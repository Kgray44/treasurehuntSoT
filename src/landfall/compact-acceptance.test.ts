import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { compactSiteFixture } from "@/landfall/compact-fixtures";
import { physicalObservation } from "@/landfall/fixtures";
import { verifyPlayerLandmark } from "@/landfall/landmark-verification";
import { signLandmarkReceipt, landmarkDefinitionHash } from "@/landfall/landmark-receipt";
import { qualifyPlayerLandfallEvidence } from "@/landfall/server-evidence";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { validateLandfallReferenceAssets } from "@/landfall/context-assets";
import { validateLandfallBlockContracts } from "@/landfall/block-validation";
import { observationContextReached } from "@/landfall/observation-context";

const now = Date.parse("2026-10-01T12:00:05Z");
const events = ["compact-arrival", "compact-door", "compact-room"].map((waypointId, i) => ({
  id: `arrival-${i}`,
  sequence: i + 1,
  eventType: "landfallWaypointConfirmed",
  payload: { waypointId, worldspaceId: "town", outcome: "CONFIRMED" },
}));
const fixes = [0, 1].map((i) => ({
  ...physicalObservation(
    `compact-fix-${i}`,
    new Date(now - 2000 + i * 1000).toISOString(),
    44 + 10 / 111000,
    -72 - 25 / 80000,
    2,
  ),
  providerId: "browser-geolocation",
}));
const request = {
  schemaVersion: 1 as const,
  sessionId: "session-1",
  publishedVersionId: "version-1",
  worldspaceId: "town",
  waypointId: "compact-landmark-target",
  evidenceId: "compact-signed-evidence",
  expectedSequence: 3,
  idempotencyKey: "compact-idempotency",
  method: "LANDMARK" as const,
};
async function patternedImage() {
  const pixels = Buffer.alloc(64 * 64 * 3);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) pixels.fill(x > y ? 220 : 25, (y * 64 + x) * 3, (y * 64 + x) * 3 + 3);
  return sharp(pixels, { raw: { width: 64, height: 64, channels: 3 } })
    .png()
    .toBuffer();
}
describe("museum and mixed compact site server acceptance", () => {
  it.each(["MUSEUM", "GARDEN"] as const)(
    "retains one geometry domain, route, optional discovery and readable fallback for %s",
    (kind) => {
      const fixture = compactSiteFixture(kind);
      expect(fixture.context!.regions.some((item) => item.kind === "CORRIDOR")).toBe(true);
      expect(fixture.waypoints.some((item) => item.sequence.optional)).toBe(true);
      expect(fixture.waypoints.every((item) => item.fallback.mode !== "NONE")).toBe(true);
      expect(fixture.routes[0].segmentRegionIds).toHaveLength(3);
      if (kind === "MUSEUM") expect(fixture.maps.map((map) => map.level)).toEqual(["Ground", "Upper"]);
    },
  );
  it("verifies multiple reference frames only inside plausible authored regional context", async () => {
    const definition = compactSiteFixture();
    const image = await patternedImage();
    const secondView = await sharp(image).linear(1, -2).png().toBuffer();
    definition.context!.landmarks[0].negativeReferenceAssetIds = [];
    const input = {
      definition,
      request: {
        ...request,
        landmarkId: "compact-mural",
        observations: fixes,
        frames: [image, secondView].map((view) => `data:image/png;base64,${view.toString("base64")}`),
      },
      playerProfileId: "player-1",
      events,
      chapterId: null,
      blockId: null,
      now,
      readReference: async () => image,
    };
    const match = await verifyPlayerLandmark(input);
    expect(match.result).toBe("confirmed");
    expect("receipt" in match).toBe(true);
    const qualified = qualifyPlayerLandfallEvidence({
      definition,
      request: { ...request, landmarkReceipt: "receipt" in match ? match.receipt : "" },
      journey: projectLandfallJourney(definition, events),
      now,
      playerProfileId: "player-1",
    });
    expect(qualified.contextualSummary).toMatchObject({
      state: "CONFIRMED",
      regionId: "compact-target",
      landmarkId: "compact-mural",
    });
    expect(JSON.stringify(qualified)).not.toMatch(/latitude|longitude|frames|base64/);
    await expect(
      verifyPlayerLandmark({
        ...input,
        request: {
          ...input.request,
          observations: fixes.map((fix) =>
            fix.kind === "PHYSICAL_POSITION" ? { ...fix, coordinate: { ...fix.coordinate, latitude: 45 } } : fix,
          ),
        },
      }),
    ).rejects.toThrow();
    await expect(verifyPlayerLandmark({ ...input, now: now + 31_000 })).rejects.toThrow(/STALE/);
    const sourceDisabled = structuredClone(definition);
    sourceDisabled.worldspaces[0].observationPolicy.allowedSources =
      sourceDisabled.worldspaces[0].observationPolicy.allowedSources.filter((source) => source !== "VISION_WAYPOINT");
    await expect(verifyPlayerLandmark({ ...input, definition: sourceDisabled })).rejects.toThrow(/SOURCE_UNAVAILABLE/);
    expect(() =>
      qualifyPlayerLandfallEvidence({
        definition: sourceDisabled,
        request: { ...request, landmarkReceipt: "receipt" in match ? match.receipt : "" },
        journey: projectLandfallJourney(sourceDisabled, events),
        now,
        playerProfileId: "player-1",
      }),
    ).toThrow(/SOURCE_UNAVAILABLE/);
    expect(() =>
      qualifyPlayerLandfallEvidence({
        definition,
        request: { ...request, landmarkReceipt: "receipt" in match ? match.receipt : "" },
        journey: projectLandfallJourney(definition, events),
        now,
        playerProfileId: "player-2",
      }),
    ).toThrow(/SCOPE_MISMATCH/);
  });
  it("binds landmark success to exact sequence, authored region, version and waypoint", () => {
    const definition = compactSiteFixture();
    const receipt = signLandmarkReceipt({
      id: "signed-1",
      sessionId: "session-1",
      publishedVersionId: "version-1",
      playerProfileId: "player-1",
      expectedSequence: 3,
      worldspaceId: "town",
      waypointId: "compact-landmark-target",
      landmarkId: "compact-mural",
      regionId: "compact-target",
      definitionHash: landmarkDefinitionHash(definition),
      frameCount: 2,
      result: "confirmed",
      issuedAt: now - 1000,
      expiresAt: now + 20_000,
    });
    const base = {
      definition,
      request: { ...request, landmarkReceipt: receipt },
      journey: projectLandfallJourney(definition, events),
      now,
      playerProfileId: "player-1",
    };
    for (const change of [{ expectedSequence: 4 }, { sessionId: "other" }, { publishedVersionId: "other" }])
      expect(() => qualifyPlayerLandfallEvidence({ ...base, request: { ...base.request, ...change } })).toThrow(
        /SCOPE_MISMATCH/,
      );
    const changed = structuredClone(definition);
    changed.context!.regions[0].name = "Changed property";
    expect(() => qualifyPlayerLandfallEvidence({ ...base, definition: changed })).toThrow(/SCOPE_MISMATCH/);
    expect(() =>
      qualifyPlayerLandfallEvidence({
        ...base,
        request: {
          ...base.request,
          contextualEvidence: [
            {
              kind: "LANDMARK",
              id: "spoofed",
              sessionId: "session-1",
              publishedVersionId: "version-1",
              worldspaceId: "town",
              observedAt: new Date(now).toISOString(),
              landmarkId: "compact-mural",
              regionId: "compact-target",
              result: "confirmed",
              frameCount: 2,
            },
          ],
        },
      }),
    ).toThrow(/UNTRUSTED/);
  });
  it("keeps GPS broad arrival separate from an exact-object response", () => {
    const definition = compactSiteFixture();
    const exactEvents = [
      ...events,
      {
        id: "mural-visit",
        sequence: 4,
        eventType: "landfallWaypointConfirmed",
        payload: { waypointId: "compact-landmark-target" },
      },
    ];
    const journey = projectLandfallJourney(definition, exactEvents, { observationWaypointId: "compact-observation" });
    const evidence = {
      ...request,
      method: "FOREGROUND_LOCATION" as const,
      waypointId: "compact-observation",
      evidenceId: fixes.at(-1)!.id,
      observations: fixes,
    };
    expect(() => qualifyPlayerLandfallEvidence({ definition, request: evidence, journey, now })).toThrow(
      /NOT_QUALIFIED/,
    );
    const arrival = qualifyPlayerLandfallEvidence({
      definition,
      request: evidence,
      journey,
      now,
      observationRevisit: true,
    });
    expect(arrival).toMatchObject({ outcome: "LIKELY_INSIDE", contextualArrival: true });
    const block = {
      id: "plaque",
      blockType: "locationObservation",
      configuration: { worldspaceId: "town", waypointId: "compact-observation" },
      completion: {},
    };
    expect(
      observationContextReached(block, [
        { id: "broad", blockId: "plaque", sequence: 5, eventType: "landfallWaypointConfirmed", payload: arrival },
      ]),
    ).toBe(true);
    expect(
      observationContextReached({ ...block, id: "other" }, [
        { id: "broad", blockId: "plaque", sequence: 5, eventType: "landfallWaypointConfirmed", payload: arrival },
      ]),
    ).toBe(false);
  });
  it("blocks invalid private reference assets and exact GPS configurations lacking independent observation", () => {
    const definition = compactSiteFixture();
    expect(() => validateLandfallReferenceAssets(definition, [])).toThrow(/UNAVAILABLE/);
    expect(() =>
      validateLandfallReferenceAssets(definition, [{ id: "compact-reference-positive", mimeType: "text/html" }]),
    ).toThrow();
    expect(validateLandfallBlockContracts(definition, []).map((finding) => finding.code)).toContain(
      "LANDFALL_EXACT_TARGET_VERIFICATION",
    );
    expect(
      validateLandfallBlockContracts(definition, [
        {
          id: "observation",
          title: "Plaque",
          blockType: "locationObservation",
          configuration: {
            worldspaceId: "town",
            waypointId: "compact-observation",
            prompt: "Read the plaque",
            completionMode: "textAnswer",
            acceptedAnswers: ["lantern"],
          },
          completion: {},
        },
      ]),
    ).toEqual([]);
    const observation = {
      id: "observation",
      title: "Plaque",
      blockType: "locationObservation",
      configuration: {
        worldspaceId: "town",
        waypointId: "compact-observation",
        prompt: "Read the plaque",
        completionMode: "textAnswer",
        acceptedAnswers: ["lantern"],
      },
      completion: { mode: "landfall" },
    };
    expect(validateLandfallBlockContracts(definition, [observation]).map((finding) => finding.code)).toContain(
      "LANDFALL_EXACT_TARGET_VERIFICATION",
    );
  });
});
