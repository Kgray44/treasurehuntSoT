import { expect, it } from "vitest";
import { syntheticRoomGeometry, discoverRoomSurfaces, solidFaceRectangles } from "./room-geometry";
import { simulationEnvironments } from "./studio-validation";
import { createGenericRoomFeature } from "./parametric-room";
import { findSurfacePlacement, surfaceFrameRotation } from "./surface-placement";
import { composeTransform } from "./transforms";
import { identityTransform } from "./contracts";

it("gives named environments distinct furnishings and layouts even at identical room dimensions", () => {
  const identifiers: Record<string, string[]> = {};
  const layouts = simulationEnvironments.map((room) => {
    const geometry = syntheticRoomGeometry({ ...room, width: 6, depth: 6 });
    identifiers[room.id] = geometry.map((g) => g.id);
    return JSON.stringify(geometry.filter((g) => !["FLOOR", "WALL"].includes(g.surface ?? "")));
  });
  expect(new Set(layouts).size).toBe(10);
  expect(identifiers.bedroom).toEqual(expect.arrayContaining(["bed", "wardrobe", "reference-desk"]));
  expect(identifiers["living-room"]).toEqual(expect.arrayContaining(["sofa", "television-monitor", "rug:body"]));
  expect(identifiers.dorm).toEqual(expect.arrayContaining(["dorm-bed", "shelf-entry", "laundry-basket:body"]));
  expect(identifiers.office.filter((id) => id.endsWith("-monitor"))).toHaveLength(4);
  expect(identifiers.classroom.filter((id) => id.startsWith("student-chair-") && id.endsWith("-seat"))).toHaveLength(9);
  expect(identifiers.gallery.filter((id) => /^artwork-[0-9]$/.test(id))).toHaveLength(3);
  expect(identifiers.trail).toContain("trail-path:body");
  expect(identifiers.plaza).toContain("fountain-water");
  expect(identifiers.empty.filter((id) => !id.endsWith(":skirting"))).toEqual([
    "floor-furniture",
    "wall-window",
    "wall-front",
    "wall-left",
    "wall-right",
    "ceiling:body",
  ]);
  expect(identifiers.cluttered.filter((id) => id.startsWith("stacked-box-") && id.endsWith(":body"))).toHaveLength(9);
});

it("cuts coplanar rotated windows and floor-edge doors without fragmenting a wall's placement identity", () => {
  const feature = createGenericRoomFeature;
  const wall = feature({
    id: "wall",
    classification: "WALL",
    dimensions: [6, 3, 0.12],
    position: { x: -3, y: 1.5, z: 0 },
    yawDegrees: 90,
  });
  const window = feature({
    id: "window",
    classification: "WINDOW",
    dimensions: [1.2, 1, 0.08],
    position: { x: -2.94, y: 1.8, z: 1 },
    yawDegrees: 90,
  });
  const door = feature({
    id: "door",
    classification: "DOOR",
    dimensions: [0.9, 2.1, 0.08],
    position: { x: -3, y: 1.05, z: -1.5 },
    yawDegrees: -90,
  });
  const detached = feature({ ...window, id: "detached", position: { x: 0, y: 1.8, z: 1 } });
  const perpendicular = feature({ ...window, id: "perpendicular", yawDegrees: 0 });
  const geometry = syntheticRoomGeometry({
    width: 6,
    depth: 6,
    horizontal: true,
    vertical: true,
    features: [wall, window, door, detached, perpendicular],
  });
  const part = geometry.find((g) => g.featureId === wall.id)!;
  expect(part.openings).toHaveLength(2);
  const surfaces = discoverRoomSurfaces(geometry, { tracking: true, clutter: 0 });
  expect(surfaces.filter((c) => c.surface === "WALL")).toHaveLength(1);
  const surface = surfaces[0];
  for (const hole of part.openings!) {
    const world = composeTransform(
      { position: surface.position, rotation: surfaceFrameRotation(surface), scale: 1 },
      { ...identityTransform(), position: { x: hole.x, y: hole.y, z: 0 } },
    );
    expect(findSurfacePlacement(world, surface, 0.1, false)).toBeNull();
    expect(findSurfacePlacement(world, surface, 0.1, true)).not.toBeNull();
  }
  const solids = solidFaceRectangles(6, 3, part.openings!);
  expect(solids.reduce((area, r) => area + r.width * r.depth, 0)).toBeCloseTo(18 - 1.2 - 0.9 * 2.1);
  for (const r of solids)
    for (const hole of part.openings!)
      expect(
        Math.min(r.x + r.width / 2, hole.x + hole.width / 2) - Math.max(r.x - r.width / 2, hole.x - hole.width / 2) >
          1e-8 &&
          Math.min(r.y + r.depth / 2, hole.y + hole.depth / 2) - Math.max(r.y - r.depth / 2, hole.y - hole.depth / 2) >
            1e-8,
      ).toBe(false);
});

it("subtracts overlapping and out-of-bounds openings only once and keeps the remaining face bounded", () => {
  const solids = solidFaceRectangles(4, 3, [
    { x: 0, y: 0, width: 2, depth: 2 },
    { x: 1, y: 0, width: 2, depth: 2 },
    { x: 4, y: 0, width: 1, depth: 1 },
  ]);
  expect(solids.reduce((area, r) => area + r.width * r.depth, 0)).toBeCloseTo(6);
  expect(solidFaceRectangles(4, 3, [{ x: 0, y: 0, width: 10, depth: 10 }])).toEqual([]);
});

it("derives room-specific furniture planes without exposing decorative or curved objects as planar supports", () => {
  const inventories = simulationEnvironments.map((room) => {
    const geometry = syntheticRoomGeometry(room);
    const surfaces = discoverRoomSurfaces(geometry, room);
    expect(new Set(geometry.map((g) => g.id)).size).toBe(geometry.length);
    expect(surfaces.filter((c) => c.surface === "FLOOR")).toHaveLength(1);
    expect(surfaces.map((c) => c.id)).not.toEqual(expect.arrayContaining(["window", "trail-tree-left-0"]));
    return surfaces.map((c) => c.id);
  });
  expect(new Set(inventories.map((i) => i.join(","))).size).toBe(10);
});
