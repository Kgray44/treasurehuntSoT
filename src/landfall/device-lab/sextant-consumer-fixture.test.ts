import { describe, expect, it } from "vitest";
import { landfallFixture } from "../fixtures";
import { validateLandfallDefinition } from "../definition";
import {
  prepareSextantPhysicalContext,
  sextantGenericPhysicalDefinition,
} from "../../../.agents/scripts/sextant-landfall-physical-context";
import { projectPlayerLandfallBootstrap } from "../player-bootstrap";

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

  it("withholds the approximate landmark and releases the separate generic fixture without changing the original map", () => {
    const original = JSON.stringify(landfallFixture);
    const approximate = structuredClone(landfallFixture);
    prepareSextantPhysicalContext(approximate, "synthetic-reference");
    const generic = sextantGenericPhysicalDefinition("synthetic-generic-tale");
    prepareSextantPhysicalContext(generic, "synthetic-reference", {
      worldspaceId: generic.worldspaces[0].id,
      waypointId: generic.waypoints[0].id,
    });
    const project = (definition: typeof landfallFixture) =>
      projectPlayerLandfallBootstrap(
        {
          sessionId: "synthetic-voyage",
          taleId: definition.taleId,
          publishedVersionId: "synthetic-edition",
          currentSequence: 4,
          definition: validateLandfallDefinition(definition),
        },
        {
          chapterId: null,
          blockId: null,
          releasedAssets: [{ id: "synthetic-reference", url: "/api/media/synthetic-reference" }],
        },
      );
    const hidden = project(approximate),
      released = project(generic);
    expect(hidden.runtimeDefinition.context!.landmarks).toEqual([]);
    expect(hidden.runtimeDefinition.waypoints[0].landmarkId).toBeUndefined();
    expect(approximate.maps).toEqual(landfallFixture.maps);
    expect(released.runtimeDefinition.context!.landmarks).toHaveLength(1);
    expect(released.runtimeDefinition.context!.landmarks[0].referenceAssetIds).toEqual(["synthetic-reference"]);
    expect(released.activeWaypointId).toBe("synthetic-generic-arrival");
    expect(released.scene.mapId).toBe("synthetic-generic-field-map");
    expect(released.runtimeDefinition.waypoints[0].landmarkId).toBe(
      released.runtimeDefinition.context!.landmarks[0].id,
    );
    expect(JSON.stringify(landfallFixture)).toBe(original);
  });
});
