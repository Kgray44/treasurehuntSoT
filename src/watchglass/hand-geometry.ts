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
  const auxiliary = hand.offImageFingerLandmarks ?? [];
  // Invalid auxiliary data cannot supply evidence even to direct callers that
  // have not passed through the observation schema. Existing observed points
  // always take precedence, and an estimate never repairs a required landmark.
  const auxiliaryValid =
    auxiliary.length <= 12 &&
    new Set(auxiliary.map((point) => point.index)).size === auxiliary.length &&
    auxiliary.every(
      (point) =>
        Number.isInteger(point.index) &&
        point.index >= 10 &&
        point.index <= 20 &&
        point.index !== 17 &&
        !points[point.index].valid &&
        [point.x, point.y, point.z].every(Number.isFinite) &&
        point.x >= -0.15 &&
        point.x <= 1.15 &&
        point.y >= -0.15 &&
        point.y <= 1.15 &&
        (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1),
    );
  const inferred = new Map(
    auxiliaryValid ? auxiliary.map((point) => [point.index, { ...point, y: point.y * aspect }]) : [],
  );
  const across = subtract(points[17], points[5]);
  const scale = vectorLength(across);
  const middle = subtract(points[9], points[5]);
  const along = dot(middle, across) / Math.max(1e-9, scale * scale);
  const arch = {
    x: middle.x - across.x * along,
    y: middle.y - across.y * along,
    z: middle.z - across.z * along,
  };
  const archRatio = vectorLength(arch) / Math.max(1e-9, scale);
  // A missing wrist must never become an invented origin. A visibly curved
  // knuckle row can supply palm orientation. Otherwise the observed index and
  // palm span can support finger relationships without claiming a palm normal.
  const knuckleSupport =
    [5, 9, 17].every((index) => points[index].valid) &&
    along >= 0.15 &&
    along <= 0.85 &&
    archRatio >= 0.08 &&
    archRatio <= 0.5;
  const indexProximal = subtract(points[6], points[5]);
  const indexPlane = vectorLength(cross(across, indexProximal)) / Math.max(1e-9, scale * vectorLength(indexProximal));
  const fingerSupport =
    [5, 6, 7, 8, 17].every((index) => points[index].valid) &&
    vectorLength(indexProximal) >= scale * 0.1 &&
    vectorLength(indexProximal) <= scale * 1.5 &&
    indexPlane >= 0.15;
  const palmBasis = points[0].valid
    ? ("WRIST" as const)
    : knuckleSupport
      ? ("KNUCKLE_ARCH" as const)
      : fingerSupport
        ? ("FINGER_RELATIONS" as const)
        : ("UNAVAILABLE" as const);
  const forward =
    palmBasis === "WRIST" ? subtract(points[9], points[0]) : palmBasis === "KNUCKLE_ARCH" ? arch : indexProximal;
  const normal = cross(across, forward);
  const palmLength = vectorLength(forward);
  const projectedPalm = Math.max(Math.hypot(across.x, across.y), Math.hypot(forward.x, forward.y));
  const palmArea = vectorLength(normal) / Math.max(1e-9, scale * palmLength);
  const palmFacing =
    palmBasis === "WRIST" || palmBasis === "KNUCKLE_ARCH"
      ? Math.abs(normal.z) / Math.max(1e-9, vectorLength(normal))
      : null;
  function finger(base: number, allowOffImage = false) {
    const ids = [base, base + 1, base + 2, base + 3];
    const joints = ids.map((i) =>
      points[i]?.valid ? points[i] : allowOffImage && base >= 9 ? inferred.get(i) : undefined,
    );
    if (joints.some((point) => point === undefined)) return null;
    const [a, b, c, d] = joints as Vector3[];
    const proximal = subtract(b, a);
    const middle = subtract(c, b);
    const distal = subtract(d, c);
    const axis = subtract(d, a);
    const lengths = [proximal, middle, distal].map(vectorLength);
    const chain = lengths.reduce((sum, length) => sum + length, 0);
    const reach = vectorLength(axis);
    return {
      base,
      inferredOffImage: ids.some((i) => !points[i]?.valid),
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
  return { points, aspect, scale, forward, palmLength, projectedPalm, palmArea, palmFacing, palmBasis, finger };
}
