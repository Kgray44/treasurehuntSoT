package com.voyagewright.landfall;

import android.os.Handler;
import android.os.Looper;
import android.view.Surface;
import android.view.TextureView;
import com.google.android.filament.*;
import com.google.android.filament.android.UiHelper;
import com.google.android.filament.gltfio.*;
import java.nio.*;
import java.util.*;
import java.util.function.Consumer;
import org.json.*;

/** Filament owns GLB geometry/material loading and GPU hit testing; ARCore owns all world poses. */
final class ParallaxModelRenderer {
  static { Filament.init(); Gltfio.init(); }
  private final Engine engine;
  private final Renderer renderer;
  private final Scene scene;
  private final View view;
  private final Camera camera;
  private final UiHelper ui;
  private final UbershaderProvider materials;
  private final AssetLoader loader;
  private final ResourceLoader resources;
  private final int light;
  private SwapChain swapchain;
  private final Map<String, FilamentAsset> models = new HashMap<>();
  private final Map<Integer, String> ownership = new HashMap<>();
  private final Handler main = new Handler(Looper.getMainLooper());
  private boolean closed;
  private long sceneGeneration;
  private int width, height;

  ParallaxModelRenderer(TextureView target) {
    engine = Engine.create(Engine.Backend.OPENGL);
    renderer = engine.createRenderer(); scene = engine.createScene();
    camera = engine.createCamera(EntityManager.get().create());
    camera.setExposure(16f, 1f / 125f, 100f);
    view = engine.createView(); view.setScene(scene); view.setCamera(camera);
    view.setBlendMode(View.BlendMode.TRANSLUCENT);
    view.setTransparentPickingEnabled(true);
    // Transparent overlay quality tier: no TAA/SSAO or temporal reprojection over the live camera.
    View.TemporalAntiAliasingOptions taa = new View.TemporalAntiAliasingOptions(); taa.enabled = false;
    view.setTemporalAntiAliasingOptions(taa);
    View.AmbientOcclusionOptions ao = new View.AmbientOcclusionOptions(); ao.enabled = false;
    view.setAmbientOcclusionOptions(ao);
    Renderer.ClearOptions clear = new Renderer.ClearOptions();
    clear.clear = true; clear.clearColor = new double[] {0, 0, 0, 0}; renderer.setClearOptions(clear);
    materials = new UbershaderProvider(engine);
    loader = new AssetLoader(engine, materials, EntityManager.get());
    resources = new ResourceLoader(engine, true);
    light = EntityManager.get().create();
    new LightManager.Builder(LightManager.Type.SUN).color(1, 0.97f, 0.92f)
        .intensity(100000).direction(0.3f, -1, -0.5f).castShadows(false).build(engine, light);
    scene.addEntity(light);
    ui = new UiHelper(UiHelper.ContextErrorPolicy.DONT_CHECK);
    ui.setOpaque(false);
    ui.setRenderCallback(new UiHelper.RendererCallback() {
      @Override public void onNativeWindowChanged(Surface surface) {
        if (swapchain != null) engine.destroySwapChain(swapchain);
        swapchain = engine.createSwapChain(surface, ui.getSwapChainFlags());
      }
      @Override public void onDetachedFromSurface() {
        if (swapchain != null) { engine.destroySwapChain(swapchain); engine.flushAndWait(); swapchain = null; }
      }
      @Override public void onResized(int w, int h) {
        width = w; height = h; view.setViewport(new Viewport(0, 0, w, h));
      }
    });
    ui.attachTo(target);
  }

  /** Called on the UI thread only, after every referenced byte stream has passed authorization/integrity. */
  void activate(Map<String, byte[]> verified) {
    Map<String, FilamentAsset> next = new HashMap<>();
    try {
      for (Map.Entry<String, byte[]> entry : verified.entrySet()) {
        ByteBuffer buffer = ByteBuffer.allocateDirect(entry.getValue().length).order(ByteOrder.nativeOrder());
        buffer.put(entry.getValue()).flip();
        FilamentAsset asset = loader.createAsset(buffer);
        if (asset == null) throw new IllegalArgumentException("PARALLAX_GLB_UNREADABLE");
        next.put(entry.getKey(), asset);
        if (asset.getResourceUris().length != 0) throw new IllegalArgumentException("PARALLAX_GLB_EXTERNAL_RESOURCE");
        resources.loadResources(asset);
        asset.releaseSourceData();
      }
    } catch (RuntimeException failure) {
      for (FilamentAsset asset : next.values()) loader.destroyAsset(asset);
      throw failure;
    }
    clearModels(); models.putAll(next); sceneGeneration++;
    for (Map.Entry<String, FilamentAsset> entry : models.entrySet()) {
      for (int entity : entry.getValue().getEntities()) ownership.put(entity, entry.getKey());
      scene.addEntities(entry.getValue().getEntities());
    }
  }

  /** One acquired ARCore frame supplies camera + model matrices together; no unit-cube normalization. */
  void frame(float[] projection, float[] cameraModel, Map<String, float[]> transforms,
      Set<String> visible, boolean tracking, float brightness, long timestamp) {
    if (closed || swapchain == null || width == 0 || height == 0) return;
    double[] p = new double[16]; for (int i = 0; i < 16; i++) p[i] = projection[i];
    camera.setCustomProjection(p, 0.01, 100); camera.setModelMatrix(cameraModel);
    view.setVisibleLayers(1, tracking ? 1 : 0);
    engine.getLightManager().setIntensity(engine.getLightManager().getInstance(light),
        Math.max(10000, Math.min(150000, 100000 * brightness)));
    for (Map.Entry<String, FilamentAsset> entry : models.entrySet()) {
      FilamentAsset asset = entry.getValue(); float[] matrix = transforms.get(entry.getKey());
      if (matrix != null) engine.getTransformManager().setTransform(
          engine.getTransformManager().getInstance(asset.getRoot()), matrix);
      for (int renderable : asset.getRenderableEntities())
        engine.getRenderableManager().setLayerMask(engine.getRenderableManager().getInstance(renderable),
            1, matrix != null && visible.contains(entry.getKey()) ? 1 : 0);
    }
    if (renderer.beginFrame(swapchain, timestamp)) { renderer.render(view); renderer.endFrame(); }
  }

  void pick(float x, float y, Consumer<String> result) {
    if (closed || swapchain == null || width < 1 || height < 1 || !Float.isFinite(x) || !Float.isFinite(y)
        || x < 0 || y < 0 || x >= width || y >= height) { result.accept(null); return; }
    long generation = sceneGeneration;
    view.pick(Math.max(0, Math.min(width - 1, (int) x)),
        Math.max(0, Math.min(height - 1, height - 1 - (int) y)), main,
        hit -> { if (!closed && sceneGeneration == generation) result.accept(ownership.get(hit.renderable)); });
  }

  private void clearModels() {
    ownership.clear();
    for (FilamentAsset asset : models.values()) { scene.removeEntities(asset.getEntities()); loader.destroyAsset(asset); }
    models.clear(); resources.evictResourceData();
  }

  void close() {
    if (closed) return; closed = true; sceneGeneration++;
    ui.detach(); clearModels(); resources.destroy(); loader.destroy();
    materials.destroyMaterials(); materials.destroy();
    engine.destroyEntity(light); EntityManager.get().destroy(light);
    int cameraEntity = camera.getEntity();
    engine.destroyCameraComponent(cameraEntity); EntityManager.get().destroy(cameraEntity);
    engine.destroyView(view); engine.destroyScene(scene); engine.destroyRenderer(renderer); engine.destroy();
  }
}
