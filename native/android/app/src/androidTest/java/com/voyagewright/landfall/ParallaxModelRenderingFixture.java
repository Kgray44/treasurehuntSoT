package com.voyagewright.landfall;

import android.app.Activity;
import android.app.Dialog;
import android.opengl.Matrix;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.TextureView;
import android.view.ViewGroup;
import android.view.Gravity;
import android.widget.LinearLayout;
import androidx.test.platform.app.InstrumentationRegistry;
import com.google.android.filament.*;
import com.google.android.filament.android.UiHelper;
import com.google.android.filament.gltfio.FilamentAsset;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.CRC32;
import java.util.zip.DeflaterOutputStream;
import org.json.*;
import static org.junit.Assert.*;

/** Executes the production Filament loader/scene on an owned surface. No ARCore session or camera. */
final class ParallaxModelRenderingFixture {
  private static final float TOLERANCE = 0.0001f;
  private static void stage(String phase) { Log.i("NCL01Filament", phase); }
  private interface MainAction { void run() throws Exception; }
  private static void onMain(MainAction action) throws Exception {
    AtomicReference<Throwable> failure = new AtomicReference<>();
    InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
      try { action.run(); } catch (Throwable error) { failure.set(error); }
    });
    if (failure.get() instanceof Exception) throw (Exception) failure.get();
    if (failure.get() != null) throw new AssertionError("Owned Filament fixture failed", failure.get());
  }
  @SuppressWarnings("unchecked")
  private static <T> T field(Object owner, String name) throws Exception {
    java.lang.reflect.Field field = owner.getClass().getDeclaredField(name);
    field.setAccessible(true); return (T) field.get(owner);
  }

  static void run(Activity activity) throws Exception {
    ParallaxNativeInputFixture.verifyLargeTextEscapeLayout(activity);
    AtomicReference<Dialog> dialog = new AtomicReference<>();
    AtomicReference<ParallaxModelRenderer> runtime = new AtomicReference<>();
    AtomicReference<TextureView> target = new AtomicReference<>();
    AtomicReference<LinearLayout> inputHost = new AtomicReference<>();
    JSONArray evidence = new JSONArray();
    JSONArray inputEvidence = new JSONArray();
    Engine[] engine = new Engine[1];
    try {
      onMain(() -> {
        stage("SURFACE_CREATE_BEGIN");
        Dialog owned = new Dialog(activity, android.R.style.Theme_Material_NoActionBar_Fullscreen);
        dialog.set(owned);
        TextureView surface = new TextureView(activity); surface.setOpaque(false); target.set(surface);
        LinearLayout presentation = new LinearLayout(activity); presentation.setOrientation(LinearLayout.VERTICAL);
        presentation.setGravity(Gravity.CENTER_HORIZONTAL);
        presentation.addView(surface, new LinearLayout.LayoutParams(256, 256));
        LinearLayout controls = new LinearLayout(activity); controls.setOrientation(LinearLayout.VERTICAL);
        inputHost.set(controls); presentation.addView(controls,
            new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        owned.setContentView(presentation); owned.show();
        owned.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        stage("SURFACE_CREATE_COMPLETE");
        stage("ENGINE_CREATE_BEGIN");
        runtime.set(new ParallaxModelRenderer(surface));
        engine[0] = field(runtime.get(), "engine");
        stage("ENGINE_CREATE_COMPLETE");
      });
      stage("SURFACE_WAIT_BEGIN");
      long surfaceDeadline = SystemClock.elapsedRealtime() + 10000;
      boolean[] ready = {false};
      while (!ready[0] && SystemClock.elapsedRealtime() < surfaceDeadline) {
        onMain(() -> {
          UiHelper ui = field(runtime.get(), "ui");
          com.google.android.filament.View view = field(runtime.get(), "view");
          ready[0] = ui.isReadyToRender() && view.getViewport().width > 0 && view.getViewport().height > 0;
        });
        if (!ready[0]) SystemClock.sleep(20);
      }
      assertTrue("Owned Filament surface became available", ready[0]);
      stage("SURFACE_READY");

      for (String assetId : new String[] {"brass-compass", "treasure-chest"}) {
        String entityId = "fixture-model-" + assetId;
        String fixtureAsset = assetId.equals("brass-compass") ? "BRASS_COMPASS" : "TREASURE_CHEST";
        stage("ASSET_BEGIN:" + fixtureAsset);
        byte[] bytes;
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(assetId + ".glb")) {
          bytes = input.readAllBytes();
        }
        String expectedDigest = assetId.equals("brass-compass")
            ? "5af1158b1a7f2b3339c159fbdca8b9d3d29020eaa06d41848bf5c04c0a682ccb"
            : "2e31b5eed11242e583cfc99a5491ff2e4b10dec0d4fed5d90dffe1ccab122e6f";
        assertEquals(expectedDigest, ParallaxModelCache.digest(bytes));
        assertTrue("Only the original self-contained GLB enters the loader", ParallaxModelCache.selfContainedGlb(bytes));
        float[] dimensions = assetId.equals("brass-compass") ? new float[] {.16f, .045f, .19f} : new float[] {.8f, .61f, .5f};
        JSONObject result = new JSONObject().put("assetId", assetId).put("entityId", entityId).put("sha256", expectedDigest);
        final int[][] originalEntities = new int[1][];
        float[] rootTransform = new float[16];
        Matrix.setIdentityM(rootTransform, 0);
        Matrix.translateM(rootTransform, 0, .23f, .17f, -.31f);
        Matrix.scaleM(rootTransform, 0, 1.25f, 1.25f, 1.25f);

        onMain(() -> {
          stage("LOAD_BEGIN:" + fixtureAsset);
          runtime.get().activate(Collections.singletonMap(entityId, bytes));
          stage("LOAD_COMPLETE:" + fixtureAsset);
          Map<String, FilamentAsset> loaded = field(runtime.get(), "models");
          assertEquals("Production scene contains exactly the requested model", 1, loaded.size());
          FilamentAsset asset = loaded.get(entityId); assertNotNull(asset);
          assertTrue("gltfio created actual renderables", asset.getRenderableEntities().length > 0);
          originalEntities[0] = asset.getRenderableEntities();
          assertArrayEquals("Loader preserves a neutral entity root instead of centering/normalizing it",
              identity(), engine[0].getTransformManager().getTransform(engine[0].getTransformManager().getInstance(asset.getRoot()), new float[16]), TOLERANCE);
          float[] bounds = worldBounds(engine[0], asset);
          assertOriginalBounds(bounds, dimensions, 1, new float[] {0, 0, 0});
          Set<Long> materialInstances = new HashSet<>();
          RenderableManager renderables = engine[0].getRenderableManager();
          for (int entity : originalEntities[0]) {
            int instance = renderables.getInstance(entity);
            assertTrue("Renderable has geometry primitives", renderables.getPrimitiveCount(instance) > 0);
            for (int primitive = 0; primitive < renderables.getPrimitiveCount(instance); primitive++) {
              MaterialInstance material = renderables.getMaterialInstanceAt(instance, primitive); assertNotNull(material);
              assertEquals("Original metallic/roughness content uses lit materials", Material.Shading.LIT, material.getMaterial().getShading());
              assertTrue("Native material has real shader parameters", material.getMaterial().getParameterCount() > 0);
              materialInstances.add(material.getNativeObject());
            }
          }
          assertTrue("Original catalog material assignments survived gltfio", materialInstances.size() >= 4);
          result.put("renderables", originalEntities[0].length).put("materialInstances", materialInstances.size())
              .put("originalWorldBoundsMeters", new JSONArray(bounds));
          stage("RENDER_BEGIN:" + fixtureAsset);
          draw(runtime.get(), entityId, dimensions, rootTransform);
          stage("RENDER_SUBMITTED:" + fixtureAsset);
          assertArrayEquals(rootTransform, engine[0].getTransformManager().getTransform(
              engine[0].getTransformManager().getInstance(asset.getRoot()), new float[16]), TOLERANCE);
          assertOriginalBounds(worldBounds(engine[0], asset), dimensions, 1.25f, new float[] {.23f, .17f, -.31f});
          result.put("rootTransformAndBottomPivotVerified", true);
        });
        stage("READBACK_BEGIN:" + fixtureAsset);
        JSONObject renderedFrame = readFrame(runtime.get(), activity, assetId, entityId, false);
        int visiblePixels = renderedFrame.getInt("nontransparentPixels");
        stage("READBACK_COMPLETE:" + fixtureAsset);
        assertTrue("Actual Filament frame contains rasterized model geometry", visiblePixels > 32);
        result.put("renderedNontransparentPixels", visiblePixels).put("renderedFrame", renderedFrame);
        stage("NATIVE_INPUT_BEGIN:" + fixtureAsset);
        inputEvidence.put(ParallaxNativeInputFixture.run(activity, target.get(), inputHost.get(), runtime.get(),
            renderedFrame, assetId, entityId, () -> draw(runtime.get(), entityId, dimensions, rootTransform)));
        stage("NATIVE_INPUT_COMPLETE:" + fixtureAsset);
        onMain(() -> {
          stage("CLEAR_BEGIN:" + fixtureAsset);
          runtime.get().activate(Collections.emptyMap());
          for (int entity : originalEntities[0])
            assertEquals("Replacing the scene releases the original renderables", 0, engine[0].getRenderableManager().getInstance(entity));
          draw(runtime.get(), entityId, dimensions, rootTransform);
          stage("CLEAR_SUBMITTED:" + fixtureAsset);
        });
        stage("CLEAR_READBACK_BEGIN:" + fixtureAsset);
        JSONObject clearedFrame = readFrame(runtime.get(), activity, assetId, entityId, true);
        int clearedPixels = clearedFrame.getInt("nontransparentPixels");
        stage("CLEAR_READBACK_COMPLETE:" + fixtureAsset);
        assertEquals("Cleared scene does not retain old model pixels", 0, clearedPixels);
        result.put("clearedNontransparentPixels", clearedPixels).put("clearedFrame", clearedFrame).put("assetDisposed", true);
        evidence.put(result);
        stage("ASSET_COMPLETE:" + fixtureAsset);
      }
      onMain(() -> {
        stage("DISPOSE_BEGIN");
        runtime.get().close(); runtime.get().close();
        assertTrue("Disposed runtime contains no model owners", ((Map<?, ?>) field(runtime.get(), "models")).isEmpty());
        boolean destroyed = false;
        try { engine[0].getNativeObject(); } catch (IllegalStateException expected) { destroyed = true; }
        assertTrue("The production owner destroyed its native Filament engine", destroyed);
        stage("DISPOSE_COMPLETE");
      });
      JSONObject report = new JSONObject().put("schemaVersion", 1).put("evidenceClass", "INSTRUMENTED_FILAMENT_GLTF_RENDERING_ONLY")
          .put("renderer", "FILAMENT_1_75_1_OPENGL").put("fixtureUsesCamera", false).put("fixtureCreatesARCoreSession", false)
          .put("physicalTrackingProven", false).put("engineDisposed", true).put("assets", evidence);
      Files.write(new java.io.File(activity.getFilesDir(), "ncl01-filament-catalog.json").toPath(), report.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      JSONObject inputReport = new JSONObject().put("schemaVersion", 1).put("evidenceClass", "INSTRUMENTED_NATIVE_INPUT_ONLY")
          .put("fixtureUsesCamera", false).put("fixtureCreatesARCoreSession", false).put("physicalTrackingProven", false)
          .put("canonicalOutcomeProven", false).put("inputMethod", "INSTRUMENTATION_SEND_POINTER_SYNC")
          .put("largeTextEscapeLayoutVerified", true)
          .put("intentBinding", "SYNTHETIC_SESSION_PRODUCTION_EVENT_FACTORY").put("assets", inputEvidence);
      Files.write(new java.io.File(activity.getFilesDir(), "ncl01-native-input.json").toPath(),
          inputReport.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    } finally {
      onMain(() -> {
        stage("DISPOSE_FINALIZER_BEGIN");
        if (runtime.get() != null) runtime.get().close(); if (dialog.get() != null) dialog.get().dismiss();
        stage("DISPOSE_FINALIZER_COMPLETE");
      });
    }
  }

  private static float[] identity() { float[] matrix = new float[16]; Matrix.setIdentityM(matrix, 0); return matrix; }
  private static float[] worldBounds(Engine engine, FilamentAsset asset) {
    float[] min = {Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY, Float.POSITIVE_INFINITY};
    float[] max = {Float.NEGATIVE_INFINITY, Float.NEGATIVE_INFINITY, Float.NEGATIVE_INFINITY};
    for (int entity : asset.getRenderableEntities()) {
      Box box = engine.getRenderableManager().getAxisAlignedBoundingBox(engine.getRenderableManager().getInstance(entity), new Box());
      float[] center = box.getCenter(), half = box.getHalfExtent();
      float[] world = engine.getTransformManager().getWorldTransform(engine.getTransformManager().getInstance(entity), new float[16]);
      for (int corner = 0; corner < 8; corner++) {
        float[] point = new float[4];
        Matrix.multiplyMV(point, 0, world, 0, new float[] {center[0] + ((corner & 1) == 0 ? -half[0] : half[0]),
            center[1] + ((corner & 2) == 0 ? -half[1] : half[1]), center[2] + ((corner & 4) == 0 ? -half[2] : half[2]), 1}, 0);
        for (int axis = 0; axis < 3; axis++) { assertTrue(Float.isFinite(point[axis])); min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]); }
      }
    }
    return new float[] {min[0], min[1], min[2], max[0], max[1], max[2]};
  }
  private static void assertOriginalBounds(float[] bounds, float[] dimensions, float scale, float[] translation) {
    for (int axis = 0; axis < 3; axis++) assertEquals("Original authored dimensions in meters, axis " + axis, dimensions[axis] * scale, bounds[axis + 3] - bounds[axis], TOLERANCE);
    assertEquals("Bottom-center pivot stays on the support plane", translation[1], bounds[1], TOLERANCE);
    assertEquals("Original X pivot is centered", translation[0], (bounds[0] + bounds[3]) / 2, TOLERANCE);
    assertEquals("Original Z pivot is centered", translation[2], (bounds[2] + bounds[5]) / 2, TOLERANCE);
  }
  private static void draw(ParallaxModelRenderer runtime, String id, float[] dimensions, float[] model) throws Exception {
    com.google.android.filament.View view = field(runtime, "view");
    float size = Math.max(dimensions[0], Math.max(dimensions[1], dimensions[2])) * 1.25f;
    float targetY = .17f + dimensions[1] * 1.25f / 2;
    float[] cameraView = new float[16], cameraModel = new float[16], projection = new float[16];
    Matrix.setLookAtM(cameraView, 0, .23f + size * 1.2f, targetY + size, -.31f + size * 2.2f, .23f, targetY, -.31f, 0, 1, 0);
    assertTrue(Matrix.invertM(cameraModel, 0, cameraView, 0));
    Matrix.perspectiveM(projection, 0, 45, (float) view.getViewport().width / view.getViewport().height, .01f, 100);
    runtime.frame(projection, cameraModel, Collections.singletonMap(id, model), Collections.singleton(id), true, 1, System.nanoTime());
  }
  private static final class PickObservation {
    final String kind, expected;
    final int x, y;
    final CountDownLatch complete = new CountDownLatch(1);
    final AtomicReference<String> observed = new AtomicReference<>();
    final AtomicLong completedAt = new AtomicLong(Long.MAX_VALUE);
    final AtomicInteger callbackCount = new AtomicInteger();
    PickObservation(String kind, String expected, int[] point) {
      this.kind = kind; this.expected = expected; x = point[0]; y = point[1];
    }
  }
  private static JSONObject readFrame(ParallaxModelRenderer runtime, Activity activity, String assetId, String entityId, boolean cleared) throws Exception {
    CountDownLatch complete = new CountDownLatch(1);
    AtomicLong completedAt = new AtomicLong(Long.MAX_VALUE);
    AtomicReference<ByteBuffer> pixels = new AtomicReference<>();
    AtomicBoolean acceptingCallbacks = new AtomicBoolean(true);
    boolean[] submitted = {false};
    boolean[] pumping = {false};
    int[] dimensions = new int[2];
    List<PickObservation> picks = new ArrayList<>();
    boolean picksSubmitted = false;
    long startedAt = SystemClock.elapsedRealtime(), deadline = startedAt + 10000;
    stage("READBACK_CALLBACK_PUMP_BEGIN");
    try {
    while ((complete.getCount() != 0 || !picksSubmitted || picks.stream().anyMatch(pick -> pick.complete.getCount() != 0))
        && SystemClock.elapsedRealtime() < deadline) {
      if (complete.getCount() == 0 && !picksSubmitted) {
        ByteBuffer buffer = pixels.get();
        if (!cleared) picks.add(new PickObservation("MODEL_HIT", entityId, samplePoint(buffer, dimensions[0], dimensions[1], true)));
        picks.add(new PickObservation(cleared ? "CLEARED_MISS" : "BACKGROUND_MISS", null,
            samplePoint(buffer, dimensions[0], dimensions[1], false)));
        onMain(() -> {
          for (PickObservation pick : picks) {
            stage("GPU_PICK_REQUEST:" + pick.kind);
            // Filament 1.75.1 readPixels already flips the OpenGL buffer to TOP_LEFT.
            // Production pick performs the sole height-1-y conversion for View.pick.
            // https://github.com/google/filament/blob/v1.75.1/filament/backend/src/opengl/OpenGLDriver.cpp#L3888-L3898
            runtime.pick(pick.x, pick.y, value -> {
              if (!acceptingCallbacks.get()) return;
              pick.observed.set(value); pick.completedAt.set(SystemClock.elapsedRealtime());
              pick.callbackCount.incrementAndGet(); pick.complete.countDown(); stage("GPU_PICK_CALLBACK:" + pick.kind);
            });
          }
        });
        picksSubmitted = true;
      }
      onMain(() -> {
        Renderer renderer = field(runtime, "renderer");
        com.google.android.filament.View view = field(runtime, "view");
        SwapChain swapchain = field(runtime, "swapchain");
        if (!renderer.beginFrame(swapchain, System.nanoTime())) return;
        boolean reading = !submitted[0];
        if (reading) stage("READBACK_FRAME_ACCEPTED");
        else if (!pumping[0]) { stage("READBACK_CALLBACK_PUMP_FRAME"); pumping[0] = true; }
        try {
          if (reading) stage("READBACK_RENDER_BEGIN");
          renderer.render(view);
          if (reading) {
            stage("READBACK_RENDER_SUBMITTED");
            int width = view.getViewport().width, height = view.getViewport().height;
            assertEquals("The owned fixture viewport has its fixed width", 256, width);
            assertEquals("The owned fixture viewport has its fixed height", 256, height);
            dimensions[0] = width; dimensions[1] = height;
            ByteBuffer buffer = ByteBuffer.allocateDirect(width * height * 4); pixels.set(buffer);
            stage("READBACK_REQUEST_BEGIN");
            renderer.readPixels(0, 0, width, height, new Texture.PixelBufferDescriptor(buffer, Texture.Format.RGBA, Texture.Type.UBYTE,
                1, 0, 0, 0, new Handler(Looper.getMainLooper()), () -> {
                  // Keep the native readback storage strongly reachable even on timeout;
                  // late callbacks cannot touch the renderer or publish passing evidence.
                  if (buffer.capacity() == 0 || !acceptingCallbacks.get()) return;
                  completedAt.set(SystemClock.elapsedRealtime()); stage("READBACK_CALLBACK"); complete.countDown();
                }));
            stage("READBACK_REQUEST_SUBMITTED");
            submitted[0] = true;
          }
        } finally { renderer.endFrame(); }
        if (reading) stage("READBACK_FRAME_ENDED");
      });
      // Yield outside the Engine's main thread so its asynchronous readPixels
      // callback can run while ordinary frames drain the backend command queue.
      if (complete.getCount() != 0 || !picksSubmitted || picks.stream().anyMatch(pick -> pick.complete.getCount() != 0))
        SystemClock.sleep(20);
    }
    assertTrue("Filament accepted an actual readback frame", submitted[0]);
    assertEquals("Native frame readback completed within the single deadline", 0, complete.getCount());
    assertTrue("Readback callback arrived before the existing deadline", completedAt.get() <= deadline);
    assertTrue("Production GPU pick requests were submitted", picksSubmitted);
    JSONArray pickEvidence = new JSONArray();
    for (PickObservation pick : picks) {
      assertEquals("Production GPU pick callback completed", 0, pick.complete.getCount());
      assertEquals("Exactly one callback per production pick", 1, pick.callbackCount.get());
      assertTrue("Production GPU pick completed before the same readback deadline", pick.completedAt.get() <= deadline);
      assertEquals("Production GPU pick resolves actual model ownership or real background", pick.expected, pick.observed.get());
      pickEvidence.put(new JSONObject().put("kind", pick.kind).put("x", pick.x).put("y", pick.y)
          .put("viewPickX", pick.x).put("viewPickY", dimensions[1] - 1 - pick.y).put("neighborhoodRadius", 3)
          .put("expectedEntityId", pick.expected == null ? JSONObject.NULL : pick.expected)
          .put("observedEntityId", pick.observed.get() == null ? JSONObject.NULL : pick.observed.get())
          .put("callbackElapsedMs", pick.completedAt.get() - startedAt).put("callbackCount", pick.callbackCount.get()));
    }
    stage("READBACK_CALLBACK_PUMP_COMPLETE");
    int nontransparent = 0; ByteBuffer buffer = pixels.get();
    for (int index = 3; index < buffer.capacity(); index += 4) if ((buffer.get(index) & 255) > 16) nontransparent++;
    byte[] rgba = new byte[buffer.capacity()]; ByteBuffer originalRows = buffer.duplicate(); originalRows.clear(); originalRows.get(rgba);
    byte[] png = losslessPng(rgba, dimensions[0], dimensions[1]);
    String fileName = "ncl01-filament-" + assetId + (cleared ? "-cleared.png" : "-populated.png");
    Files.write(new java.io.File(activity.getFilesDir(), fileName).toPath(), png);
    JSONObject frame = new JSONObject().put("fileName", fileName).put("width", dimensions[0]).put("height", dimensions[1])
        .put("bytes", png.length).put("sha256", ParallaxModelCache.digest(png)).put("rgbaSha256", ParallaxModelCache.digest(rgba))
        .put("nontransparentPixels", nontransparent).put("rgbaOrigin", "TOP_LEFT")
        .put("pngRowTransform", "NONE_FILAMENT_ALREADY_TOP_LEFT").put("pickCoordinateSpace", "ANDROID_VIEW_TOP_LEFT")
        .put("sharedBudgetMs", 10000).put("readbackElapsedMs", completedAt.get() - startedAt).put("picks", pickEvidence);
    long completedElapsedMs = SystemClock.elapsedRealtime() - startedAt;
    frame.put("artifactPublishedElapsedMs", completedElapsedMs);
    assertTrue("Readback, all GPU picks and original PNG publication share the existing deadline", completedElapsedMs <= 10000);
    return frame;
    } finally { acceptingCallbacks.set(false); }
  }
  private static int[] samplePoint(ByteBuffer rgba, int width, int height, boolean opaque) {
    int[] best = null; long bestDistance = opaque ? Long.MAX_VALUE : Long.MIN_VALUE;
    for (int y = 3; y < height - 3; y++) for (int x = 3; x < width - 3; x++) {
      boolean safe = true;
      for (int dy = -3; dy <= 3 && safe; dy++) for (int dx = -3; dx <= 3; dx++) {
        int alpha = rgba.get(((y + dy) * width + x + dx) * 4 + 3) & 255;
        if (opaque ? alpha < 250 : alpha != 0) { safe = false; break; }
      }
      long distance = (long) (2 * x - width) * (2 * x - width) + (long) (2 * y - height) * (2 * y - height);
      if (safe && (opaque ? distance < bestDistance : distance > bestDistance)) { best = new int[] {x, y}; bestDistance = distance; }
    }
    assertNotNull(opaque ? "Rasterized model has an opaque interior pick point" : "Actual frame has an all-zero-alpha background neighborhood", best);
    return best;
  }
  /** Original unsigned RGBA rows, with no Bitmap premultiplication, color conversion or second row flip. */
  private static byte[] losslessPng(byte[] rgba, int width, int height) throws Exception {
    ByteArrayOutputStream compressed = new ByteArrayOutputStream();
    try (DeflaterOutputStream deflater = new DeflaterOutputStream(compressed)) {
      for (int y = 0; y < height; y++) { deflater.write(0); deflater.write(rgba, y * width * 4, width * 4); }
    }
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (DataOutputStream png = new DataOutputStream(bytes)) {
      png.write(new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10});
      ByteArrayOutputStream header = new ByteArrayOutputStream();
      try (DataOutputStream data = new DataOutputStream(header)) {
        data.writeInt(width); data.writeInt(height); data.write(new byte[] {8, 6, 0, 0, 0});
      }
      pngChunk(png, "IHDR", header.toByteArray()); pngChunk(png, "IDAT", compressed.toByteArray()); pngChunk(png, "IEND", new byte[0]);
    }
    return bytes.toByteArray();
  }
  private static void pngChunk(DataOutputStream png, String name, byte[] data) throws Exception {
    byte[] type = name.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    CRC32 crc = new CRC32(); crc.update(type); crc.update(data);
    png.writeInt(data.length); png.write(type); png.write(data); png.writeInt((int) crc.getValue());
  }
}
