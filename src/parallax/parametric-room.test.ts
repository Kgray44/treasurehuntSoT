import { expect, it } from "vitest";
import {
  addRoomFeature,
  createGenericRoomFeature,
  rebuildRoomFeature,
  removeRoomFeature,
  scaleRoomFromMeasurement,
  boundRoomSurfaceIds,
} from "./parametric-room";
import { roomEnvironmentSchema, roomFeatureClasses } from "./environment-contracts";
import { createRoomEnvironment, resizeRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { createSpatialDraft, previewEntityTransform, draftSchema } from "./authoring";
import { placeOnRoomFeature } from "./room-placement";

it.each(roomFeatureClasses)(
  "renders generic %s within its declared parametric box with honest placeholder provenance",
  (classification) => {
    const feature = createGenericRoomFeature({ id: "generic", classification });
    const geometry = syntheticRoomGeometry({
      width: 6,
      depth: 6,
      horizontal: true,
      vertical: true,
      features: [feature],
    });
    for (const part of geometry) {
      part.position.forEach((position, axis) => {
        const center = [feature.position.x, feature.position.y, feature.position.z][axis];
        expect(position - part.size[axis] / 2).toBeGreaterThanOrEqual(center - feature.dimensions[axis] / 2 - 1e-9);
        expect(position + part.size[axis] / 2).toBeLessThanOrEqual(center + feature.dimensions[axis] / 2 + 1e-9);
      });
    }
    expect(feature.provenance).toEqual({ basis: "PLACEHOLDER", confidence: 0, sourceMediaIds: [] });
    const surfaces = discoverRoomSurfaces(geometry, { tracking: true, clutter: 0 });
    if (["TABLE", "DESK", "SHELF", "FLOOR", "WALL"].includes(classification))
      expect(surfaces.some((s) => s.safe)).toBe(true);
    if (["BED", "SOFA", "CHAIR", "APPLIANCE"].includes(classification))
      expect(surfaces.every((s) => !s.safe)).toBe(true);
    if (["DOOR", "WINDOW", "TREE", "CEILING", "OTHER"].includes(classification)) expect(surfaces).toHaveLength(0);
  },
);

it("adds distinct editable geometry and preserves the single whole floor and referenced support on removal/rebuild", () => {
  const original = createRoomEnvironment(simulationEnvironments[0]);
  let room = addRoomFeature(original, "TABLE", "new-table");
  room = addRoomFeature(room, "DOOR", "new-door");
  expect(room.features).toHaveLength(original.features.length + 2);
  expect(() => addRoomFeature(room, "FLOOR", "second-floor")).toThrow(/whole-floor/);
  expect(() => removeRoomFeature(room, "floor-furniture")).toThrow(/whole floor/);
  const table = room.features.find((f) => f.id === "new-table")!;
  expect(() => removeRoomFeature(room, table.id, [table.parts[0].id])).toThrow(/attached/);
  expect(() => rebuildRoomFeature(room, table.id, "BED", [table.parts[0].id])).toThrow(/attached/);
  const rebuilt = rebuildRoomFeature(room, table.id, "BED");
  const bed = rebuilt.features.find((f) => f.id === table.id)!;
  expect(bed.dimensions).toEqual(table.dimensions);
  expect(bed.position).toEqual(table.position);
  expect(bed.parts.some((p) => p.id.endsWith(":pillow"))).toBe(true);
  expect(bed.parts.some((p) => p.id.endsWith(":top"))).toBe(false);
  expect(removeRoomFeature(rebuilt, "new-door").features.some((f) => f.id === "new-door")).toBe(false);
  expect(original.features.some((f) => f.id === table.id)).toBe(false);
});

it("uses a known desk width to scale the same room and keep a bound clue on its actual enlarged face", () => {
  let draft = createSpatialDraft("known-measurement");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  const entity = draft.content.entities[0];
  draft = placeOnRoomFeature(draft, entity.id, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  const original = structuredClone(draft.content.studio!.environment!);
  draft.content.studio!.environment = scaleRoomFromMeasurement(original, "reference-desk", "WIDTH", 2.6);
  const room = draft.content.studio!.environment!;
  expect(room.width).toBeCloseTo(original.width * 2);
  expect(room.features.find((f) => f.id === "window")!.dimensions[0]).toBeCloseTo(
    original.features.find((f) => f.id === "window")!.dimensions[0] * 2,
  );
  expect(room.features.find((f) => f.id === "reference-desk")!.provenance.basis).toBe("SIMULATED");
  const surfaces = discoverRoomSurfaces(syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }), {
    tracking: true,
    clutter: 0,
  });
  const desk = surfaces.find((s) => s.id === "reference-desk")!;
  const pose = previewEntityTransform(draft.content, entity.id, room.id, { ...room, horizontal: true, vertical: true });
  expect(pose.position.x).toBeCloseTo(desk.position.x);
  expect(pose.position.y).toBeCloseTo(desk.position.y + 0.01);
  expect(draft.content.entities[0].widthMeters).toBe(entity.widthMeters);
  expect(draftSchema.parse(draft).content.studio!.environment!.scaleReference).toEqual({
    featureId: "reference-desk",
    axis: "WIDTH",
    measuredMeters: 2.6,
  });
  expect(scaleRoomFromMeasurement(room, "reference-desk", "WIDTH", 1.3).width).toBeCloseTo(original.width);
  expect(resizeRoomEnvironment(room, [room.width, room.height, room.depth], false).scaleReference).toEqual(
    room.scaleReference,
  );
  expect(resizeRoomEnvironment(room, [room.width * 1.1, room.height, room.depth], true).scaleReference).toBeUndefined();
  expect(() => scaleRoomFromMeasurement(original, "reference-desk", "WIDTH", NaN)).toThrow(/measurement/);
  expect(() => scaleRoomFromMeasurement(original, "reference-desk", "WIDTH", 100)).toThrow();
  expect(original.scaleReference).toBeUndefined();
  const invalid = structuredClone(draft);
  invalid.content.studio!.environment!.features = room.features.filter((f) => f.id !== "reference-desk");
  delete invalid.content.studio!.environment!.scaleReference;
  expect(() => draftSchema.parse(invalid)).toThrow(/PARALLAX_ROOM_SUPPORT_MISSING/);
  expect(boundRoomSurfaceIds(draft.content)).toContain("reference-desk");
  const implicit = createSpatialDraft("implicit-room");
  implicit.content.studio!.environment = original;
  expect(boundRoomSurfaceIds(implicit.content)).toContain("reference-desk");
  expect(() => removeRoomFeature(original, "reference-desk", boundRoomSurfaceIds(implicit.content))).toThrow(
    /attached/,
  );
});

it("rejects stale or orphaned scale references without adding new fields to historic rooms", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  expect(roomEnvironmentSchema.parse(room)).not.toHaveProperty("scaleReference");
  expect(
    roomEnvironmentSchema.safeParse({
      ...room,
      scaleReference: { featureId: "missing", axis: "WIDTH", measuredMeters: 1 },
    }).success,
  ).toBe(false);
  expect(
    roomEnvironmentSchema.safeParse({
      ...room,
      scaleReference: { featureId: "reference-desk", axis: "WIDTH", measuredMeters: 9 },
    }).success,
  ).toBe(false);
});
