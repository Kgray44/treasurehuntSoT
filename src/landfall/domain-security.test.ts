import { describe, expect, it } from "vitest";
import { validateLandfallDefinition } from "@/landfall/definition";
import { crossesGate, geometryMatch, validateGeometry } from "@/landfall/geometry";
import {
  landfallFixture,
  physicalCoordinate,
  physicalObservation,
  virtualCoordinate,
  virtualObservation,
} from "@/landfall/fixtures";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";

const at = (second: number) => new Date(Date.UTC(2026, 8, 29, 12, 0, second)).toISOString();
const now = (second: number) => Date.parse(at(second));
const edit = (change: (definition: typeof landfallFixture) => void) => {
  const definition = structuredClone(landfallFixture);
  change(definition);
  return definition;
};
const registry = () => {
  const providers = new LandfallProviderRegistry();
  providers.register({
    id: "sim-physical",
    source: "BROWSER_GEOLOCATION",
    worldspaceKinds: ["PHYSICAL"],
    state: "AVAILABLE",
  });
  providers.register({
    id: "sim-virtual",
    source: "PLAYER_CONFIRMATION",
    worldspaceKinds: ["VIRTUAL"],
    state: "AVAILABLE",
  });
  return providers;
};

describe("Landfall authored data and evidence boundaries", () => {
  it("rejects ambiguous IDs, incompatible maps, missing fallbacks and malformed waypoint types", () => {
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.maps[0].id = d.worldspaces[0].id;
        }),
      ),
    ).toThrow();
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.maps[1].source = { type: "ASSET_IMAGE", assetId: "other" };
        }),
      ),
    ).toThrow();
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.waypoints[0].fallback.mode = "NONE";
        }),
      ),
    ).toThrow();
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.waypoints[0].type = "PASS_THROUGH_GATE";
        }),
      ),
    ).toThrow();
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.waypoints[0].type = "MOVING_TEMPORARY_WAYPOINT";
        }),
      ),
    ).toThrow();
  });

  it("rejects prerequisite cycles and never proposes a completion before its prerequisites", () => {
    const definition = edit((d) => {
      d.waypoints.push({
        ...structuredClone(d.waypoints[0]),
        id: "second-arrival",
        name: "Second arrival",
        sequence: { afterWaypointIds: ["town-arrival"], optional: false },
      });
    });
    expect(() =>
      validateLandfallDefinition(
        edit((d) => {
          d.waypoints.push(structuredClone(definition.waypoints[2]));
          d.waypoints[0].sequence.afterWaypointIds = ["second-arrival"];
        }),
      ),
    ).toThrow();
    const runtime = new LandfallRuntime(
      validateLandfallDefinition(definition),
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("second-arrival");
    runtime.ingest(physicalObservation("prereq-1", at(1)), now(1));
    runtime.ingest(physicalObservation("prereq-2", at(2)), now(2));
    expect(() => runtime.completionRequest("prereq-2", 0, "attempt-1")).toThrow("LANDFALL_PREREQUISITE_UNMET");
  });

  it("keeps polygon holes and multiple regions distinct, and rejects self crossings", () => {
    const worldspace = landfallFixture.worldspaces[1];
    const outer = [
      virtualCoordinate(0.1, 0.1),
      virtualCoordinate(0.9, 0.1),
      virtualCoordinate(0.9, 0.9),
      virtualCoordinate(0.1, 0.9),
      virtualCoordinate(0.1, 0.1),
    ];
    const hole = [
      virtualCoordinate(0.4, 0.4),
      virtualCoordinate(0.6, 0.4),
      virtualCoordinate(0.6, 0.6),
      virtualCoordinate(0.4, 0.6),
      virtualCoordinate(0.4, 0.4),
    ];
    expect(
      geometryMatch(virtualCoordinate(0.5, 0.5), { type: "POLYGON", rings: [outer, hole] }, worldspace).inside,
    ).toBe(false);
    expect(
      geometryMatch(virtualCoordinate(0.2, 0.2), { type: "POLYGON", rings: [outer, hole] }, worldspace).inside,
    ).toBe(true);
    expect(
      geometryMatch(virtualCoordinate(0.5, 0.5), { type: "MULTIPOLYGON", polygons: [[hole], [outer]] }, worldspace)
        .inside,
    ).toBe(true);
    const crossing = [
      virtualCoordinate(0.1, 0.1),
      virtualCoordinate(0.9, 0.8),
      virtualCoordinate(0.1, 0.8),
      virtualCoordinate(0.9, 0.1),
      virtualCoordinate(0.1, 0.1),
    ];
    expect(() => validateGeometry({ type: "POLYGON", rings: [crossing] }, worldspace)).toThrow();
    expect(() =>
      validateGeometry(
        { type: "ROUTE_LINE", points: [virtualCoordinate(0.2, 0.2), virtualCoordinate(0.2, 0.2)] },
        worldspace,
      ),
    ).toThrow();
    expect(() =>
      validateGeometry(
        { type: "APPROXIMATE_REGION", center: virtualCoordinate(0.5, 0.5), radius: 0.2, publicRadius: 0.1 },
        worldspace,
      ),
    ).toThrow();
  });

  it("requires the correct gate direction", () => {
    const gate = {
      type: "ENTRANCE_GATE" as const,
      start: physicalCoordinate(44, -72.001),
      end: physicalCoordinate(44, -71.999),
      direction: "LEFT_TO_RIGHT" as const,
    };
    const worldspace = landfallFixture.worldspaces[0];
    const forward = crossesGate(physicalCoordinate(44.0001, -72), physicalCoordinate(43.9999, -72), gate, worldspace);
    const backward = crossesGate(physicalCoordinate(43.9999, -72), physicalCoordinate(44.0001, -72), gate, worldspace);
    expect(forward).toBe(true);
    expect(backward).toBe(false);
  });

  it("clears exact location on pause and blocks observations after permission denial", () => {
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("town-arrival");
    runtime.ingest(physicalObservation("first", at(1)), now(1));
    runtime.ingest(physicalObservation("second", at(2)), now(2));
    expect(runtime.projection("PLAYER", now(2)).currentContext.kind).toBe("EXACT");
    runtime.pause();
    expect(runtime.projection("PLAYER", now(2)).currentContext).toEqual({ kind: "UNAVAILABLE" });
    expect(runtime.ingest(physicalObservation("paused", at(3)), now(3)).rejection).toBe("PAUSED");
    runtime.resume();
    runtime.setPermission("DENIED");
    expect(runtime.ingest(physicalObservation("denied", at(4)), now(4))).toMatchObject({
      rejection: "PERMISSION_UNAVAILABLE",
      failure: "PERMISSION_DENIED",
    });
    expect(runtime.projection("PUBLIC", now(4))).toMatchObject({
      activeWorldspaceId: "private-worldspace",
      currentContext: { kind: "UNAVAILABLE" },
      confidence: "UNAVAILABLE",
      journeyPath: [],
    });
  });

  it("does not confirm low confidence virtual position or unavailable provider evidence", () => {
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.transition("isles", "transition-1", at(0), true);
    runtime.setActiveWaypoint("isle-region");
    const weak = {
      schemaVersion: 1,
      id: "weak",
      sessionId: "session-1",
      publishedVersionId: "version-1",
      worldspaceId: "isles",
      providerId: "sim-virtual",
      source: "PLAYER_CONFIRMATION",
      observedAt: at(1),
      kind: "VIRTUAL_POSITION",
      coordinate: virtualCoordinate(0.5, 0.5),
      uncertaintyUnits: 0.01,
      confidence: 0.3,
    };
    expect(runtime.ingest(weak, now(1)).confidence).toBe("WEAK");
    expect(
      runtime.ingest({ ...virtualObservation("unavailable", at(2)), providerId: "not-registered" }, now(2)),
    ).toMatchObject({ rejection: "UNAVAILABLE_PROVIDER", failure: "PROVIDER_UNAVAILABLE" });
    expect(runtime.projection("PLAYER", now(2)).visitedLocationIds).toEqual([]);
  });

  it("does not treat a browser provider ID as semantic location evidence", () => {
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("town-arrival");
    const spoofed = {
      ...virtualObservation("spoofed", at(1), "town-arrival"),
      worldspaceId: "town",
      providerId: "sim-physical",
      source: "BROWSER_GEOLOCATION",
    };
    expect(runtime.ingest(spoofed, now(1)).rejection).toBe("POSITION_KIND_MISMATCH");
  });

  it("does not claim durable offline queueing when offline support is unavailable", () => {
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("town-arrival");
    runtime.setOffline("OFFLINE_UNAVAILABLE");
    runtime.ingest(physicalObservation("offline-first", at(1)), now(1));
    expect(runtime.ingest(physicalObservation("offline-second", at(2)), now(2))).toMatchObject({
      confidence: "CONFIRMED",
      sync: null,
      failure: "OFFLINE",
    });
    expect(() => runtime.completionRequest("offline-second", 0, "offline-attempt")).toThrow(
      "LANDFALL_EVIDENCE_UNAVAILABLE",
    );
  });

  it("resets dwell after leaving and treats uncertain boundaries as likely, not confirmed", () => {
    const definition = edit((d) => {
      d.waypoints[0].evidenceProfile.dwellSeconds = 3;
    });
    const runtime = new LandfallRuntime(
      validateLandfallDefinition(definition),
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("town-arrival");
    expect(runtime.ingest(physicalObservation("dwell-1", at(1)), now(1)).confidence).toBe("LIKELY_INSIDE");
    expect(runtime.ingest(physicalObservation("outside", at(11), 44.0012), now(11)).confidence).toBe("OUTSIDE");
    expect(runtime.ingest(physicalObservation("dwell-2", at(21)), now(21)).confidence).toBe("LIKELY_INSIDE");
    expect(runtime.ingest(physicalObservation("dwell-3", at(22)), now(22)).confidence).toBe("LIKELY_INSIDE");
    expect(runtime.ingest(physicalObservation("dwell-4", at(24)), now(24)).confidence).toBe("CONFIRMED");
    const near = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    near.setActiveWaypoint("town-arrival");
    expect(near.ingest(physicalObservation("boundary", at(1), 44.00085), now(1)).confidence).toBe("LIKELY_INSIDE");
    expect(near.ingest(physicalObservation("older", at(0)), now(2)).rejection).toBe("OUT_OF_ORDER");
  });

  it("rate-limits provider updates and bounds raw fixes, seen IDs, and queued evidence", () => {
    const runtime = new LandfallRuntime(
      landfallFixture,
      { sessionId: "session-1", publishedVersionId: "version-1" },
      registry(),
    );
    runtime.setActiveWaypoint("town-arrival");
    runtime.ingest(physicalObservation("rate-first", at(1)), now(1));
    const tooSoon = physicalObservation("rate-second", new Date(now(1) + 100).toISOString());
    expect(runtime.ingest(tooSoon, now(1) + 100).rejection).toBe("TOO_FREQUENT");
    for (let second = 2; second <= 100; second++)
      runtime.ingest(physicalObservation(`fix-${second}`, at(second)), now(second));
    expect(runtime.diagnostics()).toMatchObject({ fixCount: 12, seenCount: 64, pendingCount: 64 });
  });
});
