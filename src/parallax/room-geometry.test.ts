import { expect, it } from "vitest";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "./room-geometry";
import { simulationEnvironments } from "./studio-validation";

it("gives named environments distinct furnishings and layouts even at identical room dimensions", () => {
  const identifiers: Record<string, string[]> = {};
  const layouts = simulationEnvironments.map((room) => {
    const geometry = syntheticRoomGeometry({ ...room, width: 6, depth: 6 });
    identifiers[room.id] = geometry.map((g) => g.id);
    return JSON.stringify(geometry.filter((g) => !["FLOOR", "WALL"].includes(g.surface ?? "")));
  });
  expect(new Set(layouts).size).toBe(10);
  expect(identifiers.bedroom).toEqual(expect.arrayContaining(["bed", "wardrobe", "reference-desk"]));
  expect(identifiers["living-room"]).toEqual(expect.arrayContaining(["sofa-seat", "television", "rug"]));
  expect(identifiers.dorm).toEqual(expect.arrayContaining(["dorm-bed", "shelf-entry", "laundry-basket"]));
  expect(identifiers.office.filter((id) => id.endsWith("-monitor"))).toHaveLength(4);
  expect(identifiers.classroom.filter((id) => id.startsWith("student-chair-") && id.endsWith("-seat"))).toHaveLength(9);
  expect(identifiers.gallery.filter((id) => id.startsWith("artwork-"))).toHaveLength(3);
  expect(identifiers.trail).toContain("trail-path");
  expect(identifiers.plaza).toContain("fountain-water");
  expect(identifiers.empty).toEqual(["floor-furniture", "wall-window", "wall-left"]);
  expect(identifiers.cluttered.filter((id) => id.startsWith("stacked-box-"))).toHaveLength(9);
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
