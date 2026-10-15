import { afterEach, expect, it, vi } from "vitest";
import { BrowserSpatialAdapter } from "./browser-spatial-adapter";
import { identityTransform } from "./contracts";
import * as T from "three";
import type { SpatialMoment } from "./contracts";
import type { SpatialElement } from "./element-contracts";
import { createSpatialDraft, previewEntityTransform } from "./authoring";
import { createPresetConstruction } from "./preset-construction";
import { materializeSpatialVersion } from "./publication";
import { composeTransform } from "./transforms";
import { syntheticSpatialMoment } from "./fixtures";
import type { BrowserTrackingSample, BrowserWorldTrackingProvider, RoomAlignment } from "./browser-world-tracking";

const { clear, renderFrame } = vi.hoisted(() => ({ clear: vi.fn(), renderFrame: vi.fn() }));
vi.mock("three", async (original) => ({
  ...(await original<typeof import("three")>()),
  WebGLRenderer: class {
    domElement = document.createElement("canvas");
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    dispose() {}
    render = renderFrame;
    clear = clear;
  },
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  renderFrame.mockReset();
});

function sceneHarness(moment: SpatialMoment = syntheticSpatialMoment()) {
  let draw!: FrameRequestCallback;
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    draw = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const sample: BrowserTrackingSample = {
    sessionId: "tracking-session",
    timestampMs: 1000,
    method: "VISUAL_SLAM",
    status: "TRACKING",
    confidence: "POSITION_NO_SCALE",
    sessionFromCamera: identityTransform(),
    reason: "",
  };
  const provider: BrowserWorldTrackingProvider = {
    providerId: "test-provider",
    version: "1",
    method: "VISUAL_SLAM",
    read: () => sample,
    cameraIntrinsics: () => ({ width: 320, height: 240, focal: 256 }),
    ray: () => null,
    start: async () => {},
    stop: vi.fn(async () => {}),
    hitTest: () => null,
    planes: () => [],
  };
  const alignment: RoomAlignment = {
    schemaVersion: 1,
    trackingSessionId: sample.sessionId,
    versionChecksum: moment.version.checksum,
    semanticFeatureId: "table",
    sessionFromScene: identityTransform(),
    scaleBasis: "ROOM_POINT_CORRESPONDENCES",
    trackingScale: "RELATIVE",
    normalizedResidual: 0,
  };
  const host = document.createElement("div"),
    select = vi.fn(),
    emit = vi.fn();
  Object.defineProperties(host, { clientWidth: { value: 390 }, clientHeight: { value: 844 } });
  const adapter = new BrowserSpatialAdapter(host, provider, moment, alignment, select);
  return {
    adapter,
    sample,
    provider,
    host,
    select,
    emit,
    start: () => adapter.start({ signal: new AbortController().signal, emit }),
    draw: () => draw(1000),
    rendered: () => renderFrame.mock.calls.at(-1)! as [T.Scene, T.PerspectiveCamera],
  };
}

it("uses the SDK viewport projection and inverse for rendering and refreshes it when the camera crop changes", async () => {
  const h = sceneHarness();
  const projection = new T.PerspectiveCamera(55, 390 / 844, 0.005, 1000).projectionMatrix.clone();
  projection.elements[8] = 0.15; // Off-center principal point must survive without a focal approximation.
  h.provider.cameraIntrinsics = () => null;
  h.provider.cameraProjection = vi.fn(() => Float32Array.from(projection.elements));
  await h.start();
  expect(h.provider.cameraProjection).toHaveBeenCalledWith(390, 844, 0.005, 1000);
  const camera = h.rendered()[1];
  expect(camera.projectionMatrix.elements[8]).toBeCloseTo(0.15);
  new T.Matrix4()
    .multiplyMatrices(camera.projectionMatrix, camera.projectionMatrixInverse)
    .elements.forEach((value, index) => expect(value).toBeCloseTo(new T.Matrix4().elements[index], 10));
  projection.elements[8] = -0.25;
  h.draw();
  expect(camera.projectionMatrix.elements[8]).toBe(-0.25);
  await h.adapter.stop();
});

it.each([null, [1, 2], Array(16).fill(0), [NaN, ...new T.Matrix4().elements.slice(1)]])(
  "refuses an invalid SDK projection rather than substituting estimated intrinsics: %s",
  async (projection) => {
    const h = sceneHarness();
    h.provider.cameraProjection = () => projection;
    await expect(h.start()).rejects.toThrow("valid camera projection");
    expect(renderFrame).not.toHaveBeenCalled();
    expect(h.host.children).toHaveLength(0);
    await h.adapter.stop();
  },
);

it("clears the scene and suspends runtime admission if an SDK projection becomes unavailable", async () => {
  const h = sceneHarness();
  h.provider.cameraProjection = () => new T.Matrix4().elements;
  await h.start();
  const frames = renderFrame.mock.calls.length;
  h.provider.cameraProjection = () => null;
  h.draw();
  expect(clear).toHaveBeenCalledOnce();
  expect(renderFrame).toHaveBeenCalledTimes(frames);
  expect(h.emit).toHaveBeenLastCalledWith({ type: "TRACKING", state: "INTERRUPTED" });
  await h.adapter.stop();
});

it("keeps the existing intrinsics projection for providers that do not expose an SDK matrix", async () => {
  const h = sceneHarness();
  await h.start();
  expect(h.rendered()[1].aspect).toBe(320 / 240);
  expect(h.rendered()[1].fov).toBeCloseTo(T.MathUtils.radToDeg(2 * Math.atan(240 / 512)));
  await h.adapter.stop();
});

it("preserves the canonical upright model and plane-local paper frames when roots share a tabletop anchor", async () => {
  const draft = createSpatialDraft("shared-desk", "Desk Map");
  const room = createPresetConstruction({ id: "bedroom", width: 4, depth: 4, vertical: true });
  draft.content.studio!.environment = room;
  const paper = draft.content.entities[0];
  const model = {
    ...structuredClone(paper),
    id: "lantern",
    element: {
      kind: "PHYSICAL_ASSET",
      enabled: true,
      modelId: "lantern",
      packageVersion: "1.0.0",
      articulation: 0,
    } satisfies SpatialElement,
  };
  draft.content.entities.push(model);
  const moment = syntheticSpatialMoment();
  moment.version = materializeSpatialVersion(draft.content);
  const h = sceneHarness(moment);
  const anchor = moment.version.anchors.find((a) => a.id === paper.anchorId)!;
  const paperFrame = await h.adapter.resolve(anchor),
    modelFrame = await h.adapter.resolve(anchor, model.id);
  for (const [entity, frame] of [
    [paper, paperFrame],
    [model, modelFrame],
  ] as const) {
    const actual = composeTransform(frame!, entity.transform);
    const expected = previewEntityTransform(draft.content, entity.id, room.id, {
      ...room,
      horizontal: true,
      vertical: true,
    });
    expect(actual).toEqual(expected);
  }
  expect(modelFrame!.rotation).not.toEqual(paperFrame!.rotation);
});

it("exports bounded local frame intervals and CPU submission timing without pose or sensor data", async () => {
  const h = sceneHarness();
  await h.start();
  let now = 1002;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  renderFrame.mockImplementation(() => {
    now += 2;
  });
  for (let i = 0; i < 3610; i++) {
    h.sample.timestampMs = now;
    h.draw();
  }
  const diagnostics = h.adapter.diagnostics();
  expect(diagnostics.renderedFrames).toBe(3611);
  expect(diagnostics.frameIntervalMs).toMatchObject({ samples: 3600, p50: 2, p95: 2 });
  expect(diagnostics.mainThreadRenderCallMs).toMatchObject({ samples: 3600, p50: 2, p95: 2 });
  expect(Object.keys(diagnostics).sort()).toEqual([
    "durationMs",
    "frameIntervalMs",
    "mainThreadRenderCallMs",
    "renderedFrames",
    "sampleLimit",
  ]);
  await h.adapter.stop();
  expect(h.adapter.diagnostics()).toEqual(diagnostics);
});

it("renders authored models and particles through shared Scene primitives, preserving pose, envelope and entity selection", async () => {
  const moment = syntheticSpatialMoment();
  const source = moment.version.entities[0];
  source.element = {
    kind: "PHYSICAL_ASSET",
    enabled: true,
    modelId: "lantern",
    packageVersion: "1.0.0",
    articulation: 0,
  };
  const particle = {
    ...structuredClone(source),
    id: "particles",
    element: {
      kind: "PARTICLES",
      enabled: true,
      style: "MAGIC",
      count: 5,
      radius: 0.3,
      speed: 1,
      size: 0.02,
      seed: 12,
      color: "#ffffff",
    } satisfies SpatialElement,
  };
  moment.version.entities.push(particle);
  const original = structuredClone(moment);
  const h = sceneHarness(moment);
  await h.start();
  const transform = { ...identityTransform(), position: { x: 1, y: 2, z: -3 }, scale: 2 };
  const entities = moment.version.entities.map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    content: entity.content,
    widthMeters: entity.widthMeters,
    transform,
    opacity: 0.5,
    envelope: 0.5,
  }));
  await h.adapter.render(entities, { elapsedMs: 0, reducedMotion: false });
  h.draw();
  const scene = h.rendered()[0];
  const model = scene.children.find((o) => o.userData.entityId === source.id)!;
  const pointsRoot = scene.children.find((o) => o.userData.entityId === particle.id)!;
  expect(model.getObjectByName("physical-model")).toBeTruthy();
  expect(model.position.toArray()).toEqual([1, 2, -3]);
  expect(model.scale.toArray()).toEqual([2, 2, 2]);
  const points = pointsRoot.getObjectByName("particles") as T.Points<T.BufferGeometry, T.PointsMaterial>;
  expect(points).toBeInstanceOf(T.Points);
  expect(pointsRoot.getObjectByName("editor-marker")!.visible).toBe(false);
  expect(points.material.opacity).toBeCloseTo(0.25);
  const positions = [...points.geometry.attributes.position.array];
  await h.adapter.render(entities, { elapsedMs: 1000, reducedMotion: false });
  expect([...points.geometry.attributes.position.array]).not.toEqual(positions);
  expect(points.material.opacity).toBeCloseTo(0.25); // Repeated samples never compound alpha.
  const geometryDisposed = vi.spyOn(points.geometry, "dispose"),
    textureDisposed = vi.spyOn(points.material.map!, "dispose");
  vi.spyOn(T.Raycaster.prototype, "intersectObjects").mockReturnValue([{ object: model } as T.Intersection]);
  const canvas = h.host.querySelector("canvas")!;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 390,
    height: 844,
  } as DOMRect);
  canvas.dispatchEvent(new MouseEvent("pointerup", { clientX: 195, clientY: 422 }));
  expect(h.select).toHaveBeenCalledWith(source.id);
  expect(moment).toEqual(original);
  await h.adapter.stop();
  expect(geometryDisposed).toHaveBeenCalledOnce();
  expect(textureDisposed).toHaveBeenCalledOnce();
});

it.each([
  { kind: "SPATIAL_AUDIO", enabled: true, sound: "ETHER", gain: 0.1, refDistance: 1, maxDistance: 10, rolloff: 1 },
  { kind: "INTERACTION_VOLUME", enabled: true, shape: "BOX", radius: 1 },
] satisfies SpatialElement[])("refuses unsupported $kind without drawing an editor surrogate", async (element) => {
  const moment = syntheticSpatialMoment();
  moment.version.entities[0].element = element;
  const h = sceneHarness(moment);
  await h.start();
  expect(h.adapter.supportsElement(element)).toBe(false);
  const source = moment.version.entities[0];
  await expect(
    h.adapter.render([
      {
        id: source.id,
        kind: source.kind,
        content: source.content,
        widthMeters: source.widthMeters,
        transform: identityTransform(),
      },
    ]),
  ).rejects.toThrow("does not yet support");
  await h.adapter.stop();
});

it("hides stale frames and interrupts runtime admission even when a tracker stops notifying", async () => {
  let now = 1000,
    draw!: FrameRequestCallback;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    draw = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const moment = syntheticSpatialMoment();
  let sample: BrowserTrackingSample | null = {
    sessionId: "tracking-session",
    timestampMs: now,
    method: "VISUAL_SLAM",
    status: "TRACKING",
    confidence: "POSITION_NO_SCALE",
    sessionFromCamera: identityTransform(),
    reason: "",
  };
  const provider: BrowserWorldTrackingProvider = {
    providerId: "test-provider",
    version: "1",
    method: "VISUAL_SLAM",
    read: () => sample,
    cameraIntrinsics: () => ({ width: 320, height: 240, focal: 256 }),
    ray: () => null,
    start: async () => {},
    stop: vi.fn(async () => {}),
    hitTest: () => null,
    planes: () => [],
  };
  const alignment: RoomAlignment = {
    schemaVersion: 1,
    trackingSessionId: "tracking-session",
    versionChecksum: moment.version.checksum,
    semanticFeatureId: "table",
    sessionFromScene: identityTransform(),
    scaleBasis: "ROOM_POINT_CORRESPONDENCES",
    trackingScale: "RELATIVE",
    normalizedResidual: 0,
  };
  const host = document.createElement("div"),
    emit = vi.fn();
  const adapter = new BrowserSpatialAdapter(host, provider, moment, alignment, () => {});
  adapter.updateTracking(sample);
  await adapter.start({
    signal: new AbortController().signal,
    emit,
    sceneIdentity: { versionChecksum: moment.version.checksum, instanceId: "instance" },
  });
  expect(renderFrame).toHaveBeenCalledTimes(1);
  draw(now);
  draw(now);
  expect(emit.mock.calls.filter(([event]) => event.state === "NORMAL")).toHaveLength(1);
  for (const timestamp of [1001, 1002]) {
    now = timestamp;
    sample = { ...sample!, timestampMs: now };
    draw(now);
  }
  expect(emit.mock.calls.filter(([event]) => event.state === "NORMAL")).toHaveLength(3);
  const renderedBeforeStale = renderFrame.mock.calls.length;
  now += 501;
  draw(now);
  expect(clear).toHaveBeenCalledTimes(1);
  expect(emit).toHaveBeenLastCalledWith({ type: "TRACKING", state: "LIMITED_FEATURES" });
  expect(renderFrame).toHaveBeenCalledTimes(renderedBeforeStale);
  sample = null;
  draw(now);
  expect(emit).toHaveBeenLastCalledWith({ type: "TRACKING", state: "INTERRUPTED" });
  await adapter.stop();
  expect(host.children).toHaveLength(0);
  expect(provider.stop).toHaveBeenCalledOnce();
});
