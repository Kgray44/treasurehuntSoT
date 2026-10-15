import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import { BrowserCameraBroker } from "@/sextant/camera";
import type { BrowserTrackingSample } from "./browser-world-tracking";
import {
  EighthWallBrowserProvider,
  eighthWallCameraPose,
  type EighthWallAuthorizedConfig,
  type EighthWallPipelineModule,
  type EighthWallSdk,
} from "./eighthwall-browser-provider";

const config: EighthWallAuthorizedConfig = {
  version: "1.0.0",
  scriptUrl: "/api/dev/parallax-tracker/xr.js",
  integrity: "sha256-s5c5NoYvTLd64y0k8lPYoOix3k+ioM9oiDN0KInugp0=",
};
const providers = new Set<EighthWallBrowserProvider>();
afterEach(async () => {
  for (const provider of providers) await provider.stop();
  providers.clear();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function makeStream() {
  const track = Object.assign(new EventTarget(), { readyState: "live", stop: vi.fn() });
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { track, stream };
}

/** Public-API doubles, never a binary or physical tracking qualification. */
function setup() {
  vi.useFakeTimers();
  vi.stubGlobal("isSecureContext", true);
  const getUserMedia = vi.fn();
  const broker = new BrowserCameraBroker({ getUserMedia });
  const { track, stream } = makeStream();
  const host = document.createElement("div"),
    video = document.createElement("video"),
    overlay = document.createElement("div");
  Object.defineProperties(host, { clientWidth: { value: 320 }, clientHeight: { value: 240 } });
  host.append(video, overlay);
  document.body.appendChild(host);
  vi.spyOn(video, "play").mockResolvedValue();
  vi.spyOn(video, "pause").mockImplementation(() => {});
  let now = 100,
    time = 0,
    observer!: EighthWallPipelineModule;
  const projection = new Float32Array(new PerspectiveCamera(60, 4 / 3, 0.005, 1000).projectionMatrix.elements);
  const reality = {
    position: { x: 1, y: 2, z: -3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    intrinsics: projection,
    trackingStatus: "NORMAL",
    trackingReason: "UNSPECIFIED",
  };
  const sdk: EighthWallSdk = {
    initialize: vi.fn(async () => {}),
    loadChunk: vi.fn(async () => {}),
    addCameraPipelineModules: vi.fn((modules) => {
      observer = modules.at(-1)!;
    }),
    removeCameraPipelineModules: vi.fn(),
    stop: vi.fn(() => observer?.onPaused?.()),
    run: vi.fn(({ canvas }) => {
      observer.onCameraStatusChange?.({ status: "hasStream", stream });
      observer.onCameraStatusChange?.({ status: "hasVideo", video });
      observer.onStart?.({ canvasWidth: canvas.width, canvasHeight: canvas.height });
    }),
    XrConfig: { device: () => ({ MOBILE: "mobile" }), camera: () => ({ BACK: "back" }) },
    GlTextureRenderer: { pipelineModule: vi.fn(() => ({ name: "camera-background" })) },
    XrController: {
      configure: vi.fn(() => {
        // The unmodified pinned SDK rejects scale configuration after its first run, even after stop().
        if (vi.mocked(sdk.run).mock.calls.length > 0)
          throw new Error("[XR] Scale can only be changed before calling XR8.run()");
      }),
      pipelineModule: vi.fn(() => ({ name: "reality" })),
      updateCameraProjectionMatrix: vi.fn(),
    },
  };
  const loadSdk = vi.fn(async () => sdk),
    controller = new AbortController();
  const provider = new EighthWallBrowserProvider(config, { loadSdk, now: () => now });
  providers.add(provider);
  const input = {
    broker,
    video,
    signal: controller.signal,
    motionGranted: true,
    sample: vi.fn<(sample: BrowserTrackingSample) => void>(),
  };
  const frame = (options: { repeat?: boolean; sameTime?: boolean; at?: number } = {}) => {
    now = options.at ?? now + 34;
    if (!options.sameTime) time += 1 / 30;
    observer.onUpdate?.({
      frameStartResult: { videoTime: time, repeatFrame: options.repeat ?? false },
      processCpuResult: { reality },
    });
  };
  return {
    provider,
    input,
    sdk,
    loadSdk,
    broker,
    getUserMedia,
    track,
    stream,
    video,
    host,
    overlay,
    reality,
    projection,
    controller,
    frame,
    observer: () => observer,
    setNow: (value: number) => {
      now = value;
    },
  };
}

it("reserves before SDK capture, adopts one real stream, and keeps all authored rendering outside the SDK", async () => {
  const f = setup();
  vi.mocked(f.sdk.run).mockImplementation(({ canvas }) => {
    expect(f.broker.state).toBe("REQUESTING");
    f.observer().onCameraStatusChange?.({ status: "hasStream", stream: f.stream });
    f.observer().onCameraStatusChange?.({ status: "hasVideo", video: f.video });
    f.observer().onStart?.({ canvasWidth: canvas.width, canvasHeight: canvas.height });
  });
  await f.provider.startManaged(f.input);
  expect(f.getUserMedia).not.toHaveBeenCalled();
  expect(f.broker.ownedTracks).toBe(1);
  expect(f.video.srcObject).toBe(f.stream);
  expect(f.video.play).not.toHaveBeenCalled();
  expect(f.video.style.visibility).toBe("hidden");
  const canvas = f.host.querySelector("canvas")!;
  expect(canvas.nextSibling).toBe(f.overlay);
  expect(canvas.width).toBe(320);
  expect(canvas.height).toBe(240);
  expect(f.sdk.addCameraPipelineModules).toHaveBeenCalledWith([
    expect.objectContaining({ name: "camera-background" }),
    expect.objectContaining({ name: "reality" }),
    expect.objectContaining({ onUpdate: expect.any(Function) }),
  ]);
  f.frame();
  expect(f.provider.read()).toMatchObject({
    method: "VISUAL_SLAM",
    status: "TRACKING",
    confidence: "POSITION_NO_SCALE",
    sessionFromCamera: { position: { x: 1, y: 2, z: -3 }, scale: 1 },
  });
  expect(f.provider.ray(0.5, 0.5)?.direction.z).toBeCloseTo(-1);
  expect(f.provider.planes()).toEqual([]);
  expect(f.provider.hitTest()).toBeNull();
  await f.provider.stop();
  expect(f.broker.ownedTracks).toBe(0);
  expect(f.track.stop).toHaveBeenCalledOnce();
  expect(f.sdk.stop).toHaveBeenCalledOnce();
  expect(f.sdk.removeCameraPipelineModules).toHaveBeenCalledOnce();
  expect(f.video.style.visibility).toBe("");
  expect(f.host.querySelector("canvas")).toBeNull();
});

it("refuses pre-acquired camera leases before opening a second source", async () => {
  const f = setup(),
    release = vi.fn();
  await expect(f.provider.start({ ...f.input, lease: { stream: f.stream, release } as never })).rejects.toThrow(
    /pre-opened/,
  );
  expect(release).toHaveBeenCalledOnce();
  expect(f.loadSdk).not.toHaveBeenCalled();
  expect(f.sdk.run).not.toHaveBeenCalled();
});

it.each(["permission", "https", "integrity"])("does not load an SDK without %s", async (kind) => {
  const f = setup();
  let provider = f.provider;
  if (kind === "permission") f.input.motionGranted = false;
  if (kind === "https") vi.stubGlobal("isSecureContext", false);
  if (kind === "integrity") {
    provider = new EighthWallBrowserProvider({ ...config, integrity: "sha256-unknown" }, { loadSdk: f.loadSdk });
    providers.add(provider);
  }
  await expect(provider.startManaged(f.input)).rejects.toThrow();
  expect(f.loadSdk).not.toHaveBeenCalled();
  expect(f.broker.ownedTracks).toBe(0);
});

it("keeps responsive world scale explicitly relative and normalizes the same camera projection for rays and pixels", async () => {
  const f = setup();
  await f.provider.startManaged(f.input);
  expect(f.sdk.XrController.configure).toHaveBeenCalledWith(
    expect.objectContaining({
      scale: "responsive",
      leftHandedAxes: false,
      mirroredDisplay: false,
      disableWorldTracking: false,
    }),
  );
  f.frame();
  const projection = f.provider.cameraProjection(640, 240, 0.1, 50)!;
  expect(projection[0]).toBeCloseTo(f.projection[0] / 2);
  expect(projection[5]).toBeCloseTo(f.projection[5]);
  expect(projection[10]).toBeCloseTo(-50.1 / 49.9);
  expect(f.provider.ray(-1, 0.5)).toBeNull();
});

it("rejects LIMITED output and invalidates room registration after reinitialization", async () => {
  const f = setup();
  await f.provider.startManaged(f.input);
  f.frame();
  const session = f.provider.read()!.sessionId;
  f.reality.trackingStatus = "LIMITED";
  f.frame();
  expect(f.provider.read()).toMatchObject({ status: "LIMITED", sessionFromCamera: null });
  expect(f.provider.ray(0.5, 0.5)).toBeNull();
  f.reality.trackingReason = "INITIALIZING";
  f.frame();
  const reset = f.provider.read()!.sessionId;
  expect(reset).not.toBe(session);
  f.frame();
  expect(f.provider.read()!.sessionId).toBe(reset);
  f.reality.trackingStatus = "NORMAL";
  f.frame();
  expect(f.provider.read()).toMatchObject({ status: "TRACKING", sessionId: reset });
});

it("never refreshes repeated-frame poses and pauses stale interactions", async () => {
  const f = setup();
  await f.provider.startManaged(f.input);
  f.frame();
  const timestamp = f.provider.read()!.timestampMs;
  f.frame({ repeat: true });
  expect(f.provider.read()!.timestampMs).toBe(timestamp);
  f.frame({ sameTime: true });
  const latestTimestamp = f.provider.read()!.timestampMs;
  f.frame({ sameTime: true, at: 900 });
  expect(f.provider.read()!.timestampMs).toBe(latestTimestamp);
  expect(f.provider.ray(0.5, 0.5)).toBeNull();
  await vi.advanceTimersByTimeAsync(250);
  expect(f.provider.read()).toMatchObject({ status: "LIMITED", sessionFromCamera: null });
});

it.each(["abort", "ended", "exception", "orientation", "context", "resize"])(
  "cleans up SDK capture on %s",
  async (cause) => {
    const f = setup();
    await f.provider.startManaged(f.input);
    f.frame();
    if (cause === "abort") f.controller.abort();
    if (cause === "ended") f.track.dispatchEvent(new Event("ended"));
    if (cause === "exception") f.observer().onException?.(new Error("private SDK detail"));
    if (cause === "orientation") window.dispatchEvent(new Event("orientationchange"));
    if (cause === "context")
      f.host.querySelector("canvas")!.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    if (cause === "resize") f.observer().onCanvasSizeChange?.({ canvasWidth: 240, canvasHeight: 320 });
    expect(f.provider.read()).toBeNull();
    expect(f.broker.ownedTracks).toBe(0);
    expect(f.sdk.stop).toHaveBeenCalledOnce();
    expect(f.input.sample.mock.calls.flatMap(([sample]) => [sample.reason]).join()).not.toContain("private SDK detail");
  },
);

it("bounds stalled SDK initialization before any camera opens", async () => {
  const f = setup();
  vi.mocked(f.sdk.initialize).mockImplementation(() => new Promise(() => {}));
  const rejected = expect(f.provider.startManaged(f.input)).rejects.toThrow(/initialize/);
  await vi.advanceTimersByTimeAsync(15000);
  await rejected;
  expect(f.sdk.run).not.toHaveBeenCalled();
  expect(f.broker.state).toBe("DISABLED");
});

it("releases a pending permission reservation and rejects late streams after cancellation", async () => {
  const f = setup();
  vi.mocked(f.sdk.run).mockImplementation(() => {});
  const starting = f.provider.startManaged(f.input);
  const rejected = expect(starting).rejects.toThrow("Browser AR opening was cancelled.");
  await vi.advanceTimersByTimeAsync(0);
  f.controller.abort();
  await rejected;
  const late = makeStream();
  f.observer().onCameraStatusChange?.({ status: "hasStream", stream: late.stream });
  expect(late.track.stop).toHaveBeenCalledOnce();
  expect(f.broker.ownedTracks).toBe(0);
});

it.each([
  ["camera failed", "Safari could not open the rear camera. Check camera permission and retry."],
  ["exception", "8th Wall stopped with a camera or tracking error. Restart browser AR."],
  ["async exception", "8th Wall stopped with a camera or tracking error. Restart browser AR."],
  ["paused", "Camera tracking paused. Restart and align the room again."],
  ["run rejected", "8th Wall could not start this device's camera session."],
] as const)(
  "preserves the first %s startup failure through cleanup and permits a clean retry",
  async (cause, reason) => {
    const f = setup();
    vi.mocked(f.sdk.run).mockImplementation(() => {
      f.observer().onCameraStatusChange?.({ status: "hasStream", stream: f.stream });
      if (cause === "camera failed") f.observer().onCameraStatusChange?.({ status: "failed" });
      if (cause === "exception") f.observer().onException?.(new Error("private SDK detail"));
      if (cause === "async exception")
        return Promise.resolve().then(() => f.observer().onException?.(new Error("private SDK detail")));
      if (cause === "paused") f.observer().onPaused?.();
      if (cause === "run rejected") return Promise.reject(new Error("private SDK detail"));
    });
    await expect(f.provider.startManaged(f.input)).rejects.toThrow(reason);
    expect(f.provider.read()).toBeNull();
    expect(f.broker.state).toBe("DISABLED");
    expect(f.broker.ownedTracks).toBe(0);
    expect(f.track.stop).toHaveBeenCalledOnce();
    // stop() itself emits onPaused; that cleanup callback must not replace the first failure.
    expect(f.sdk.stop).toHaveBeenCalledOnce();
    expect(f.sdk.removeCameraPipelineModules).toHaveBeenCalledOnce();
    expect(f.video.srcObject).toBeNull();
    expect(f.video.style.visibility).toBe("");
    expect(f.host.querySelector("canvas")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(f.input.sample.mock.calls.map(([sample]) => sample.reason).join()).not.toContain("private SDK detail");

    const retry = makeStream();
    vi.mocked(f.sdk.run).mockImplementation(({ canvas }) => {
      f.observer().onCameraStatusChange?.({ status: "hasStream", stream: retry.stream });
      f.observer().onCameraStatusChange?.({ status: "hasVideo", video: f.video });
      f.observer().onStart?.({ canvasWidth: canvas.width, canvasHeight: canvas.height });
    });
    await f.provider.startManaged(f.input);
    f.frame();
    expect(f.provider.read()).toMatchObject({ status: "TRACKING", confidence: "POSITION_NO_SCALE" });
    expect(f.broker.ownedTracks).toBe(1);
    expect(f.video.srcObject).toBe(retry.stream);
    expect(f.sdk.XrController.configure).toHaveBeenCalledOnce();
    expect(f.getUserMedia).not.toHaveBeenCalled();
    await f.provider.stop();
    expect(retry.track.stop).toHaveBeenCalledOnce();
    expect(f.sdk.stop).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each(["pose", "projection"])("fails closed on malformed %s data", async (field) => {
  const f = setup();
  await f.provider.startManaged(f.input);
  if (field === "pose") f.reality.rotation.w = 0;
  else f.projection.fill(0);
  f.frame();
  expect(f.provider.read()).toBeNull();
  expect(f.input.sample.mock.calls.some(([sample]) => sample.status === "LOST")).toBe(true);
  expect(f.broker.ownedTracks).toBe(0);
});

it("preserves documented right-handed camera translation and rejects nonfinite or invalid rotations", () => {
  expect(
    eighthWallCameraPose({ position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }).position,
  ).toEqual({ x: 1, y: 2, z: 3 });
  expect(() =>
    eighthWallCameraPose({ position: { x: NaN, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }),
  ).toThrow(/INVALID_POSE/);
});

async function loaderFixture() {
  const f = setup();
  vi.resetModules();
  const { loadAuthorizedEighthWallSdk } = await import("./eighthwall-browser-provider");
  const scripts: HTMLScriptElement[] = [];
  vi.spyOn(document.head, "appendChild").mockImplementation((element) => {
    scripts.push(element as HTMLScriptElement);
    return element;
  });
  return { ...f, load: loadAuthorizedEighthWallSdk, scripts };
}

it("caches one verified SDK for ordinary restarts instead of executing the core script again", async () => {
  const f = await loaderFixture();
  const loaded = f.load(config, f.controller.signal);
  const script = f.scripts[0];
  expect(script.getAttribute("src")).toBe(config.scriptUrl);
  expect(script.integrity).toBe(config.integrity);
  expect(script.getAttribute("data-preload-chunks")).toBe("slam");
  vi.stubGlobal("XR8", f.sdk);
  script.dispatchEvent(new Event("load"));
  window.dispatchEvent(new Event("xrloaded"));
  expect(await loaded).toBe(f.sdk);
  expect(await f.load(config, new AbortController().signal)).toBe(f.sdk);
  expect(f.scripts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("reuses fixed SDK configuration across sequential provider instances without changing locked scale", async () => {
  const f = setup();
  await f.provider.startManaged(f.input);
  await f.provider.stop();
  const retry = makeStream();
  vi.mocked(f.sdk.run).mockImplementation(({ canvas }) => {
    f.observer().onCameraStatusChange?.({ status: "hasStream", stream: retry.stream });
    f.observer().onCameraStatusChange?.({ status: "hasVideo", video: f.video });
    f.observer().onStart?.({ canvasWidth: canvas.width, canvasHeight: canvas.height });
  });
  const nextProvider = new EighthWallBrowserProvider(config, { loadSdk: f.loadSdk });
  providers.add(nextProvider);
  await nextProvider.startManaged(f.input);
  expect(f.sdk.XrController.configure).toHaveBeenCalledOnce();
  expect(f.sdk.run).toHaveBeenCalledTimes(2);
  expect(f.broker.ownedTracks).toBe(1);
  await nextProvider.stop();
  expect(f.track.stop).toHaveBeenCalledOnce();
  expect(retry.track.stop).toHaveBeenCalledOnce();
  expect(f.broker.ownedTracks).toBe(0);
});

it("configures each fresh SDK identity before its first pipeline and camera run", async () => {
  const first = setup();
  await first.provider.startManaged(first.input);
  await first.provider.stop();
  const second = setup();
  await second.provider.startManaged(second.input);
  expect(first.sdk).not.toBe(second.sdk);
  for (const sdk of [first.sdk, second.sdk]) {
    expect(sdk.XrController.configure).toHaveBeenCalledOnce();
    expect(sdk.XrController.configure).toHaveBeenCalledWith({
      disableWorldTracking: false,
      enableWorldPoints: false,
      scale: "responsive",
      leftHandedAxes: false,
      mirroredDisplay: false,
    });
    expect(vi.mocked(sdk.XrController.configure).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sdk.XrController.pipelineModule).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(sdk.XrController.configure).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sdk.addCameraPipelineModules).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(sdk.XrController.configure).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sdk.run).mock.invocationCallOrder[0],
    );
  }
});

it("does not cache a failed configuration as successful and permits retry before the first run", async () => {
  const f = setup();
  vi.mocked(f.sdk.XrController.configure).mockImplementationOnce(() => {
    throw new Error("SDK configuration unavailable");
  });
  await expect(f.provider.startManaged(f.input)).rejects.toThrow("SDK configuration unavailable");
  expect(f.sdk.run).not.toHaveBeenCalled();
  expect(f.broker.state).toBe("DISABLED");
  expect(f.host.querySelector("canvas")).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  await f.provider.startManaged(f.input);
  expect(f.sdk.XrController.configure).toHaveBeenCalledTimes(2);
  expect(f.sdk.run).toHaveBeenCalledOnce();
  expect(f.broker.ownedTracks).toBe(1);
});

it("waits for its own script integrity/load completion even if xrloaded arrives first", async () => {
  const f = await loaderFixture();
  let resolved = false;
  const loaded = f.load(config, f.controller.signal).then((sdk) => {
    resolved = true;
    return sdk;
  });
  vi.stubGlobal("XR8", f.sdk);
  window.dispatchEvent(new Event("xrloaded"));
  await vi.advanceTimersByTimeAsync(0);
  expect(resolved).toBe(false);
  f.scripts[0].dispatchEvent(new Event("load"));
  expect(await loaded).toBe(f.sdk);
});

it("cancels one consumer promptly while retaining one bootstrap and rejecting a stale unverified global", async () => {
  const f = await loaderFixture();
  const unverified = { ...f.sdk };
  vi.stubGlobal("XR8", unverified);
  const abandoned = f.load(config, f.controller.signal);
  const rejected = expect(abandoned).rejects.toThrow(/cancelled/);
  f.controller.abort();
  await rejected;
  let resolved = false;
  const retry = f.load(config, new AbortController().signal).then((sdk) => {
    resolved = true;
    return sdk;
  });
  expect(f.scripts).toHaveLength(1);
  f.scripts[0].dispatchEvent(new Event("load"));
  window.dispatchEvent(new Event("xrloaded"));
  await vi.advanceTimersByTimeAsync(0);
  expect(resolved).toBe(false);
  vi.stubGlobal("XR8", f.sdk);
  window.dispatchEvent(new Event("xrloaded"));
  expect(await retry).toBe(f.sdk);
  expect(f.scripts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("keeps failed or partial bootstrap rejected until page reload instead of executing over it", async () => {
  const f = await loaderFixture();
  const failed = expect(f.load(config, f.controller.signal)).rejects.toThrow(/integrity/);
  f.scripts[0].dispatchEvent(new Event("error"));
  await failed;
  vi.stubGlobal("XR8", f.sdk);
  await expect(f.load(config, new AbortController().signal)).rejects.toThrow(/Reload the page/);
  expect(f.scripts).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});
