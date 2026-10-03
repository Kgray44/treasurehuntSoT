import { describe, expect, it } from "vitest";
import { createLandfallWorldspace, createLandfallWaypoint, landfallAuthoringFindings } from "@/landfall/authoring";
import { defaultContextPrivacy, projectContextRegion } from "@/landfall/context-projection";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { validateLandfallDefinition } from "@/landfall/definition";
import { ContextualLandfallEngine } from "@/landfall/contextual";
import { physicalObservation } from "@/landfall/fixtures";
import type { LandfallDefinition } from "@/landfall/schema";

describe("intentional contextual privacy projection", () => {
  function ordinary() {
    const d = createLandfallWorldspace({ taleId: "synthetic-tale", name: "Synthetic private site", kind: "PHYSICAL" });
    const world = d.worldspaces[0],
      map = d.maps[0];
    const waypoint = createLandfallWaypoint(world, map, map.camera.center, "Synthetic target");
    d.waypoints = [{ ...waypoint, regionId: "ordinary-region" }];
    d.context = {
      regions: [
        {
          id: "ordinary-region",
          name: "Synthetic room",
          kind: "ROOM",
          worldspaceId: world.id,
          mapId: map.id,
          geometry: { type: "POINT_RADIUS", center: map.camera.center, radius: 20 },
          privacyClassification: defaultContextPrivacy(world),
          hiddenUntilRevealed: false,
        },
      ],
      landmarks: [],
    };
    return validateLandfallDefinition(d);
  }
  it("preserves the standard physical default through saved/reloaded published Player evaluation", () => {
    const d = JSON.parse(JSON.stringify(ordinary())) as LandfallDefinition;
    expect(d.worldspaces[0].privacyPolicy.classification).toBe("APPROXIMATE_REAL_WORLD");
    expect(d.context!.regions[0].privacyClassification).toBe("PRIVATE_REAL_WORLD");
    const bootstrap = projectPlayerLandfallBootstrap(
      { definition: d, sessionId: "session-1", taleId: d.taleId, publishedVersionId: "version-1", currentSequence: 0 },
      { chapterId: null, blockId: null, releasedAssets: [] },
    );
    expect(bootstrap.runtimeDefinition.context!.regions).toHaveLength(1);
    const now = Date.parse("2026-10-03T10:00:00Z");
    const region = bootstrap.runtimeDefinition.context!.regions[0];
    const engine = new ContextualLandfallEngine(bootstrap.runtimeDefinition, {
      sessionId: "session-1",
      publishedVersionId: "version-1",
    });
    const point = region.geometry.type === "POINT_RADIUS" ? region.geometry.center : d.maps[0].camera.center;
    expect(
      engine.ingestPosition(
        {
          ...physicalObservation("synthetic", new Date(now).toISOString()),
          kind: "PHYSICAL_POSITION",
          worldspaceId: d.worldspaces[0].id,
          coordinate: point,
          accuracyMeters: 2,
        },
        now,
      ).regionId,
    ).toBe(region.id);
    expect(projectContextRegion(region, d.worldspaces[0], "PUBLIC")).toBeNull();
  });
  it("generalizes approximate broad geometry without changing canonical data", () => {
    const d = ordinary();
    const region = d.context!.regions[0];
    region.kind = "SITE";
    region.privacyClassification = "APPROXIMATE_REAL_WORLD";
    const original = JSON.stringify(region);
    const projected = projectContextRegion(region, d.worldspaces[0], "PLAYER")!;
    expect(projected.geometry).toMatchObject({ type: "APPROXIMATE_REGION", radius: 500 });
    expect(JSON.stringify(region)).toBe(original);
    expect(projectContextRegion(region, d.worldspaces[0], "PUBLIC")!.geometry).toEqual(projected.geometry);
    region.kind = "ROOM";
    expect(projectContextRegion(region, d.worldspaces[0], "PLAYER")).toBeNull();
    expect(landfallAuthoringFindings(d, "PRIVATE")).toContainEqual(
      expect.objectContaining({ code: "LANDFALL_CONTEXT_PRIVACY_PRECISION", severity: "blocker" }),
    );
  });
});
