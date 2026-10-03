import { describe, expect, it } from "vitest";
import { NativeLocationProvider, type NativeLocationDriver } from "@/landfall/native-location";
import { landfallFixture, physicalObservation } from "@/landfall/fixtures";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { qualifyPlayerLandfallEvidence, type PlayerLandfallEvidence } from "@/landfall/server-evidence";
import { LandfallEvidenceFusion } from "@/landfall/evidence-fusion";

describe("native foreground acquisition lifecycle", () => {
  it("rejects virtual input, requires consent, keeps fixes ephemeral and tears down on permission loss", async () => {
    let listener: Parameters<NativeLocationDriver["subscribe"]>[0] = () => undefined;
    let stops = 0;
    const driver: NativeLocationDriver = {
      platform: "IOS",
      permission: async () => "APPROXIMATE",
      start: async (options) => {
        expect(options.precise).toBe(false);
        expect(options.background).toBe(false);
      },
      stop: async () => {
        stops++;
      },
      subscribe: (callback) => {
        listener = callback;
        return () => undefined;
      },
    };
    expect(() => new NativeLocationProvider(driver, landfallFixture.worldspaces[1])).toThrow("PHYSICAL_WGS84");
    const provider = new NativeLocationProvider(driver, landfallFixture.worldspaces[0], () => 10000);
    const identity = { sessionId: "session", publishedVersionId: "version" };
    const emitted: unknown[] = [];
    await expect(
      provider.start(
        identity,
        { userAction: false, intervalMs: 1000, precise: true },
        (fix) => emitted.push(fix),
        () => undefined,
      ),
    ).rejects.toThrow("CONSENT");
    await provider.start(
      identity,
      { userAction: true, intervalMs: 5000, precise: true },
      (fix) => emitted.push(fix),
      () => undefined,
    );
    const fix = { id: "native-1", timestamp: 9000, latitude: 0, longitude: 0, accuracyMeters: 100 };
    listener({ type: "fix", fix });
    listener({ type: "fix", fix });
    listener({ type: "fix", fix: { ...fix, timestamp: 11001 } });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({
      source: "NATIVE_LOCATION",
      providerId: "ios-core-location",
      sessionId: "session",
      accuracyMeters: 100,
    });
    listener({ type: "permission", state: "REVOKED" });
    listener({ type: "fix", fix: { ...fix, timestamp: 9500 } });
    expect(provider.active).toBe(false);
    expect(stops).toBe(1);
    expect(emitted).toHaveLength(1);
  });
});
describe("one canonical native/browser qualification", () => {
  const now = Date.parse("2026-09-30T10:00:02.000Z");
  const definition = structuredClone(landfallFixture);
  definition.worldspaces[0].observationPolicy.allowedSources.push("NATIVE_LOCATION");
  definition.waypoints
    .filter((waypoint) => waypoint.worldspaceId === "town")
    .forEach((waypoint) => waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION"));
  const request: PlayerLandfallEvidence = {
    schemaVersion: 1,
    sessionId: "session-1",
    publishedVersionId: "version-1",
    worldspaceId: "town",
    waypointId: "town-arrival",
    evidenceId: "fix-2",
    expectedSequence: 4,
    idempotencyKey: "native-evidence",
    method: "FOREGROUND_LOCATION",
    observations: [
      physicalObservation("fix-1", "2026-09-30T10:00:00.000Z"),
      physicalObservation("fix-2", "2026-09-30T10:00:01.000Z"),
    ].map((fix) => ({ ...fix, source: "NATIVE_LOCATION", providerId: "ios-core-location" })),
  };
  const journey = projectLandfallJourney(definition, [], { chapterId: null, blockId: null });
  it("passes native observations through the accepted qualifier, retaining freshness/accuracy/provider checks", () => {
    expect(qualifyPlayerLandfallEvidence({ definition, request, journey, now }).method).toBe("NATIVE_LOCATION");
    expect(() => qualifyPlayerLandfallEvidence({ definition, request, journey, now: now + 120000 })).toThrow();
    const mixed = structuredClone(request);
    mixed.observations![1].source = "BROWSER_GEOLOCATION";
    expect(() => qualifyPlayerLandfallEvidence({ definition, request: mixed, journey, now })).toThrow(
      "IDENTITY_MISMATCH",
    );
    const forged = structuredClone(request);
    forged.observations![0].providerId = "geofence";
    expect(() => qualifyPlayerLandfallEvidence({ definition, request: forged, journey, now })).toThrow(
      "PROVIDER_UNAVAILABLE",
    );
  });
  it("never counts browser and native OS location as independent sources", () => {
    const fusion = new LandfallEvidenceFusion();
    const profile = {
      ...definition.waypoints[0].evidenceProfile,
      fusionPolicy: { version: 1 as const, minimumIndependentSources: 2 },
    };
    const browser = {
      ...physicalObservation("browser", "2026-09-30T10:00:01.000Z"),
      source: "BROWSER_GEOLOCATION" as const,
    };
    const native = { ...physicalObservation("native", "2026-09-30T10:00:01.000Z"), source: "NATIVE_LOCATION" as const };
    fusion.consider(browser, true, profile, now);
    expect(fusion.consider(native, true, profile, now)).toBe("INSUFFICIENT");
    const human = {
      schemaVersion: 1 as const,
      id: "human",
      sessionId: "session-1",
      publishedVersionId: "version-1",
      worldspaceId: "town",
      providerId: "player",
      source: "PLAYER_CONFIRMATION" as const,
      kind: "SEMANTIC_LOCATION" as const,
      targetLocationId: "town-arrival",
      assertion: "PRESENT" as const,
      confidence: 1,
      observedAt: "2026-09-30T10:00:01.000Z",
    };
    expect(fusion.consider(human, true, profile, now)).toBe("SUPPORTED");
  });
});
