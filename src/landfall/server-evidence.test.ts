import { describe, expect, it } from "vitest";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { qualifyPlayerLandfallEvidence, type PlayerLandfallEvidence } from "@/landfall/server-evidence";

const now = Date.parse("2026-09-30T10:00:02.000Z");
const request: PlayerLandfallEvidence = {
  schemaVersion: 1,
  sessionId: "session-1",
  publishedVersionId: "version-1",
  worldspaceId: "town",
  waypointId: "town-arrival",
  evidenceId: "fix-2",
  expectedSequence: 4,
  idempotencyKey: "synthetic-evidence-1",
  method: "FOREGROUND_LOCATION",
  observations: [
    { ...physicalObservation("fix-1", "2026-09-30T10:00:00.000Z"), providerId: "browser-geolocation" },
    { ...physicalObservation("fix-2", "2026-09-30T10:00:01.000Z"), providerId: "browser-geolocation" },
  ],
};

describe("server-side Landfall evidence qualification", () => {
  it("accepts bounded qualified physical samples without returning raw coordinates", () => {
    const result = qualifyPlayerLandfallEvidence({
      definition: landfallFixture,
      request,
      journey: projectLandfallJourney(landfallFixture, []),
      now,
    });
    expect(result).toMatchObject({
      waypointId: "town-arrival",
      evidenceId: "fix-2",
      method: "BROWSER_GEOLOCATION",
      outcome: "CONFIRMED",
      accuracyBand: "HIGH",
    });
    expect(JSON.stringify(result)).not.toContain("-72");
  });

  it("rejects stale, mismatched, and weak samples", () => {
    const journey = projectLandfallJourney(landfallFixture, []);
    for (const observations of [
      request.observations!.map((item) => ({ ...item, publishedVersionId: "other-version" })),
      request.observations!.map((item) => ({ ...item, observedAt: "2026-09-30T09:00:00.000Z" })),
      request.observations!.map((item) =>
        item.kind === "PHYSICAL_POSITION" ? { ...item, accuracyMeters: 500 } : item,
      ),
    ]) {
      expect(() =>
        qualifyPlayerLandfallEvidence({
          definition: landfallFixture,
          request: { ...request, observations },
          journey,
          now,
        }),
      ).toThrow();
    }
  });

  it("records a configured Player fallback as human confirmation without sensor claims", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
    const result = qualifyPlayerLandfallEvidence({
      definition,
      request: { ...request, method: "PLAYER_FALLBACK", observations: undefined },
      journey: projectLandfallJourney(definition, []),
      now,
    });
    expect(result.method).toBe("PLAYER_CONFIRMATION");
    expect(result).not.toHaveProperty("accuracyBand");
    expect(() =>
      qualifyPlayerLandfallEvidence({
        definition,
        request: { ...request, method: "PLAYER_FALLBACK" },
        journey: projectLandfallJourney(definition, []),
        now,
      }),
    ).toThrow("LANDFALL_FALLBACK_MUST_NOT_CLAIM_SENSOR");
  });
});
