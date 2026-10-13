import { roomEnvironmentSchema, type RoomEnvironment } from "./environment-contracts";
import { detachRoomExclusion, reconcileRoomExclusions } from "./exclusion-zones";

export type RoomFeatureTransform = {
  position: { x: number; y: number; z: number };
  yawDegrees: number;
  scale: number;
};

/** Gravity-aligned authoring features use the same gizmo, with dimensions as scale.
 * Declared attachments follow their support; measured scale is cleared only when changed.
 */
export function transformRoomFeature(input: RoomEnvironment, id: string, pose: RoomFeatureTransform): RoomEnvironment {
  const room = structuredClone(detachRoomExclusion(input, id));
  const before = input.features.find((feature) => feature.id === id);
  const feature = room.features.find((feature) => feature.id === id);
  if (!before || !feature) throw new Error("Select a room feature before transforming it.");
  if (!Number.isFinite(pose.scale) || pose.scale <= 0)
    throw new Error("Room feature scale must be finite and positive.");
  const delta = ((pose.yawDegrees - before.yawDegrees) * Math.PI) / 180;
  const angle = (before.yawDegrees * Math.PI) / 180;
  const visited = new Set([id]);
  const follow = (parentId: string) => {
    for (const relation of room.construction?.relationships ?? []) {
      if (relation.targetFeatureId !== parentId || visited.has(relation.featureId)) continue;
      visited.add(relation.featureId);
      const child = room.features.find((entry) => entry.id === relation.featureId)!;
      const offset = {
        x: child.position.x - before.position.x,
        y: child.position.y - before.position.y,
        z: child.position.z - before.position.z,
      };
      const localX = (Math.cos(angle) * offset.x - Math.sin(angle) * offset.z) * pose.scale;
      const localZ = (Math.sin(angle) * offset.x + Math.cos(angle) * offset.z) * pose.scale;
      const nextAngle = angle + delta;
      child.position = {
        x: pose.position.x + Math.cos(nextAngle) * localX + Math.sin(nextAngle) * localZ,
        y: pose.position.y + offset.y * pose.scale,
        z: pose.position.z - Math.sin(nextAngle) * localX + Math.cos(nextAngle) * localZ,
      };
      child.yawDegrees = ((child.yawDegrees + pose.yawDegrees - before.yawDegrees + 540) % 360) - 180;
      child.dimensions = child.dimensions.map((value) => value * pose.scale) as typeof child.dimensions;
      child.provenance = { ...child.provenance, basis: "CREATOR_CONFIRMED", confidence: 1 };
      follow(child.id);
    }
  };
  follow(id);
  feature.position = pose.position;
  feature.yawDegrees = ((pose.yawDegrees + 540) % 360) - 180;
  feature.dimensions = before.dimensions.map((value) => value * pose.scale) as typeof feature.dimensions;
  feature.provenance = { ...feature.provenance, basis: "CREATOR_CONFIRMED", confidence: 1 };
  if (room.scaleReference) {
    const reference = room.features.find((entry) => entry.id === room.scaleReference!.featureId);
    const axis = ({ WIDTH: 0, HEIGHT: 1, DEPTH: 2 } as const)[room.scaleReference.axis];
    if (!reference || Math.abs(reference.dimensions[axis] - room.scaleReference.measuredMeters) > 1e-6)
      delete room.scaleReference;
  }
  return reconcileRoomExclusions(roomEnvironmentSchema.parse(room));
}
