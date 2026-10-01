import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserContextProvider, type BrowserContextTarget } from "@/landfall/browser-context";
import type { ContextualEvidence } from "@/landfall/contextual";

const identity = { sessionId: "session", publishedVersionId: "edition" };
function harness(capabilities = true) {
  const listeners = new Map<string, EventListener>();
  const addEventListener = vi.fn((type: string, listener: EventListener) => listeners.set(type, listener));
  const removeEventListener = vi.fn((type: string, listener: EventListener) => {
    if (listeners.get(type) === listener) listeners.delete(type);
  });
  const target: BrowserContextTarget = {
    addEventListener,
    removeEventListener,
    document: { visibilityState: "visible", addEventListener, removeEventListener },
    ...(capabilities ? { DeviceOrientationEvent: {}, DeviceMotionEvent: {} } : {}),
  };
  return {
    target,
    listeners,
    addEventListener,
    removeEventListener,
    dispatch: (type: string, value: Record<string, unknown>) => listeners.get(type)?.(value as unknown as Event),
  };
}
afterEach(() => vi.useRealTimers());
describe("optional foreground browser context hints", () => {
  it("requires explicit consent and honestly reports unsupported browsers", async () => {
    const h = harness();
    const states: string[] = [];
    const provider = new BrowserContextProvider(h.target, "town");
    await provider.start(
      identity,
      () => {},
      (state) => states.push(state),
      false,
    );
    expect(states).toEqual(["DENIED"]);
    expect(h.addEventListener).not.toHaveBeenCalled();
    const unavailable = new BrowserContextProvider(harness(false).target, "town");
    await unavailable.start(
      identity,
      () => {},
      (state) => states.push(state),
      true,
    );
    expect(states.at(-1)).toBe("UNAVAILABLE");
    const missing = new BrowserContextProvider(null, "town");
    expect(missing.permissionState).toBe("UNAVAILABLE");
  });
  it("owns one listener per source, throttles bounded hints, and cleans up", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 1));
    const h = harness(),
      emitted: ContextualEvidence[] = [];
    const provider = new BrowserContextProvider(h.target, "town");
    await provider.start(
      identity,
      (hint) => emitted.push(hint),
      () => {},
      true,
    );
    await provider.start(
      identity,
      (hint) => emitted.push(hint),
      () => {},
      true,
    );
    expect(h.addEventListener).toHaveBeenCalledTimes(3);
    h.dispatch("deviceorientation", { alpha: 90, absolute: false });
    expect(emitted).toEqual([]);
    h.dispatch("deviceorientation", { alpha: 90, absolute: true });
    h.dispatch("deviceorientation", { alpha: 80, absolute: true });
    h.dispatch("devicemotion", { acceleration: { x: 1, y: 0, z: 0 } });
    h.dispatch("devicemotion", { acceleration: { x: 2, y: 0, z: 0 } });
    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toMatchObject({ kind: "HEADING", degrees: 270 });
    expect(emitted[1]).toMatchObject({ kind: "MOTION", moving: true });
    vi.advanceTimersByTime(1000);
    h.dispatch("devicemotion", { acceleration: { x: 0, y: 0, z: 0 } });
    expect(emitted.at(-1)).toMatchObject({ moving: false });
    expect(JSON.stringify(emitted)).not.toMatch(/acceleration|alpha|latitude/);
    provider.stop();
    expect(provider.active).toBe(false);
    expect(h.listeners.size).toBe(0);
    expect(h.removeEventListener).toHaveBeenCalledTimes(3);
  });
  it("stops automatically when hidden and never restarts without user action", async () => {
    const h = harness(),
      states: string[] = [];
    const provider = new BrowserContextProvider(h.target, "town");
    await provider.start(
      identity,
      () => {},
      (state) => states.push(state),
      true,
    );
    h.target.document!.visibilityState = "hidden";
    h.dispatch("visibilitychange", {});
    expect(provider.active).toBe(false);
    expect(states.at(-1)).toBe("UNAVAILABLE");
    expect(h.listeners.size).toBe(0);
    h.target.document!.visibilityState = "visible";
    h.dispatch("visibilitychange", {});
    expect(provider.active).toBe(false);
  });
  it("handles denied permission and cancellation while browser permission is pending", async () => {
    const denied = harness();
    denied.target.DeviceOrientationEvent = { requestPermission: async () => "denied" };
    const deniedProvider = new BrowserContextProvider(denied.target, "town");
    await deniedProvider.start(
      identity,
      () => {},
      () => {},
      true,
    );
    expect(deniedProvider.permissionState).toBe("DENIED");
    expect(denied.listeners.size).toBe(0);
    const h = harness();
    let resolve: (state: string) => void = () => {};
    h.target.DeviceOrientationEvent = {
      requestPermission: () =>
        new Promise((done) => {
          resolve = done;
        }),
    };
    const provider = new BrowserContextProvider(h.target, "town");
    const pending = provider.start(
      identity,
      () => {},
      () => {},
      true,
    );
    provider.stop();
    resolve("granted");
    await pending;
    expect(provider.active).toBe(false);
    expect(h.listeners.size).toBe(0);
  });
  it("keeps permission requests and listeners singular during simultaneous starts", async () => {
    const h = harness();
    let resolve: (state: string) => void = () => {};
    const requestPermission = vi.fn(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    h.target.DeviceOrientationEvent = { requestPermission };
    const provider = new BrowserContextProvider(h.target, "town");
    const start = provider.start(
      identity,
      () => {},
      () => {},
      true,
    );
    await provider.start(
      identity,
      () => {},
      () => {},
      true,
    );
    expect(requestPermission).toHaveBeenCalledTimes(1);
    resolve("granted");
    await start;
    expect(h.addEventListener).toHaveBeenCalledTimes(3);
    provider.stop();
  });
});
