import { afterEach, expect, it, vi } from "vitest";
import { BrowserSpatialAdapter } from "./browser-spatial-adapter";
import { identityTransform } from "./contracts";
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
