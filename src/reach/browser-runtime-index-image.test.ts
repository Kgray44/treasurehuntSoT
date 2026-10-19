// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ReachBrowserRuntime,
  type IndexImageObservation,
  type ReachInferenceMetrics,
  type ReachFrameDiagnostics,
} from "./browser-runtime";
import { BrowserHandAdapter, type HandInferencePolicy, type HandResult } from "@/watchglass/hand-provider";
import { handObservationSchema } from "@/watchglass/hand-observation";
import { pointingPose } from "../../tests/e2e/fixtures/reach/pointing-poses";
import { IndexImageTracker } from "./index-image-tracker";
import { IndexImageObservationGate, indexImageObservationSchema } from "./index-image-observation";
import { ReachCaptureHealth } from "./capture-health";
import * as imageSignal from "@/watchglass/image-signal";

type Bitmap = { rgba: Uint8ClampedArray; width: number; height: number; close: ReturnType<typeof vi.fn> };
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
function startupHealthFor(init: Record<string, unknown> | null, backend: "CPU_WASM" | "GPU_WEBGL" = "GPU_WEBGL") {
  const width = Number(init?.frameWidth),
    height = Number(init?.frameHeight);
  return {
    classification: "SYNTHETIC_PREREADY_LATENCY_NECESSARY_CONDITION_ONLY",
    probeDimensions: { width, height },
    geometryVersion: init?.geometryVersion,
    mirrorTransform: init?.mirrorTransform,
    attempts: [
      {
        passed: true,
        delegate: backend === "GPU_WEBGL" ? "GPU" : "CPU",
        width,
        height,
        maximumElapsedMs: 150,
        outputsDiscarded: true,
        retainedRegionsCleared: true,
        probes: [
          { timestamp: -2, elapsedMs: 20, forcedRegions: 2 },
          { timestamp: -1, elapsedMs: 21, forcedRegions: 2 },
        ],
      },
    ],
  };
}
function setup(
  options: {
    focused?: boolean;
    imageConsumer?: boolean;
    imageCostMs?: number;
    callbackCostMs?: number;
    frameCallbacks?: boolean;
    backend?: "CPU_WASM" | "GPU_WEBGL";
    providerPolicy?: HandInferencePolicy;
    imageFailure?: "DRAW" | "READBACK";
    calibrationCollecting?: boolean;
    metricsThrows?: boolean;
    frameDiagnostics?: boolean;
    frameDiagnosticsThrows?: boolean;
    exposureControls?: boolean;
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
  const bitmap = vi.fn<() => Promise<Bitmap>>(async () => ({
    rgba: video.rgba.slice(),
    width: video.videoWidth,
    height: video.videoHeight,
    close: vi.fn(),
  }));
  const callbacks = new Map<number, VideoFrameRequestCallback>();
  let callbackId = 0;
  const cancelVideoFrame = vi.fn((id: number) => callbacks.delete(id));
  const presented = (frame: number, mediaTime: number, metadata: Partial<VideoFrameCallbackMetadata> = {}) => {
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
      ...metadata,
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
    url: string;
    init: Record<string, unknown> | null;
    onmessage: ((event: MessageEvent) => void) | null;
    frames: FrameMessage[];
    transfers: unknown[][];
    terminate: ReturnType<typeof vi.fn>;
  }[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      generation = 0;
      init: Record<string, unknown> | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      frames: FrameMessage[] = [];
      transfers: unknown[][] = [];
      terminate = vi.fn();
      constructor(readonly url: string) {
        workers.push(this);
      }
      postMessage(message: { type: string; generation: number }, transfer: unknown[] = []) {
        if (message.type === "INIT") {
          this.generation = message.generation;
          this.init = { ...message };
        }
        if (message.type === "FRAME") {
          events.push("WORKER_FRAME_POSTED");
          this.frames.push(message as FrameMessage);
          this.transfers.push(transfer);
        }
      }
    },
  );
  const exposureSettings = { width: 320, height: 240, frameRate: 30, exposureCompensation: 0 };
  const originalExposureConstraint: MediaTrackConstraintSet & { exposureCompensation: number } = {
    exposureCompensation: 0,
  };
  const applySettings = (input: MediaTrackConstraints) => {
    for (const set of input.advanced ?? [])
      for (const [key, value] of Object.entries(set))
        if (key === "exposureCompensation") exposureSettings.exposureCompensation = Number(value);
  };
  const track = {
    kind: "video",
    readyState: "live",
    getCapabilities: vi.fn(() => ({
      exposureMode: ["continuous"],
      torch: true,
      ...(options.exposureControls ? { exposureCompensation: { min: -4, max: 4, step: 0.5 } } : {}),
    })),
    getSettings: vi.fn(() => ({ ...exposureSettings, deviceId: "never-export-device-id" })),
    getConstraints: options.exposureControls
      ? vi.fn(() => ({
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { max: 30 },
          advanced: [originalExposureConstraint],
        }))
      : undefined,
    applyConstraints: options.exposureControls
      ? vi.fn(async (input: MediaTrackConstraints) => applySettings(input))
      : undefined,
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
    raw = vi.fn(),
    frameDiagnostics = vi.fn<(packet: ReachFrameDiagnostics) => void>(() => {
      if (options.frameDiagnosticsThrows) throw new Error("OPTIONAL_FRAME_DIAGNOSTICS_FAILED");
    }),
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
    options.frameDiagnostics || options.frameDiagnosticsThrows ? raw : undefined,
    options.imageConsumer === false ? undefined : image,
    metrics,
    options.frameDiagnostics || options.frameDiagnosticsThrows ? frameDiagnostics : undefined,
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
    raw,
    frameDiagnostics,
    status,
    track,
    media,
    exposureSettings,
    applySettings,
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
          backend: options.backend ?? "CPU_WASM",
          providerPolicy: options.providerPolicy ?? "ORIGINAL_CPU",
          ...(options.providerPolicy === "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1"
            ? { startupHealth: startupHealthFor(worker.init, options.backend) }
            : {}),
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
    jumpClock(ms: number) {
      now += ms;
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
          backend: options.backend ?? "CPU_WASM",
          providerPolicy: options.providerPolicy ?? "ORIGINAL_CPU",
        },
      } as MessageEvent);
    },
    hide() {
      visible = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

/** Advance the fake wall clock with its timers, then present one genuinely new frame. */
async function spacedResult(s: ReturnType<typeof setup>, landmarks: HandResult["landmarks"], minimumCaptureGap = 67) {
  const worker = s.workers.at(-1)!;
  const before = worker.frames.length;
  const lastCapture = worker.frames.at(-1)!.capture;
  while (performance.now() - lastCapture < minimumCaptureGap) await s.advance(1);
  s.freshFrame();
  for (let elapsed = 0; elapsed < 500 && worker.frames.length === before; elapsed++) await s.advance(1);
  expect(worker.frames).toHaveLength(before + 1);
  await s.advance(10);
  s.result(undefined, landmarks);
  const latest = s.image.mock.calls.at(-1)![0];
  expect(latest.monotonicCaptureTime).toBe(worker.frames.at(-1)!.capture);
  return latest;
}

describe("runtime image source integration", () => {
  it("reports the exact gated same-frame pair once, after the existing raw and tracking consumers", async () => {
    const s = setup({ frameDiagnostics: true });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    expect(s.raw).toHaveBeenCalledOnce();
    expect(s.frameDiagnostics).toHaveBeenCalledOnce();
    const packet = s.frameDiagnostics.mock.calls[0][0];
    expect(packet).toMatchObject({
      capture: worker.frames[0].capture,
      completed: performance.now(),
      modelReason: "ACCEPTED",
      indexReason: "ACCEPTED",
    });
    expect(packet.modelObservation).toBe(s.observe.mock.calls[0][0]);
    expect(packet.indexObservation).toBe(s.image.mock.calls[0][0]);
    expect(packet.indexObservation?.monotonicCaptureTime).toBe(packet.capture);
    for (const consumer of [s.raw, s.observe, s.image])
      expect(consumer.mock.invocationCallOrder[0]).toBeLessThan(s.frameDiagnostics.mock.invocationCallOrder[0]);
  });

  it("retains a rejected raw result with exact final reasons and no accepted canonical pair", async () => {
    const s = setup({ frameDiagnostics: true });
    const worker = await s.start();
    await s.advance(151);
    s.result();
    expect(s.raw).toHaveBeenCalledOnce();
    expect(s.observe).not.toHaveBeenCalled();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.frameDiagnostics).toHaveBeenCalledExactlyOnceWith({
      capture: worker.frames[0].capture,
      completed: performance.now(),
      modelObservation: null,
      indexObservation: null,
      modelReason: "OBSERVATION_PIXEL_ORIGIN_STALE",
      indexReason: "INDEX_MODEL_OBSERVATION_REJECTED",
    });
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
  });

  it("isolates a throwing frame diagnostic from accepted tracking and subsequent capture", async () => {
    const s = setup({ frameDiagnosticsThrows: true });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    const first = s.image.mock.calls[0][0];
    s.freshFrame();
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    await s.advance(10);
    s.result();
    expect(s.frameDiagnostics).toHaveBeenCalledTimes(2);
    expect(s.raw).toHaveBeenCalledTimes(2);
    expect(s.observe).toHaveBeenCalledTimes(2);
    expect(s.image).toHaveBeenCalledTimes(2);
    expect(s.image.mock.calls[1][0].trackId).toBe(first.trackId);
    expect(s.status).toHaveBeenLastCalledWith("READY");
    expect(s.runtime.resources().workers).toBe(1);
    expect(s.runtime.resources().tracks).toBe(1);
  });

  it("diagnoses the exact existing bitmap gray plane without another readback, queue or repeated capability query", async () => {
    const sampled = vi.spyOn(imageSignal, "sampleImageSignal"),
      record = vi.spyOn(ReachCaptureHealth.prototype, "record");
    const s = setup(),
      worker = await s.start();
    expect(s.track.getCapabilities).toHaveBeenCalledOnce();
    expect(s.track.getSettings).toHaveBeenCalledOnce();
    expect(s.events.filter((e) => e === "PIXEL_READBACK")).toHaveLength(1);
    expect(worker.frames).toHaveLength(1);
    expect(sampled).not.toHaveBeenCalled();
    // The displayed video moves after capture; diagnostics must still inspect the original paired pixels.
    s.video.rgba.fill(255);
    await s.advance(10);
    s.result();
    expect(sampled).toHaveBeenCalledOnce();
    const plane = sampled.mock.calls[0][0],
      original = worker.frames[0].bitmap.rgba;
    const at = (120 * 320 + 160) * 4;
    expect(plane.data[120 * 320 + 160]).toBe((original[at] * 77 + original[at + 1] * 150 + original[at + 2] * 29) >> 8);
    expect(record.mock.calls.at(-1)![0]).toMatchObject({
      accepted: true,
      usablePoint: true,
      freshImageContinuity: true,
      imageSignal: { scope: "SUBJECT_REGION" },
    });
    const a = s.runtime.captureDiagnostics(),
      b = s.runtime.captureDiagnostics();
    expect(a.capabilities?.negotiated).toMatchObject({ width: 320, height: 240, frameRate: 30 });
    expect(a.capabilities?.descriptor.controls.directInfraredLed).toBe("UNKNOWN");
    expect(s.track.getCapabilities).toHaveBeenCalledOnce();
    expect(s.track.getSettings).toHaveBeenCalledOnce();
    expect(s.events.filter((e) => e === "PIXEL_READBACK")).toHaveLength(1);
    expect(worker.frames).toHaveLength(1);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toContain("never-export-device-id");
    expect(JSON.stringify(a)).not.toContain('"data"');
    if (a.capabilities) a.capabilities.negotiated.width = 1;
    expect(s.runtime.captureDiagnostics().capabilities?.negotiated.width).toBe(320);
  });
  it("labels the whole frame honestly when no current ROI exists, and uses a same-capture index region without a wrist requirement", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup();
    await s.start(false);
    await s.advance(10);
    s.result();
    expect(record.mock.calls.at(-1)![0].imageSignal?.scope).toBe("WHOLE_FRAME");
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    const pose = modelPose(s.hint);
    pose[0].y = -0.05;
    s.result(undefined, [pose]);
    expect(record.mock.calls.at(-1)![0].imageSignal?.scope).toBe("SUBJECT_REGION");
    expect(record.mock.calls.at(-1)![0].usablePoint).toBe(true);
    expect(s.image.mock.calls.at(-1)![0].state).toBe("TRACKING");
  });
  it("discards a rejected capture's signal and never reuses its ROI on the next current no-hand frame", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      sampled = vi.spyOn(imageSignal, "sampleImageSignal"),
      s = setup();
    const worker = await s.start();
    await s.advance(151);
    s.result();
    expect(record.mock.calls.at(-1)![0]).toMatchObject({ accepted: false, imageSignal: null });
    expect(sampled).not.toHaveBeenCalled();
    s.video.rgba.fill(255);
    s.freshFrame();
    // The first late inference already consumed the interval; the due zero-delay pump needs one timer turn.
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    await s.advance(10);
    s.result();
    const current = record.mock.calls.at(-1)![0];
    expect(current.accepted).toBe(true);
    expect(current.imageSignal).toMatchObject({ scope: "WHOLE_FRAME", meanLuminance: 1, luminanceDeviation: 0 });
    expect(sampled).toHaveBeenCalledOnce();
  });
  it("clears retained diagnostic pixels on mode disable and leaves the model-only path without extra image work", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup();
    await s.start();
    s.runtime.setIndexTrackingEnabled(false);
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    expect(record.mock.calls.at(-1)![0].imageSignal).toBeNull();
    expect(s.image).not.toHaveBeenCalled();
    s.freshFrame();
    await s.advance(7);
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    expect(record.mock.calls.at(-1)![0].imageSignal).toBeNull();
    expect(s.events.filter((e) => e === "PIXEL_READBACK")).toHaveLength(1);
  });
  it("preserves an explicit pointing attempt through a contrary result, without changing its existing pause", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup({ frameDiagnostics: true });
    await s.start();
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] })]);
    expect(s.frameDiagnostics.mock.calls[0][0].indexReason).toBe("ACCEPTED");
    expect(record.mock.calls.at(-1)![0]).toMatchObject({
      contraryGesture: true,
      trackingExpected: true,
      usablePoint: false,
    });
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({
      state: "UNCERTAIN",
      point: null,
      reason: "FULL_HAND_CONTRARY_PENDING",
    });
  });
  it("suppresses only implicit recent-point expectation for a contrary gesture outside explicit collection/manual selection", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup({ calibrationCollecting: false });
    await s.start(false);
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint)]);
    for (let evidence = 1; evidence < 3; evidence++) {
      expect(record.mock.calls.at(-1)![0].usablePoint).toBe(false);
      s.freshFrame();
      await s.advance(57);
      await s.advance(10);
      s.result(undefined, [modelPose(s.hint)]);
    }
    expect(record.mock.calls.at(-1)![0].usablePoint).toBe(true);
    s.freshFrame();
    await s.advance(57);
    await s.advance(10);
    s.result(undefined, [modelPose(s.hint, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] })]);
    expect(record.mock.calls.at(-1)![0]).toMatchObject({
      contraryGesture: true,
      trackingExpected: false,
      usablePoint: false,
    });
  });
  it("keeps a low administrative rate distinct from measured processing pressure", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup();
    s.runtime.setTrackingLimits({
      normalMaximumHz: 5,
      calibrationMaximumHz: 5,
      modelMaximumHz: 5,
      unfocusedMaximumHz: 5,
    });
    await s.start();
    await s.advance(10);
    s.result();
    expect(s.runtime.trackingPacing()?.maximumHz).toBe(5);
    expect(record.mock.calls.at(-1)![0].processingPressure).toBe(false);
  });
  it("reports measured image-processing pressure only when it reduces the current permitted ceiling", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup({ imageCostMs: 70 });
    await s.start();
    await s.advance(10);
    s.result();
    expect(s.runtime.trackingPacing()!.targetHz).toBeLessThan(s.runtime.trackingPacing()!.maximumHz);
    expect(record.mock.calls.at(-1)![0].processingPressure).toBe(true);
  });
  it("preserves independent latency pressure even when a slow admin cap hides capacity limitation", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = setup();
    s.runtime.setTrackingLimits({
      normalMaximumHz: 5,
      calibrationMaximumHz: 5,
      modelMaximumHz: 5,
      unfocusedMaximumHz: 5,
    });
    await s.start();
    await s.advance(121);
    s.result();
    expect(s.runtime.trackingPacing()!.targetHz).toBe(5);
    expect(record.mock.calls.at(-1)![0].processingPressure).toBe(true);
  });
  it.each(["SAMPLER", "HEALTH"] as const)(
    "isolates an optional %s diagnostic failure from every existing inference consumer",
    async (failure) => {
      if (failure === "SAMPLER")
        vi.spyOn(imageSignal, "sampleImageSignal").mockImplementationOnce(() => {
          throw Error("diagnostic failed");
        });
      else
        vi.spyOn(ReachCaptureHealth.prototype, "record").mockImplementationOnce(() => {
          throw Error("diagnostic failed");
        });
      const s = setup();
      await s.start();
      await s.advance(10);
      s.result();
      expect(s.observe).toHaveBeenCalledOnce();
      expect(s.image).toHaveBeenCalledOnce();
      expect(s.metrics).toHaveBeenCalledOnce();
      expect(s.status).toHaveBeenLastCalledWith("READY");
      expect(s.runtime.resources().workers).toBe(1);
    },
  );
  it.each(["STOP", "HIDE", "LEASE_ENDED"] as const)(
    "withholds stale capability metadata and pixel evidence after %s",
    async (reason) => {
      const s = setup();
      await s.start();
      await s.advance(10);
      s.result();
      expect(s.runtime.captureDiagnostics().capabilities).not.toBeNull();
      if (reason === "STOP") s.runtime.stop();
      else if (reason === "HIDE") s.hide();
      else s.runtime.camera.release();
      const result = s.runtime.captureDiagnostics();
      expect(result.capabilities).toBeNull();
      expect(result.assistance).toBeNull();
      expect(result.health).toMatchObject({ state: "WARMING", context: null, evidenceMs: 0 });
      expect(s.track.getCapabilities).toHaveBeenCalledOnce();
      expect(s.track.getSettings).toHaveBeenCalledOnce();
    },
  );
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
        backend: "CPU_WASM",
        providerPolicy: "ORIGINAL_CPU",
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
  it("waits for a new presentation instead of relabeling an old queued frame after a slow result", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    const binding = s.runtime.camera.snapshot();
    await s.advance(10);
    s.presented(2, 1.1);
    s.jumpClock(400);
    s.result();
    await s.advance(1);
    expect(worker.frames).toHaveLength(1);
    expect(s.bitmap).toHaveBeenCalledOnce();
    expect(s.observe).not.toHaveBeenCalled();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    expect(s.runtime.camera.snapshot()).toEqual(binding);
    expect(worker.terminate).not.toHaveBeenCalled();
    s.presented(3, 1.2);
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    await s.advance(5);
    s.result();
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.runtime.camera.snapshot()).toEqual(binding);
    expect(s.status).toHaveBeenLastCalledWith("READY");
  });
  it("does not dispatch an old startup presentation when the model becomes ready", async () => {
    const s = setup({ frameCallbacks: true });
    await s.runtime.start(true, true);
    s.presented(1, 1);
    s.jumpClock(400);
    const worker = s.workers[0];
    worker.onmessage!({
      data: { type: "READY", generation: worker.generation, backend: "CPU_WASM", providerPolicy: "ORIGINAL_CPU" },
    } as MessageEvent);
    await Promise.resolve();
    expect(worker.frames).toHaveLength(0);
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(s.runtime.resources()).toEqual({ tracks: 1, workers: 1, timers: 0 });
    s.presented(2, 1.1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(1);
  });
  it("rejects an old camera origin even when its presentation and dispatch appear current", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(10);
    s.result();
    await s.advance(7);
    await s.advance(144);
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(1);
    expect(worker.frames).toHaveLength(1);
    expect(s.bitmap).toHaveBeenCalledOnce();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
  });
  it("checks camera-origin age again at model receipt without extending the 150ms budget", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(100);
    s.result();
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(1);
    expect(worker.frames).toHaveLength(2);
    await s.advance(60);
    s.result();
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.metrics.mock.calls.at(-1)?.[0]).toMatchObject({ disposition: "LATE", packetAgeMs: 161 });
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    expect(s.runtime.resources().tracks).toBe(1);
  });
  it.each([150, 151])("retains the exact camera-origin freshness boundary at %sms", async (age) => {
    const s = setup({ frameCallbacks: true });
    await s.start(false);
    await s.advance(100);
    s.result();
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(1);
    await s.advance(age - 101);
    s.result();
    expect(s.observe).toHaveBeenCalledTimes(age === 150 ? 2 : 1);
    expect(s.image).toHaveBeenCalledTimes(age === 150 ? 2 : 1);
    expect(s.metrics.mock.calls.at(-1)?.[0]).toMatchObject({
      disposition: age === 150 ? "ACCEPTED" : "LATE",
      packetAgeMs: age,
    });
  });
  it("does not publish image evidence when optical completion itself exhausts the origin budget", async () => {
    const s = setup({ frameCallbacks: true });
    await s.start(false);
    const complete = IndexImageTracker.prototype.complete;
    vi.spyOn(IndexImageTracker.prototype, "complete").mockImplementation(function (this: IndexImageTracker, ...args) {
      const result = complete.apply(this, args);
      s.jumpClock(20);
      return result;
    });
    await s.advance(140);
    s.result();
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("rolls back an image seed when origin age expires inside finalization while dispatch age remains fresh", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(10);
    s.result();
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    const complete = IndexImageTracker.prototype.complete;
    const finalizations: { started: number; completed: number; capture: number }[] = [];
    vi.spyOn(IndexImageTracker.prototype, "complete").mockImplementationOnce(function (
      this: IndexImageTracker,
      token,
      model,
      completionClock,
      sourceFresh,
    ) {
      let calls = 0;
      const clock = () => {
        if (++calls === 2) s.jumpClock(20);
        const value = typeof completionClock === "function" ? completionClock() : completionClock;
        if (calls === 1) finalizations.push({ started: value, completed: value, capture: token.capture });
        else finalizations[0].completed = value;
        return value;
      };
      return complete.call(this, token, model, clock, sourceFresh);
    });
    await s.advance(123);
    s.result();
    expect(finalizations).toEqual([{ started: 240, completed: 260, capture: 117 }]);
    expect(finalizations[0].completed - finalizations[0].capture).toBeLessThan(150);
    expect(finalizations[0].completed - 100).toBeGreaterThan(150);
    expect(s.observe).toHaveBeenCalledTimes(2);
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.presented(3, 1.2);
    await s.advance(1);
    await s.advance(5);
    s.result();
    expect(s.image.mock.calls.at(-1)?.[0]).toMatchObject({
      state: "UNSEEDED",
      reason: "MANUAL_SELECTION_REQUIRED",
      anchorSource: null,
      trackId: null,
      point: null,
    });
    expect(s.image.mock.calls.at(-1)?.[0].matchedPoint ?? null).toBeNull();
    expect(s.runtime.indexSelectionMode()).toBe("MANUAL");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("does not mutate hand association for a dispatch that is already late before adapter processing", async () => {
    const s = setup();
    await s.start(false);
    const envelope = vi.spyOn(BrowserHandAdapter.prototype, "envelope");
    await s.advance(151);
    s.result(undefined, [modelPose(s.hint)]);
    expect(envelope).not.toHaveBeenCalled();
    expect(s.observe).not.toHaveBeenCalled();
    expect(s.metrics.mock.calls.at(-1)?.[0]).toMatchObject({ disposition: "LATE", packetAgeMs: 151 });
    expect(s.runtime.resources().tracks).toBe(1);
  });
  it.each(["FUTURE_INFERENCE", "FUTURE_CAPTURE", "FRACTIONAL_FRAME"] as const)(
    "does not poison association or gate state after rejecting %s metadata",
    async (fault) => {
      const s = setup();
      const worker = await s.start(false);
      await s.advance(10);
      const pose = modelPose(s.hint);
      worker.onmessage!({
        data: {
          type: "RESULT",
          backend: "CPU_WASM",
          providerPolicy: "ORIGINAL_CPU",
          generation: worker.generation,
          capture: worker.frames[0].capture + (fault === "FUTURE_CAPTURE" ? 1000 : 0),
          inferenceTime: performance.timeOrigin + performance.now() + (fault.startsWith("FUTURE") ? 1000 : 0),
          width: fault === "FRACTIONAL_FRAME" ? 320.5 : 320,
          height: 240,
          result: { landmarks: [pose], handedness: [[{ categoryName: "Right", score: 0.99 }]] },
        },
      } as MessageEvent);
      expect(s.observe).not.toHaveBeenCalled();
      expect(s.image).not.toHaveBeenCalled();
      expect(s.metrics.mock.calls.at(-1)?.[0].disposition).toBe("INVALID");
      s.freshFrame();
      await s.advance(7);
      expect(worker.frames).toHaveLength(2);
      await s.advance(5);
      s.result(undefined, [pose]);
      expect(s.observe).toHaveBeenCalledOnce();
      expect(s.observe.mock.calls[0][0]).toMatchObject({
        sequence: 0,
        observationId: "observation-0",
        hands: [{ trackId: "local-1", trackGeneration: 1 }],
      });
      expect(s.status).toHaveBeenLastCalledWith("READY");
      expect(s.runtime.resources().workers).toBe(1);
    },
  );
  it("rolls back both gate and association when source age expires during schema validation", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(10);
    s.result();
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    const parse = handObservationSchema.parse;
    vi.spyOn(handObservationSchema, "parse").mockImplementationOnce((...args) => {
      const parsed = parse(...args);
      s.jumpClock(20);
      return parsed;
    });
    await s.advance(123);
    s.result(undefined, [modelPose(s.hint)]);
    expect(performance.now()).toBe(260);
    expect(s.observe).toHaveBeenCalledOnce();
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.metrics.mock.calls.at(-1)?.[0]).toMatchObject({ disposition: "LATE", packetAgeMs: 160 });
    s.presented(3, 1.2);
    await s.advance(1);
    await s.advance(5);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.observe).toHaveBeenCalledTimes(2);
    expect(s.observe.mock.calls[1][0]).toMatchObject({
      sequence: 1,
      observationId: "observation-1",
      hands: [{ trackId: "local-1", trackGeneration: 1 }],
    });
    expect(s.status).toHaveBeenLastCalledWith("READY");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("rejects an image publication whose origin expires during image schema parsing and recovers on the next frame", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(10);
    s.result();
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    const parse = indexImageObservationSchema.parse;
    vi.spyOn(indexImageObservationSchema, "parse").mockImplementationOnce((...args) => {
      const parsed = parse(...args);
      s.jumpClock(20);
      return parsed;
    });
    await s.advance(123);
    s.result();
    expect(performance.now()).toBe(260);
    expect(performance.now() - worker.frames[1].capture).toBe(143);
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.presented(3, 1.2);
    await s.advance(1);
    await s.advance(5);
    s.result();
    expect(s.image).toHaveBeenCalledTimes(2);
    expect(s.image.mock.calls[1][0]).toMatchObject({ state: "TRACKING", point: s.hint });
    expect(s.status).toHaveBeenLastCalledWith("READY");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("checks origin freshness immediately before image publication even after a valid gate return", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start(false);
    await s.advance(10);
    s.result();
    expect(s.runtime.seedIndex(s.hint)).toBe(true);
    s.presented(2, 1.1, { captureTime: 100 });
    await s.advance(7);
    expect(worker.frames).toHaveLength(2);
    const accept = IndexImageObservationGate.prototype.accept;
    vi.spyOn(IndexImageObservationGate.prototype, "accept").mockImplementationOnce(function (
      this: IndexImageObservationGate,
      ...args
    ) {
      const accepted = accept.apply(this, args);
      s.jumpClock(20);
      return accepted;
    });
    await s.advance(123);
    s.result();
    expect(performance.now()).toBe(260);
    expect(s.image).toHaveBeenCalledOnce();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.presented(3, 1.2);
    await s.advance(1);
    await s.advance(5);
    s.result();
    expect(s.image).toHaveBeenCalledTimes(2);
    expect(s.image.mock.calls[1][0]).toMatchObject({ state: "TRACKING", point: s.hint });
  });
  it("rejects dispatch age that expires during image parsing when camera-origin metadata is unavailable", async () => {
    const s = setup();
    await s.start();
    const parse = indexImageObservationSchema.parse;
    vi.spyOn(indexImageObservationSchema, "parse").mockImplementationOnce((...args) => {
      const parsed = parse(...args);
      s.jumpClock(20);
      return parsed;
    });
    await s.advance(140);
    s.result();
    expect(s.image).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("carries known pixel origin to both consumers while preserving worker dispatch timestamps", async () => {
    const s = setup({ frameCallbacks: true });
    const worker = await s.start();
    await s.advance(10);
    s.result();
    s.presented(2, 1.1, { captureTime: 105 });
    await s.advance(7);
    await s.advance(5);
    s.result();
    expect(worker.frames[1].capture).toBe(117);
    expect(s.observe.mock.calls[1][0]).toMatchObject({ monotonicCaptureTime: 117, monotonicPixelOriginTime: 105 });
    expect(s.image.mock.calls[1][0]).toMatchObject({ monotonicCaptureTime: 117, monotonicPixelOriginTime: 105 });
  });
  it("leaves pixel-origin knowledge absent on the existing fallback path", async () => {
    const s = setup();
    await s.start();
    await s.advance(10);
    s.result();
    expect(s.observe.mock.calls[0][0]).not.toHaveProperty("monotonicPixelOriginTime");
    expect(s.image.mock.calls[0][0]).not.toHaveProperty("monotonicPixelOriginTime");
  });
  it("closes a bitmap whose origin becomes old during asynchronous extraction", async () => {
    const s = setup({ frameCallbacks: true });
    let deliver!: (bitmap: Bitmap) => void;
    s.bitmap.mockImplementationOnce(() => new Promise((resolve) => (deliver = resolve)));
    const worker = await s.start(false, false);
    s.jumpClock(151);
    const bitmap = { rgba: pixels(), width: 320, height: 240, close: vi.fn() };
    deliver(bitmap);
    await Promise.resolve();
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(worker.frames).toHaveLength(0);
    expect(s.drawn).toHaveLength(0);
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.presented(2, 1.1);
    await s.advance(1);
    expect(worker.frames).toHaveLength(1);
  });
  it("keeps camera-origin and serialized dispatch clocks separate through phase changes", async () => {
    const s = setup({ frameCallbacks: true, calibrationCollecting: false });
    const worker = await s.start(false);
    const binding = s.runtime.camera.snapshot();
    await s.advance(20);
    s.presented(2, 1.1, { captureTime: 115 });
    s.runtime.setCalibrationCollecting(true);
    await s.advance(10);
    s.result();
    s.runtime.setCalibrationCollecting(false);
    s.runtime.setCalibrationCollecting(true);
    await s.advance(1);
    await s.advance(36);
    expect(worker.frames).toHaveLength(2);
    expect(worker.frames[1].capture).toBeGreaterThanOrEqual(130);
    expect(worker.frames[1].capture).not.toBe(115);
    await s.advance(5);
    s.result();
    expect(s.observe).toHaveBeenCalledTimes(2);
    expect(s.runtime.camera.snapshot()).toEqual(binding);
    expect(s.workers).toHaveLength(1);
    expect(s.media.getUserMedia).toHaveBeenCalledOnce();
  });
  it.each([NaN, Infinity, -1, 1000])(
    "does not reinterpret invalid camera-origin metadata (%s) as fresh",
    async (captureTime) => {
      const s = setup({ frameCallbacks: true });
      const worker = await s.start(false);
      await s.advance(10);
      s.result();
      s.presented(2, 1.1, { captureTime });
      await s.advance(7);
      expect(worker.frames).toHaveLength(1);
      expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    },
  );
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
  it("accepts the verified recovery policy and binds actual GPU metadata without changing the image coordinate path", async () => {
    const s = setup({ backend: "GPU_WEBGL", providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1" });
    const worker = await s.start();
    expect(worker.url).toBe("/reach/recovery-worker.js");
    expect(worker.init).toMatchObject({
      delegate: "GPU",
      mirrorTransform: "PREVIEW_X",
      geometryVersion: s.runtime.camera.snapshot().generation,
    });
    await s.advance(10);
    s.result();
    expect(s.observe.mock.calls[0][0]).toMatchObject({
      inferenceBackend: "GPU_WEBGL",
      providerVersion: "1.6.0+actual-roi-v1",
    });
    expect(s.runtime.captureDiagnostics().perception).toMatchObject({
      backend: "GPU_WEBGL",
      policy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
      fallbackReason: null,
    });
    expect(s.image.mock.calls.at(-1)?.[0].point).not.toBeNull();
    worker.onmessage!({
      data: { type: "RESULT", generation: worker.generation, backend: "GPU_WEBGL", providerPolicy: "ORIGINAL_CPU" },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_BACKEND_CHANGED");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it.each([8110, 11999])(
    "accepts a healthy optional GPU READY at %ims without a second camera or worker",
    async (elapsed) => {
      const s = setup({ backend: "GPU_WEBGL", providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1" });
      await s.runtime.start(true, true);
      const worker = s.workers[0];
      s.jumpClock(elapsed);
      worker.onmessage!({
        data: {
          type: "READY",
          generation: worker.generation,
          backend: "GPU_WEBGL",
          providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
          startupHealth: startupHealthFor(worker.init),
        },
      } as MessageEvent);
      await Promise.resolve();
      expect(s.status).toHaveBeenLastCalledWith("READY");
      expect(s.workers).toHaveLength(1);
      expect(worker.terminate).not.toHaveBeenCalled();
      expect(s.media.getUserMedia).toHaveBeenCalledOnce();
      expect(worker.frames).toHaveLength(1);
    },
  );
  it("retires a slow optional startup before originalCPU fallback within the unchanged total model deadline", async () => {
    const s = setup();
    await s.runtime.start(true, true);
    const optional = s.workers[0],
      late = optional.onmessage!;
    expect(optional.frames).toHaveLength(0);
    await s.advance(12000);
    expect(optional.terminate).toHaveBeenCalledOnce();
    const cpu = s.workers[1];
    expect(cpu.url).toBe("/reach/hand-worker.js");
    expect(s.media.getUserMedia).toHaveBeenCalledOnce();
    late({
      data: {
        type: "READY",
        generation: optional.generation,
        backend: "GPU_WEBGL",
        providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
      },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_STARTING");
    expect(s.bitmap).not.toHaveBeenCalled();
    await s.advance(2999);
    expect(s.runtime.resources().workers).toBe(1);
    await s.advance(1);
    expect(cpu.terminate).toHaveBeenCalledOnce();
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    expect(s.status).toHaveBeenLastCalledWith("MODEL_FAILURE");
  });
  it("runs originalCPU on startup failure without requesting a second camera or reusing optional-worker replies", async () => {
    const s = setup({ backend: "CPU_WASM" });
    await s.runtime.start(true, true);
    const optional = s.workers[0];
    optional.onmessage!({
      data: { type: "ERROR", generation: optional.generation, reason: "RECOVERY_RUNTIME_ABI" },
    } as MessageEvent);
    const cpu = s.workers[1];
    expect(optional.terminate).toHaveBeenCalledOnce();
    cpu.onmessage!({ data: { type: "READY", generation: cpu.generation, backend: "CPU_WASM" } } as MessageEvent);
    await Promise.resolve();
    expect(cpu.frames).toHaveLength(1);
    await s.advance(10);
    s.result();
    expect(s.observe.mock.calls[0][0].providerVersion).toBe("1.6.0");
    expect(s.runtime.captureDiagnostics().perception).toMatchObject({
      backend: "CPU_WASM",
      policy: "ORIGINAL_CPU",
      fallbackReason: "RECOVERY_STARTUP_UNAVAILABLE",
    });
    expect(s.media.getUserMedia).toHaveBeenCalledOnce();
  });
  it.each(["RECOVERY_TASK_INTEGRITY", "RECOVERY_PARTIAL_CLOSE_FAILED"])(
    "does not bypass a fatal %s with a second worker",
    async (reason) => {
      const s = setup();
      await s.runtime.start(true, true);
      const worker = s.workers[0];
      worker.onmessage!({ data: { type: "ERROR", generation: worker.generation, reason } } as MessageEvent);
      expect(s.workers).toHaveLength(1);
      expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    },
  );
  it("rejects READY after the absolute startup deadline even when a blocked event loop delivers it before timers", async () => {
    const s = setup();
    await s.runtime.start(true, true);
    const worker = s.workers[0];
    s.jumpClock(15000);
    worker.onmessage!({ data: { type: "READY", generation: worker.generation, backend: "CPU_WASM" } } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_FAILURE");
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(s.workers).toHaveLength(1);
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("enforces the optional startup deadline on receipt without waiting for its delayed timer", async () => {
    const s = setup();
    await s.runtime.start(true, true);
    const worker = s.workers[0];
    s.jumpClock(12000);
    worker.onmessage!({
      data: {
        type: "READY",
        generation: worker.generation,
        backend: "GPU_WEBGL",
        providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1",
      },
    } as MessageEvent);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(s.workers).toHaveLength(2);
    expect(s.workers[1].url).toBe("/reach/hand-worker.js");
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("MODEL_STARTING");
  });
  function modelPose(point: { x: number; y: number }, options: Parameters<typeof pointingPose>[0] = {}) {
    const pose = pointingPose(options);
    const dx = point.x - pose[8].x,
      dy = point.y - pose[8].y;
    return pose.map((p) => ({ x: p.x + dx, y: p.y + dy, z: p.z }));
  }
  function prepareExposureRig() {
    const s = setup({ exposureControls: true });
    s.runtime.setTrackingLimits({
      normalMaximumHz: 10,
      calibrationMaximumHz: 10,
      modelMaximumHz: 60,
      unfocusedMaximumHz: 8,
    });
    const dark = pixels();
    for (let i = 0; i < dark.length; i += 4) dark[i] = dark[i + 1] = dark[i + 2] = 8 + (dark[i] % 25);
    s.video.rgba = dark;
    const open = modelPose(s.hint, { indexBends: [0, 5, 10], otherBends: [0, 5, 10] });
    return { ...s, dark, open };
  }
  async function nextExposureFrame(s: ReturnType<typeof prepareExposureRig>, landmarks: HandResult["landmarks"]) {
    const before = s.workers.at(-1)!.frames.length;
    s.freshFrame();
    await s.advance(90);
    expect(s.workers.at(-1)!.frames).toHaveLength(before + 1);
    await s.advance(10);
    s.result(undefined, landmarks);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  async function startExposureFailureWindow(s: ReturnType<typeof prepareExposureRig>, frames = 13) {
    await s.start();
    await s.advance(10);
    s.result(undefined, [s.open]);
    for (let i = 1; i < frames; i++) await nextExposureFrame(s, [s.open]);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  }
  it("requests only one bounded same-color exposure trial after sustained measured signal loss, then retains actual current improvement", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s);
    expect(s.track.applyConstraints).toHaveBeenCalledTimes(1);
    const trial = s.runtime.captureDiagnostics();
    expect(trial.assistance).toMatchObject({ state: "TRIAL", activeKind: "EXPOSURE", transitioning: false });
    expect(trial.assistance?.profile).toBe("COLOR_RADIOMETRIC_COMPATIBILITY_NOT_PHYSICAL_QUALIFICATION");
    expect(s.exposureSettings.exposureCompensation).toBe(1);
    const lease = s.observe.mock.calls[0][0].cameraLeaseId,
      imageId = s.image.mock.calls[0][0].trackId;
    const bright = s.dark.slice();
    for (let i = 0; i < bright.length; i += 4) bright[i] = bright[i + 1] = bright[i + 2] = bright[i] + 80;
    s.video.rgba = bright;
    for (let i = 0; i < 23; i++) await nextExposureFrame(s, [modelPose(s.hint)]);
    expect(s.runtime.captureDiagnostics().assistance).toMatchObject({
      state: "ASSISTED",
      reason: "ASSISTANCE_IMPROVED_TRACKING",
      activeKind: "EXPOSURE",
    });
    expect(s.track.applyConstraints).toHaveBeenCalledTimes(1);
    expect(s.media.getUserMedia).toHaveBeenCalledTimes(1);
    expect(s.observe.mock.calls.every(([o]) => o.cameraLeaseId === lease)).toBe(true);
    expect(s.image.mock.calls.every(([o]) => o.trackId === imageId)).toBe(true);
    expect(s.contexts).toHaveLength(1);
    expect(s.events.filter((e) => e === "PIXEL_READBACK")).toHaveLength(s.workers[0].frames.length);
    expect(s.runtime.resources().timers).toBeLessThanOrEqual(2);
    expect(s.track.stop).not.toHaveBeenCalled();
  });
  it("does not modify exposure for a brief signal dip or invent a second stream", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s, 5);
    expect(s.track.applyConstraints).not.toHaveBeenCalled();
    expect(s.runtime.captureDiagnostics().assistance?.activeKind).toBeNull();
    for (let i = 0; i < 5; i++) await nextExposureFrame(s, [modelPose(s.hint)]);
    expect(s.track.applyConstraints).not.toHaveBeenCalled();
    expect(s.media.getUserMedia).toHaveBeenCalledOnce();
  });
  it("discovers controls that become available later without opening another camera or restarting capture", async () => {
    const s = prepareExposureRig();
    s.track.getCapabilities.mockReturnValue({ exposureMode: ["continuous"], torch: true });
    await startExposureFailureWindow(s);
    expect(s.track.applyConstraints).not.toHaveBeenCalled();
    s.track.getCapabilities.mockReturnValue({
      exposureMode: ["continuous"],
      torch: true,
      exposureCompensation: { min: -4, max: 4, step: 0.5 },
    });
    await nextExposureFrame(s, [s.open]);
    expect(s.track.applyConstraints).toHaveBeenCalledOnce();
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("TRIAL");
    expect(s.media.getUserMedia).toHaveBeenCalledOnce();
    expect(s.runtime.resources().workers).toBe(1);
  });
  it("expires assisted mode at its last qualified evidence deadline despite a stale packet immediately before it", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s);
    for (let i = 0; i < 23; i++) await nextExposureFrame(s, [modelPose(s.hint)]);
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("ASSISTED");
    const deadline = s.runtime.captureDiagnostics().assistance!.deadlineMs!;
    s.freshFrame();
    await s.advance(90);
    const capture = s.workers[0].frames.at(-1)!.capture;
    s.video.readyState = 0;
    await s.advance(deadline - performance.now() - 1);
    s.result(capture);
    expect(s.metrics.mock.calls.at(-1)![0].disposition).toBe("LATE");
    expect(s.runtime.captureDiagnostics().assistance?.deadlineMs).toBe(deadline);
    expect(s.exposureSettings.exposureCompensation).toBe(1);
    await s.advance(1);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(s.runtime.captureDiagnostics().assistance).toMatchObject({
      state: "BACKOFF",
      reason: "ASSISTANCE_EVIDENCE_TIMEOUT",
      activeKind: null,
    });
    expect(s.exposureSettings.exposureCompensation).toBe(0);
    expect(s.track.stop).not.toHaveBeenCalled();
  });
  it("restores a failed trial before assigning a new baseline diagnostic context while preserving the camera binding", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s);
    const trialContext = s.runtime.captureDiagnostics().health.context,
      lease = s.observe.mock.calls[0][0].cameraLeaseId;
    for (let i = 0; i < 24; i++) await nextExposureFrame(s, [s.open]);
    expect(s.runtime.captureDiagnostics().assistance).toMatchObject({
      state: "BACKOFF",
      reason: "ASSISTANCE_DID_NOT_IMPROVE_TRACKING",
      activeKind: null,
      transitioning: false,
    });
    expect(s.exposureSettings.exposureCompensation).toBe(0);
    expect(s.track.applyConstraints).toHaveBeenCalledTimes(3);
    expect(s.runtime.captureDiagnostics().health.context).not.toBe(trialContext);
    expect(s.observe.mock.calls.every(([o]) => o.cameraLeaseId === lease)).toBe(true);
    expect(s.runtime.resources().workers).toBe(1);
    expect(s.track.stop).not.toHaveBeenCalled();
  });
  it("excludes an in-flight pre-apply bitmap from the new trial window without suppressing its normal observation", async () => {
    const record = vi.spyOn(ReachCaptureHealth.prototype, "record"),
      s = prepareExposureRig();
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    s.track.applyConstraints!.mockImplementationOnce(async (input) => {
      await pending;
      s.applySettings(input);
    });
    await startExposureFailureWindow(s);
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("REQUESTING");
    const previousRecords = record.mock.calls.length,
      previousObservations = s.observe.mock.calls.length;
    s.freshFrame();
    await s.advance(90);
    const oldCapture = s.workers[0].frames.at(-1)!.capture;
    await s.advance(1);
    resolve();
    for (let i = 0; i < 6; i++) await Promise.resolve();
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("TRIAL");
    await s.advance(9);
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.observe).toHaveBeenCalledTimes(previousObservations + 1);
    expect(record).toHaveBeenCalledTimes(previousRecords);
    await nextExposureFrame(s, [modelPose(s.hint)]);
    expect(record.mock.calls.at(-1)![0].captureMs).toBeGreaterThan(oldCapture);
    expect(s.runtime.captureDiagnostics().health.windowStartedMs).toBeGreaterThan(oldCapture);
  });
  it("expires and restores an exposure trial even when no further neural result arrives", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s);
    s.video.readyState = 0;
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("TRIAL");
    await s.advance(8000);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(s.runtime.captureDiagnostics().assistance).toMatchObject({
      state: "BACKOFF",
      reason: "ASSISTANCE_TRIAL_TIMEOUT",
      activeKind: null,
    });
    expect(s.exposureSettings.exposureCompensation).toBe(0);
    expect(s.track.stop).not.toHaveBeenCalled();
    expect(s.runtime.resources().timers).toBeLessThanOrEqual(1);
  });
  it("stops the old session instead of declaring a baseline when exposure restoration cannot be confirmed", async () => {
    const s = prepareExposureRig();
    await startExposureFailureWindow(s);
    s.track.applyConstraints!.mockRejectedValueOnce(Error("synthetic failed restore"));
    for (let i = 0; i < 24 && s.runtime.resources().workers; i++) await nextExposureFrame(s, [s.open]);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(s.status).toHaveBeenLastCalledWith("CAPTURE_CONTROL_RESTORE_FAILED");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    expect(s.runtime.captureDiagnostics().capabilities).toBeNull();
    expect(s.runtime.captureDiagnostics().assistance?.reason).toBe("EXPOSURE_RESTORE_FAILED");
  });
  it("aborts a pending old exposure request and prevents its late completion from touching a fresh session", async () => {
    const s = prepareExposureRig();
    let resolve!: () => void;
    const pending = new Promise<void>((done) => {
      resolve = done;
    });
    s.track.applyConstraints!.mockImplementationOnce(async (input) => {
      await pending;
      s.applySettings(input);
    });
    await startExposureFailureWindow(s);
    expect(s.runtime.captureDiagnostics().assistance?.state).toBe("REQUESTING");
    const oldWorker = s.workers[0];
    s.runtime.stop();
    const freshTrack = {
      ...s.track,
      readyState: "live",
      stop: vi.fn(),
      getCapabilities: vi.fn(() => ({})),
      getSettings: vi.fn(() => ({ width: 320, height: 240, frameRate: 30 })),
      applyConstraints: vi.fn(async () => {}),
    };
    s.media.getUserMedia.mockResolvedValueOnce({
      getTracks: () => [freshTrack],
      getVideoTracks: () => [freshTrack],
    } as unknown as MediaStream);
    await s.runtime.start(true, true);
    const freshWorker = s.workers.at(-1)!;
    freshWorker.onmessage!({
      data: { type: "READY", generation: freshWorker.generation, backend: "CPU_WASM", providerPolicy: "ORIGINAL_CPU" },
    } as MessageEvent);
    await Promise.resolve();
    resolve();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(freshTrack.applyConstraints).not.toHaveBeenCalled();
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(s.runtime.resources().workers).toBe(1);
    expect(s.runtime.captureDiagnostics().assistance).toMatchObject({
      state: "BASELINE",
      activeKind: null,
      transitioning: false,
    });
    expect(s.runtime.captureDiagnostics().assistance?.reason).not.toBe("EXPOSURE_CONTROL_FAILED");
  });

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
    for (let evidence = 0; evidence < 3; evidence++) {
      await spacedResult(s, [modelPose(s.hint)]);
      if (evidence < 2) expect(s.image.mock.calls.at(-1)![0].point).toBeNull();
    }
    expect(s.image.mock.calls.at(-1)![0]).toMatchObject({ state: "TRACKING", anchorSource: "MODEL_INDEX" });
  });

  it("cannot turn one cold model guess into image control when that hand disappears before confirmation", async () => {
    const s = setup();
    const worker = await s.start(false);
    const firstCapture = worker.frames[0].capture;
    await s.advance(10);
    // Good texture is deliberately available at this unverified model guess.
    // It cannot independently prove that this is the selected anatomical index.
    s.result(undefined, [modelPose(s.hint)]);
    expect(s.image.mock.calls.at(-1)![0].point).toBeNull();
    for (let absent = 0; absent < 6; absent++) {
      const latest = await spacedResult(s, [], 100);
      expect(latest.point).toBeNull();
      expect(latest.state).not.toBe("TRACKING");
      expect(s.observe.mock.calls.at(-1)![0].hands).toHaveLength(0);
    }
    expect(worker.frames.at(-1)!.capture - firstCapture).toBeLessThan(1200);
    expect(s.image.mock.calls.every(([packet]) => packet.point === null && packet.state !== "TRACKING")).toBe(true);
    const qualificationStart = worker.frames.length;
    for (let evidence = 0; evidence < 3; evidence++) {
      const latest = await spacedResult(s, [modelPose(s.hint)]);
      if (evidence < 2) expect(latest.point).toBeNull();
      else expect(latest).toMatchObject({ state: "TRACKING", anchorSource: "MODEL_INDEX" });
    }
    expect(worker.frames.at(-1)!.capture - worker.frames[qualificationStart].capture).toBeGreaterThanOrEqual(120);
    expect(s.runtime.indexSelectionMode()).toBe("AUTOMATIC");
    expect(s.observe).toHaveBeenCalledTimes(worker.frames.length);
    expect(s.metrics.mock.calls.every(([packet]) => packet.disposition === "ACCEPTED")).toBe(true);
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
    const late = { rgba: pixels(), width: 320, height: 240, close: vi.fn() };
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

describe("startup capacity screen and actual frame geometry", () => {
  const actual = { backend: "GPU_WEBGL", providerPolicy: "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1" } as const;
  it.each(["CPU_WASM", "GPU_WEBGL"] as const)(
    "binds qualified %s startup to the actual camera geometry",
    async (backend) => {
      const s = setup({ backend, providerPolicy: actual.providerPolicy });
      const worker = await s.start(false);
      expect(worker.init).toMatchObject({ frameWidth: 320, frameHeight: 240 });
      expect(worker.frames).toHaveLength(1);
      expect(s.media.getUserMedia).toHaveBeenCalledOnce();
    },
  );
  it.each([0, -1, 1.5, 16385, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid delivered dimension %s before creating a worker",
    async (dimension) => {
      const s = setup(actual);
      s.video.videoWidth = dimension;
      await s.runtime.start(true, true);
      expect(s.status).toHaveBeenLastCalledWith("FRAME_CHANGED_RECALIBRATE");
      expect(s.workers).toHaveLength(0);
      expect(s.track.stop).toHaveBeenCalledOnce();
      expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    },
  );
  const invalidProofs: [string, (health: ReturnType<typeof startupHealthFor>) => unknown][] = [
    ["missing", () => undefined],
    ["null", () => null],
    ["different width", (h) => ({ ...h, probeDimensions: { width: 640, height: 240 } })],
    ["different lease", (h) => ({ ...h, geometryVersion: Number(h.geometryVersion) + 1 })],
    ["different mirror", (h) => ({ ...h, mirrorTransform: "NONE" })],
    ["wrong backend", (h) => ({ ...h, attempts: [{ ...h.attempts[0], delegate: "CPU" }] })],
    ["failed last probe", (h) => ({ ...h, attempts: [{ ...h.attempts[0], passed: false }] })],
    ["output not discarded", (h) => ({ ...h, attempts: [{ ...h.attempts[0], outputsDiscarded: false }] })],
    ["regions not cleared", (h) => ({ ...h, attempts: [{ ...h.attempts[0], retainedRegionsCleared: false }] })],
    ["null probe", (h) => ({ ...h, attempts: [{ ...h.attempts[0], probes: [null, null] }] })],
    ["sparse probes", (h) => ({ ...h, attempts: [{ ...h.attempts[0], probes: Array(2) }] })],
    ["one probe", (h) => ({ ...h, attempts: [{ ...h.attempts[0], probes: h.attempts[0].probes.slice(0, 1) }] })],
    [
      "negative elapsed",
      (h) => ({
        ...h,
        attempts: [{ ...h.attempts[0], probes: h.attempts[0].probes.map((p) => ({ ...p, elapsedMs: -1 })) }],
      }),
    ],
    [
      "nonfinite elapsed",
      (h) => ({
        ...h,
        attempts: [{ ...h.attempts[0], probes: h.attempts[0].probes.map((p) => ({ ...p, elapsedMs: Number.NaN })) }],
      }),
    ],
    [
      "151ms elapsed",
      (h) => ({
        ...h,
        attempts: [{ ...h.attempts[0], probes: h.attempts[0].probes.map((p) => ({ ...p, elapsedMs: 151 })) }],
      }),
    ],
    [
      "repeated timestamp",
      (h) => ({
        ...h,
        attempts: [{ ...h.attempts[0], probes: h.attempts[0].probes.map((p) => ({ ...p, timestamp: -1 })) }],
      }),
    ],
  ];
  it.each(invalidProofs)("rejects %s startup evidence without a legacy retry", async (_name, mutate) => {
    const s = setup(actual);
    await s.runtime.start(true, true);
    const worker = s.workers[0];
    worker.onmessage!({
      data: {
        type: "READY",
        generation: worker.generation,
        ...actual,
        startupHealth: mutate(startupHealthFor(worker.init)),
      },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_STARTUP_HEALTH_INVALID");
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(s.workers).toHaveLength(1);
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("accepts both probes at the unchanged inclusive150ms bound", async () => {
    const s = setup(actual);
    await s.runtime.start(true, true);
    const worker = s.workers[0],
      health = startupHealthFor(worker.init);
    for (const p of health.attempts[0].probes) p.elapsedMs = 150;
    worker.onmessage!({
      data: { type: "READY", generation: worker.generation, ...actual, startupHealth: health },
    } as MessageEvent);
    await Promise.resolve();
    expect(worker.frames).toHaveLength(1);
    expect(s.workers).toHaveLength(1);
  });
  it("rejects a resize during startup before the first bitmap", async () => {
    const s = setup(actual);
    await s.runtime.start(true, true);
    const worker = s.workers[0];
    s.video.videoWidth = 640;
    worker.onmessage!({
      data: { type: "READY", generation: worker.generation, ...actual, startupHealth: startupHealthFor(worker.init) },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("FRAME_CHANGED_RECALIBRATE");
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(worker.frames).toHaveLength(0);
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("closes a pending old-size bitmap when video geometry changes during capture", async () => {
    const s = setup(actual);
    let release!: (value: Bitmap) => void;
    s.bitmap.mockImplementationOnce(
      () =>
        new Promise<Bitmap>((resolve) => {
          release = resolve;
        }),
    );
    const worker = await s.start(false, false),
      close = vi.fn();
    s.video.videoHeight = 480;
    release({ rgba: s.video.rgba.slice(), width: 320, height: 240, close } as Bitmap);
    await Promise.resolve();
    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(worker.frames).toHaveLength(0);
    expect(s.status).toHaveBeenLastCalledWith("FRAME_CHANGED_RECALIBRATE");
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("invalidates the live source when the worker rejects bitmap geometry", async () => {
    const s = setup(actual),
      worker = await s.start(false);
    worker.onmessage!({
      data: { type: "ERROR", generation: worker.generation, reason: "RECOVERY_FRAME_GEOMETRY_MISMATCH" },
    } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("FRAME_CHANGED_RECALIBRATE");
    expect(s.observe).not.toHaveBeenCalled();
    expect(s.workers).toHaveLength(1);
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it("restricts omitted legacy READY metadata to the original worker fallback", async () => {
    const s = setup();
    await s.runtime.start(true, true);
    const worker = s.workers[0];
    worker.onmessage!({ data: { type: "READY", generation: worker.generation } } as MessageEvent);
    expect(s.status).toHaveBeenLastCalledWith("MODEL_BACKEND_CHANGED");
    expect(s.workers).toHaveLength(1);
    expect(s.bitmap).not.toHaveBeenCalled();
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  });
  it.each([null, { type: "PROGRESS" }])(
    "fails malformed startup messages without treating them as optional-init errors: %s",
    async (value) => {
      const s = setup();
      await s.runtime.start(true, true);
      const worker = s.workers[0];
      worker.onmessage!({ data: value === null ? null : { ...value, generation: worker.generation } } as MessageEvent);
      expect(s.status).toHaveBeenLastCalledWith("MODEL_FAILURE");
      expect(s.workers).toHaveLength(1);
      expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    },
  );
});
