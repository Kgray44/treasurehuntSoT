import { afterEach, expect, it, vi } from "vitest";
import { PublicSourceBrowserProvider, requestBrowserOrientationPermission } from "./public-source-browser-provider";
import type { BrowserTrackingSample } from "./browser-world-tracking";
import { webcrypto } from "node:crypto";

let activeModule: unknown;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup({ permitted = true, inliers = 18 }: { permitted?: boolean; inliers?: number } = {}) {
  vi.useFakeTimers();
  vi.stubGlobal("isSecureContext", true);
  let time = 100,
    scheduled: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockImplementation(() => time);
  vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
    scheduled = frame;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const memory = new ArrayBuffer(2_000_000),
    heap = new Float64Array(memory);
  let allocated = 8;
  const trackingModule = {
    HEAPU8: new Uint8Array(memory),
    HEAPF64: heap,
    _malloc: vi.fn((bytes: number) => {
      const pointer = allocated;
      allocated += bytes;
      return pointer;
    }),
    _free: vi.fn(),
    _setCameraIntrinsics: vi.fn(() => 1),
    _getFrameStats: vi.fn((pointer: number) => heap.set([40, inliers, 1, 40, 25, 25, 0, 0, 0.1, 0.2, 1], pointer / 8)),
    _processFrameWithPoseInput: vi.fn((_frame: number, _width: number, _height: number, rotation: number) => {
      // Same rotation supplied by real device conversion; CV t = -R * camera center.
      const r = Array.from(heap.subarray(rotation / 8, rotation / 8 + 9));
      heap.set([...r, -r[0], -r[3], -r[6]], 1_000_000 / 8);
      return 1_000_000;
    }),
  };
  activeModule = trackingModule;
  vi.stubGlobal(
    "createARModule",
    vi.fn(async () => activeModule),
  );
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    queueMicrotask(() => (node as HTMLScriptElement).dispatchEvent(new Event("load")));
    return node;
  });
  vi.stubGlobal("crypto", {
    randomUUID: webcrypto.randomUUID.bind(webcrypto),
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
    subtle: {
      digest: vi.fn(
        async () =>
          Uint8Array.from("8fdd5d411163ee6bc7065efdf73b5a1ca33096341ecdda8cb1a3ee4b2ef844d1".match(/../g)!, (value) =>
            parseInt(value, 16),
          ).buffer,
      ),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) })),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(320 * 240 * 4) }),
  } as never);
  const video = document.createElement("video");
  Object.defineProperties(video, { videoWidth: { value: 640 }, videoHeight: { value: 480 }, readyState: { value: 2 } });
  video.currentTime = 0;
  vi.spyOn(video, "play").mockResolvedValue();
  vi.spyOn(video, "pause").mockImplementation(() => {});
  const track = new EventTarget(),
    release = vi.fn(),
    controller = new AbortController();
  const input = {
    video,
    lease: { stream: { getVideoTracks: () => [track] }, release } as never,
    motionGranted: permitted,
    signal: controller.signal,
    sample: vi.fn<(sample: BrowserTrackingSample) => void>(),
  };
  const provider = new PublicSourceBrowserProvider();
  const orientation = () => {
    const event = new Event("deviceorientation");
    Object.assign(event, { alpha: 0, beta: 90, gamma: 0 });
    window.dispatchEvent(event);
  };
  const frame = (ms: number, refreshOrientation = true) => {
    time = ms;
    video.currentTime += 0.1;
    if (refreshOrientation) orientation();
    scheduled(ms);
  };
  return { provider, input, trackingModule, release, controller, frame };
}

it("releases its camera lease when required permission is absent", async () => {
  const { provider, input, release, trackingModule } = setup({ permitted: false });
  await expect(provider.start(input)).rejects.toThrow(/permissions/);
  expect(release).toHaveBeenCalledTimes(1);
  expect(trackingModule._malloc).not.toHaveBeenCalled();
  expect(provider.read()).toBeNull();
});

it("processes uncropped camera frames with a shared projection and admits only fresh mapped positions", async () => {
  const { provider, input, trackingModule, release, frame } = setup();
  await provider.start(input);
  frame(200);
  expect(trackingModule._setCameraIntrinsics).toHaveBeenCalledWith(
    320,
    240,
    expect.closeTo(226.24),
    expect.closeTo(226.24),
    160,
    120,
  );
  expect(provider.read()).toMatchObject({ method: "VISUAL_SLAM", status: "TRACKING", confidence: "POSITION_NO_SCALE" });
  expect(provider.read()?.sessionFromCamera?.position.x).toBeCloseTo(1);
  expect(provider.read()?.sessionFromCamera?.position.y).toBeCloseTo(0);
  expect(provider.read()?.sessionFromCamera?.position.z).toBeCloseTo(0);
  expect(provider.ray(0.5, 0.5)?.direction.z).toBeCloseTo(-1);
  frame(500, false);
  expect(provider.read()?.status).toBe("LIMITED");
  expect(provider.ray(0.5, 0.5)).toBeNull();
  await provider.stop();
  expect(trackingModule._free).toHaveBeenCalledTimes(3);
  expect(release).toHaveBeenCalledTimes(1);
  expect(provider.read()).toBeNull();
  expect(provider.cameraIntrinsics()).toBeNull();
});

it("does not admit a finite heuristic pose or orientation when no mapped PnP solve exists", async () => {
  const { provider, input, frame } = setup({ inliers: 0 });
  await provider.start(input);
  frame(200);
  frame(300);
  expect(input.sample.mock.calls.every(([sample]) => sample.status !== "TRACKING")).toBe(true);
  expect(provider.ray(0.5, 0.5)).toBeNull();
  await provider.stop();
});

it("requests orientation permission directly and handles unsupported devices explicitly", async () => {
  vi.stubGlobal("DeviceOrientationEvent", undefined);
  expect(await requestBrowserOrientationPermission()).toBe(false);
  const requestPermission = vi.fn(async () => "granted");
  vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
  const result = requestBrowserOrientationPermission();
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(await result).toBe(true);
});
