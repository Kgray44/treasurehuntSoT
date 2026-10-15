import { afterEach, describe, expect, it, vi } from "vitest";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { BrowserTrackingSample } from "./browser-world-tracking";
import {
  loadAuthorizedZapparSdk,
  ZapparBrowserProvider,
  zapparCameraPose,
  type ZapparAuthorizedConfig,
  type ZapparSdk,
} from "./zappar-browser-provider";

const config: ZapparAuthorizedConfig = {
  version: "4.4.0",
  scriptUrl: "/api/dev/parallax-tracker/zappar-4.4.0.js",
  integrity: `sha256-${"a".repeat(43)}=`,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Contract doubles only. These tests do not execute an SDK or qualify physical AR. */
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("isSecureContext", true);
  let scheduled: FrameRequestCallback = () => {};
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      scheduled = callback;
      return 1;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const state = {
    now: 100,
    frame: 1,
    camera: new Float32Array(new Matrix4().makeTranslation(1, 2, 3).elements),
    projection: new Float32Array(new PerspectiveCamera(60, 4 / 3, 0.005, 1000).projectionMatrix.elements),
  };
  const anchor = {
    id: "world-one",
    status: 1,
    poseCameraRelative: vi.fn(() => new Float32Array(new Matrix4().elements)),
  };
  const pipeline = {
    glContextSet: vi.fn(),
    glContextLost: vi.fn(),
    processGL: vi.fn(),
    frameUpdate: vi.fn(),
    frameNumber: vi.fn(() => state.frame),
    projectionMatrix: vi.fn(() => state.projection),
    cameraPoseWithOrigin: vi.fn(() => state.camera),
    destroy: vi.fn(),
  };
  const tracker = { quality: 1, worldAnchor: anchor, scaleMode: 0, destroy: vi.fn() };
  const source = { start: vi.fn(), pause: vi.fn(), destroy: vi.fn() };
  const sdk: ZapparSdk = {
    Pipeline: vi.fn(function () {
      return pipeline;
    }) as unknown as ZapparSdk["Pipeline"],
    WorldTracker: vi.fn(function () {
      return tracker;
    }) as unknown as ZapparSdk["WorldTracker"],
    HTMLElementSource: vi.fn(function () {
      return source;
    }) as unknown as ZapparSdk["HTMLElementSource"],
    WorldScaleMode: { ABSOLUTE: 1 },
    WorldTrackerQuality: {
      WORLD_TRACKER_QUALITY_INITIALIZING: 0,
      WORLD_TRACKER_QUALITY_GOOD: 1,
      WORLD_TRACKER_QUALITY_LIMITED: 2,
      WORLD_TRACKER_QUALITY_INACTIVE: 3,
    },
    AnchorStatus: {
      ANCHOR_STATUS_INITIALIZING: 0,
      ANCHOR_STATUS_TRACKING: 1,
      ANCHOR_STATUS_PAUSED: 2,
      ANCHOR_STATUS_STOPPED: 3,
    },
    loadedPromise: vi.fn(async () => {}),
  };
  const loseContext = vi.fn(),
    gl = { getExtension: vi.fn(() => ({ loseContext })) };
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getContext").mockReturnValue(gl as never);
  const video = document.createElement("video");
  Object.defineProperties(video, {
    videoWidth: { value: 640, configurable: true },
    videoHeight: { value: 480, configurable: true },
    readyState: { value: 2, configurable: true },
  });
  vi.spyOn(video, "play").mockResolvedValue();
  vi.spyOn(video, "pause").mockImplementation(() => {});
  const track = Object.assign(new EventTarget(), { readyState: "live" });
  const release = vi.fn(),
    controller = new AbortController();
  const input = {
    video,
    lease: { id: "lease", generation: 1, stream: { getVideoTracks: () => [track] }, release } as never,
    motionGranted: true,
    signal: controller.signal,
    sample: vi.fn<(sample: BrowserTrackingSample) => void>(),
  };
  const loadSdk = vi.fn(async () => sdk);
  const provider = new ZapparBrowserProvider(config, { loadSdk, createCanvas: () => canvas, now: () => state.now });
  const frame = (changes: { advanceVideo?: boolean; advanceSdk?: boolean; time?: number } = {}) => {
    state.now = changes.time ?? state.now + 34;
    if (changes.advanceVideo !== false) video.currentTime += 1 / 30;
    if (changes.advanceSdk !== false) state.frame++;
    scheduled(state.now);
  };
  return {
    provider,
    input,
    sdk,
    state,
    pipeline,
    tracker,
    anchor,
    source,
    canvas,
    release,
    controller,
    track,
    loadSdk,
    frame,
    loseContext,
  };
}

it("refuses SDK loading before the local authorization permit and exact bundle are provided", async () => {
  const f = setup();
  const provider = new ZapparBrowserProvider(
    { ...config, scriptUrl: "https://libs.zappar.com/zappar.js" },
    { loadSdk: f.loadSdk },
  );
  await expect(provider.start(f.input)).rejects.toThrow(/entitlement/);
  expect(f.loadSdk).not.toHaveBeenCalled();
  expect(f.release).toHaveBeenCalledOnce();
});

it.each(["permission", "https", "lease"])(
  "releases the lease without loading an SDK when %s is unavailable",
  async (kind) => {
    const f = setup();
    if (kind === "permission") f.input.motionGranted = false;
    if (kind === "https") vi.stubGlobal("isSecureContext", false);
    if (kind === "lease") f.track.readyState = "ended";
    await expect(f.provider.start(f.input)).rejects.toThrow();
    expect(f.loadSdk).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalledOnce();
    expect(f.provider.read()).toBeNull();
  },
);

it("uses the existing leased video, separate processing context, true world translation and SDK projection", async () => {
  const f = setup();
  await f.provider.start(f.input);
  expect(f.sdk.HTMLElementSource).toHaveBeenCalledWith(f.pipeline, f.input.video);
  expect(f.pipeline.glContextSet).toHaveBeenCalledWith(expect.objectContaining({ getExtension: expect.any(Function) }));
  expect(f.source.start).toHaveBeenCalledOnce();
  expect(f.tracker.scaleMode).toBe(1);
  expect(f.pipeline.cameraPoseWithOrigin).toHaveBeenCalledWith(f.anchor.poseCameraRelative.mock.results[0].value);
  expect(f.provider.read()).toMatchObject({
    method: "VISUAL_SLAM",
    status: "TRACKING",
    confidence: "POSITION_NO_SCALE",
    sessionFromCamera: { position: { x: 1, y: 2, z: 3 }, scale: 1 },
  });
  expect(f.provider.cameraProjection(390, 844, 0.01, 100)).toEqual(f.state.projection);
  expect(f.pipeline.projectionMatrix).toHaveBeenLastCalledWith(390, 844, 0.01, 100);
  expect(f.provider.ray(0.5, 0.5)).toMatchObject({ origin: { x: 1, y: 2, z: 3 } });
  expect(f.provider.ray(0.5, 0.5)?.direction.z).toBeCloseTo(-1);
  expect(f.provider.planes()).toEqual([]);
  expect(f.provider.hitTest()).toBeNull();
  expect(document.body.contains(f.canvas)).toBe(false);
  await f.provider.stop();
  expect(f.source.pause).toHaveBeenCalledOnce();
  expect(f.source.destroy).toHaveBeenCalledOnce();
  expect(f.tracker.destroy).toHaveBeenCalledOnce();
  expect(f.pipeline.glContextLost).toHaveBeenCalledOnce();
  expect(f.pipeline.destroy).toHaveBeenCalledOnce();
  expect(f.loseContext).toHaveBeenCalledOnce();
  expect(f.release).toHaveBeenCalledOnce();
  expect(f.input.video.srcObject).toBeNull();
  expect(f.provider.cameraIntrinsics()).toBeNull();
});

it("unprojects calibration rays through the SDK principal point and camera rotation", async () => {
  const f = setup();
  f.state.camera = new Float32Array(
    new Matrix4().compose(
      new Vector3(1, 2, 3),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
      new Vector3(1, 1, 1),
    ).elements,
  );
  f.state.projection[8] = 0.15;
  await f.provider.start(f.input);
  const ray = f.provider.ray(0.5, 0.5)!;
  expect(ray.direction.x).toBeLessThan(-0.98);
  expect(Math.abs(ray.direction.z)).toBeGreaterThan(0.05);
  expect(f.provider.ray(-0.1, 0.5)).toBeNull();
  await f.provider.stop();
});

it.each([
  [0, 1, "INITIALIZING"],
  [1, 0, "INITIALIZING"],
  [2, 1, "LIMITED"],
  [1, 2, "LIMITED"],
  [3, 1, "LIMITED"],
  [1, 3, "LOST"],
])("requires both good tracking and a tracked anchor (%s/%s)", async (quality, status, expected) => {
  const f = setup();
  f.tracker.quality = Number(quality);
  f.anchor.status = Number(status);
  await f.provider.start(f.input);
  expect(f.provider.read()).toMatchObject({ status: expected, confidence: "NONE", sessionFromCamera: null });
  expect(f.provider.ray(0.5, 0.5)).toBeNull();
  await f.provider.stop();
});

it("keeps a temporarily paused map identity and invalidates calibration after reset or anchor replacement", async () => {
  const f = setup();
  await f.provider.start(f.input);
  const initialSession = f.provider.read()!.sessionId;
  f.tracker.quality = 2;
  f.frame();
  expect(f.provider.read()!.sessionId).toBe(initialSession);
  f.tracker.quality = 1;
  f.frame();
  expect(f.provider.read()!.sessionId).toBe(initialSession);
  f.tracker.quality = 0;
  f.frame();
  const resetSession = f.provider.read()!.sessionId;
  expect(resetSession).not.toBe(initialSession);
  f.frame();
  expect(f.provider.read()!.sessionId).toBe(resetSession);
  f.tracker.quality = 1;
  f.frame();
  f.anchor.id = "new-world";
  f.frame();
  expect(f.provider.read()!.sessionId).not.toBe(resetSession);
  await f.provider.stop();
});

it("does not refresh tracking timestamps for repeated video or SDK frames", async () => {
  const f = setup();
  await f.provider.start(f.input);
  const timestamp = f.provider.read()!.timestampMs;
  const processed = f.pipeline.processGL.mock.calls.length;
  f.frame({ advanceVideo: false });
  expect(f.pipeline.processGL).toHaveBeenCalledTimes(processed);
  expect(f.provider.read()!.timestampMs).toBe(timestamp);
  f.frame({ advanceSdk: false });
  // The skipped video frame advanced our fixture's SDK counter; freeze it explicitly next.
  const freshTimestamp = f.provider.read()!.timestampMs;
  f.frame({ advanceSdk: false, time: 800 });
  expect(f.provider.read()!.timestampMs).toBe(freshTimestamp);
  expect(f.provider.ray(0.5, 0.5)).toBeNull();
  await vi.advanceTimersByTimeAsync(250);
  expect(f.provider.read()).toMatchObject({ status: "LIMITED", sessionFromCamera: null });
  await f.provider.stop();
});

it("cancels pending SDK startup and never constructs tracking resources after late completion", async () => {
  const f = setup();
  let finish!: (sdk: ZapparSdk) => void;
  f.loadSdk.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const starting = f.provider.start(f.input);
  const rejected = expect(starting).rejects.toThrow(/cancelled/);
  await Promise.resolve();
  f.controller.abort();
  await rejected;
  finish(f.sdk);
  await Promise.resolve();
  expect(f.sdk.Pipeline).not.toHaveBeenCalled();
  expect(f.release).toHaveBeenCalledOnce();
});

it.each(["download", "initialization"])("bounds stalled SDK %s and releases the lease", async (phase) => {
  const f = setup();
  if (phase === "download") f.loadSdk.mockImplementation(() => new Promise(() => {}));
  else vi.mocked(f.sdk.loadedPromise).mockImplementation(() => new Promise(() => {}));
  const rejected = expect(f.provider.start(f.input)).rejects.toThrow(/timed out|initialize/);
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(f.release).toHaveBeenCalledOnce();
  expect(f.sdk.Pipeline).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it("releases the lease when secure session ID generation is unavailable", async () => {
  const f = setup();
  vi.stubGlobal("crypto", {});
  await expect(f.provider.start(f.input)).rejects.toThrow(/identifiers/);
  expect(f.release).toHaveBeenCalledOnce();
  expect(f.loadSdk).not.toHaveBeenCalled();
});

it("invalidates room alignment when the SDK frame sequence restarts", async () => {
  const f = setup();
  await f.provider.start(f.input);
  const session = f.provider.read()!.sessionId;
  f.state.frame = 0;
  f.frame({ advanceSdk: false });
  expect(f.provider.read()).toMatchObject({ status: "INITIALIZING", sessionFromCamera: null });
  expect(f.provider.read()!.sessionId).not.toBe(session);
  await f.provider.stop();
});

it.each(["ended", "mute", "orientation", "context", "abort"])(
  "stops and releases all resources on %s",
  async (cause) => {
    const f = setup();
    await f.provider.start(f.input);
    if (cause === "orientation") window.dispatchEvent(new Event("orientationchange"));
    else if (cause === "context") f.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    else if (cause === "abort") f.controller.abort();
    else f.track.dispatchEvent(new Event(cause));
    expect(f.release).toHaveBeenCalledOnce();
    expect(f.provider.read()).toBeNull();
    f.frame();
    await f.provider.stop();
    expect(f.release).toHaveBeenCalledOnce();
  },
);

it("finishes releasing the camera when SDK teardown throws", async () => {
  const f = setup();
  await f.provider.start(f.input);
  f.source.destroy.mockImplementation(() => {
    throw new Error("already lost");
  });
  await f.provider.stop();
  expect(f.pipeline.destroy).toHaveBeenCalledOnce();
  expect(f.release).toHaveBeenCalledOnce();
});

it.each(["pose", "projection"])("fails closed on invalid SDK %s data", async (field) => {
  const f = setup();
  if (field === "pose") f.state.camera[0] = NaN;
  else f.state.projection.fill(0);
  await f.provider.start(f.input);
  expect(f.input.sample.mock.calls.some(([sample]) => sample.status === "LOST")).toBe(true);
  expect(f.provider.read()).toBeNull();
  expect(f.release).toHaveBeenCalledOnce();
});

describe("pose boundary", () => {
  it("preserves SDK world translation without converting attitude into motion", () => {
    expect(zapparCameraPose(new Matrix4().makeTranslation(2, 0.5, -3).elements).position).toEqual({
      x: 2,
      y: 0.5,
      z: -3,
    });
  });
  it.each([
    new Matrix4().makeScale(-1, 1, 1),
    new Matrix4().makeScale(2, 2, 2),
    new Matrix4().makeShear(0.2, 0, 0, 0, 0, 0),
  ])("rejects reflected, scaled or sheared poses", (matrix) => {
    expect(() => zapparCameraPose(matrix.elements)).toThrow(/NONRIGID/);
  });
});

it("loads only a local SRI-checked authorized script and removes it on abort", async () => {
  const f = setup();
  vi.stubGlobal("Zappar", f.sdk);
  let script!: HTMLScriptElement;
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    script = node as HTMLScriptElement;
    return node;
  });
  const result = loadAuthorizedZapparSdk(config, f.controller.signal);
  expect(script.getAttribute("src")).toBe(config.scriptUrl);
  expect(script.integrity).toBe(config.integrity);
  const rejected = expect(result).rejects.toThrow(/cancelled/);
  f.controller.abort();
  await rejected;
  expect(script.onload).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
