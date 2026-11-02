package com.voyagewright.landfall;

import android.app.Activity;
import android.app.Dialog;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import android.view.ViewGroup;
import android.view.TextureView;
import android.widget.FrameLayout;
import com.google.ar.core.*;
import java.nio.*;
import java.util.*;
import java.util.function.Consumer;
import java.util.concurrent.*;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;
import org.json.*;

/** Local foreground ARCore provider. Camera images and geometry never cross the bridge. */
final class ParallaxLocalRuntime implements GLSurfaceView.Renderer {
  private final Activity activity;
  private final Consumer<JSONObject> emit;
  private Session session;
  private Dialog dialog;
  private GLSurfaceView surface;
  private TextureView modelTarget;
  private android.view.Choreographer.FrameCallback softwareFrame;
  final boolean softwareFixture;
  private ParallaxInteractionView controls;
  private JSONArray pending;
  private Set<String> pendingSurfaceQuads = new HashSet<>();
  private final List<Entity> entities = new ArrayList<>();
  private Frame frame;
  private int width, height, cameraTexture, cameraProgram, entityProgram;
  private volatile String tracking = "INITIALIZING", selected;
  private volatile boolean active;
  final ParallaxSceneTransfer transfer;
  private final Runnable terminated;
  private boolean stopped;
  private volatile boolean sceneLoading = true, sceneLoadFailed;
  private int normalFrames;
  private ParallaxModelRenderer modelRenderer;
  private final ParallaxModelCache modelCache;
  private final ExecutorService assetWorker = Executors.newSingleThreadExecutor();
  private final Map<String, byte[]> sessionAssets = new ConcurrentHashMap<>();
  private int activationGeneration;
  private int pendingGeneration;
  private int materializedGeneration, modelActivationGeneration;
  private Consumer<Boolean> pendingActivation;
  private String modelSignature = "";
  private ModelFrame latestModelFrame;
  private boolean modelFramePosted;

  private static final class ModelFrame {
    float[] projection, camera;
    Map<String, float[]> transforms = new HashMap<>();
    Set<String> visible = new HashSet<>();
    boolean tracking;
    float brightness;
    long timestamp;
    int generation;
  }

  private static final class Entity {
    String id, content;
    float width, scale, opacity;
    int texture;
    Anchor anchor;
    Pose authoredPose, localDelta = Pose.IDENTITY;
    boolean model, surfaceQuad, visible = true, selectable = true;
    JSONObject definition;
  }

  ParallaxLocalRuntime(Activity activity, Consumer<JSONObject> emit, String sessionId, int epoch, Runnable terminated) {
    this(activity, emit, sessionId, epoch, terminated, 1, null, null, BuildConfig.LANDFALL_ORIGIN);
  }

  ParallaxLocalRuntime(Activity activity, Consumer<JSONObject> emit, String sessionId, int epoch,
      Runnable terminated, int version, String checksum, String instance, String origin) {
    this(activity, emit, sessionId, epoch, terminated, version, checksum, instance, origin, false);
  }
  ParallaxLocalRuntime(Activity activity, Consumer<JSONObject> emit, String sessionId, int epoch,
      Runnable terminated, int version, String checksum, String instance, String origin, boolean requestedFixture) {
    this.transfer = new ParallaxSceneTransfer(sessionId, epoch, version, checksum, instance);
    this.terminated = terminated;
    this.activity = activity;
    this.emit = emit;
    this.softwareFixture = BuildConfig.DEBUG && ParallaxModelCache.allowedSoftwareFixture(true, origin, requestedFixture);
    this.modelCache = new ParallaxModelCache(activity, origin, softwareFixture);
  }

  static JSONObject state(Activity a) throws JSONException {
    return new JSONObject()
        .put("sceneTransferVersion", 1)
        .put("sceneDeliveryVersions", new JSONArray().put(1).put(2))
        .put("capabilities", new JSONArray().put("WORLD_TRACKING").put("PLANE_PLACEMENT").put("MODEL_GLB"))
        .put("supported", ArCoreApk.getInstance().checkAvailability(a).isSupported())
        .put(
            "permission",
            a.checkSelfPermission(android.Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED
                ? "GRANTED"
                : "PROMPT");
  }

  boolean start() {
    if (stopped || active) return false;
    try {
      boolean depthSupported = false;
      if (!(BuildConfig.DEBUG && softwareFixture)) {
        if (activity.checkSelfPermission(android.Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED) return false;
        if (ArCoreApk.getInstance().requestInstall(activity, true)
            != ArCoreApk.InstallStatus.INSTALLED) return false;
        session = new Session(activity);
        Config config = new Config(session);
        config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
        // Depth acquisition is available only on supported devices. This overlay does not claim occlusion.
        depthSupported = session.isDepthModeSupported(Config.DepthMode.AUTOMATIC);
        config.setDepthMode(Config.DepthMode.DISABLED);
        config.setLightEstimationMode(Config.LightEstimationMode.AMBIENT_INTENSITY);
        session.configure(config);
      } else if (transfer.deliveryVersion != 2) return false;
      dialog = new Dialog(activity, android.R.style.Theme_Material_NoActionBar_Fullscreen);
      FrameLayout root = new FrameLayout(activity);
      root.setBackgroundColor(0xff0a1212);
      if (!(BuildConfig.DEBUG && softwareFixture)) {
        surface = new GLSurfaceView(activity);
        surface.setEGLContextClientVersion(2);
        surface.setPreserveEGLContextOnPause(true);
        surface.setRenderer(this);
        root.addView(surface);
      }
      TextureView models = null;
      if (transfer.deliveryVersion == 2) {
        models = new TextureView(activity);
        models.setOpaque(false);
        root.addView(models, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        modelRenderer = new ParallaxModelRenderer(models);
        modelTarget = models;
      }
      android.view.View touchTarget = models == null ? surface : models;
      controls = new ParallaxInteractionView(activity, touchTarget, this::pickAt,
          hit -> { selected = hit; updateControls(); if (hit != null) interaction("PICK"); },
          this::interaction, this::stop, softwareFixture);
      FrameLayout.LayoutParams bottom =
          new FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
              android.view.Gravity.BOTTOM);
      root.addView(controls, bottom);
      if (BuildConfig.DEBUG && softwareFixture) {
        android.widget.TextView fidelity = new android.widget.TextView(activity);
        fidelity.setText("Device Lab: camera-free software fixture. No AR tracking or physical proof.");
        fidelity.setTextColor(Color.WHITE); fidelity.setBackgroundColor(0xff35220a);
        fidelity.setTextSize(16); fidelity.setPadding(16, 16, 16, 16);
        root.addView(fidelity, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT, android.view.Gravity.TOP));
      }
      dialog.setContentView(root);
      bindDismissal(dialog);
      if (session != null) session.resume();
      active = true;
      dialog.show();
      if (surface != null) surface.onResume();
      if (BuildConfig.DEBUG && softwareFixture) {
        softwareFrame = this::softwareFrame;
        android.view.Choreographer.getInstance().postFrameCallback(softwareFrame);
      } else emit.accept(new JSONObject().put("type", "parallax-capabilities")
          .put("sessionId", transfer.sessionId).put("epoch", transfer.epoch)
          .put("depthSupported", depthSupported).put("depthOcclusion", false)
          .put("renderer", "FILAMENT_1_75_1_GLB_OVERLAY"));
      return true;
    } catch (Exception e) {
      stop();
      return false;
    }
  }

  // Kept separate from ARCore acquisition so the OS Dialog lifecycle is testable without camera/tracking claims.
  void bindDismissal(Dialog owned) { owned.setOnDismissListener(d -> stop()); }

  private void pickAt(float x, float y, Consumer<String> result) {
    if (!active || sceneLoading || !(softwareFixture || tracking.equals("NORMAL"))) { result.accept(null); return; }
    if (modelRenderer == null) { pickQuad(x, y, result); return; }
    modelRenderer.pick(x, y, hit -> {
      if (!active || sceneLoading || !(softwareFixture || tracking.equals("NORMAL"))) return;
      if (hit != null && selectable(hit)) result.accept(hit);
      else if (softwareFixture) result.accept(null);
      else pickQuad(x, y, result);
    });
  }

  private void pickQuad(float x, float y, Consumer<String> result) {
    GLSurfaceView owned = surface;
    if (owned == null) return;
    owned.queueEvent(() -> {
      String hit = pick(x, y);
      activity.runOnUiThread(() -> result.accept(hit));
    });
  }

  private String pick(float x, float y) {
    if (!active || frame == null || !tracking.equals("NORMAL")) return null;
    float[] projection = new float[16],
        view = new float[16],
        model = new float[16],
        mv = new float[16],
        mvp = new float[16],
        inverse = new float[16];
    frame.getCamera().getProjectionMatrix(projection, 0, 0.01f, 100);
    frame.getCamera().getViewMatrix(view, 0);
    String hit = null;
    float nearest = Float.MAX_VALUE;
    synchronized (entities) {
      for (Entity e : entities) {
        if (e.model || !e.visible || !e.selectable || e.opacity <= 0
            || e.anchor.getTrackingState() != TrackingState.TRACKING) continue;
        geometryPose(e).toMatrix(model, 0);
        Matrix.scaleM(model, 0, e.width * e.scale / 2, e.width * 0.7f * e.scale / 2, 1);
        Matrix.multiplyMM(mv, 0, view, 0, model, 0);
        Matrix.multiplyMM(mvp, 0, projection, 0, mv, 0);
        if (!Matrix.invertM(inverse, 0, mvp, 0)) continue;
        float[] a = new float[4], b = new float[4];
        Matrix.multiplyMV(
            a, 0, inverse, 0, new float[] {2 * x / width - 1, 1 - 2 * y / height, -1, 1}, 0);
        Matrix.multiplyMV(
            b, 0, inverse, 0, new float[] {2 * x / width - 1, 1 - 2 * y / height, 1, 1}, 0);
        if (Math.abs(a[3]) < 1e-6 || Math.abs(b[3]) < 1e-6) continue;
        for (int i = 0; i < 3; i++) {
          a[i] /= a[3];
          b[i] /= b[3];
        }
        float dz = b[2] - a[2];
        if (Math.abs(dz) < 1e-6) continue;
        float t = -a[2] / dz;
        float hx = a[0] + t * (b[0] - a[0]), hy = a[1] + t * (b[1] - a[1]);
        if (t >= 0 && t <= 1 && Math.abs(hx) <= 1 && Math.abs(hy) <= 1 && t < nearest) {
          hit = e.id;
          nearest = t;
        }
      }
    }
    return hit;
  }

  private boolean selectable(String id) {
    synchronized (entities) { for (Entity e : entities) if (e.id.equals(id)) return e.visible && e.opacity > 0 && e.selectable && entityTracked(e); }
    return false;
  }

  private static Pose geometryPose(Entity entity) {
    Pose root = entityPose(entity);
    // ARCore plane poses expose +Y as their normal. Only the child quad changes its facing axis.
    return entity.surfaceQuad ? root.compose(new Pose(new float[] {0, 0, 0},
        new float[] {-(float) Math.sqrt(0.5), 0, 0, (float) Math.sqrt(0.5)})) : root;
  }

  private void interaction(String action) {
    if (!active || sceneLoading || sceneLoadFailed || !(softwareFixture || tracking.equals("NORMAL"))
        || (softwareFixture && action.equals("PLACE"))) return;
    String id = selected;
    boolean found = false;
    synchronized (entities) {
      for (Entity e : entities) if (e.id.equals(id)) {
        if (!e.visible || e.opacity <= 0 || !e.selectable || !entityTracked(e)) return;
        JSONArray actions = e.definition.optJSONArray("interactions");
        if (actions != null) { boolean allowed = false; for (int i = 0; i < actions.length(); i++) if (actions.optString(i).equals(action)) allowed = true; if (!allowed) return; }
        found = true;
      }
    }
    if (id == null || !found) return;
    // INSPECT is an intent. The existing Player records it and presents its accepted or retryable outcome.
    try {
      JSONObject intent = interactionIntent(transfer, id, action);
      if (BuildConfig.DEBUG && softwareFixture) intent.put("type", "parallax-lab-interaction").put("synthetic", true);
      emit.accept(intent);
    } catch (JSONException ignored) {
    }
  }

  static JSONObject interactionIntent(ParallaxSceneTransfer transfer, String entityId, String action) throws JSONException {
    return new JSONObject().put("sessionId", transfer.sessionId).put("epoch", transfer.epoch)
        .put("type", "parallax-interaction").put("entityId", entityId).put("interactionType", action);
  }

  private void updateControls() {
    activity.runOnUiThread(() -> {
      if (controls == null || !active) return;
      Set<String> actions = new HashSet<>();
      synchronized (entities) {
        for (Entity entity : entities) if (entity.id.equals(selected) && entity.visible && entity.opacity > 0 && entity.selectable
            && entityTracked(entity)) {
          JSONArray allowed = entity.definition.optJSONArray("interactions");
          if (allowed == null) actions.addAll(Arrays.asList("PICK", "INSPECT", "PLACE"));
          else for (int i = 0; i < allowed.length(); i++) actions.add(allowed.optString(i));
        }
      }
      controls.update(tracking, sceneLoading, sceneLoadFailed, actions);
    });
  }

  private void tracking(String value) {
    normalFrames = value.equals("NORMAL") ? normalFrames + 1 : 0;
    if (value.equals(tracking) && (!value.equals("NORMAL") || normalFrames > 3)) return;
    tracking = value;
    activity.runOnUiThread(
        () -> {
          if (!active) return;
          updateControls();
          try {
            emit.accept(new JSONObject().put("sessionId", transfer.sessionId).put("epoch", transfer.epoch).put("type", "parallax-tracking").put("state", value));
          } catch (JSONException ignored) {
          }
        });
  }

  synchronized JSONObject placement(String alignment) throws JSONException {
    if (softwareFixture || frame == null || !tracking.equals("NORMAL"))
      return new JSONObject().put("pose", JSONObject.NULL);
    for (HitResult hit : frame.hitTest(width / 2f, height / 2f))
      if (hit.getTrackable() instanceof Plane) {
        Plane p = (Plane) hit.getTrackable();
        boolean vertical = p.getType() == Plane.Type.VERTICAL;
        if (p.isPoseInPolygon(hit.getHitPose()) && vertical == alignment.equals("VERTICAL"))
          return new JSONObject().put("pose", serialize(hit.getHitPose()));
      }
    return new JSONObject().put("pose", JSONObject.NULL);
  }

  private static JSONObject serialize(Pose p) throws JSONException {
    return new JSONObject()
        .put("position", new JSONObject().put("x", p.tx()).put("y", p.ty()).put("z", p.tz()))
        .put(
            "rotation",
            new JSONObject().put("x", p.qx()).put("y", p.qy()).put("z", p.qz()).put("w", p.qw()))
        .put("scale", 1);
  }

  synchronized boolean render(JSONArray input) {
    if (!active || !ParallaxSceneTransfer.validEntities(input)) return false;
    pending = input;
    pendingSurfaceQuads = new HashSet<>();
    sceneLoading = true; sceneLoadFailed = false; updateControls();
    return true;
  }

  void renderScene(JSONObject scene, Consumer<Boolean> completed) {
    if (!active) { completed.accept(false); return; }
    if (scene.optInt("schemaVersion") == 1) { completed.accept(render(scene.optJSONArray("entities"))); return; }
    final int generation = ++activationGeneration;
    sceneLoading = true; sceneLoadFailed = false; updateControls();
    if (pendingActivation != null) pendingActivation.accept(false);
    pendingActivation = completed;
    final JSONArray input = scene.optJSONArray("entities");
    final StringBuilder signature = new StringBuilder();
    for (int i = 0; i < input.length(); i++) {
      JSONObject entity = input.optJSONObject(i), model = entity.optJSONObject("model");
      if (model != null) signature.append(entity.optString("id")).append(':').append(model.optString("sha256")).append(';');
    }
    new android.os.Handler(activity.getMainLooper()).postDelayed(() -> {
      if (active && generation == activationGeneration && pendingActivation != null) {
        stop();
      }
    }, 60000);
    assetWorker.submit(() -> {
      Map<String, byte[]> assets = new HashMap<>();
      try {
        for (int i = 0; i < input.length(); i++) {
          JSONObject entity = input.getJSONObject(i), model = entity.optJSONObject("model");
          if (model == null) continue;
          String digest = model.getString("sha256"); byte[] bytes = sessionAssets.get(digest);
          if (bytes == null) { bytes = modelCache.load(model); sessionAssets.put(digest, bytes); }
          assets.put(entity.getString("id"), bytes);
        }
        activity.runOnUiThread(() -> {
          if (!active || generation != activationGeneration) return;
          try {
            if (!signature.toString().equals(modelSignature)) { modelRenderer.activate(assets); modelSignature = signature.toString(); }
            modelActivationGeneration = generation;
            Set<String> surfaceQuads = new HashSet<>();
            for (int i = 0; i < input.length(); i++) {
              JSONObject entity = input.optJSONObject(i);
              if (ParallaxSceneDelivery.surfaceQuadCorrection(scene, entity)) surfaceQuads.add(entity.optString("id"));
            }
            synchronized (this) { pending = input; pendingGeneration = generation; pendingSurfaceQuads = surfaceQuads; }
          } catch (RuntimeException failure) { finishActivation(false); }
        });
      } catch (Exception failure) {
        activity.runOnUiThread(() -> { if (generation == activationGeneration) finishActivation(false); });
      }
    });
  }

  private void finishActivation(boolean success) {
    Consumer<Boolean> reply = pendingActivation; pendingActivation = null;
    sceneLoading = false; sceneLoadFailed = !success; updateControls();
    transfer.completeActivation();
    if (reply != null) reply.accept(success && active);
  }

  boolean abortScene(JSONObject payload) {
    boolean canceledStaging = transfer.stagedMatches(payload);
    boolean accepted = transfer.abort(payload);
    // Ending the owned foreground provider makes a canceled COMMIT incapable of resurfacing late.
    if (canceledStaging) stop();
    return accepted;
  }

  void stop() {
    if (stopped) return;
    stopped = true;
    boolean wasActive = active;
    active = false;
    if (controls != null) { controls.close(); controls = null; }
    if (BuildConfig.DEBUG && softwareFrame != null) {
      android.view.Choreographer.getInstance().removeFrameCallback(softwareFrame); softwareFrame = null;
    }
    activationGeneration++; finishActivation(false); assetWorker.shutdownNow(); sessionAssets.clear();
    if (modelRenderer != null) { modelRenderer.close(); modelRenderer = null; }
    transfer.clear();
    pending = null; selected = null; tracking = "INTERRUPTED"; normalFrames = 0;
    latestModelFrame = null; modelFramePosted = false;
    if (surface != null) {
      surface.queueEvent(() -> {
        synchronized (entities) {
          for (Entity e : entities) if (e.texture != 0) GLES20.glDeleteTextures(1, new int[] {e.texture}, 0);
        }
        if (cameraTexture != 0) GLES20.glDeleteTextures(1, new int[] {cameraTexture}, 0);
        if (cameraProgram != 0) GLES20.glDeleteProgram(cameraProgram);
        if (entityProgram != 0) GLES20.glDeleteProgram(entityProgram);
        cameraTexture = cameraProgram = entityProgram = 0;
      });
      surface.onPause();
    }
    if (session != null) {
      try {
        session.pause();
      } catch (Exception ignored) {
      }
      synchronized (entities) {
        for (Entity e : entities) if (e.anchor != null) e.anchor.detach();
        entities.clear();
      }
      session.close();
      session = null;
    }
    synchronized (entities) { entities.clear(); }
    Dialog old = dialog;
    dialog = null;
    if (old != null) { old.setOnDismissListener(null); if (old.isShowing()) old.dismiss(); }
    surface = null; modelTarget = null;
    terminated.run();
    if (wasActive) { try { emit.accept(new JSONObject().put("type", "parallax-tracking").put("state", "INTERRUPTED").put("sessionId", transfer.sessionId).put("epoch", transfer.epoch)); } catch (JSONException ignored) {} }
    frame = null;
  }

  private static FloatBuffer floats(float... v) {
    FloatBuffer b =
        ByteBuffer.allocateDirect(v.length * 4).order(ByteOrder.nativeOrder()).asFloatBuffer();
    b.put(v);
    b.position(0);
    return b;
  }

  private static int shader(int type, String source) {
    int s = GLES20.glCreateShader(type);
    GLES20.glShaderSource(s, source);
    GLES20.glCompileShader(s);
    int[] status = new int[1];
    GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, status, 0);
    if (status[0] == 0) throw new IllegalStateException("PARALLAX_SHADER_INVALID");
    return s;
  }

  private static int program(String fragment) {
    int p = GLES20.glCreateProgram();
    GLES20.glAttachShader(
        p,
        shader(
            GLES20.GL_VERTEX_SHADER,
            "attribute vec2 vertex;attribute vec2 uv;uniform mat4 mvp;varying vec2 tex;void"
                + " main(){tex=uv;gl_Position=mvp*vec4(vertex,0.0,1.0);}"));
    GLES20.glAttachShader(p, shader(GLES20.GL_FRAGMENT_SHADER, fragment));
    GLES20.glLinkProgram(p);
    int[] result = new int[1];
    GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, result, 0);
    if (result[0] == 0) throw new IllegalStateException("PARALLAX_PROGRAM_INVALID");
    return p;
  }

  @Override
  public void onSurfaceCreated(GL10 gl, EGLConfig config) {
    int[] texture = new int[1];
    GLES20.glGenTextures(1, texture, 0);
    cameraTexture = texture[0];
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTexture);
    GLES20.glTexParameteri(
        GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
    GLES20.glTexParameteri(
        GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
    cameraProgram =
        program(
            "#extension GL_OES_EGL_image_external : require\n"
                + "precision mediump float;uniform samplerExternalOES image;varying vec2 tex;void"
                + " main(){gl_FragColor=texture2D(image,tex);}");
    entityProgram =
        program(
            "precision mediump float;uniform sampler2D image;uniform float opacity;varying vec2 tex;void"
                + " main(){vec4 color=texture2D(image,tex);gl_FragColor=vec4(color.rgb,color.a*opacity);}");
  }

  @Override
  public void onSurfaceChanged(GL10 gl, int w, int h) {
    width = w;
    height = h;
    GLES20.glViewport(0, 0, w, h);
  }

  private void quad(
      int p, int target, int texture, float[] mvp, FloatBuffer vertices, FloatBuffer uv) {
    GLES20.glUseProgram(p);
    int v = GLES20.glGetAttribLocation(p, "vertex"), u = GLES20.glGetAttribLocation(p, "uv");
    GLES20.glEnableVertexAttribArray(v);
    GLES20.glEnableVertexAttribArray(u);
    GLES20.glVertexAttribPointer(v, 2, GLES20.GL_FLOAT, false, 0, vertices);
    GLES20.glVertexAttribPointer(u, 2, GLES20.GL_FLOAT, false, 0, uv);
    GLES20.glUniformMatrix4fv(GLES20.glGetUniformLocation(p, "mvp"), 1, false, mvp, 0);
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
    GLES20.glBindTexture(target, texture);
    GLES20.glUniform1i(GLES20.glGetUniformLocation(p, "image"), 0);
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
    GLES20.glDisableVertexAttribArray(v);
    GLES20.glDisableVertexAttribArray(u);
  }

  private synchronized void materialize() throws Exception {
    if (pending == null) return;
    JSONArray input = pending;
    int committedGeneration = pendingGeneration;
    pending = null;
    List<Entity> next = new ArrayList<>();
    Map<String, Entity> previous = new HashMap<>();
    synchronized (entities) { for (Entity old : entities) previous.put(old.id, old); }
    Set<Anchor> reused = new HashSet<>();
    try {
    for (int i = 0; i < input.length(); i++) {
      JSONObject j = input.getJSONObject(i),
          t = j.getJSONObject("transform"),
          p = t.getJSONObject("position"),
          q = t.getJSONObject("rotation");
      Entity e = new Entity();
      next.add(e);
      e.id = j.getString("id");
      e.definition = j;
      e.content = j.getString("content");
      e.width = (float) j.getDouble("widthMeters");
      e.opacity = (float) j.optDouble("opacity", 1);
      e.scale = (float) t.getDouble("scale");
      e.model = j.has("model"); e.visible = j.optBoolean("visible", true); e.selectable = j.optBoolean("selectable", true);
      e.surfaceQuad = pendingSurfaceQuads.contains(e.id);
      Pose desired = new Pose(
                  new float[] {
                    (float) p.getDouble("x"), (float) p.getDouble("y"), (float) p.getDouble("z")
                  },
                  new float[] {
                    (float) q.getDouble("x"),
                    (float) q.getDouble("y"),
                    (float) q.getDouble("z"),
                    (float) q.getDouble("w")
                  });
      Entity old = previous.get(e.id);
      if (BuildConfig.DEBUG && softwareFixture) { e.authoredPose = desired; }
      else if (old != null && old.anchor.getTrackingState() != TrackingState.STOPPED) {
        e.anchor = old.anchor; e.authoredPose = old.authoredPose;
        e.localDelta = e.authoredPose.inverse().compose(desired); reused.add(e.anchor);
      } else { e.anchor = session.createAnchor(desired); e.authoredPose = desired; }
      if (e.model) { e.scale *= e.width / (float) j.getJSONObject("model").getDouble("sourceWidthMeters"); continue; }
      if (BuildConfig.DEBUG && softwareFixture) throw new IllegalArgumentException("PARALLAX_LAB_REQUIRES_GLB");
      Bitmap image = Bitmap.createBitmap(1024, 716, Bitmap.Config.ARGB_8888);
      Canvas canvas = new Canvas(image);
      canvas.drawColor(0xffecddba);
      Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
      paint.setColor(0xff302718);
      paint.setTextSize(38);
      int line = 0;
      for (String wordLine : e.content.split("(?<=\\G.{38})"))
        canvas.drawText(wordLine, 50, 80 + (line++) * 48, paint);
      int[] texture = new int[1];
      GLES20.glGenTextures(1, texture, 0);
      e.texture = texture[0];
      GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, e.texture);
      GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
      GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
      // GLES 2 requires edge clamping for our non-power-of-two parchment texture.
      GLES20.glTexParameteri(
          GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
      GLES20.glTexParameteri(
          GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
      GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, image, 0);
      image.recycle();
    }
    } catch (Exception failure) {
      for (Entity e : next) { if (e.anchor != null && !reused.contains(e.anchor)) e.anchor.detach(); if (e.texture != 0) GLES20.glDeleteTextures(1, new int[]{e.texture}, 0); }
      throw failure;
    }
    synchronized (entities) {
      for (Entity e : entities) {
        if (e.anchor != null && !reused.contains(e.anchor)) e.anchor.detach();
        if (e.texture != 0) GLES20.glDeleteTextures(1, new int[] {e.texture}, 0);
      }
      entities.clear();
      entities.addAll(next);
      selected = ParallaxSceneDelivery.retainedSelection(selected, input);
    }
    materializedGeneration = committedGeneration;
    activity.runOnUiThread(() -> { if (committedGeneration == activationGeneration) finishActivation(true); });
  }

  private void publishModels(Camera camera, long timestamp) {
    ModelFrame snapshot = new ModelFrame(); snapshot.projection = new float[16]; snapshot.camera = new float[16];
    camera.getProjectionMatrix(snapshot.projection, 0, 0.01f, 100);
    camera.getDisplayOrientedPose().toMatrix(snapshot.camera, 0);
    snapshot.tracking = tracking.equals("NORMAL"); snapshot.timestamp = timestamp;
    snapshot.generation = materializedGeneration;
    snapshot.brightness = frame.getLightEstimate().getState() == LightEstimate.State.VALID
        ? frame.getLightEstimate().getPixelIntensity() : 1;
    synchronized (entities) {
      for (Entity entity : entities) {
        if (!entity.model) continue;
        float[] matrix = new float[16]; entity.anchor.getPose().compose(entity.localDelta).toMatrix(matrix, 0);
        Matrix.scaleM(matrix, 0, entity.scale, entity.scale, entity.scale);
        snapshot.transforms.put(entity.id, matrix);
        if (entity.visible && entity.opacity > 0 && entity.anchor.getTrackingState() == TrackingState.TRACKING) snapshot.visible.add(entity.id);
      }
    }
    latestModelFrame = snapshot;
    if (modelFramePosted) return;
    modelFramePosted = true;
    activity.runOnUiThread(() -> {
      ModelFrame ready;
      synchronized (this) { ready = latestModelFrame; latestModelFrame = null; modelFramePosted = false; }
      if (active && modelRenderer != null && ready != null)
        modelRenderer.frame(ready.projection, ready.camera, ready.transforms, ready.visible,
            ready.tracking && ready.generation == modelActivationGeneration, ready.brightness, ready.timestamp);
    });
  }

  private boolean entityTracked(Entity entity) {
    return softwareFixture || (entity.anchor != null && entity.anchor.getTrackingState() == TrackingState.TRACKING);
  }
  private static Pose entityPose(Entity entity) {
    return entity.anchor == null ? entity.authoredPose : entity.anchor.getPose().compose(entity.localDelta);
  }

  /** The DEBUG loopback lab supplies a fixed camera, never an ARCore frame, anchor, plane or NORMAL event. */
  private void softwareFrame(long timestamp) {
    if (BuildConfig.DEBUG) {
    if (!active || !softwareFixture || modelRenderer == null || modelTarget == null) return;
    try {
      materialize();
      int w = modelTarget.getWidth(), h = modelTarget.getHeight();
      if (w > 0 && h > 0) {
        float[] projection = new float[16], camera = new float[16];
        Matrix.perspectiveM(projection, 0, 45, (float) w / h, 0.01f, 100);
        Matrix.setIdentityM(camera, 0);
        Map<String, float[]> transforms = new HashMap<>(); Set<String> visible = new HashSet<>();
        synchronized (entities) {
          for (Entity entity : entities) {
            float[] matrix = new float[16]; entityPose(entity).toMatrix(matrix, 0);
            Matrix.scaleM(matrix, 0, entity.scale, entity.scale, entity.scale);
            transforms.put(entity.id, matrix); if (entity.visible && entity.opacity > 0) visible.add(entity.id);
          }
        }
        // This flag controls renderer visibility only; the lab never publishes world-tracking observations.
        modelRenderer.frame(projection, camera, transforms, visible,
            materializedGeneration == modelActivationGeneration, 1, timestamp);
      }
    } catch (Exception failure) { stop(); return; }
    if (active && softwareFrame != null) android.view.Choreographer.getInstance().postFrameCallback(softwareFrame);
    }
  }

  @Override
  public synchronized void onDrawFrame(GL10 gl) {
    if (!active || session == null) return;
    try {
      session.setDisplayGeometry(
          activity.getWindowManager().getDefaultDisplay().getRotation(), width, height);
      session.setCameraTextureName(cameraTexture);
      Frame f = session.update();
      synchronized (this) {
        frame = f;
      }
      Camera camera = f.getCamera();
      FloatBuffer vertices = floats(-1, -1, 1, -1, -1, 1, 1, 1),
          uv = floats(0, 0, 1, 0, 0, 1, 1, 1);
      f.transformCoordinates2d(
          Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
          vertices,
          Coordinates2d.TEXTURE_NORMALIZED,
          uv);
      float[] identity = new float[16];
      Matrix.setIdentityM(identity, 0);
      GLES20.glDisable(GLES20.GL_DEPTH_TEST);
      quad(cameraProgram, GLES11Ext.GL_TEXTURE_EXTERNAL_OES, cameraTexture, identity, vertices, uv);
      if (camera.getTrackingState() != TrackingState.TRACKING) {
        tracking(
            camera.getTrackingFailureReason() == TrackingFailureReason.INSUFFICIENT_LIGHT
                ? "LIMITED_LOW_LIGHT"
                : "LOST");
        publishModels(camera, System.nanoTime());
        return;
      }
      tracking("NORMAL");
      materialize();
      float[] projection = new float[16],
          view = new float[16],
          model = new float[16],
          mv = new float[16],
          mvp = new float[16];
      camera.getProjectionMatrix(projection, 0, 0.01f, 100);
      camera.getViewMatrix(view, 0);
      GLES20.glEnable(GLES20.GL_DEPTH_TEST);
      GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT);
      synchronized (entities) {
        for (Entity e : entities) {
          if (e.anchor.getTrackingState() != TrackingState.TRACKING) {
            tracking("RELOCALIZING");
            continue;
          }
          if (e.model || !e.visible || e.opacity <= 0) continue;
          geometryPose(e).toMatrix(model, 0);
          Matrix.scaleM(model, 0, e.width * e.scale / 2, e.width * 0.7f * e.scale / 2, 1);
          Matrix.multiplyMM(mv, 0, view, 0, model, 0);
          Matrix.multiplyMM(mvp, 0, projection, 0, mv, 0);
          if (e.opacity < 1) { GLES20.glEnable(GLES20.GL_BLEND); GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA); GLES20.glDepthMask(false); }
          GLES20.glUseProgram(entityProgram);
          GLES20.glUniform1f(GLES20.glGetUniformLocation(entityProgram, "opacity"), e.opacity);
          quad(
              entityProgram,
              GLES20.GL_TEXTURE_2D,
              e.texture,
              mvp,
              floats(-1, -1, 1, -1, -1, 1, 1, 1),
              floats(0, 1, 1, 1, 0, 0, 1, 0));
          GLES20.glDepthMask(true); GLES20.glDisable(GLES20.GL_BLEND);
        }
      }
      publishModels(camera, System.nanoTime());
    } catch (Exception e) {
      activity.runOnUiThread(this::stop);
    }
  }
}
