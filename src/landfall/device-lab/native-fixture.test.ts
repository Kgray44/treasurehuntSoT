import { describe, expect, it } from "vitest";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { qualifyPlayerLandfallEvidence, type PlayerLandfallEvidence } from "@/landfall/server-evidence";
import { deviceLabFixtureForScenario } from "./native-fixture";

describe("published native restart fixture policy", () => {
  const timestamp = Date.parse("2026-10-04T10:00:00Z");
  const request: PlayerLandfallEvidence = {
    schemaVersion: 1,
    sessionId: "session-1",
    publishedVersionId: "version-1",
    worldspaceId: "town",
    waypointId: "town-arrival",
    evidenceId: "second",
    expectedSequence: 0,
    idempotencyKey: "synthetic-restart",
    method: "FOREGROUND_LOCATION",
    observations: [
      { ...physicalObservation("first", new Date(timestamp).toISOString()), providerId: "browser-geolocation" },
      { ...physicalObservation("second", new Date(timestamp + 1000).toISOString()), providerId: "browser-geolocation" },
    ],
  };
  const qualify = (scenarioId: string, afterMs: number) => {
    const definition = deviceLabFixtureForScenario(scenarioId);
    return qualifyPlayerLandfallEvidence({
      definition,
      request,
      journey: projectLandfallJourney(definition, []),
      now: timestamp + afterMs,
    });
  };
  it("accepts the original observations across a bounded restart only under the published restart policy", () => {
    const before = JSON.stringify(request);
    expect(qualify("offline-restart-canonical-reconcile", 100000).outcome).toBe("CONFIRMED");
    expect(JSON.stringify(request)).toBe(before);
    expect(() => qualify("gps-perfect-walk", 100000)).toThrow("LANDFALL_EVIDENCE_STALE");
  });
  it("rejects evidence after the authored restart window and preserves the product fixture", () => {
    const before = JSON.stringify(landfallFixture);
    expect(() => qualify("offline-restart-canonical-reconcile", 601001)).toThrow("LANDFALL_EVIDENCE_STALE");
    expect(() => qualify("unknown-untrusted-scenario", 31000)).toThrow("LANDFALL_EVIDENCE_STALE");
    expect(JSON.stringify(landfallFixture)).toBe(before);
  });
});
