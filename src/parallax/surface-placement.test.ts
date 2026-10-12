import { describe, it, expect } from "vitest";
import { createSpatialDraft, changeHistory, undo, redo, previewEntityTransform } from "./authoring";
import { identityTransform } from "./contracts";
import { discoverRoomSurfaces, syntheticRoomGeometry, type RoomGeometry } from "./room-geometry";
import { placeOnSurface, snapToNearestSurface, snapSpatialEntity } from "./surface-placement";
import { syntheticEnvironmentEvidence, enableAdaptiveAuthoring } from "./adaptive-authoring";
import { evaluateCandidate, resolveAdaptiveScene, environmentEvidenceSchema } from "./adaptive";
import { composeTransform } from "./transforms";
import { simulationEnvironments } from "./studio-validation";

const quality = { tracking: true, clutter: 0.3 };
const room = simulationEnvironments[0];
const surfaces = () => syntheticEnvironmentEvidence(room).candidates;
const face = (rotation: ReturnType<typeof identityTransform>["rotation"]) =>
  composeTransform({ ...identityTransform(), rotation }, { ...identityTransform(), position: { x: 0, y: 0, z: 1 } })
    .position;

describe("room geometry and surface placement", () => {
  it("represents the complete floor and each complete wall exactly once across all rooms", () => {
    for (const room of simulationEnvironments) {
      const detected = discoverRoomSurfaces(syntheticRoomGeometry(room), room);
      const floors = detected.filter((c) => c.surface === "FLOOR");
      expect(floors).toHaveLength(1);
      expect(floors[0].widthMeters).toBe(room.width);
      expect(floors[0].depthMeters).toBe(room.depth);
      const walls = detected.filter((c) => c.surface === "WALL");
      expect(walls).toHaveLength(room.vertical ? 2 : 0);
      if (room.vertical)
        expect(walls.map((c) => [c.widthMeters, c.depthMeters])).toEqual([
          [room.width, 2.8],
          [room.depth, 2.8],
        ]);
      expect(environmentEvidenceSchema.safeParse(syntheticEnvironmentEvidence(room)).success).toBe(true);
    }
  });
  it("discovers added, resized and removed furniture from geometry without registering placement candidates", () => {
    const geometry: RoomGeometry[] = [
      {
        id: "user-room-new-table",
        size: [2.7, 0.1, 1.8],
        position: [2, 0.95, -3],
        surface: "TABLE",
        context: ["FURNITURE"],
        face: "TOP",
      },
    ];
    const found = discoverRoomSurfaces(geometry, quality)[0];
    expect(found.position).toEqual({ x: 2, y: 1, z: -3 });
    expect([found.widthMeters, found.depthMeters]).toEqual([2.7, 1.8]);
    geometry[0].size[0] = 4;
    expect(discoverRoomSurfaces(geometry, quality)[0].widthMeters).toBe(4);
    expect(discoverRoomSurfaces([], quality)).toEqual([]);
  });
  it("aligns the same object to both wall directions, then a table and floor", () => {
    for (const id of ["wall-window", "wall-left", "table-left", "floor-furniture"]) {
      const c = surfaces().find((c) => c.id === id)!;
      const placed = placeOnSurface({ ...identityTransform(), position: c.position, scale: 0.8 }, c, 0.3)!;
      expect(placed.scale).toBe(0.8);
      const normal = face(placed.rotation);
      for (const axis of ["x", "y", "z"] as const) expect(normal[axis]).toBeCloseTo(c.normal[axis]);
      const d = createSpatialDraft("snapped");
      const idEntity = d.content.entities[0].id;
      const next = snapSpatialEntity(d, idEntity, placed, c);
      expect(next.content.anchors[0]).toMatchObject({ alignment: c.surface === "WALL" ? "VERTICAL" : "HORIZONTAL" });
      const actual = previewEntityTransform(next.content, idEntity);
      for (const axis of ["x", "y", "z"] as const) expect(actual.position[axis]).toBeCloseTo(placed.position[axis]);
      for (const axis of ["x", "y", "z"] as const) expect(face(actual.rotation)[axis]).toBeCloseTo(normal[axis]);
      expect(next.content.entities[0].transform.position.z).toBeCloseTo(0);
      for (const axis of ["x", "y", "z", "w"] as const)
        expect(next.content.entities[0].transform.rotation[axis]).toBeCloseTo(identityTransform().rotation[axis]);
      const changed = changeHistory({ present: d, past: [], future: [] }, { type: "REPLACE", draft: next });
      expect(undo(changed).present).toEqual(d);
      expect(redo(undo(changed)).present).toEqual(next);
    }
  });
  it("snaps only near a safe, fitting plane and retains scale", () => {
    const c = surfaces().find((c) => c.id === "table-left")!;
    const pose = { ...identityTransform(), position: { ...c.position, y: c.position.y + 0.1 } };
    expect(face(snapToNearestSurface(pose, [c], 0.25).rotation).y).toBeCloseTo(1);
    const far = { ...pose, position: { ...pose.position, y: 2 } };
    expect(snapToNearestSurface(far, [c], 0.25)).toEqual(far);
    expect(placeOnSurface(pose, { ...c, safe: false }, 0.25)).toBeNull();
    expect(placeOnSurface(pose, { ...c, surface: "OPEN_SPACE" }, 0.25)).toBeNull();
    expect(placeOnSurface(pose, c, 4)).toBeNull();
    expect(
      placeOnSurface({ ...pose, position: { ...pose.position, x: c.position.x + c.widthMeters } }, c, 0.25),
    ).toBeNull();
  });
  it("does not snap into the walkway and does not persist synthetic floor height in a native pose", () => {
    const pose = { ...identityTransform(), position: { x: 0, y: 0.1, z: 0 } };
    expect(snapToNearestSurface(pose, surfaces(), 0.25)).toEqual(pose);
    const floor = surfaces().find((c) => c.id === "floor-furniture")!;
    const world = placeOnSurface({ ...pose, position: { x: -1, y: 0, z: -0.8 } }, floor, 0.25)!;
    const d = createSpatialDraft("native-floor");
    const saved = snapSpatialEntity(d, d.content.entities[0].id, world, floor);
    const relative = composeTransform(saved.content.anchors[0].transform, saved.content.entities[0].transform);
    expect(relative.position.z).toBeCloseTo(0.01);
    expect(relative.position.y).toBeCloseTo(0.8);
    expect(relative.rotation.w).toBeCloseTo(1);
    expect(enableAdaptiveAuthoring(saved).content.studio?.surfacePreviewFrames).toBeUndefined();
  });
  it("preserves Hidden Wall Message intent in automatic placement and aligns a horizontal substitute", () => {
    const d = enableAdaptiveAuthoring(createSpatialDraft("wall-note", "Hidden Wall Message"));
    const recipe = d.content.adaptive!.recipes[0];
    expect(recipe.preferredSurfaces).toEqual(["WALL"]);
    const resolution = resolveAdaptiveScene(d.content, syntheticEnvironmentEvidence(room), "wall-preview");
    expect(resolution.status).toBe("RESOLVED");
    expect(Object.values(resolution.placements)[0].surface).toBe("WALL");
    const table = surfaces().find((c) => c.id === "table-left")!;
    const substitute = evaluateCandidate({ ...recipe, orientation: "UPRIGHT" }, table, 0.25, true);
    expect(substitute.accepted).toBe(true);
    expect(face(substitute.transform.rotation).y).toBeCloseTo(1);
  });
});
