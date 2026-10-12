import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createPresetConstruction } from "./preset-construction";
import type { DraftContent } from "./authoring";

export type PreviewEnvironment = {
  id: string;
  name: string;
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
  tracking: boolean;
  clutter: number;
  light: string;
  features?: RoomFeature[];
};
/** Editable invented geometry; no survey, image interpretation or physical evidence is implied. */
export function createRoomEnvironment(room: PreviewEnvironment): RoomEnvironment {
  if (room.features)
    return roomEnvironmentSchema.parse({
      schemaVersion: 1,
      id: room.id,
      name: room.name,
      width: room.width,
      depth: room.depth,
      height: 2.8,
      origin: "MANUAL",
      features: room.features,
    });
  return createPresetConstruction(room);
}

export function authoredPreviewEnvironment(content: DraftContent, fallback: PreviewEnvironment): PreviewEnvironment {
  const room = content.studio?.environment;
  if (!room || (fallback.id !== room.id && fallback.id !== "AUTHORED")) return fallback;
  return {
    ...fallback,
    ...room,
    horizontal: true,
    vertical: room.features.some((f) => f.classification === "WALL"),
    tracking: true,
    clutter: 0,
    light: "NORMAL",
  };
}
/** Dimensions change room shell and furniture positions; furniture size remains explicitly editable. */
export function resizeRoomEnvironment(
  input: RoomEnvironment,
  dimensions: [number, number, number],
  scaleFurniture = false,
) {
  const room = structuredClone(input),
    ratios = dimensions.map((v, i) => v / [room.width, room.height, room.depth][i]);
  room.width = dimensions[0];
  room.height = dimensions[1];
  room.depth = dimensions[2];
  if (room.construction?.navigation) {
    const navigation = room.construction.navigation;
    navigation.points = navigation.points.map((point) => ({
      x: point.x * ratios[0],
      y: point.y * ratios[1],
      z: point.z * ratios[2],
    }));
    navigation.widthMeters *= Math.min(ratios[0], ratios[2]);
  }
  room.features = room.features.map((feature) => ({
    ...feature,
    position: {
      x: feature.position.x * ratios[0],
      y: feature.position.y * ratios[1],
      z: feature.position.z * ratios[2],
    },
    dimensions: (scaleFurniture ||
    ["FLOOR", "WALL", "CEILING"].includes(feature.classification) ||
    feature.parts.some((part) => part.shape === "PATH")
      ? feature.dimensions.map((v, i) => v * ratios[i])
      : feature.dimensions) as RoomFeature["dimensions"],
  }));
  if (room.scaleReference) {
    const reference = room.features.find((f) => f.id === room.scaleReference!.featureId);
    const axis = ({ WIDTH: 0, HEIGHT: 1, DEPTH: 2 } as const)[room.scaleReference.axis];
    if (!reference || Math.abs(reference.dimensions[axis] - room.scaleReference.measuredMeters) > 1e-6)
      delete room.scaleReference;
  }
  return roomEnvironmentSchema.parse(room);
}
export function roomFeatureRelations(room: RoomEnvironment, featureId: string) {
  const feature = room.features.find((f) => f.id === featureId);
  if (!feature) return [];
  return room.features
    .filter((f) => f.id !== featureId && f.classification !== "OTHER")
    .map((other) => ({
      featureId: other.id,
      classification: other.classification,
      distanceMeters: Math.hypot(feature.position.x - other.position.x, feature.position.z - other.position.z),
      direction:
        Math.abs(feature.position.x - other.position.x) > Math.abs(feature.position.z - other.position.z)
          ? feature.position.x < other.position.x
            ? "LEFT_OF"
            : "RIGHT_OF"
          : feature.position.z < other.position.z
            ? "BEHIND"
            : "IN_FRONT_OF",
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
/** Do not arbitrarily select the first matching table. Nearness must materially disambiguate. */
export function resolveRoomFeature(
  room: RoomEnvironment,
  classification: RoomFeature["classification"],
  nearId?: string | null,
) {
  const near = nearId ? room.features.find((f) => f.id === nearId) : null;
  if (nearId && !near) return { status: "MISSING" as const, candidates: [] };
  const candidates = room.features.filter((f) => f.classification === classification);
  if (!candidates.length) return { status: "MISSING" as const, candidates };
  if (near) {
    const ordered = candidates
      .map((feature) => ({
        feature,
        distance: Math.hypot(feature.position.x - near.position.x, feature.position.z - near.position.z),
      }))
      .sort((a, b) => a.distance - b.distance);
    if (ordered.length === 1 || ordered[1].distance - ordered[0].distance > 0.3)
      return { status: "RESOLVED" as const, feature: ordered[0].feature, candidates };
  }
  return candidates.length === 1
    ? { status: "RESOLVED" as const, feature: candidates[0], candidates }
    : { status: "AMBIGUOUS" as const, candidates };
}
