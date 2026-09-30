import { describe, expect, it } from "vitest";
import { landfallFixture, physicalCoordinate } from "@/landfall/fixtures";
import { projectLandfallJourney } from "@/landfall/journey-projection";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";

const event = (sequence: number, eventType: string, payload: Record<string, unknown>) => ({
  id: `event-${sequence}`,
  sequence,
  eventType,
  payload: JSON.stringify(payload),
  createdAt: "2026-09-30T10:00:00.000Z",
});

describe("canonical Landfall journey projection", () => {
  it("releases prerequisites after a durable visit without exposing a future location before it", () => {
    const definition = structuredClone(landfallFixture);
    definition.waypoints.push({
      ...definition.waypoints[0],
      id: "next-place",
      name: "Next place",
      geometry: { type: "POINT_RADIUS", center: physicalCoordinate(51, -4), radius: 100 },
      sequence: { afterWaypointIds: ["town-arrival"], optional: false },
    });
    const pinned = {
      sessionId: "session-1",
      taleId: "fixture-tale",
      publishedVersionId: "version-1",
      currentSequence: 4,
      definition,
    };
    const before = projectPlayerLandfallBootstrap(pinned, { chapterId: null, blockId: null, releasedAssets: [] });
    expect(JSON.stringify(before)).not.toContain("-4");
    const after = projectPlayerLandfallBootstrap(pinned, {
      chapterId: null,
      blockId: null,
      releasedAssets: [],
      events: [event(5, "landfallWaypointConfirmed", { waypointId: "town-arrival" })],
    });
    expect(after.activeWaypointId).toBe("next-place");
    expect(after.visitedIds).toEqual(["town-arrival"]);
    expect(after.runtimeDefinition.waypoints.map((item) => item.id)).toEqual(["town-arrival", "next-place"]);
    expect(after.journeyPath).toMatchObject([{ kind: "VISIT", targetId: "town-arrival" }]);
  });

  it("keeps hidden virtual geometry withheld until reveal and follows a canonical transition", () => {
    const before = projectLandfallJourney(landfallFixture, [
      event(1, "landfallWorldspaceEntered", { worldspaceId: "isles" }),
    ]);
    expect(before.activeWorldspaceId).toBe("isles");
    expect(before.availableWaypoints).toEqual([]);
    const after = projectLandfallJourney(landfallFixture, [
      event(1, "landfallWorldspaceEntered", { worldspaceId: "isles" }),
      event(2, "landfallWaypointRevealed", { waypointId: "isle-region" }),
      event(3, "landfallRouteRevealed", { routeId: "isle-route" }),
    ]);
    expect(after.availableWaypoints.map((item) => item.id)).toEqual(["isle-region"]);
    expect(after.activeRoute?.id).toBe("isle-route");
  });

  it("ignores invalid target IDs and duplicate visit events", () => {
    const projection = projectLandfallJourney(landfallFixture, [
      event(1, "landfallWaypointConfirmed", { waypointId: "town-arrival" }),
      event(2, "landfallWaypointConfirmed", { waypointId: "town-arrival" }),
      event(3, "landfallWaypointRevealed", { waypointId: "other-worldspace" }),
    ]);
    expect(projection.visitedIds).toEqual(["town-arrival"]);
    expect(projection.journeyPath).toHaveLength(1);
    expect(projection.revealedWaypointIds).toEqual([]);
  });
});
