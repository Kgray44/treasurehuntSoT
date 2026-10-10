// @sounding-line-registration owner=project-sextant suite=unit.sextant contracts=sextant.phase1.foundation
import { describe, it, expect, vi, afterEach } from "vitest";
import { LandfallForegroundCompatibilityAdapter, projectLandfallContextHint } from "./landfall-compatibility";
import type { BrowserContextTarget } from "@/landfall/browser-context";
import type { ContextualEvidence } from "@/landfall/contextual";
const identity = { sessionId: "session", publishedVersionId: "edition" };
function harness() {
  const listeners = new Map<string, EventListener>();
  const addEventListener = vi.fn((type: string, fn: EventListener) => {
    listeners.set(type, fn);
  });
  const removeEventListener = vi.fn((type: string, fn: EventListener) => {
    if (listeners.get(type) === fn) listeners.delete(type);
  });
  const target: BrowserContextTarget = {
    addEventListener,
    removeEventListener,
    document: { visibilityState: "visible", addEventListener, removeEventListener },
    DeviceOrientationEvent: {},
    DeviceMotionEvent: {},
  };
  return {
    target,
    listeners,
    addEventListener,
    dispatch: (type: string, data: unknown) => listeners.get(type)?.(data as Event),
  };
}
afterEach(() => vi.useRealTimers());
describe("accepted Landfall foreground compatibility", () => {
  it("preserves accepted consent, throttle, compass and motion semantics with separate normalized metadata", async () => {
    vi.useFakeTimers();
    const h = harness(),
      evidence: ContextualEvidence[] = [],
      projections: unknown[] = [];
    const a = new LandfallForegroundCompatibilityAdapter(h.target, "town", () => 100);
    await a.start(
      identity,
      (e, p) => {
        evidence.push(e);
        projections.push(p);
      },
      () => {},
      true,
    );
    await a.start(
      identity,
      () => {},
      () => {},
      true,
    );
    expect(h.addEventListener).toHaveBeenCalledTimes(3);
    h.dispatch("deviceorientation", { alpha: 90, absolute: false });
    expect(evidence).toEqual([]);
    h.dispatch("deviceorientation", { alpha: 90, absolute: true });
    h.dispatch("deviceorientation", { alpha: 80, absolute: true });
    h.dispatch("devicemotion", { acceleration: { x: 1, y: 0, z: 0 } });
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toMatchObject({
      ...identity,
      worldspaceId: "town",
      kind: "HEADING",
      degrees: 270,
      accuracyDegrees: 45,
    });
    expect(evidence[1]).toMatchObject({ kind: "MOTION", moving: true });
    expect(projections[0]).toMatchObject({
      value: 270,
      sourceClass: "COMPATIBILITY",
      syntheticFlag: false,
      qualityClass: "UNKNOWN",
      referenceFrame: "LOCAL_ARBITRARY",
    });
    vi.advanceTimersByTime(1000);
    h.dispatch("devicemotion", { acceleration: { x: 0, y: 0, z: 0 } });
    expect(evidence.at(-1)).toMatchObject({ moving: false });
    expect(JSON.stringify(evidence)).not.toMatch(/acceleration|alpha|capabilityId/);
    a.stop();
    expect(h.listeners.size).toBe(0);
  });
  it("does not request hardware without consent or capabilities", async () => {
    const h = harness(),
      a = new LandfallForegroundCompatibilityAdapter(h.target, "town");
    await a.start(
      identity,
      () => {},
      () => {},
      false,
    );
    expect(a.permissionState).toBe("DENIED");
    expect(h.listeners.size).toBe(0);
    const missing = new LandfallForegroundCompatibilityAdapter(null, "town");
    await missing.start(
      identity,
      () => {},
      () => {},
      true,
    );
    expect(missing.permissionState).toBe("UNAVAILABLE");
  });
  it("cleans hidden foreground listeners and does not automatically restart", async () => {
    const h = harness(),
      a = new LandfallForegroundCompatibilityAdapter(h.target, "town");
    await a.start(
      identity,
      () => {},
      () => {},
      true,
    );
    h.target.document!.visibilityState = "hidden";
    h.dispatch("visibilitychange", {});
    expect(a.active).toBe(false);
    expect(a.permissionState).toBe("UNAVAILABLE");
    expect(h.listeners.size).toBe(0);
  });
  it("preserves pending permission cancellation and denial", async () => {
    const h = harness();
    let resolve!: (s: string) => void;
    h.target.DeviceOrientationEvent = {
      requestPermission: () =>
        new Promise((r) => {
          resolve = r;
        }),
    };
    const a = new LandfallForegroundCompatibilityAdapter(h.target, "town");
    const pending = a.start(
      identity,
      () => {},
      () => {},
      true,
    );
    a.stop();
    resolve("granted");
    await pending;
    expect(h.listeners.size).toBe(0);
    h.target.DeviceOrientationEvent = { requestPermission: async () => "denied" };
    await a.start(
      identity,
      () => {},
      () => {},
      true,
    );
    expect(a.permissionState).toBe("DENIED");
    expect(h.listeners.size).toBe(0);
  });
  it("keeps elevation uncertainty and never converts it to relative pressure or an exact floor", () => {
    const e: ContextualEvidence = {
      id: "hint",
      ...identity,
      worldspaceId: "town",
      observedAt: new Date().toISOString(),
      kind: "ELEVATION",
      meters: 120,
      accuracyMeters: 25,
    };
    expect(projectLandfallContextHint(e, 100)).toMatchObject({
      capabilityId: "sextant.elevation.absolute-hint",
      uncertainty: 25,
      qualityClass: "UNKNOWN",
      confidence: null,
    });
  });
  it("declines non-hardware contextual evidence", () => {
    expect(
      projectLandfallContextHint(
        {
          id: "hint",
          ...identity,
          worldspaceId: "town",
          observedAt: new Date().toISOString(),
          kind: "OBSERVATION",
          regionId: "region",
        },
        100,
      ),
    ).toBeNull();
  });
});

describe("accepted Landfall position compatibility", () => {
  it("preserves the foreground watch, identity, uncertainty and original observation", async () => {
    const { LandfallPositionCompatibilityAdapter } = await import("./landfall-compatibility");
    const { landfallFixture } = await import("@/landfall/fixtures");
    let success!: PositionCallback;
    const watchPosition = vi.fn((callback: PositionCallback) => {
      success = callback;
      return 7;
    });
    const clearWatch = vi.fn();
    const a = new LandfallPositionCompatibilityAdapter(
      { watchPosition, clearWatch },
      landfallFixture.worldspaces[0],
      () => 100,
    );
    const original: unknown[] = [],
      projected: unknown[] = [];
    expect(watchPosition).not.toHaveBeenCalled();
    a.start(
      identity,
      (o, p) => {
        original.push(o);
        projected.push(p);
      },
      () => {},
    );
    a.start(
      identity,
      () => {},
      () => {},
    );
    expect(watchPosition).toHaveBeenCalledTimes(1);
    success({
      timestamp: Date.now(),
      coords: {
        latitude: 44,
        longitude: -72,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
    } as GeolocationPosition);
    expect(original[0]).toMatchObject({
      kind: "PHYSICAL_POSITION",
      accuracyMeters: 12,
      coordinate: { latitude: 44, longitude: -72 },
      ...identity,
    });
    expect(projected[0]).toMatchObject({
      capabilityId: "sextant.position.observation",
      referenceFrame: "WGS84",
      uncertainty: 12,
      qualityClass: "UNKNOWN",
      syntheticFlag: false,
    });
    expect(JSON.stringify(original)).not.toContain("capabilityId");
    a.stop();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });
  it("keeps delivery unchanged if the legacy sample cannot be normalized", async () => {
    const { LandfallPositionCompatibilityAdapter } = await import("./landfall-compatibility");
    const { landfallFixture } = await import("@/landfall/fixtures");
    let success!: PositionCallback;
    const a = new LandfallPositionCompatibilityAdapter(
      {
        watchPosition: (callback) => {
          success = callback;
          return 9;
        },
        clearWatch: () => {},
      },
      landfallFixture.worldspaces[0],
    );
    const emit = vi.fn();
    a.start(identity, emit, () => {});
    success({
      timestamp: Date.now(),
      coords: {
        latitude: 44,
        longitude: -72,
        accuracy: NaN,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
    } as GeolocationPosition);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ accuracyMeters: NaN }), null);
    a.stop();
  });
});
