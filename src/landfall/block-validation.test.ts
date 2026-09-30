import { describe, expect, it } from "vitest";
import { landfallFixture } from "@/landfall/fixtures";
import { validateLandfallBlockContracts } from "@/landfall/block-validation";

const provider = {
  mode: "landfall",
  fallbackMode: "playerConfirmation",
  provider: {
    id: "landfall",
    version: 1,
    options: {
      worldspaceId: "town",
      locationId: "town-arrival",
      requiredOutcome: "CONFIRMED",
      allowCaptainOverride: true,
      allowPlayerFallback: false,
      replayPolicy: "PRESENTATION_ONLY",
    },
  },
};

describe("Landfall Chronicle publication references", () => {
  it("accepts a valid journey and reusable provider on another Passage", () => {
    expect(
      validateLandfallBlockContracts(landfallFixture, [
        {
          id: "journey",
          title: "Journey",
          blockType: "waypointJourney",
          configuration: { worldspaceId: "town", waypointId: "town-arrival" },
          completion: { mode: "automatic" },
        },
        { id: "story", title: "Story", blockType: "narrative", configuration: {}, completion: provider },
      ]),
    ).toEqual([]);
  });

  it("blocks forged cross-Worldspace targets and unavailable manual fallback", () => {
    const findings = validateLandfallBlockContracts(landfallFixture, [
      {
        id: "journey",
        title: "Journey",
        blockType: "waypointJourney",
        configuration: { worldspaceId: "town", waypointId: "isle-region" },
        completion: { mode: "automatic" },
      },
      {
        id: "story",
        title: "Story",
        blockType: "narrative",
        configuration: {},
        completion: {
          ...provider,
          provider: { ...provider.provider, options: { ...provider.provider.options, allowPlayerFallback: true } },
        },
      },
    ]);
    expect(findings.map((item) => item.code)).toEqual(["LANDFALL_BLOCK_WAYPOINT", "LANDFALL_COMPLETION_FALLBACK"]);
    expect(
      validateLandfallBlockContracts(null, [
        { id: "story", title: "Story", blockType: "narrative", configuration: {}, completion: provider },
      ])[0].code,
    ).toBe("LANDFALL_DEFINITION_MISSING");
  });
});
