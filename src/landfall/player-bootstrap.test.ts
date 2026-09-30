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
