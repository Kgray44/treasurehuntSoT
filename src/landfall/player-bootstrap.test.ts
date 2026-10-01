import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

const pinned = {
  sessionId: "session-1",
  taleId: "fixture-tale",
  publishedVersionId: "version-1",
  currentSequence: 4,
  definition: landfallFixture,
};

describe("authorized Player Landfall bootstrap projection", () => {
  it("marks a released physical floor overlay partial rather than unavailable offline", () => {
    const definition = structuredClone(landfallFixture);
    definition.maps[0].overlays = [
      {
        id: "floor",
        assetId: "floor-image",
        bounds: { west: -72.001, east: -71.999, south: 43.999, north: 44.001 },
        opacity: 1,
        hiddenUntilRevealed: false,
        attributionLabel: "Floor",
        attributionUrl: "https://example.invalid/floor",
        privacyClassification: "PRIVATE_REAL_WORLD",
      },
    ];
    const result = projectPlayerLandfallBootstrap(
      { ...pinned, definition },
      { chapterId: null, blockId: null, releasedAssets: [{ id: "floor-image", url: "/api/media/floor-image" }] },
    );
    expect(result.availableMaps?.[0].offlineMap).toBe("PARTIAL");
    expect(result.availableMaps?.[0].scene.overlays[0].imageUrl).toBe("/api/media/floor-image");
  });
  it("marks exact observation arrival separately while preserving the pinned exact requirement", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints[0].evidenceProfile.precisionProfile = "EXACT_OBJECT";
    const ordinary = projectPlayerLandfallBootstrap(
      { ...pinned, definition },
      { chapterId: null, blockId: null, releasedAssets: [] },
    );
    const observation = projectPlayerLandfallBootstrap(
      { ...pinned, definition },
      { chapterId: null, blockId: null, releasedAssets: [], observationWaypointId: "town-arrival" },
    );
    expect(ordinary.contextualArrivalWaypointId).toBeUndefined();
    expect(observation.contextualArrivalWaypointId).toBe("town-arrival");
    expect(observation.runtimeDefinition.waypoints[0].completion.requiredOutcome).toBe("CONFIRMED");
  });
  it("keeps authorized private layouts, filters unrevealed context, and offers released floors without changing the objective", () => {
    const definition = structuredClone(landfallFixture);
    const base = {
      id: "building",
      worldspaceId: "town",
      mapId: "town-map",
      name: "Building",
      kind: "BUILDING" as const,
      geometry: definition.waypoints[0].geometry,
      privacyClassification: "PUBLIC_REAL_WORLD" as const,
      hiddenUntilRevealed: false,
    };
    base.mapId = definition.maps[0].id;
    definition.context = {
      regions: [
        base,
        { ...base, id: "secret-room", name: "Secret room", hiddenUntilRevealed: true },
        { ...base, id: "private-room", name: "Private room", privacyClassification: "PRIVATE_REAL_WORLD" },
      ],
      landmarks: [],
    };
    definition.maps.push(
      {
        ...definition.maps[0],
        id: "floor-two",
        name: "Floor two",
        role: "FLOOR",
        level: "2",
        source: { type: "AUTHORED_VECTOR" },
      },
      {
        ...definition.maps[0],
        id: "unreleased-floor",
        name: "Unreleased floor",
        source: { type: "ASSET_IMAGE", assetId: "secret-floor-asset" },
      },
    );
    definition.context.regions.push({ ...base, id: "upper-floor", mapId: "floor-two", kind: "FLOOR", level: "2" });
    const result = projectPlayerLandfallBootstrap(
      { ...pinned, definition },
      { chapterId: null, blockId: null, releasedAssets: [] },
    );
    expect(result.availableMaps?.map((item) => item.id)).toEqual([definition.maps[0].id, "floor-two"]);
    expect(result.activeWaypointId).toBe("town-arrival");
    expect(result.runtimeDefinition.context?.regions.map((item) => item.id)).toEqual([
      "building",
      "private-room",
      "upper-floor",
    ]);
    expect(
      result.availableMaps?.find((item) => item.id === "floor-two")?.scene.features.map((item) => item.id),
    ).toEqual(["upper-floor"]);
    expect(JSON.stringify(result)).not.toMatch(/secret-room|unreleased-floor|secret-floor-asset/);
  });
  it("sends only initial released evaluation geometry from the pinned version", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints.push({
      ...definition.waypoints[0],
      id: "future-location",
      geometry: { type: "POINT_RADIUS", center: physicalCoordinate(51, -4), radius: 30 },
      sequence: { afterWaypointIds: ["town-arrival"], optional: false },
    });
    const result = projectPlayerLandfallBootstrap(
      { ...pinned, definition },
      { chapterId: null, blockId: null, releasedAssets: [] },
    );
    expect(result.publishedVersionId).toBe("version-1");
    expect(result.activeWaypointId).toBe("town-arrival");
    expect(result.runtimeDefinition.worldspaces.map((item) => item.id)).toEqual(["town"]);
    expect(result.runtimeDefinition.waypoints.map((item) => item.id)).toEqual(["town-arrival"]);
    expect(result.scene.features.map((item) => item.id)).toEqual(["town-arrival", "town-route"]);
    expect(JSON.stringify(result)).not.toContain("future-location");
    expect(JSON.stringify(result)).not.toContain("-4");
    expect(JSON.stringify(result)).not.toContain("isle-region");
  });

  it("selects an entered virtual chapter without GPS or hidden geometry and gates its image asset", () => {
    const hidden = projectPlayerLandfallBootstrap(pinned, {
      chapterId: "chapter-isles",
      blockId: "chapter-isles-opening",
      releasedAssets: [],
    });
    expect(hidden.scene.worldspaceKind).toBe("VIRTUAL");
    expect(hidden.scene.features).toEqual([]);
    expect(hidden.activeWaypointId).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain("synthetic-chart");
    const released = projectPlayerLandfallBootstrap(pinned, {
      chapterId: "chapter-isles",
      blockId: "chapter-isles-opening",
      releasedAssets: [
        { id: "synthetic-chart", url: "/api/media/synthetic-chart?version=version-1&session=session-1" },
      ],
    });
    expect(released.scene.imageUrl).toContain("session=session-1");
    expect(released.scene.features).toEqual([]);
  });
});
