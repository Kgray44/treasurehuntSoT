import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { resizeRoomEnvironment } from "./environment-authoring";
import { referenceSurfaceCandidate, type DraftContent } from "./authoring";

import { createGenericRoomFeature } from "./room-feature-construction";
export { createGenericRoomFeature } from "./room-feature-construction";

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

/** Creator-controlled relative scale does not invent a physical measurement. */
export function scaleRoomByFactor(room: RoomEnvironment, factor: number) {
  if (!Number.isFinite(factor) || factor < 0.1 || factor > 10)
    throw new Error("Choose a scale between 0.1 and 10 times the current room.");
  const next = resizeRoomEnvironment(room, [room.width * factor, room.height * factor, room.depth * factor], true);
  // A relative adjustment invalidates an earlier physical reference; no new measurement is claimed.
  delete next.scaleReference;
  return roomEnvironmentSchema.parse(next);
}
