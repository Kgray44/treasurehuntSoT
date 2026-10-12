import { draftSchema, type SpatialDraft } from "./authoring";
import { emptyStudioContent, type AnimationTrack } from "./studio-contracts";
import { sampleAnimationTrack } from "./behavior";
import type { Transform } from "./contracts";

export function recordAnimationKeyframe(
  draft: SpatialDraft,
  entityId: string,
  property: AnimationTrack["property"],
  atMs: number,
): SpatialDraft {
  const next = structuredClone(draft),
    entity = next.content.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error("Choose an existing object before recording a keyframe.");
  if (next.content.studio?.layers.find((l) => l.entityId === entityId)?.locked)
    throw new Error("Unlock this object before changing its animation.");
  if (next.content.adaptive && property === "POSITION")
    throw new Error("Automatic placement owns position. Animate orientation, scale or visibility instead.");
  const studio = (next.content.studio ??= emptyStudioContent());
  const tracks = (studio.animationTracks ??= []);
  const track = tracks.find((t) => t.entityId === entityId && t.property === property);
  const sampled = track ? sampleAnimationTrack(track, atMs)?.value : undefined;
  const value =
    sampled ??
    (property === "POSITION"
      ? entity.transform.position
      : property === "ROTATION"
        ? entity.transform.rotation
        : property === "SCALE"
          ? entity.transform.scale
          : (studio.layers.find((l) => l.entityId === entityId)?.visible ?? true));
  if (track) {
    if (!track.keyframes.some((f) => f.atMs === atMs)) {
      track.keyframes.push({ id: crypto.randomUUID(), atMs, value } as never);
      track.keyframes.sort((a, b) => a.atMs - b.atMs);
    }
  } else
    tracks.push({
      id: crypto.randomUUID(),
      entityId,
      property,
      enabled: true,
      interpolation: property === "VISIBILITY" ? "STEP" : "LINEAR",
      keyframes: [{ id: crypto.randomUUID(), atMs, value }],
    } as AnimationTrack);
  return draftSchema.parse(next);
}

/** XYZ Euler degrees are an authoring view; stored rotations stay normalized quaternions. */
export function rotationFromDegrees(v: Transform["position"]): Transform["rotation"] {
  const [x, y, z] = [v.x, v.y, v.z].map((a) => (a * Math.PI) / 360);
  const [s1, s2, s3, c1, c2, c3] = [Math.sin(x), Math.sin(y), Math.sin(z), Math.cos(x), Math.cos(y), Math.cos(z)];
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}
export function rotationToDegrees(q: Transform["rotation"]): Transform["position"] {
  const m13 = 2 * (q.x * q.z + q.w * q.y);
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  const x =
    Math.abs(m13) < 0.9999999
      ? Math.atan2(2 * (q.w * q.x - q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y))
      : Math.atan2(2 * (q.y * q.z + q.w * q.x), 1 - 2 * (q.x * q.x + q.z * q.z));
  const z = Math.abs(m13) < 0.9999999 ? Math.atan2(2 * (q.w * q.z - q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)) : 0;
  return { x: (x * 180) / Math.PI, y: (y * 180) / Math.PI, z: (z * 180) / Math.PI };
}
