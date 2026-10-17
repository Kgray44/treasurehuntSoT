// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReachBrowserRuntime, type IndexImageObservation } from "./browser-runtime";

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
            state.bitmap = bitmap;
            drawn.push(bitmap);
          },
          getImageData() {
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
  );
  sessions.push(runtime);
  const hint = { x: 160 / 319, y: 120 / 239 };
  return {
    runtime,
    video,
    workers,
    image,
    observe,
    status,
    track,
    bitmap,
    drawn,
    contexts,
    hint,
    presented,
    cancelVideoFrame,
    callbacks,
    async start(seed = true, expectFrame = true) {
      await runtime.start(true, true);
      if (seed) expect(runtime.seedIndex(hint)).toBe(true);
      if (options.frameCallbacks) presented(1, video.currentTime);
      const worker = workers.at(-1)!;
      worker.onmessage!({ data: { type: "READY", generation: worker.generation } } as MessageEvent);
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
    result(capture?: number) {
      const worker = workers.at(-1)!;
      worker.onmessage!({
        data: {
          type: "RESULT",
          generation: worker.generation,
          capture: capture ?? worker.frames.at(-1)!.capture,
          inferenceTime: performance.timeOrigin + now,
          width: 320,
          height: 240,
          result: { landmarks: [], handedness: [] },
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

  it("suppresses stale image callbacks using original capture age, while retaining the hint for a new capture", async () => {
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
      state: "TRACKING",
      monotonicCaptureTime: worker.frames[1].capture,
    });
  });

  it("does not turn a mismatched worker capture into current image evidence", async () => {
    const s = setup();
    const worker = await s.start();
    await s.advance(10);
    s.result(worker.frames[0].capture - 1);
    expect(s.image).not.toHaveBeenCalled();
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
