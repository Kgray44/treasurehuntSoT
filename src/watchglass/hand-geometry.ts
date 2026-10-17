import type { HandObservation } from "./hand-observation";

export type GeometryFrame = Pick<HandObservation, "frameWidth" | "frameHeight">;
type Hand = HandObservation["hands"][number];
export type Vector3 = { x: number; y: number; z: number };
export const vectorLength = (v: Vector3) => Math.hypot(v.x, v.y, v.z);
export const subtract = (a: Vector3, b: Vector3): Vector3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const dot = (a: Vector3, b: Vector3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vector3, b: Vector3): Vector3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const cosine = (a: Vector3, b: Vector3) => dot(a, b) / Math.max(1e-9, vectorLength(a) * vectorLength(b));

/**
 * MediaPipe image z is inferred relative depth on approximately the x scale.
 * Put y on that same scale before using joint angles. These are neither world
 * landmarks nor a metric reconstruction, even when all landmarks are valid.
 */
export function handGeometry(hand: Hand, frame?: GeometryFrame) {
  const aspect = frame ? frame.frameHeight / frame.frameWidth : 1;
  if (!Number.isFinite(aspect) || aspect <= 0) throw new Error("HAND_GEOMETRY_FRAME_INVALID");
  const points = hand.landmarks.map((p) => ({ ...p, y: p.y * aspect }));
  const across = subtract(points[17], points[5]);
  const forward = subtract(points[9], points[0]);
  const normal = cross(across, forward);
  const scale = vectorLength(across);
  const palmLength = vectorLength(forward);
  const projectedPalm = Math.max(Math.hypot(across.x, across.y), Math.hypot(forward.x, forward.y));
  const palmArea = vectorLength(normal) / Math.max(1e-9, scale * palmLength);
  const palmFacing = Math.abs(normal.z) / Math.max(1e-9, vectorLength(normal));
  function finger(base: number) {
    const ids = [base, base + 1, base + 2, base + 3];
    if (ids.some((i) => !points[i]?.valid)) return null;
    const [a, b, c, d] = ids.map((i) => points[i]);
    const proximal = subtract(b, a);
    const middle = subtract(c, b);
    const distal = subtract(d, c);
    const axis = subtract(d, a);
    const lengths = [proximal, middle, distal].map(vectorLength);
    const chain = lengths.reduce((sum, length) => sum + length, 0);
    const reach = vectorLength(axis);
    return {
      axis,
      proximal,
      chain,
      reach,
      lengths,
      straightness: reach / Math.max(1e-9, chain),
      pipAlignment: cosine(proximal, middle),
      dipAlignment: cosine(middle, distal),
    };
  }
  return { points, aspect, scale, forward, palmLength, projectedPalm, palmArea, palmFacing, finger };
}
