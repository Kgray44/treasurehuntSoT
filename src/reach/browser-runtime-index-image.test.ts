// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReachBrowserRuntime, type IndexImageObservation, type ReachInferenceMetrics } from "./browser-runtime";
import type { HandResult } from "@/watchglass/hand-provider";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { IndexImageTracker } from "./index-image-tracker";
import { IndexImageObservationGate } from "./index-image-observation";

type Bitmap = { rgba: Uint8ClampedArray; close: ReturnType<typeof vi.fn> };
type FrameMessage = { type: "FRAME"; generation: number; capture: number; bitmap: Bitmap };
const sessions: ReachBrowserRuntime[] = [];
afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function pixels() {
  const data = new Uint8ClampedArray(320 * 240 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i + 1] = data[i + 2] = 30;
    data[i + 3] = 255;
  }
  for (let dy = -10; dy <= 10; dy++)
    for (let dx = -10; dx <= 10; dx++) {
      const i = ((120 + dy) * 320 + 160 + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 45 + ((dx * 73 + dy * 127 + dx * dy * 19 + 100000) % 135);
    }
  return data;
}
function setup(
  options: {
    focused?: boolean;
    imageConsumer?: boolean;
    imageCostMs?: number;
    callbackCostMs?: number;
    frameCallbacks?: boolean;
    backend?: "CPU_WASM" | "GPU_WEBGL";
    imageFailure?: "DRAW" | "READBACK";
    calibrationCollecting?: boolean;
    metricsThrows?: boolean;
  } = {},
) {
  vi.useFakeTimers();
  let now = 100;
  let visible: DocumentVisibilityState = "visible";
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible);
  vi.spyOn(document, "hasFocus").mockReturnValue(options.focused ?? true);
  vi.stubGlobal("isSecureContext", true);
  const drawn: Bitmap[] = [];
  const events: string[] = [];
  const contexts: { bitmap: Bitmap | null }[] = [];
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
      getContext() {
        const state = { bitmap: null as Bitmap | null };
        contexts.push(state);
        return {
          drawImage(bitmap: Bitmap) {
            if (options.imageFailure === "DRAW") throw new Error("DRAW_FAILED");
            state.bitmap = bitmap;
            drawn.push(bitmap);
          },
          getImageData() {
            if (options.imageFailure === "READBACK") throw new Error("READBACK_FAILED");
            events.push("PIXEL_READBACK");
            now += options.imageCostMs ?? 0;
            return { data: state.bitmap!.rgba };
          },
        };
      }
    },
  );
  const video = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    srcObject: null,
    readyState: 4,
    currentTime: 1,
    presentedFrames: 1,
    getVideoPlaybackQuality() {
      return { totalVideoFrames: this.presentedFrames, droppedVideoFrames: 0 };
    },
    videoWidth: 320,
    videoHeight: 240,
    rgba: pixels(),
  };
  const bitmap = vi.fn<() => Promise<Bitmap>>(async () => ({ rgba: video.rgba.slice(), close: vi.fn() }));
  const callbacks = new Map<number, VideoFrameRequestCallback>();
  let callbackId = 0;
  const cancelVideoFrame = vi.fn((id: number) => callbacks.delete(id));
  const presented = (frame: number, mediaTime: number) => {
    const pending = [...callbacks.entries()].at(-1)!;
    callbacks.delete(pending[0]);
    pending[1](now, {
      presentedFrames: frame,
      mediaTime,
      width: 320,
      height: 240,
      presentationTime: now,
      expectedDisplayTime: now,
      processingDuration: 0,
    });
  };
  if (options.frameCallbacks)
    Object.assign(video, {
      requestVideoFrameCallback: (callback: VideoFrameRequestCallback) => {
        const id = ++callbackId;
        callbacks.set(id, callback);
        return id;
      },
      cancelVideoFrameCallback: cancelVideoFrame,
    });
  vi.stubGlobal("createImageBitmap", bitmap);
  const workers: {
    generation: number;
    onmessage: ((event: MessageEvent) => void) | null;
    frames: FrameMessage[];
    transfers: unknown[][];
    terminate: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      generation = 0;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      frames: FrameMessage[] = [];
      transfers: unknown[][] = [];
      terminate = vi.fn();
      constructor() {
        workers.push(this);
      }
      postMessage(message: { type: string; generation: number }, transfer: unknown[] = []) {
        if (message.type === "INIT") this.generation = message.generation;
        if (message.type === "FRAME") {
          events.push("WORKER_FRAME_POSTED");
          this.frames.push(message as FrameMessage);
          this.transfers.push(transfer);
        }
      }
    },
  );
  const track = {
    readyState: "live",
    stop: vi.fn(() => {
      track.readyState = "ended";
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const media = {
    getUserMedia: vi.fn(
      async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }) as unknown as MediaStream,
    ),
  };
  const observe = vi.fn(),
    metrics = vi.fn<(packet: ReachInferenceMetrics) => void>(() => {
      if (options.metricsThrows) throw new Error("OPTIONAL_METRICS_FAILED");
    }),
    image = vi.fn<(observation: IndexImageObservation) => void>(() => {
      now += options.callbackCostMs ?? 0;
    }),
    status = vi.fn();
  const runtime = new ReachBrowserRuntime(
    video as unknown as HTMLVideoElement,
    observe,
    status,
    media,
    undefined,
    options.imageConsumer === false ? undefined : image,
    metrics,
  );
  sessions.push(runtime);
  // Source integration cases use active collection; normal tracking is covered
  // separately below so both phase ceilings are explicit in the fixture.
  runtime.setCalibrationCollecting(options.calibrationCollecting ?? true);
  const hint = { x: 160 / 319, y: 120 / 239 };
  return {
    runtime,
    video,
    workers,
    image,
    observe,
    metrics,
    status,
    track,
    bitmap,
    drawn,
    contexts,
    events,
    hint,
    presented,
    cancelVideoFrame,
    callbacks,
    async start(seed = true, expectFrame = true) {
      await runtime.start(true, true);
      if (seed) expect(runtime.seedIndex(hint)).toBe(true);
      if (options.frameCallbacks) presented(1, video.currentTime);
      const worker = workers.at(-1)!;
      worker.onmessage!({
        data: {
          type: "READY",
          generation: worker.generation,
          ...(options.backend ? { backend: options.backend } : {}),
        },
      } as MessageEvent);
      await Promise.resolve();
      if (expectFrame) expect(worker.frames).toHaveLength(1);
      return worker;
    },
    async advance(ms: number) {
      now += ms;
      await vi.advanceTimersByTimeAsync(ms);
    },
    freshFrame() {
      video.currentTime += 1 / 30;
      video.presentedFrames++;
    },
    result(capture?: number, landmarks: HandResult["landmarks"] = []) {
      const worker = workers.at(-1)!;
      worker.onmessage!({
        data: {
          type: "RESULT",
          generation: worker.generation,
          capture: capture ?? worker.frames.at(-1)!.capture,
          inferenceTime: performance.timeOrigin + now,
          width: 320,
          height: 240,
          result: { landmarks, handedness: landmarks.map(() => [{ categoryName: "Right", score: 0.99 }]) },
          ...(options.backend ? { backend: options.backend } : {}),
        },
      } as MessageEvent);
    },
    hide() {
      visible = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

describe("runtime image source integration", () => {
  it("reports only scalar gate disposition and preserves rejected-packet denominators", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result();
    expect(s.metrics).toHaveBeenLastCalledWith({
      disposition: "ACCEPTED",
      packetAgeMs: 10,
      modelResultMs: 10,
      preprocessingMs: 0,
      frameIntervalMs: null,
      handCount: 0,
    });
    s.freshFrame();
    await s.advance(7);
    const capture = worker.frames.at(-1)!.capture;
    await s.advance(151);
    s.result(capture);
    expect(s.metrics).toHaveBeenLastCalledWith(
      expect.objectContaining({ disposition: "LATE", packetAgeMs: 151, handCount: null }),
    );
    for (const [packet] of s.metrics.mock.calls) {
      expect(Object.keys(packet).sort()).toEqual(
        ["disposition", "packetAgeMs", "modelResultMs", "preprocessingMs", "frameIntervalMs", "handCount"].sort(),
      );
      expect(
        Object.values(packet).every((value) => value === null || ["string", "number"].includes(typeof value)),
      ).toBe(true);
    }
  });
  it("isolates aggregate diagnostic failures from inference and image tracking", async () => {
    const s = setup({ metricsThrows: true });
    await s.start();
    await s.advance(10);
    s.result();
    expect(s.metrics).toHaveBeenCalledOnce();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.status).toHaveBeenLastCalledWith("READY");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("applies administrative limits to a pending timer without restarting the camera or image identity", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result();
    const first = s.image.mock.calls[0][0];
    const resources = s.runtime.resources();
    s.runtime.setTrackingLimits({
      modelMaximumHz: 60,
      normalMaximumHz: 10,
      calibrationMaximumHz: 20,
      unfocusedMaximumHz: 5,
    });
    expect(s.runtime.trackingPacing()?.maximumHz).toBe(20);
    expect(s.runtime.resources()).toEqual(resources);
    s.freshFrame();
    await s.advance(7);
    expect(worker.frames).toHaveLength(1);
    await s.advance(32);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    await s.advance(10);
    s.result();
    expect(s.image.mock.calls[1][0]).toMatchObject({
      state: "TRACKING",
      trackId: first.trackId,
      trackGeneration: first.trackGeneration,
      providerGeneration: first.providerGeneration,
      cameraLeaseId: first.cameraLeaseId,
    });
    expect(s.track.stop).not.toHaveBeenCalled();
    expect(worker.terminate).not.toHaveBeenCalled();
  });
  it("validates administrative limits even before a camera session is started", () => {
    const s = setup();
    expect(() =>
      s.runtime.setTrackingLimits({
        modelMaximumHz: 60,
        normalMaximumHz: 5,
        calibrationMaximumHz: 60,
        unfocusedMaximumHz: 8,
      }),
    ).toThrow("REACH_TRACKING_LIMITS_INVALID");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("uses policy supplied before startup for the first scheduled collection interval", async () => {
    const s = setup();
    s.runtime.setTrackingLimits({
      modelMaximumHz: 60,
      normalMaximumHz: 10,
      calibrationMaximumHz: 20,
      unfocusedMaximumHz: 5,
    });
    const worker = await s.start();
    expect(s.runtime.trackingPacing()).toMatchObject({ maximumHz: 20, calibrationCollecting: true });
    await s.advance(10);
    s.result();
    s.freshFrame();
    await s.advance(39);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
  });
  it("uses the normal 15Hz ceiling unless the Lab explicitly marks active collection", async () => {
    const s = setup({ calibrationCollecting: false });
    const worker = await s.start();
    expect(s.runtime.trackingPacing()).toMatchObject({ calibrationCollecting: false, maximumHz: 15 });
    await s.advance(10);
    s.result();
    s.freshFrame();
    await s.advance(56);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture - worker.frames[0].capture).toBeGreaterThanOrEqual(1000 / 15);
  });
  it("does not let an already scheduled fast capture bypass a collection pause", async () => {
    const s = setup();
    const worker = await s.start();
    expect(s.runtime.trackingPacing()).toMatchObject({ calibrationCollecting: true, maximumHz: 60 });
    await s.advance(10);
    s.result();
    s.freshFrame();
    s.runtime.setCalibrationCollecting(false);
    expect(s.runtime.trackingPacing()).toMatchObject({ calibrationCollecting: false, maximumHz: 15 });
    await s.advance(7);
    expect(worker.frames).toHaveLength(1);
    await s.advance(49);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture - worker.frames[0].capture).toBeGreaterThanOrEqual(1000 / 15);
  });
  it("preserves one-in-flight backpressure when collection becomes active", async () => {
    const s = setup({ calibrationCollecting: false });
    const worker = await s.start();
    s.runtime.setCalibrationCollecting(true);
    s.freshFrame();
    await s.advance(20);
    expect(worker.frames).toHaveLength(1);
    s.result();
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    expect(s.runtime.trackingPacing()).toMatchObject({ calibrationCollecting: true, maximumHz: 60 });
  });
  it("prepares clean optical candidates after posting the exact worker bitmap but commits only its paired result", async () => {
    const prepare = vi.spyOn(IndexImageTracker.prototype, "prepare");
    const complete = vi.spyOn(IndexImageTracker.prototype, "complete");
    const s = setup();
    const worker = await s.start();
    expect(s.events).toEqual(["WORKER_FRAME_POSTED", "PIXEL_READBACK"]);
    expect(prepare).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    expect(s.image).not.toHaveBeenCalled();
    await s.advance(10);
    s.result();
    expect(complete).toHaveBeenCalledOnce();
    expect(s.image.mock.calls[0][0].monotonicCaptureTime).toBe(worker.frames[0].capture);
  });
  it("does not treat a malformed hand envelope as model-unavailable image authority", async () => {
    const complete = vi.spyOn(IndexImageTracker.prototype, "complete");
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    worker.onmessage!({
      data: {
        type: "RESULT",
        generation: worker.generation,
        capture: worker.frames[0].capture,
        inferenceTime: NaN,
        width: 320,
        height: 240,
        result: { landmarks: [], handedness: [] },
      },
    } as MessageEvent);
    expect(s.observe).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
  });
  it.each(["DRAW", "READBACK", "PREPARE", "COMPLETE", "GATE"] as const)(
    "signals an actual %s image rejection even when the paired hand result is valid",
    async (failure) => {
      if (failure === "PREPARE")
        vi.spyOn(IndexImageTracker.prototype, "prepare").mockImplementationOnce(() => {
          throw new Error("PREPARE_FAILED");
        });
      if (failure === "COMPLETE")
        vi.spyOn(IndexImageTracker.prototype, "complete").mockImplementationOnce(() => {
          throw new Error("COMPLETE_FAILED");
        });
      if (failure === "GATE")
        vi.spyOn(IndexImageObservationGate.prototype, "accept").mockImplementationOnce(() => {
          throw new Error("GATE_FAILED");
        });
      const s = setup({ imageFailure: failure === "DRAW" || failure === "READBACK" ? failure : undefined });
      await s.start();
      await s.advance(10);
      s.result();
      expect(s.observe).toHaveBeenCalledOnce();
      expect(s.image).not.toHaveBeenCalled();
      expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
      expect(s.runtime.resources().workers).toBe(1);
    },
  );
  it("keeps a fresh accepted image source valid when an optional consumer throws", async () => {
    const s = setup();
    await s.start();
    s.image.mockImplementationOnce(() => {
      throw new Error("CONSUMER_FAILED");
    });
    await s.advance(120);
    s.result();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.image.mock.calls[0][0].monotonicCaptureTime).toBe(100);
    expect(s.status).toHaveBeenLastCalledWith("READY");
  });
  it("wakes on a fresh presentation after a due capture found no frame, without another full interval", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    await s.advance(7);
    expect(worker.frames).toHaveLength(1);
    expect(s.runtime.resources().timers).toBe(0);
    await s.advance(3);
    s.presented(2, 1.1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture - worker.frames[0].capture).toBeLessThan(25);
  });
  it("never wakes a second inference while the current worker result is pending", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start();
    for (let frame = 2; frame <= 5; ++frame) {
      await s.advance(20);
      s.presented(frame, frame / 30);
      await s.advance(1);
    }
    expect(worker.frames).toHaveLength(1);
    s.result();
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
  });
  it("keeps the visible-unfocused ceiling when a fresh presentation wakes the loop", async () => {
    const s = setup({ frameCallbacks: true, focused: false });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.presented(2, 1.1);
    await s.advance(114);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
  });
  it("binds actual CPU results and rejects a backend switch", async () => {
    const s = setup({ backend: "CPU_WASM" });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    expect(s.observe.mock.calls[0][0].inferenceBackend).toBe("CPU_WASM");
    worker.onmessage!({
      data: { type: "RESULT", generation: worker.generation, backend: "GPU_WEBGL" },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_BACKEND_CHANGED");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("rejects an unsupported GPU startup instead of silently changing the accepted model pipeline", async () => {
    const s = setup({ backend: "GPU_WEBGL" });
    await s.start(true, false);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_BACKEND_CHANGED");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  function modelPose(point: { x: number; y: number }, options: Parameters<typeof pointingPose>[0] = {}) {
    const pose = pointingPose(options);
    const dx = point.x - pose[8].x,
      dy = point.y - pose[8].y;
    return pose.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z }));
  }

  it("gives a coherent full hand gesture authority while preserving independent image coordinates and identity", async () => {
    const s = setup();
    await s.start();
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    const first = s.image.mock.calls.at(-1)![0];
    expect(first).toMatchObject({ state: "TRACKING", point: s.hint, modelAgreement: "AGREE" });
    const next = async (landmarks: HandResult["landmarks"] = []) => {
      const count = s.workers.at(-1)!.frames.length;
      s.freshFrame();
      await s.advance(7);
      expect(s.workers.at(-1)!.frames).toHaveLength(count + 1);
      await s.advance(10);
      s.result(undefined, landmarks);
      return s.image.mock.calls.at(-1)![0];
    };
    const open = modelPose(s.hint, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] });
    expect(await next([open])).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: s.hint,
      reason: "FULL_HAND_CONTRARY_PENDING",
    });
    // One questionable whole-hand result cannot leave an indefinite veto.
    expect(await next()).toMatchObject({ state: "TRACKING", point: s.hint, trackId: first.trackId });
    for (let i = 0; i < 9; i++) await next([open]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      reason: "FULL_HAND_CONTRARY_CONFIRMED",
    });
    expect(await next()).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      trackId: first.trackId,
      reason: "FULL_HAND_CONTRARY_AWAITING_POINT",
    });
    // Clearing a confirmed negative also needs compatible temporal evidence.
    expect(await next([modelPose(s.hint)])).toMatchObject({ state: "UNCERTAIN", point: null, trackId: first.trackId });
    for (let i = 0; i < 8; i++) await next([modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({ state: "TRACKING", point: s.hint, trackId: first.trackId });
  });

  it("cannot bypass an available contrary full hand with a manual appearance hint", async () => {
    const s = setup();
    await s.start();
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] })]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      reason: "FULL_HAND_CONTRARY_PENDING",
    });
  });

  it("pauses a disagreeing full-hand return without latching its wrong digit", async () => {
    const s = setup();
    await s.start();
    await s.advance(10);
    s.result(undefined, [
      modelPose({ x: s.hint.x + 0.12, y: s.hint.y }, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] }),
    ]);
    const conflict = s.image.mock.calls.at(-1)![0];
    expect(conflict).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      matchedPoint: s.hint,
      reason: "FULL_HAND_INDEX_CONFLICT",
    });
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result();
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "TRACKING",
      point: s.hint,
      trackId: conflict.trackId,
    });
  });

  it.each(["MISSING_INDEX", "TWO_FULL_HANDS", "POINT_CONFLICT"] as const)(
    "pauses%s without snapping image coordinates or fabricating a missing index",
    async (scenario) => {
      const s = setup();
      await s.start();
      await s.advance(10);
      const pose = modelPose(s.hint);
      if (scenario === "MISSING_INDEX") pose[8].x = -0.1;
      const landmarks =
        scenario === "TWO_FULL_HANDS"
          ? [modelPose({ x: s.hint.x - 0.14, y: s.hint.y }), modelPose({ x: s.hint.x + 0.14, y: s.hint.y })]
          : scenario === "POINT_CONFLICT"
            ? [modelPose({ x: s.hint.x + 0.12, y: s.hint.y })]
            : [pose];
      s.result(undefined, landmarks);
      expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
        state: "UNCERTAIN",
        point: null,
        reason: scenario === "POINT_CONFLICT" ? "FULL_HAND_INDEX_CONFLICT" : "FULL_HAND_AMBIGUOUS",
      });
    },
  );
  it("pairs clean pixels with the exact worker bitmap/capture and emits no pixel or model payload", async () => {
    const s = setup();
    const worker = await s.start();
    const captured = worker.frames[0];
    expect(s.drawn[0]).toBe(captured.bitmap);
    expect(worker.transfers[0]).toEqual([captured.bitmap]);
    await s.advance(10);
    s.result();
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).toHaveBeenCalledOnce();
    const observation = s.image.mock.calls[0][0];
    expect(observation).toMatchObject({
      providerId: "watchglass.index-image",
      monotonicCaptureTime: captured.capture,
      state: "TRACKING",
      anchorSource: "MANUAL_HINT",
      modelAgreement: "UNAVAILABLE",
      point: s.hint,
      frameWidth: 320,
      frameHeight: 240,
      mirrorTransform: "PREVIEW_X",
    });
    expect(observation.monotonicInferenceTime).toBeGreaterThanOrEqual(observation.monotonicCaptureTime);
    for (const key of ["data", "pixels", "rgba", "bitmap", "landmarks", "hands", "result"])
      expect(observation).not.toHaveProperty(key);
    expect(s.runtime.trackingPacing()?.smoothedTotalMs).toBe(10);
  });

  it("does not apply a later hint to an already captured image", async () => {
    const s = setup();
    const worker = await s.start(false);
    const olderCapture = worker.frames[0].capture;
    await s.advance(5);
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    await s.advance(5);
    s.result();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.freshFrame();
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture).toBeGreaterThan(olderCapture);
    await s.advance(10);
    s.result();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.image.mock.calls[0][0]).toMatchObject({
      state: "TRACKING",
      anchorSource: "MANUAL_HINT",
      monotonicCaptureTime: worker.frames[1].capture,
    });
  });

  it("suppresses stale image callbacks and never retries a selected old coordinate on a later image", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(151);
    s.result();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.freshFrame();
    const wait = Math.ceil(s.runtime.trackingPacing()!.intervalMs - 151);
    await s.advance(wait);
    expect(worker.frames).toHaveLength(2);
    await s.advance(10);
    s.result();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.image.mock.calls[0][0]).toMatchObject({
      state: "UNSEEDED",
      point: null,
      anchorSource: null,
      reason: "MANUAL_SELECTION_REQUIRED",
      monotonicCaptureTime: worker.frames[1].capture,
    });
    expect(s.runtime.indexSelectionMode()).toBe("MANUAL");
  });

  it("keeps rejected manual selection intent instead of seeding the next automatic model digit", async () => {
    const s = setup();
    s.video.rgba.fill(30);
    await s.start();
    await s.advance(10);
    s.result();
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNSEEDED",
      reason: "ANCHOR_TEXTURE_OR_EDGE_UNSUITABLE",
      point: null,
    });
    expect(s.runtime.indexSelectionMode()).toBe("MANUAL");
    s.video.rgba = pixels();
    s.freshFrame();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNSEEDED",
      reason: "MANUAL_SELECTION_REQUIRED",
      point: null,
      anchorSource: null,
    });
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.freshFrame();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    await s.advance(10);
    s.result();
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({ state: "TRACKING", anchorSource: "MANUAL_HINT" });
    expect(s.runtime.clearIndexSelection()).toBe(true);
    expect(s.runtime.indexSelectionMode()).toBe("AUTOMATIC");
    s.freshFrame();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({ state: "TRACKING", anchorSource: "MODEL_INDEX" });
  });

  it("keeps manual intent after an expired image track until explicit index disable", async () => {
    const s = setup();
    await s.start();
    await s.advance(10);
    s.result();
    const first = s.image.mock.calls.at(-1)![0];
    await s.advance(1201);
    s.freshFrame();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "LOST",
      reason: "MANUAL_SELECTION_REQUIRED",
      point: null,
      trackId: null,
      anchorSource: null,
    });
    expect(s.runtime.indexSelectionMode()).toBe("MANUAL");
    expect(first.trackId).not.toBeNull();
    s.runtime.setIndexTrackingEnabled(false);
    expect(s.runtime.indexSelectionMode()).toBe("AUTOMATIC");
  });

  it("expires an unattempted hint rather than seeding its old coordinates after a delayed in-flight packet", async () => {
    const s = setup();
    const worker = await s.start(false);
    await s.advance(5);
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    await s.advance(151);
    s.result();
    s.freshFrame();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    await s.advance(10);
    for (let retry = 0; retry < 16 && worker.frames.length < 2; retry++) await s.advance(10);
    expect(worker.frames).toHaveLength(2);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNSEEDED",
      reason: "MANUAL_SELECTION_REQUIRED",
      point: null,
      anchorSource: null,
    });
    expect(s.runtime.indexSelectionMode()).toBe("MANUAL");
    s.runtime.stop();
    expect(s.runtime.indexSelectionMode()).toBe("AUTOMATIC");
  });

  it("does not turn a mismatched worker capture into current image evidence", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result(worker.frames[0].capture - 1);
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
  });

  it("publishes fresh uncertainty with no held point when image evidence disappears", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.video.rgba.fill(30);
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result();
    expect(s.image).toHaveBeenCalledTimes(2);
    expect(s.image.mock.calls[1][0]).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      monotonicCaptureTime: worker.frames[1].capture,
    });
    const uncertain = s.image.mock.calls[1][0] as IndexImageObservation & {
      matchedPoint?: { x: number; y: number } | null;
    };
    expect(uncertain.matchedPoint ?? null).toBeNull();
    expect(s.status).toHaveBeenLastCalledWith("READY");
  });

  it("measures capture-to-completion and both main-thread phases without relabeling capture time", async () => {
    const s = setup({ imageCostMs: 4, callbackCostMs: 3 });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    expect(s.image.mock.calls[0][0].monotonicCaptureTime).toBe(worker.frames[0].capture);
    expect(s.runtime.trackingPacing()).toMatchObject({ smoothedTotalMs: 17, smoothedMainThreadMs: 7 });
  });

  it("keeps hard inference backpressure and avoids recapturing an unchanged video frame", async () => {
    const s = setup();
    const worker = await s.start();
    s.freshFrame();
    await s.advance(100);
    expect(worker.frames).toHaveLength(1);
    s.result();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs - 100));
    expect(worker.frames).toHaveLength(2);
    await s.advance(10);
    s.result();
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs - 10));
    expect(worker.frames).toHaveLength(2);
  });

  it("does not treat a continuously advancing media clock as newly presented pixels", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.video.currentTime += 1 / 30;
    await s.advance(7);
    expect(worker.frames).toHaveLength(1);
    expect(s.bitmap).toHaveBeenCalledOnce();
    s.video.presentedFrames++;
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    expect(worker.frames).toHaveLength(2);
    expect(s.bitmap).toHaveBeenCalledTimes(2);
    expect(worker.frames[1].capture).toBeGreaterThan(worker.frames[0].capture);
  });

  it("uses presented-frame callbacks ahead of the fallback clock and cancels them on stop", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.freshFrame();
    await s.advance(7);
    expect(worker.frames).toHaveLength(1);
    s.presented(1, s.video.currentTime);
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    expect(worker.frames).toHaveLength(1);
    s.presented(2, s.video.currentTime);
    await s.advance(Math.ceil(s.runtime.trackingPacing()!.intervalMs));
    expect(worker.frames).toHaveLength(2);
    expect(s.callbacks.size).toBe(1);
    s.runtime.stop();
    expect(s.cancelVideoFrame).toHaveBeenCalledOnce();
    expect(s.callbacks.size).toBe(0);
  });

  it("reduces a visible unfocused page to at most 8Hz and preserves that cap across completions", async () => {
    const s = setup({ focused: false });
    const worker = await s.start();
    expect(s.runtime.trackingPacing()?.focused).toBe(false);
    expect(s.runtime.trackingPacing()?.targetHz).toBeLessThanOrEqual(8);
    await s.advance(10);
    s.result();
    s.freshFrame();
    await s.advance(114);
    expect(worker.frames).toHaveLength(1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture - worker.frames[0].capture).toBeGreaterThanOrEqual(125);
    window.dispatchEvent(new Event("focus"));
    expect(s.runtime.trackingPacing()?.targetHz).toBeLessThanOrEqual(8);
    await s.advance(10);
    s.result();
    expect(s.runtime.trackingPacing()!.targetHz).toBeGreaterThan(8);
    window.dispatchEvent(new Event("blur"));
    expect(s.runtime.trackingPacing()?.targetHz).toBeLessThanOrEqual(8);
  });

  it.each(["STOP", "HIDE"] as const)(
    "%s retires image/camera resources and ignores late worker data",
    async (reason) => {
      const s = setup();
      const worker = await s.start();
      await s.advance(10);
      s.result();
      expect(s.image).toHaveBeenCalledOnce();
      if (reason === "HIDE") s.hide();
      else s.runtime.stop();
      expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
      expect(s.runtime.trackingPacing()).toBeNull();
      expect(s.runtime.seedIndex(s.hint)).toBe(false);
      expect(s.track.stop).toHaveBeenCalledOnce();
      expect(worker.terminate).toHaveBeenCalledOnce();
      s.result();
      await s.advance(1000);
      expect(s.image).toHaveBeenCalledOnce();
      expect(worker.frames).toHaveLength(1);
    },
  );

  it("closes a late bitmap after stop before creating optional pixel resources", async () => {
    const s = setup();
    let resolve!: (bitmap: Bitmap) => void;
    s.bitmap.mockImplementationOnce(
      () =>
        new Promise<Bitmap>((done) => {
          resolve = done;
        }),
    );
    const worker = await s.start(true, false);
    s.runtime.stop();
    const late = { rgba: pixels(), close: vi.fn() };
    resolve(late);
    await Promise.resolve();
    expect(late.close).toHaveBeenCalledOnce();
    expect(s.contexts).toHaveLength(0);
    expect(s.drawn).toHaveLength(0);
    expect(worker.frames).toHaveLength(0);
    expect(s.image).not.toHaveBeenCalled();
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });

  it("leaves optional image work absent for the existing five-argument camera/recorder path", async () => {
    const s = setup({ imageConsumer: false });
    const worker = await s.start(false);
    expect(s.runtime.seedIndex(s.hint)).toBe(false);
    await s.advance(10);
    s.result();
    expect(worker.frames).toHaveLength(1);
    expect(s.contexts).toHaveLength(0);
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("READY");
  });
  it("does not report a retired image attempt as a rejection in the new absolute mode", async () => {
    const s = setup();
    await s.start();
    s.runtime.setIndexTrackingEnabled(false);
    await s.advance(10);
    s.result();
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("READY");
  });

  it("keeps the image envelope clock monotonic when relative image work is disabled and re-enabled", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result();
    expect(s.image).toHaveBeenCalledTimes(2);
    const previous = s.image.mock.calls[1][0];
    expect(previous.sequence).toBeGreaterThan(0);
    s.runtime.setIndexTrackingEnabled(false);
    expect(s.runtime.seedIndex(s.hint)).toBe(false);
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result();
    expect(s.image).toHaveBeenCalledTimes(2);
    expect(s.contexts).toHaveLength(1);
    s.runtime.setIndexTrackingEnabled(true);
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result();
    expect(worker.frames).toHaveLength(4);
    expect(s.image).toHaveBeenCalledTimes(3);
    const resumed = s.image.mock.calls[2][0];
    expect(resumed).toMatchObject({ state: "TRACKING", anchorSource: "MANUAL_HINT" });
    expect(resumed.sequence).toBeGreaterThan(previous.sequence);
    expect(resumed.monotonicCaptureTime).toBeGreaterThan(previous.monotonicCaptureTime);
    expect(resumed.trackId).not.toBe(previous.trackId);
    expect(s.contexts).toHaveLength(2);
  });
});
