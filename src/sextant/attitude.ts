/** Physical portrait device frame: +X right, +Y top, +Z through the display.
 * W3C intrinsic Z-X'-Y'' angles map device vectors into the reference frame. */
export type Vector3 = { x: number; y: number; z: number };
export type Quaternion = Vector3 & { w: number };
export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const degrees = (radians: number) => (radians * 180) / Math.PI;
export const wrapDegrees = (angle: number) => ((angle % 360) + 360) % 360;
export const deltaDegrees = (next: number, previous: number) => ((next - previous + 540) % 360) - 180;
export function normalizeQuaternion(q: Quaternion): Quaternion {
  const length = Math.hypot(q.x, q.y, q.z, q.w);
  if (!Number.isFinite(length) || length < 1e-12) throw new Error("SEXTANT_ATTITUDE_INVALID");
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}
export function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  return normalizeQuaternion({
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  });
}
export const inverseQuaternion = (q: Quaternion): Quaternion => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
export function orientationQuaternion(alpha: number, beta: number, gamma: number): Quaternion {
  if (
    ![alpha, beta, gamma].every(Number.isFinite) ||
    alpha < 0 ||
    alpha >= 360 ||
    Math.abs(beta) > 180 ||
    Math.abs(gamma) > 90
  )
    throw new Error("SEXTANT_EULER_INVALID");
  const a = radians(alpha) / 2,
    b = radians(beta) / 2,
    c = radians(gamma) / 2;
  return multiplyQuaternion(
    multiplyQuaternion({ x: 0, y: 0, z: Math.sin(a), w: Math.cos(a) }, { x: Math.sin(b), y: 0, z: 0, w: Math.cos(b) }),
    { x: 0, y: Math.sin(c), z: 0, w: Math.cos(c) },
  );
}
export function rotateVector(q: Quaternion, v: Vector3): Vector3 {
  const tx = 2 * (q.y * v.z - q.z * v.y),
    ty = 2 * (q.z * v.x - q.x * v.z),
    tz = 2 * (q.x * v.y - q.y * v.x);
  return {
    x: v.x + q.w * tx + q.y * tz - q.z * ty,
    y: v.y + q.w * ty + q.z * tx - q.x * tz,
    z: v.z + q.w * tz + q.x * ty - q.y * tx,
  };
}
export function screenAdjustedQuaternion(q: Quaternion, screenDegrees: number): Quaternion {
  const angle = -radians(screenDegrees) / 2;
  return multiplyQuaternion(q, { x: 0, y: 0, z: Math.sin(angle), w: Math.cos(angle) });
}
/** Project the physical top edge onto the horizontal plane; upright/degenerate poses have no bearing. */
export function headingFromAttitude(q: Quaternion): number | null {
  const top = rotateVector(q, { x: 0, y: 1, z: 0 });
  return Math.hypot(top.x, top.y) < 0.2 ? null : wrapDegrees(degrees(Math.atan2(top.x, top.y)));
}
export function finiteVector(
  value: { x: number | null; y: number | null; z: number | null } | null | undefined,
): Vector3 | null {
  return value && [value.x, value.y, value.z].every((n) => typeof n === "number" && Number.isFinite(n))
    ? { x: value.x!, y: value.y!, z: value.z! }
    : null;
}
