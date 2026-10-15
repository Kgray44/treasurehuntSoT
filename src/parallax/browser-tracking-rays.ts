import { z } from "zod";
import { resolvedTransformSchema, type Transform } from "./contracts";
import { composeTransform } from "./transforms";

const point = resolvedTransformSchema.shape.position;
export const trackingRaySchema = z.strictObject({
  sessionId: z.string().min(1).max(200),
  origin: point,
  direction: point,
});
export type TrackingRay = z.infer<typeof trackingRaySchema>;

/** Map a contain-fitted video tap to camera pixels, excluding letterbox margins. */
export function containedCameraPoint(input: {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
  frameWidth: number;
  frameHeight: number;
}): { x: number; y: number } | null {
  const { x, y, viewportWidth, viewportHeight, frameWidth, frameHeight } = input;
  if (
    !Object.values(input).every(Number.isFinite) ||
    Math.min(viewportWidth, viewportHeight, frameWidth, frameHeight) <= 0
  )
    return null;
  const scale = Math.min(viewportWidth / frameWidth, viewportHeight / frameHeight);
  const width = frameWidth * scale,
    height = frameHeight * scale;
  const u = (x - (viewportWidth - width) / 2) / width;
  const v = (y - (viewportHeight - height) / 2) / height;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { x: u, y: v } : null;
}

/** Unproject through the same uncropped camera frame used for tracking and rendering. */
export function cameraTrackingRay(input: {
  sessionId: string;
  camera: Transform;
  x: number;
  y: number;
  width: number;
  height: number;
  focal: number;
}): TrackingRay {
  const { x, y, width, height, focal } = input;
  if (
    ![x, y, width, height, focal].every(Number.isFinite) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1 ||
    Math.min(width, height, focal) <= 0
  )
    throw new Error("PARALLAX_CAMERA_RAY_INVALID");
  const local = { x: (x * width - width / 2) / focal, y: -(y * height - height / 2) / focal, z: -1 };
  const end = composeTransform(input.camera, {
    position: local,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: 1,
  }).position;
  const delta = {
    x: end.x - input.camera.position.x,
    y: end.y - input.camera.position.y,
    z: end.z - input.camera.position.z,
  };
  const length = Math.hypot(delta.x, delta.y, delta.z);
  return trackingRaySchema.parse({
    sessionId: input.sessionId,
    origin: input.camera.position,
    direction: { x: delta.x / length, y: delta.y / length, z: delta.z / length },
  });
}

/** Two observations of the same physical corner recover relative depth without a measurement or guessed plane. */
export function triangulateTrackingRays(first: TrackingRay, second: TrackingRay) {
  const a = trackingRaySchema.parse(first),
    b = trackingRaySchema.parse(second);
  if (a.sessionId !== b.sessionId) throw new Error("PARALLAX_ALIGNMENT_SESSION_CHANGED");
  const dot = (u: typeof a.origin, v: typeof a.origin) => u.x * v.x + u.y * v.y + u.z * v.z;
  const normA = dot(a.direction, a.direction),
    normB = dot(b.direction, b.direction);
  if (Math.abs(normA - 1) > 1e-5 || Math.abs(normB - 1) > 1e-5)
    throw new Error("PARALLAX_ALIGNMENT_UNIT_RAYS_REQUIRED");
  const delta = { x: a.origin.x - b.origin.x, y: a.origin.y - b.origin.y, z: a.origin.z - b.origin.z };
  const cosine = dot(a.direction, b.direction),
    denominator = 1 - cosine * cosine;
  if (denominator < 0.01) throw new Error("Move sideways for a second view of the same corner.");
  const ad = dot(a.direction, delta),
    bd = dot(b.direction, delta);
  const ta = (cosine * bd - ad) / denominator,
    tb = (bd - cosine * ad) / denominator;
  if (ta <= 0 || tb <= 0) throw new Error("The corner must be in front of both camera views.");
  const pa = {
    x: a.origin.x + ta * a.direction.x,
    y: a.origin.y + ta * a.direction.y,
    z: a.origin.z + ta * a.direction.z,
  };
  const pb = {
    x: b.origin.x + tb * b.direction.x,
    y: b.origin.y + tb * b.direction.y,
    z: b.origin.z + tb * b.direction.z,
  };
  const residual = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) / Math.min(ta, tb);
  if (residual > 0.02) throw new Error("Those taps disagree. Tap the same physical corner again.");
  return point.parse({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 });
}
