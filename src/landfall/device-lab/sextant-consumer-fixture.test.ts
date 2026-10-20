import { describe, expect, it } from "vitest";
import { landfallFixture } from "../fixtures";
import { validateLandfallDefinition } from "../definition";
import { prepareSextantPhysicalContext } from "../../../.agents/scripts/sextant-landfall-physical-context";

describe("owned Sextant physical consumer fixture", () => {
  it("assembles a valid physical context without lowering map, region or landmark protection", () => {
    const original = JSON.stringify(landfallFixture);
    const definition = structuredClone(landfallFixture);
    prepareSextantPhysicalContext(definition, "synthetic-reference");
    const parsed = validateLandfallDefinition(definition);
    expect(parsed.maps).toEqual(landfallFixture.maps);
    expect(parsed.context!.regions[0].privacyClassification).toBe("APPROXIMATE_REAL_WORLD");
    expect(parsed.context!.landmarks[0].privacyClassification).toBe("APPROXIMATE_REAL_WORLD");
    expect(parsed.context!.landmarks[0].referenceAssetIds).toEqual(["synthetic-reference"]);
    expect(parsed.waypoints[0].regionId).toBe(parsed.context!.regions[0].id);
    expect(parsed.waypoints[0].landmarkId).toBe(parsed.context!.landmarks[0].id);
    expect(JSON.stringify(landfallFixture)).toBe(original);
    const invalidRegion = structuredClone(parsed);
    invalidRegion.context!.regions[0].privacyClassification = "FICTIONAL";
    expect(() => validateLandfallDefinition(invalidRegion)).toThrow(/privacy/);
    const invalidLandmark = structuredClone(parsed);
    invalidLandmark.context!.landmarks[0].privacyClassification = "GENERIC";
    expect(() => validateLandfallDefinition(invalidLandmark)).toThrow(/privacy/);
  });
});
