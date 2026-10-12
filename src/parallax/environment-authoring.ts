import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { syntheticRoomGeometry } from "./room-geometry";
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
  const geometry = syntheticRoomGeometry(room);
  const groups = new Map<string, typeof geometry>();
  for (const part of geometry) {
    const id = part.featureId ?? part.id;
    groups.set(id, [...(groups.get(id) ?? []), part]);
  }
  const features = [...groups].map(([id, parts]): RoomFeature => {
    const minimum = [0, 1, 2].map((axis) => Math.min(...parts.map((p) => p.position[axis] - p.size[axis] / 2)));
    const maximum = [0, 1, 2].map((axis) => Math.max(...parts.map((p) => p.position[axis] + p.size[axis] / 2)));
    const dimensions = maximum.map((v, i) => v - minimum[i]) as RoomFeature["dimensions"];
    const center = maximum.map((v, i) => (v + minimum[i]) / 2);
    return {
      id,
      name: id.replaceAll("-", " "),
      classification: parts[0].classification ?? "OTHER",
      position: { x: center[0], y: center[1], z: center[2] },
      yawDegrees: 0,
      dimensions,
      provenance: { basis: "SIMULATED", confidence: 1, sourceMediaIds: [] },
      parts: parts.map((p) => ({
        id: p.id,
        size: p.size.map((v, i) => v / dimensions[i]) as RoomFeature["parts"][number]["size"],
        position: p.position.map((v, i) => (v - center[i]) / dimensions[i]) as RoomFeature["parts"][number]["position"],
        surface: p.surface as RoomFeature["parts"][number]["surface"],
        context: p.context,
        face: p.face,
        shape: p.shape ?? "BOX",
        color: p.color ?? 0x8797a8,
      })),
    };
  });
  return roomEnvironmentSchema.parse({
    schemaVersion: 1,
    id: `editable-${room.id}`,
    name: room.name,
    width: room.width,
    depth: room.depth,
    height: 2.8,
    origin: "PRESET",
    features,
  });
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
  room.features = room.features.map((feature) => ({
    ...feature,
    position: {
      x: feature.position.x * ratios[0],
      y: feature.position.y * ratios[1],
      z: feature.position.z * ratios[2],
    },
    dimensions: (scaleFurniture || ["FLOOR", "WALL", "CEILING"].includes(feature.classification)
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
