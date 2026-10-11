// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { afterEach, expect, it, vi } from "vitest";
import { ReachBrowserRuntime } from "./browser-runtime";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup() {
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("createImageBitmap", vi.fn());
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal(
    "Worker",
    class {
      onmessage = null;
      onerror = null;
      postMessage() {}
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
  const video = { play, pause: vi.fn(), srcObject: null } as unknown as HTMLVideoElement;
  const runtime = new ReachBrowserRuntime(video, vi.fn(), vi.fn(), media);
  return { runtime, stops, play, resume: () => resume() };
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
