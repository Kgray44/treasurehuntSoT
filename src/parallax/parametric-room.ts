import {
  roomEnvironmentSchema,
  roomFeatureSchema,
  type RoomEnvironment,
  type RoomFeature,
} from "./environment-contracts";
import { resizeRoomEnvironment } from "./environment-authoring";
import { referenceSurfaceCandidate, type DraftContent } from "./authoring";

type Part = RoomFeature["parts"][number];
const defaults: Record<RoomFeature["classification"], RoomFeature["dimensions"]> = {
  FLOOR: [4, 0.12, 4],
  WALL: [4, 2.8, 0.12],
  CEILING: [4, 0.08, 4],
  DOOR: [0.9, 2.1, 0.08],
  WINDOW: [1.2, 1.2, 0.08],
  TABLE: [1.4, 0.75, 0.85],
  DESK: [1.3, 0.75, 0.7],
  CHAIR: [0.5, 0.95, 0.55],
  SOFA: [2.2, 0.9, 0.9],
  BED: [1.5, 0.85, 2.1],
  CABINET: [0.9, 1.2, 0.5],
  WARDROBE: [1.2, 2, 0.6],
  SHELF: [1.2, 1.6, 0.35],
  APPLIANCE: [0.65, 1.7, 0.65],
  TREE: [1.1, 2.5, 1.1],
  OTHER: [0.7, 0.7, 0.7],
};

/** Repository-authored generic geometry, shared by manual correction and room reconstruction.
 * Coordinates are dimensionless within the declared box. No model implies physical measurement.
 */
export function createGenericRoomFeature(input: {
  id: string;
  classification: RoomFeature["classification"];
  name?: string;
  dimensions?: RoomFeature["dimensions"];
  position?: RoomFeature["position"];
  yawDegrees?: number;
  provenance?: RoomFeature["provenance"];
}): RoomFeature {
  const { id, classification } = input;
  const dimensions = input.dimensions ?? defaults[classification];
  const parts: Part[] = [];
  const add = (
    slot: string,
    size: Part["size"],
    position: Part["position"],
    color: number,
    surface: Part["surface"] = null,
    context: Part["context"] = [],
    shape: Part["shape"] = "BOX",
  ) =>
    parts.push({
      id: `${id}:${slot}`,
      size,
      position,
      color,
      surface,
      context,
      shape,
      face: "TOP",
    });
  const legs = (top = 0.4) => {
    for (const x of [-0.42, 0.42])
      for (const z of [-0.4, 0.4]) add(`leg-${x}-${z}`, [0.035, top + 0.5, 0.045], [x, (top - 0.5) / 2, z], 0x48596a);
  };
  if (classification === "TABLE" || classification === "DESK") {
    add("top", [1, 0.08, 1], [0, 0.46, 0], 0xa38a68, classification, ["FURNITURE"]);
    legs(0.42);
    if (classification === "DESK") {
      add("drawer", [0.35, 0.17, 0.65], [0.26, 0.29, 0], 0x8c7458);
      add("handle", [0.14, 0.025, 0.025], [0.26, 0.29, 0.338], 0xccbea0);
    }
  } else if (classification === "CHAIR") {
    add("seat", [1, 0.08, 1], [0, -0.04, 0], 0x6487a0, "TABLE", ["FURNITURE", "OBSTACLE"]);
    add("back", [1, 0.48, 0.1], [0, 0.26, -0.45], 0x52748b);
    legs(-0.08);
  } else if (classification === "SOFA") {
    add("base", [1, 0.15, 1], [0, -0.3, 0], 0x475d71);
    add("seat", [0.84, 0.23, 0.82], [0, -0.11, 0.08], 0x7995a8, "TABLE", ["FURNITURE", "OBSTACLE"]);
    add("back", [1, 0.75, 0.18], [0, 0.125, -0.41], 0x587a93);
    for (const x of [-0.46, 0.46]) add(`arm-${x}`, [0.08, 0.5, 1], [x, 0, 0], 0x587a93);
    for (const x of [-0.4, 0.4])
      for (const z of [-0.37, 0.37]) add(`foot-${x}-${z}`, [0.04, 0.125, 0.07], [x, -0.4375, z], 0x4e4943);
  } else if (classification === "BED") {
    add("base", [1, 0.26, 1], [0, -0.32, 0], 0x856e56);
    add("mattress", [0.96, 0.23, 0.93], [0, -0.075, 0.025], 0x90acc1, "TABLE", ["FURNITURE", "OBSTACLE"]);
    add("headboard", [1, 1, 0.05], [0, 0, -0.475], 0x725e4c);
    add("pillow", [0.65, 0.12, 0.17], [0, 0.1, -0.3], 0xe4e2d9);
  } else if (classification === "CABINET" || classification === "WARDROBE" || classification === "APPLIANCE") {
    const color = classification === "APPLIANCE" ? 0xc0cbd2 : 0x9e876e;
    add("body", [1, 1, 0.94], [0, 0, -0.03], color, "SHELF", ["FURNITURE", "OBSTACLE"]);
    for (const x of [-0.24, 0.24]) {
      add(`door-${x}`, [0.47, 0.92, 0.018], [x, 0, 0.48], color + 0x090909);
      add(`handle-${x}`, [0.018, 0.14, 0.025], [x < 0 ? -0.07 : 0.07, 0.02, 0.4875], 0x475564);
    }
  } else if (classification === "SHELF") {
    add("left", [0.035, 1, 1], [-0.4825, 0, 0], 0x8d775c);
    add("right", [0.035, 1, 1], [0.4825, 0, 0], 0x8d775c);
    add("back", [0.93, 1, 0.06], [0, 0, -0.47], 0x8d775c);
    for (const y of [-0.48, -0.16, 0.16, 0.48])
      add(`shelf-${y}`, [0.93, 0.04, 0.94], [0, y, 0.03], 0xad9372, "SHELF", ["FURNITURE"]);
  } else if (classification === "WINDOW") {
    add("window", [1, 1, 1], [0, 0, 0], 0xaed4ec, null, ["WINDOW"], "WINDOW");
  } else if (classification === "DOOR") {
    add("panel", [0.94, 0.97, 0.6], [0, -0.015, 0], 0x9b805e, null, ["ENTRANCE"]);
    for (const x of [-0.485, 0.485]) add(`jamb-${x}`, [0.03, 1, 1], [x, 0, 0], 0xd2c6b7);
    add("lintel", [0.94, 0.03, 1], [0, 0.485, 0], 0xd2c6b7);
    add("handle", [0.05, 0.025, 0.1], [0.34, -0.04, 0.35], 0xc8b785);
  } else if (classification === "TREE") {
    add("tree", [1, 1, 1], [0, 0, 0], 0x4a7658, null, [], "TREE");
  } else {
    add(
      "body",
      [1, 1, 1],
      [0, 0, 0],
      classification === "FLOOR" ? 0xab9981 : 0xc1cbd7,
      classification === "FLOOR" || classification === "WALL" ? classification : null,
      classification === "FLOOR" ? ["WALKWAY"] : [],
    );
    if (classification === "WALL") parts[0].face = "FRONT";
  }
  return roomFeatureSchema.parse({
    id,
    name: input.name ?? `New ${classification.toLowerCase()}`,
    classification,
    dimensions,
    yawDegrees: input.yawDegrees ?? 0,
    position: input.position ?? { x: 0, y: dimensions[1] / 2, z: 0 },
    parts,
    provenance: input.provenance ?? { basis: "PLACEHOLDER", confidence: 0, sourceMediaIds: [] },
  });
}

/** One canonical floor; additional walls/furniture are ordinary editable features. */
export function addRoomFeature(room: RoomEnvironment, classification: RoomFeature["classification"], id: string) {
  if (classification === "FLOOR" && room.features.some((f) => f.classification === "FLOOR"))
    throw new Error("The room already has its whole-floor feature. Edit that floor instead.");
  if (classification === "CEILING" && room.features.some((f) => f.classification === "CEILING"))
    throw new Error("The room already has a ceiling. Edit that ceiling instead.");
  const feature = createGenericRoomFeature({
    id,
    classification,
    ...(classification === "FLOOR"
      ? { dimensions: [room.width, 0.12, room.depth], position: { x: 0, y: -0.06, z: 0 } }
      : {}),
    ...(classification === "CEILING"
      ? { dimensions: [room.width, 0.08, room.depth], position: { x: 0, y: room.height + 0.04, z: 0 } }
      : {}),
    ...(classification === "WALL"
      ? { dimensions: [room.width, room.height, 0.12], position: { x: 0, y: room.height / 2, z: -room.depth / 2 } }
      : {}),
  });
  return roomEnvironmentSchema.parse({ ...room, features: [...room.features, feature] });
}

function assertFeatureUnbound(feature: RoomFeature, boundSurfaceIds: readonly string[]) {
  if (feature.parts.some((p) => boundSurfaceIds.includes(p.id)))
    throw new Error(
      "An object is attached to this feature. Move it to another surface before removing or rebuilding the feature.",
    );
}
/** Include implicit preset supports as well as explicit snaps; deleting either must not silently relocate a clue. */
export function boundRoomSurfaceIds(content: DraftContent) {
  const room = content.studio?.environment;
  if (!room) return [];
  return content.anchors.flatMap((anchor) => {
    if (!content.entities.some((entity) => entity.anchorId === anchor.id)) return [];
    const explicit = content.studio?.surfacePreviewFrames?.find(
      (frame) => frame.anchorId === anchor.id && frame.environmentId === room.id,
    );
    if (explicit) return [explicit.surfaceId];
    const candidate = referenceSurfaceCandidate(anchor, { ...room, horizontal: true, vertical: true });
    return candidate ? [candidate.id] : [];
  });
}
export function removeRoomFeature(room: RoomEnvironment, id: string, boundSurfaceIds: readonly string[] = []) {
  const feature = room.features.find((f) => f.id === id);
  if (!feature) throw new Error("Choose an existing room feature.");
  if (feature.classification === "FLOOR") throw new Error("Keep the whole floor; resize or reposition it instead.");
  assertFeatureUnbound(feature, boundSurfaceIds);
  const next = structuredClone(room);
  next.features = next.features.filter((f) => f.id !== id);
  if (next.scaleReference?.featureId === id) delete next.scaleReference;
  return roomEnvironmentSchema.parse(next);
}
export function rebuildRoomFeature(
  room: RoomEnvironment,
  id: string,
  classification: RoomFeature["classification"],
  boundSurfaceIds: readonly string[] = [],
) {
  const feature = room.features.find((f) => f.id === id);
  if (!feature) throw new Error("Choose an existing room feature.");
  if (
    ["FLOOR", "WALL", "CEILING"].includes(feature.classification) ||
    ["FLOOR", "WALL", "CEILING"].includes(classification)
  )
    throw new Error("Edit the room shell directly. Generic shape replacement is for furniture, doors and windows.");
  assertFeatureUnbound(feature, boundSurfaceIds);
  const replacement = createGenericRoomFeature({ ...feature, classification });
  // Type correction keeps the chosen footprint/pose/name, and preserves source uncertainty.
  return roomEnvironmentSchema.parse({ ...room, features: room.features.map((f) => (f.id === id ? replacement : f)) });
}

/** A known measurement uniformly corrects approximate room geometry, not native calibration or authored asset sizes. */
export function scaleRoomFromMeasurement(
  room: RoomEnvironment,
  featureId: string,
  axis: "WIDTH" | "HEIGHT" | "DEPTH",
  measuredMeters: number,
) {
  if (!Number.isFinite(measuredMeters) || measuredMeters < 0.05 || measuredMeters > 100)
    throw new Error("Enter a known measurement between 0.05 and 100 metres.");
  const feature = room.features.find((f) => f.id === featureId);
  if (!feature) throw new Error("Choose an existing reference feature.");
  const index = ({ WIDTH: 0, HEIGHT: 1, DEPTH: 2 } as const)[axis];
  const ratio = measuredMeters / feature.dimensions[index];
  const next = resizeRoomEnvironment(room, [room.width * ratio, room.height * ratio, room.depth * ratio], true);
  next.scaleReference = { featureId, axis, measuredMeters };
  return roomEnvironmentSchema.parse(next);
}
