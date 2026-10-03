import { describe, expect, it } from "vitest";
import { validateLandfallDefinition } from "@/landfall/definition";
import { bearingDegrees, distance, geometryMatch, routeProgress } from "@/landfall/geometry";
import { LandfallProviderRegistry, LandfallSimulationProvider, sanitizeObservation } from "@/landfall/observation";
import { LandfallRuntime } from "@/landfall/runtime";
import {
  landfallFixture,
  physicalCoordinate,
  physicalObservation,
  virtualCoordinate,
  virtualObservation,
} from "@/landfall/fixtures";

const identity = { sessionId: "session-1", publishedVersionId: "version-1" };
function registry() {
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
}
const at = (seconds: number) => new Date(Date.UTC(2026, 8, 29, 12, 0, seconds)).toISOString();
const now = (seconds: number) => Date.parse(at(seconds));

describe("Landfall Phase 1 Worldspace foundation", () => {
  it("rejects mixed Worldspace coordinates, unknown references and virtual GPS precision", () => {
    const wrongWorldspace = structuredClone(landfallFixture);
    wrongWorldspace.routes[1].geometry = {
      type: "ROUTE_LINE",
      points: [physicalCoordinate(44, -72), virtualCoordinate(0.5, 0.5)],
    };
    expect(() => validateLandfallDefinition(wrongWorldspace)).toThrow();
    const wrongReference = structuredClone(landfallFixture);
    wrongReference.maps[1].camera.center.referenceVersion = 2;
    expect(() => validateLandfallDefinition(wrongReference)).toThrow();
    const virtualGps = structuredClone(landfallFixture);
    virtualGps.waypoints[1].evidenceProfile.requiredAccuracyMeters = 5;
    expect(() => validateLandfallDefinition(virtualGps)).toThrow();
    expect(() =>
      distance(physicalCoordinate(44, -72), virtualCoordinate(0.5, 0.5), landfallFixture.worldspaces[0]),
    ).toThrow("REFERENCE_MISMATCH");
  });

  it("calculates physical bearings and virtual route progress without shared units", () => {
    expect(
      distance(physicalCoordinate(44, -72), physicalCoordinate(44.001, -72), landfallFixture.worldspaces[0]),
    ).toBeCloseTo(111.2, 0);
    expect(
      bearingDegrees(physicalCoordinate(44, -72), physicalCoordinate(44.001, -72), landfallFixture.worldspaces[0]),
    ).toBeCloseTo(0, 4);
    const progress = routeProgress(
      virtualCoordinate(0.3, 0.3),
      [virtualCoordinate(0.1, 0.1), virtualCoordinate(0.5, 0.5)],
      landfallFixture.worldspaces[1],
    );
    expect(progress.fraction).toBeCloseTo(0.5, 4);
    expect(
      geometryMatch(virtualCoordinate(0.5, 0.5), landfallFixture.waypoints[1].geometry, landfallFixture.worldspaces[1])
        .inside,
    ).toBe(true);
    expect(
      geometryMatch(virtualCoordinate(0.8, 0.8), landfallFixture.waypoints[1].geometry, landfallFixture.worldspaces[1])
        .inside,
    ).toBe(false);
  });

  it("requires repeated qualified physical evidence and rejects stale, weak, duplicate, and impossible movement", () => {
    const runtime = new LandfallRuntime(landfallFixture, identity, registry());
    runtime.setActiveWaypoint("town-arrival");
    expect(runtime.ingest(physicalObservation("weak", at(0), 44, -72, 300), now(0)).confidence).toBe("WEAK");
    expect(runtime.ingest(physicalObservation("stale", at(0)), now(50)).rejection).toBe("STALE");
    expect(runtime.ingest(physicalObservation("first", at(1)), now(1)).confidence).toBe("LIKELY_INSIDE");
    expect(runtime.ingest(physicalObservation("first", at(1)), now(2)).rejection).toBe("DUPLICATE");
    expect(runtime.ingest(physicalObservation("jump", at(2), 45, -72), now(2)).rejection).toBe("IMPOSSIBLE_SPEED");
    const confirmed = runtime.ingest(physicalObservation("second", at(3)), now(3));
    expect(confirmed.confidence).toBe("CONFIRMED");
    expect(runtime.projection("PUBLIC", now(3))).not.toHaveProperty("currentContext.coordinate");
    const consent = {
      sessionId: "session-1",
      purpose: "LIVE_CAPTAIN_VIEW" as const,
      grantedAt: now(1),
      expiresAt: now(8),
    };
    expect(runtime.projection("CAPTAIN", now(3)).currentContext).not.toHaveProperty("coordinate");
    expect(runtime.projection("CAPTAIN", now(3), consent).currentContext).toHaveProperty("coordinate");
    expect(runtime.projection("CAPTAIN", now(3), { ...consent, revokedAt: now(2) }).currentContext).not.toHaveProperty(
      "coordinate",
    );
    expect(runtime.projection("CAPTAIN", now(8), consent).currentContext).not.toHaveProperty("coordinate");
    expect(JSON.stringify(runtime.diagnostics())).not.toContain("latitude");
    expect(JSON.stringify(sanitizeObservation(physicalObservation("receipt", at(3))))).not.toContain("longitude");
    expect(runtime.diagnostics().fixCount).toBeLessThanOrEqual(12);
  });

  it("keeps local evidence unconfirmed until canonical reconciliation, then deduplicates", () => {
    const runtime = new LandfallRuntime(landfallFixture, identity, registry());
    runtime.setActiveWaypoint("town-arrival");
    runtime.setOffline("OFFLINE_READY");
    runtime.ingest(physicalObservation("first", at(1)), now(1));
    const outcome = runtime.ingest(physicalObservation("second", at(2)), now(2));
    expect(outcome.sync).toBe("QUEUED");
    expect(runtime.projection("PLAYER", now(2)).visitedLocationIds).toEqual([]);
    expect(runtime.completionRequest("second", 4, "retry-key", now(2))).toMatchObject({
      expectedSequence: 4,
      publishedVersionId: "version-1",
      waypointId: "town-arrival",
    });
    const receipt = {
      status: "CONFIRMED" as const,
      sessionId: "session-1",
      evidenceId: "second",
      publishedVersionId: "version-1",
      waypointId: "town-arrival",
      confirmedAt: at(5),
      canonicalEventId: "canonical-1",
      canonicalSequence: 5,
    };
    expect(() => runtime.reconcile("second", { ...receipt, sessionId: "other" })).toThrow(
      "LANDFALL_RECONCILIATION_MISMATCH",
    );
    expect(() => runtime.reconcile("second", { ...receipt, canonicalSequence: 0 })).toThrow(
      "LANDFALL_STALE_RECONCILIATION",
    );
    expect(runtime.reconcile("second", receipt)).toBe("SERVER_CONFIRMED");
    expect(runtime.reconcile("second", receipt)).toBe("SERVER_CONFIRMED");
    expect(runtime.projection("PLAYER", now(5)).journeyPath).toHaveLength(1);
  });

  it("transitions into a virtual Worldspace without inventing telemetry or revealing hidden targets", () => {
    const runtime = new LandfallRuntime(landfallFixture, identity, registry());
    expect(() => runtime.transition("isles", "transition-1", at(0), false)).toThrow(
      "LANDFALL_DESTINATION_ASSETS_UNAVAILABLE",
    );
    runtime.transition("isles", "transition-1", at(0), true);
    runtime.setActiveWaypoint("isle-region");
    expect(runtime.projection("PLAYER", now(0)).availableLocations).toEqual([]);
    expect(runtime.ingest(virtualObservation("wrong", at(1), "different"), now(1)).confidence).toBe("OUTSIDE");
    const simulation = new LandfallSimulationProvider([virtualObservation("found", at(2))]);
    const found = runtime.ingest(simulation.next(), now(2));
    expect(found.confidence).toBe("CONFIRMED");
    expect(runtime.projection("PLAYER", now(2)).currentContext.kind).toBe("UNAVAILABLE");
    expect(runtime.projection("PLAYER", now(2)).availableLocations).toEqual([]);
    runtime.reconcile("found", {
      status: "CONFIRMED",
      sessionId: "session-1",
      evidenceId: "found",
      publishedVersionId: "version-1",
      waypointId: "isle-region",
      confirmedAt: at(3),
      canonicalEventId: "canonical-isle",
      canonicalSequence: 1,
    });
    expect(runtime.projection("PLAYER", now(3)).availableLocations).toMatchObject([{ id: "isle-region" }]);
    expect(runtime.projection("PLAYER", now(3)).journeyPath.map((segment) => segment.kind)).toEqual([
      "TRANSITION",
      "VISIT",
    ]);
    expect(runtime.projection("CAPTAIN", now(3)).currentContext).not.toHaveProperty("coordinate");
    expect(runtime.projection("PUBLIC", now(3))).toMatchObject({
      activeWaypointId: null,
      currentContext: { kind: "UNAVAILABLE" },
      confidence: "UNAVAILABLE",
      visitedLocationIds: [],
      discoveredLocationIds: [],
      availableLocations: [],
      journeyPath: [],
    });
  });
});
