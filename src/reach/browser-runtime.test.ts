// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { afterEach, expect, it, vi } from "vitest";
import { ReachBrowserRuntime, type RawHandInference } from "./browser-runtime";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(rawInference?: (frame: RawHandInference) => void) {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ close: vi.fn() }));
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const workers: { onmessage: ((event: MessageEvent) => void) | null; generation: number }[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror = null;
      generation = 0;
      constructor() {
        workers.push(this);
      }
      postMessage(message: { type: string; generation: number }) {
        if (message.type === "INIT") this.generation = message.generation;
      }
      terminate() {}
    },
  );
  const stops: number[] = [];
  const media = {
    getUserMedia: async () => {
      const index = stops.push(0) - 1;
      const track = {
        readyState: "live",
        stop() {
          this.readyState = "ended";
          stops[index]++;
        },
        addEventListener() {},
        removeEventListener() {},
      };
      return { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
    },
  };
  let resume!: () => void;
  const play = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const video = {
    play,
    pause: vi.fn(),
    srcObject: null,
    readyState: 4,
    currentTime: 1.25,
    getVideoPlaybackQuality: () => ({ totalVideoFrames: 1, droppedVideoFrames: 0 }),
    videoWidth: 640,
    videoHeight: 480,
  } as unknown as HTMLVideoElement;
  const observe = vi.fn(),
    status = vi.fn();
  const runtime = new ReachBrowserRuntime(video, observe, status, media, rawInference);
  return { runtime, stops, play, workers, observe, status, resume: () => resume() };
}
it("a late video-play completion cannot stop a newer camera generation", async () => {
  const s = setup();
  try {
    const first = s.runtime.start(true, false);
    await vi.waitFor(() => expect(s.play).toHaveBeenCalledTimes(1));
    s.runtime.stop();
    await s.runtime.start(true, false);
    expect(s.runtime.resources()).toEqual({ tracks: 1, workers: 1, timers: 1 });
    s.resume();
    await first;
    expect(s.runtime.resources()).toEqual({ tracks: 1, workers: 1, timers: 1 });
    expect(s.stops).toEqual([1, 0]);
  } finally {
    s.runtime.stop();
  }
  expect(s.stops).toEqual([1, 1]);
});
it("page suspension releases a camera while video startup is still pending", async () => {
  const s = setup();
  try {
    const pending = s.runtime.start(true, false);
    await vi.waitFor(() => expect(s.play).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event("pagehide"));
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
    s.resume();
    await pending;
    expect(s.runtime.resources()).toEqual({ tracks: 0, workers: 0, timers: 0 });
  } finally {
    s.runtime.stop();
  }
});
it.each([false, true])(
  "an optional raw recorder cannot change accepted observations, even when it throws (%s)",
  async (throws) => {
    const capture = vi.fn<(frame: RawHandInference) => void>(() => {
      if (throws) throw new Error("RECORDER_ONLY_FAILURE");
    });
    const s = setup(capture);
    try {
      const start = s.runtime.start(true, true);
      await vi.waitFor(() => expect(s.play).toHaveBeenCalledOnce());
      s.resume();
      await start;
      const worker = s.workers[0];
      worker.onmessage!({ data: { type: "READY", generation: worker.generation } } as MessageEvent);
      await Promise.resolve();
      const now = performance.now();
      const result = { landmarks: [], handedness: [] };
      worker.onmessage!({
        data: {
          type: "RESULT",
          generation: worker.generation,
          result,
          capture: now - 5,
          inferenceTime: performance.timeOrigin + now - 1,
          width: 640,
          height: 480,
        },
      } as MessageEvent);
      expect(capture).toHaveBeenCalledOnce();
      expect(capture.mock.calls[0][0]).toMatchObject({
        result,
        width: 640,
        height: 480,
        mirror: true,
        inferenceBackend: "CPU_WASM",
        videoTime: 1.25,
      });
      expect(Object.keys(capture.mock.calls[0][0]).sort()).toEqual(
        [
          "result",
          "capture",
          "inference",
          "received",
          "videoTime",
          "width",
          "height",
          "mirror",
          "inferenceBackend",
        ].sort(),
      );
      expect(s.observe).toHaveBeenCalledOnce();
      expect(s.status).toHaveBeenLastCalledWith("READY");
    } finally {
      s.runtime.stop();
    }
  },
);
it("records stale raw results for diagnosis without making them eligible, and ignores retired generations", async () => {
  const capture = vi.fn();
  const s = setup(capture);
  try {
    const start = s.runtime.start(true, false);
    await vi.waitFor(() => expect(s.play).toHaveBeenCalledOnce());
    s.resume();
    await start;
    const worker = s.workers[0],
      now = performance.now();
    worker.onmessage!({ data: { type: "READY", generation: worker.generation } } as MessageEvent);
    const data = {
      type: "RESULT",
      generation: worker.generation,
      result: { landmarks: [], handedness: [] },
      capture: now - 200,
      inferenceTime: performance.timeOrigin + now - 1,
      width: 640,
      height: 480,
    };
    worker.onmessage!({ data } as MessageEvent);
    expect(capture).toHaveBeenCalledOnce();
    expect(s.observe).not.toHaveBeenCalled();
    expect(s.status).toHaveBeenLastCalledWith("STALE_OR_INVALID_OBSERVATION");
    s.runtime.stop();
    worker.onmessage!({ data } as MessageEvent);
    expect(capture).toHaveBeenCalledOnce();
  } finally {
    s.runtime.stop();
  }
});
