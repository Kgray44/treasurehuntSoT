import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createPresetConstruction } from "./preset-construction";
import type { DraftContent } from "./authoring";
import type { EnvironmentContent } from "./legacy-scene-environment-contracts";

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
  fixtures?: EnvironmentContent["fixtures"];
  evidence?: EnvironmentContent["evidence"];
};
/** Editable invented geometry; no survey, image interpretation or physical evidence is implied. */
export function createRoomEnvironment(room: PreviewEnvironment): RoomEnvironment {
  if (room.fixtures)
    throw new Error(
      "This Environment uses legacy fixtures. Open its independent Environment editor instead of converting it to a reference room.",
    );
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
  const base =
    room && (fallback.id === room.id || fallback.id === "AUTHORED")
      ? {
          ...fallback,
          ...room,
          horizontal: true,
          vertical: room.features.some((f) => f.classification === "WALL"),
          tracking: true,
          clutter: 0,
          light: room.light ?? "NORMAL",
        }
      : fallback;
  const override = content.scenePresentation?.lighting;
  return override === "NORMAL" || override === "LOW" ? { ...base, light: override } : base;
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
  room.features = room.features.map((feature) => {
    const shell = ["FLOOR", "WALL", "CEILING"].includes(feature.classification);
    const resized = scaleFurniture || shell || feature.parts.some((part) => part.shape === "PATH");
    const angle = (feature.yawDegrees * Math.PI) / 180;
    const c2 = Math.cos(angle) ** 2,
      s2 = Math.sin(angle) ** 2;
    const localRatios = [ratios[0] * c2 + ratios[2] * s2, ratios[1], ratios[0] * s2 + ratios[2] * c2];
    const attached = room.construction?.relationships.some((relation) => relation.featureId === feature.id);
    return {
      ...feature,
      position: {
        x: feature.position.x * ratios[0],
        y:
          resized || attached || feature.classification === "WINDOW"
            ? feature.position.y * ratios[1]
            : feature.position.y,
        z: feature.position.z * ratios[2],
      },
      dimensions: (resized
        ? feature.dimensions.map((value, i) => value * localRatios[i])
        : feature.dimensions) as RoomFeature["dimensions"],
    };
  });
  if (!scaleFurniture) {
    const original = new Map(input.features.map((feature) => [feature.id, feature]));
    const current = new Map(room.features.map((feature) => [feature.id, feature]));
    const resolved = new Set<string>();
    const resolving = new Set<string>();
    const preserveAttachment = (id: string) => {
      if (resolved.has(id) || resolving.has(id)) return;
      resolving.add(id);
      const relation = room.construction?.relationships.find((relation) => relation.featureId === id);
      const before = original.get(id),
        after = current.get(id);
      if (relation && before && after) {
        preserveAttachment(relation.targetFeatureId);
        const oldTarget = original.get(relation.targetFeatureId),
          target = current.get(relation.targetFeatureId);
        if (oldTarget && target && relation.type === "SUPPORTED_BY") {
          after.position = {
            x: target.position.x + before.position.x - oldTarget.position.x,
            y:
              target.position.y +
              target.dimensions[1] / 2 +
              before.position.y -
              oldTarget.position.y -
              oldTarget.dimensions[1] / 2,
            z: target.position.z + before.position.z - oldTarget.position.z,
          };
        } else if (oldTarget && target && relation.type === "MOUNTED_ON") {
          const angle = (target.yawDegrees * Math.PI) / 180;
          const nx = Math.sin(angle),
            nz = Math.cos(angle);
          const oldDistance =
            (before.position.x - oldTarget.position.x) * nx + (before.position.z - oldTarget.position.z) * nz;
          const oldThickness = oldTarget.dimensions[2],
            thickness = target.dimensions[2];
          const desired = oldDistance + (thickness - oldThickness) * 0.4;
          const actual = (after.position.x - target.position.x) * nx + (after.position.z - target.position.z) * nz;
          after.position.x += nx * (desired - actual);
          after.position.z += nz * (desired - actual);
        }
      }
      resolving.delete(id);
      resolved.add(id);
    };
    room.features.forEach((feature) => preserveAttachment(feature.id));
  }
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
        // A long wall's centre can be far from a door mounted on that same
        // wall. Compare the landmark with the feature footprint, not its centre.
        distance: roomFeatureHorizontalDistance(feature, near.position),
      }))
      .sort((a, b) => a.distance - b.distance);
    if (ordered.length === 1 || ordered[1].distance - ordered[0].distance > 0.3)
      return { status: "RESOLVED" as const, feature: ordered[0].feature, candidates };
  }
  return candidates.length === 1
    ? { status: "RESOLVED" as const, feature: candidates[0], candidates }
    : { status: "AMBIGUOUS" as const, candidates };
}

export function roomFeatureHorizontalDistance(feature: RoomFeature, point: RoomFeature["position"]): number {
  const yaw = (feature.yawDegrees * Math.PI) / 180;
  const dx = point.x - feature.position.x,
    dz = point.z - feature.position.z;
  const x = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
  const z = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  return Math.hypot(
    Math.max(0, Math.abs(x) - feature.dimensions[0] / 2),
    Math.max(0, Math.abs(z) - feature.dimensions[2] / 2),
  );
}
