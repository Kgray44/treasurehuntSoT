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
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.ar.core.*;
import java.nio.*;
import java.util.*;
import java.util.function.Consumer;
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
  private TextView status;
  private JSONArray pending = new JSONArray();
  private final List<Entity> entities = new ArrayList<>();
  private Frame frame;
  private int width, height, cameraTexture, cameraProgram, entityProgram;
  private volatile String tracking = "INITIALIZING", selected;
  private boolean active;
  private int normalFrames;

  private static final class Entity {
    String id, content;
    float width, scale;
    int texture;
    Anchor anchor;
  }

  ParallaxLocalRuntime(Activity activity, Consumer<JSONObject> emit) {
    this.activity = activity;
    this.emit = emit;
  }

  static JSONObject state(Activity a) throws JSONException {
    return new JSONObject()
        .put("supported", ArCoreApk.getInstance().checkAvailability(a).isSupported())
        .put(
            "permission",
            a.checkSelfPermission(android.Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED
                ? "GRANTED"
                : "PROMPT");
  }

  boolean start() {
    try {
      if (activity.checkSelfPermission(android.Manifest.permission.CAMERA)
          != PackageManager.PERMISSION_GRANTED) return false;
      if (ArCoreApk.getInstance().requestInstall(activity, true)
          != ArCoreApk.InstallStatus.INSTALLED) return false;
      session = new Session(activity);
      Config config = new Config(session);
      config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);
      session.configure(config);
      dialog = new Dialog(activity, android.R.style.Theme_Material_NoActionBar_Fullscreen);
      FrameLayout root = new FrameLayout(activity);
      surface = new GLSurfaceView(activity);
      surface.setEGLContextClientVersion(2);
      surface.setPreserveEGLContextOnPause(true);
      surface.setRenderer(this);
      root.addView(surface);
      LinearLayout controls = new LinearLayout(activity);
      controls.setOrientation(LinearLayout.VERTICAL);
      controls.setPadding(24, 24, 24, 24);
      controls.setBackgroundColor(0xcf0c202b);
      status = new TextView(activity);
      status.setTextColor(Color.WHITE);
      status.setText("Move your device slowly. Guided View remains available.");
      controls.addView(status);
      for (String action : new String[] {"INSPECT", "PLACE", "GUIDED"}) {
        Button b = new Button(activity);
        b.setText(
            action.equals("INSPECT")
                ? "Inspect object"
                : action.equals("PLACE") ? "Place on a surface" : "Return to Guided View");
        b.setTextColor(Color.WHITE);
        b.setBackgroundTintList(android.content.res.ColorStateList.valueOf(0xff16303b));
        b.setMinHeight(48);
        controls.addView(b);
        b.setOnClickListener(
            v -> {
              if (action.equals("GUIDED")) {
                tracking("INTERRUPTED");
                stop();
              } else interaction(action);
            });
      }
      FrameLayout.LayoutParams bottom =
          new FrameLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              ViewGroup.LayoutParams.WRAP_CONTENT,
              android.view.Gravity.BOTTOM);
      root.addView(controls, bottom);
      surface.setOnTouchListener(
          (v, event) -> {
            if (event.getAction() == android.view.MotionEvent.ACTION_UP
                && tracking.equals("NORMAL")) {
              float tapX = event.getX(), tapY = event.getY();
              surface.queueEvent(() -> pick(tapX, tapY));
              v.performClick();
              return true;
            }
            return true;
          });
      dialog.setContentView(root);
      dialog.setOnDismissListener(d -> stop());
      session.resume();
      active = true;
      dialog.show();
      surface.onResume();
      return true;
    } catch (Exception e) {
      stop();
      return false;
    }
  }

  private void pick(float x, float y) {
    if (frame == null || !tracking.equals("NORMAL")) return;
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
        e.anchor.getPose().toMatrix(model, 0);
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
    if (hit != null) {
      selected = hit;
      activity.runOnUiThread(() -> interaction("PICK"));
    }
  }

  private void interaction(String action) {
    if (!tracking.equals("NORMAL")) return;
    String id = selected, content = null;
    synchronized (entities) {
      if (id == null && !entities.isEmpty()) id = entities.get(0).id;
      for (Entity e : entities) if (e.id.equals(id)) content = e.content;
    }
    if (id == null) return;
    if (action.equals("INSPECT"))
      new android.app.AlertDialog.Builder(activity)
          .setTitle("Inspect object")
          .setMessage(content)
          .setPositiveButton("Return to the Lens", (d, w) -> {})
          .show();
    try {
      emit.accept(
          new JSONObject()
              .put("type", "parallax-interaction")
              .put("entityId", id)
              .put("interactionType", action));
    } catch (JSONException ignored) {
    }
  }

  private void tracking(String value) {
    normalFrames = value.equals("NORMAL") ? normalFrames + 1 : 0;
    if (value.equals(tracking) && (!value.equals("NORMAL") || normalFrames > 3)) return;
    tracking = value;
    activity.runOnUiThread(
        () -> {
          if (status != null)
            status.setText(
                value.equals("NORMAL")
                    ? "Tap to choose the object, then inspect it."
                    : "Finding the space again. Guided View is always available.");
          try {
            emit.accept(new JSONObject().put("type", "parallax-tracking").put("state", value));
          } catch (JSONException ignored) {
          }
        });
  }

  synchronized JSONObject placement(String alignment) throws JSONException {
    if (frame == null || !tracking.equals("NORMAL"))
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
    if (!active || input.length() > 32) return false;
    try {
      for (int i = 0; i < input.length(); i++) {
        JSONObject j = input.getJSONObject(i),
            t = j.getJSONObject("transform"),
            p = t.getJSONObject("position"),
            q = t.getJSONObject("rotation");
        if (!j.getString("id").matches("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}")
            || j.getString("content").length() > 2000) return false;
        double width = j.getDouble("widthMeters"), scale = t.getDouble("scale"), norm = 0;
        if (!Double.isFinite(width)
            || width < 0.01
            || width > 5
            || !Double.isFinite(scale)
            || scale < 0.01
            || scale > 10) return false;
        for (String axis : new String[] {"x", "y", "z"}) {
          double v = p.getDouble(axis);
          if (!Double.isFinite(v) || Math.abs(v) > 10000) return false;
        }
        for (String axis : new String[] {"x", "y", "z", "w"}) {
          double v = q.getDouble(axis);
          if (!Double.isFinite(v)) return false;
          norm += v * v;
        }
        if (Math.abs(Math.sqrt(norm) - 1) > 0.00001) return false;
      }
    } catch (JSONException e) {
      return false;
    }
    pending = input;
    return true;
  }

  void stop() {
    if (!active && session == null) return;
    active = false;
    if (surface != null) surface.onPause();
    if (session != null) {
      try {
        session.pause();
      } catch (Exception ignored) {
      }
      synchronized (entities) {
        for (Entity e : entities) e.anchor.detach();
        entities.clear();
      }
      session.close();
      session = null;
    }
    Dialog old = dialog;
    dialog = null;
    if (old != null && old.isShowing()) old.dismiss();
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
            "precision mediump float;uniform sampler2D image;varying vec2 tex;void"
                + " main(){gl_FragColor=texture2D(image,tex);}");
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
    pending = null;
    List<Entity> next = new ArrayList<>();
    for (int i = 0; i < input.length(); i++) {
      JSONObject j = input.getJSONObject(i),
          t = j.getJSONObject("transform"),
          p = t.getJSONObject("position"),
          q = t.getJSONObject("rotation");
      Entity e = new Entity();
      e.id = j.getString("id");
      e.content = j.getString("content");
      e.width = (float) j.getDouble("widthMeters");
      e.scale = (float) t.getDouble("scale");
      if (e.content.length() > 2000
          || e.width < 0.01
          || e.width > 5
          || e.scale < 0.01
          || e.scale > 10) throw new IllegalArgumentException();
      e.anchor =
          session.createAnchor(
              new Pose(
                  new float[] {
                    (float) p.getDouble("x"), (float) p.getDouble("y"), (float) p.getDouble("z")
                  },
                  new float[] {
                    (float) q.getDouble("x"),
                    (float) q.getDouble("y"),
                    (float) q.getDouble("z"),
                    (float) q.getDouble("w")
                  }));
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
      next.add(e);
    }
    synchronized (entities) {
      for (Entity e : entities) {
        e.anchor.detach();
        GLES20.glDeleteTextures(1, new int[] {e.texture}, 0);
      }
      entities.clear();
      entities.addAll(next);
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
          e.anchor.getPose().toMatrix(model, 0);
          Matrix.scaleM(model, 0, e.width * e.scale / 2, e.width * 0.7f * e.scale / 2, 1);
          Matrix.multiplyMM(mv, 0, view, 0, model, 0);
          Matrix.multiplyMM(mvp, 0, projection, 0, mv, 0);
          quad(
              entityProgram,
              GLES20.GL_TEXTURE_2D,
              e.texture,
              mvp,
              floats(-1, -1, 1, -1, -1, 1, 1, 1),
              floats(0, 1, 1, 1, 0, 0, 1, 0));
        }
      }
    } catch (Exception e) {
      tracking("LOST");
    }
  }
}
