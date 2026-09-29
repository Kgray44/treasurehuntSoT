import { describe, expect, it, vi } from "vitest";
import { BrowserGeolocationProvider } from "@/landfall/browser-geolocation";
import { landfallFixture } from "@/landfall/fixtures";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";

describe("foreground browser geolocation provider", () => {
  it("requests only when started, emits typed accuracy, and clears its watch", () => {
    let success: PositionCallback | undefined;
    const watchPosition = vi.fn((callback: PositionCallback) => {
      success = callback;
      return 7;
    });
    const clearWatch = vi.fn();
    const provider = new BrowserGeolocationProvider({ watchPosition, clearWatch }, landfallFixture.worldspaces[0]);
    const emitted: unknown[] = [],
      states: string[] = [];
    expect(watchPosition).not.toHaveBeenCalled();
    provider.start(
      { sessionId: "session-1", publishedVersionId: "version-1" },
      (observation) => emitted.push(observation),
      (state) => states.push(state),
    );
    success?.({ timestamp: Date.now(), coords: { latitude: 44, longitude: -72, accuracy: 12 } } as GeolocationPosition);
    expect(emitted[0]).toMatchObject({
      kind: "PHYSICAL_POSITION",
      accuracyMeters: 12,
      coordinate: { worldspaceId: "town" },
    });
    expect(states).toEqual(["GRANTED"]);
    provider.stop();
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(provider.active).toBe(false);
  });

  it("degrades honestly on denial or missing browser support", () => {
    let failure: PositionErrorCallback | null | undefined;
    const clearWatch = vi.fn();
    const provider = new BrowserGeolocationProvider(
      {
        watchPosition: (_success, error) => {
          failure = error;
          return 8;
        },
        clearWatch,
      },
      landfallFixture.worldspaces[0],
    );
    const states: string[] = [];
    provider.start(
      { sessionId: "session-1", publishedVersionId: "version-1" },
      () => {},
      (state) => states.push(state),
    );
    failure?.({ code: 1, message: "denied" } as GeolocationPositionError);
    expect(states).toEqual(["DENIED"]);
    expect(clearWatch).toHaveBeenCalledWith(8);
    expect(provider.active).toBe(false);
    const unavailable = new BrowserGeolocationProvider(null, landfallFixture.worldspaces[0]);
    unavailable.start(
      { sessionId: "session-1", publishedVersionId: "version-1" },
      () => {},
      (state) => states.push(state),
    );
    expect(states.at(-1)).toBe("UNAVAILABLE");
  });

  it("stops the foreground watch on a provider error", () => {
    let failure: PositionErrorCallback | null | undefined;
    const clearWatch = vi.fn();
    const provider = new BrowserGeolocationProvider(
      {
        watchPosition: (_success, error) => {
          failure = error;
          return 9;
        },
        clearWatch,
      },
      landfallFixture.worldspaces[0],
    );
    const states: string[] = [];
    provider.start(
      { sessionId: "session-1", publishedVersionId: "version-1" },
      () => {},
      (state) => states.push(state),
    );
    failure?.({ code: 2, message: "position unavailable" } as GeolocationPositionError);
    expect(states).toEqual(["UNAVAILABLE"]);
    expect(clearWatch).toHaveBeenCalledWith(9);
    expect(provider.active).toBe(false);
  });

  it("reports a synchronous browser security failure without starting a watch", () => {
    const provider = new BrowserGeolocationProvider(
      {
        watchPosition: () => {
          throw new Error("blocked");
        },
        clearWatch: vi.fn(),
      },
      landfallFixture.worldspaces[0],
    );
    const states: string[] = [];
    expect(() =>
      provider.start(
        { sessionId: "session-1", publishedVersionId: "version-1" },
        () => {},
        (state) => states.push(state),
      ),
    ).not.toThrow();
    expect(states).toEqual(["UNAVAILABLE"]);
    expect(provider.active).toBe(false);
  });

  it("feeds foreground fixes through qualification and safe Chart state without durable coordinates", () => {
    let success: PositionCallback | undefined;
    const geolocation = {
      watchPosition: vi.fn((callback: PositionCallback) => {
        success = callback;
        return 12;
      }),
      clearWatch: vi.fn(),
    };
    const provider = new BrowserGeolocationProvider(geolocation, landfallFixture.worldspaces[0]);
    const registry = new LandfallProviderRegistry();
    registry.register({
      id: "browser-geolocation",
      source: "BROWSER_GEOLOCATION",
      worldspaceKinds: ["PHYSICAL"],
      state: "AVAILABLE",
    });
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry,
    );
    runtime.setActiveWaypoint("town-arrival");
    const start = Date.UTC(2026, 8, 29, 12, 0, 0);
    const outcomes: string[] = [];
    provider.start(
      { sessionId: "session-1", publishedVersionId: "version-1" },
      (observation) =>
        outcomes.push(
          runtime.ingest(
            observation,
            observation.kind === "PHYSICAL_POSITION" ? Date.parse(observation.observedAt) : start,
          ).confidence,
        ),
      (state) => runtime.setPermission(state),
    );
    success?.({
      timestamp: start + 1000,
      coords: { latitude: 44, longitude: -72, accuracy: 8 },
    } as GeolocationPosition);
    success?.({
      timestamp: start + 2000,
      coords: { latitude: 44, longitude: -72, accuracy: 8 },
    } as GeolocationPosition);
    expect(outcomes).toEqual(["LIKELY_INSIDE", "CONFIRMED"]);
    expect(runtime.projection("PLAYER", start + 2000).visitedLocationIds).toEqual([]);
    expect(runtime.projection("PUBLIC", start + 2000)).not.toHaveProperty("currentContext.coordinate");
    expect(
      JSON.stringify(
        runtime.safeObservationReceipt({
          schemaVersion: 1,
          id: "safe",
          sessionId: "session-1",
          publishedVersionId: "version-1",
          worldspaceId: "town",
          providerId: "browser-geolocation",
          source: "BROWSER_GEOLOCATION",
          kind: "PHYSICAL_POSITION",
          observedAt: new Date(start).toISOString(),
          coordinate: {
            type: "WGS84",
            worldspaceId: "town",
            referenceId: "town-wgs84",
            referenceVersion: 1,
            latitude: 44,
            longitude: -72,
          },
          accuracyMeters: 8,
        }),
      ),
    ).not.toContain("latitude");
    provider.stop();
    expect(runtime.diagnostics().fixCount).toBe(2);
  });
});
