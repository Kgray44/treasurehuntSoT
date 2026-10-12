import type { HandObservation } from "./hand-observation";
type Hand = HandObservation["hands"][number];
type Landmark = Hand["landmarks"][number];
export const pointingLandmarks = [0, 5, 6, 7, 8, 9, 17] as const;
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
/** Geometric posture evidence, not model confidence or a probability of intent. */
export function assessHand(hand: Hand) {
  const points = hand.landmarks;
  const validCount = points.filter((p) => p.valid).length;
  const requiredValid = pointingLandmarks.every((i) => points[i]?.valid);
  const framed =
    requiredValid &&
    pointingLandmarks.every((i) => {
      const p = points[i];
      return p.x > 0.015 && p.x < 0.985 && p.y > 0.015 && p.y < 0.985;
    });
  const scale = requiredValid ? Math.hypot(points[5].x - points[17].x, points[5].y - points[17].y) : 0;
  const geometry = requiredValid && scale >= 0.035 && scale <= 0.65;
  let pointing = false;
  let posture: "POINT" | "OPEN" | "BENT" | "UNKNOWN" = "UNKNOWN";
  if (geometry) {
    const chain = distance(points[5], points[6]) + distance(points[6], points[7]) + distance(points[7], points[8]);
    const reach = distance(points[5], points[8]);
    const distal = distance(points[6], points[8]);
    const extended =
      chain > scale * 0.45 &&
      reach / chain >= 0.82 &&
      distal >= scale * 0.28 &&
      distance(points[5], points[6]) >= scale * 0.12 &&
      distance(points[7], points[8]) >= scale * 0.08;
    const open = [
      [9, 10, 11, 12],
      [13, 14, 15, 16],
      [17, 18, 19, 20],
    ].filter((ids) => {
      if (ids.some((i) => !points[i].valid)) return false;
      const [a, b, c, d] = ids.map((i) => points[i]);
      const length = distance(a, b) + distance(b, c) + distance(c, d);
      return length > scale * 0.6 && distance(a, d) / length > 0.86 && distance(b, d) > scale * 0.4;
    }).length;
    pointing = extended && open < 2;
    posture = pointing ? "POINT" : open >= 2 ? "OPEN" : "BENT";
  }
  return {
    detected: validCount > 0,
    validCount,
    requiredValid,
    framed,
    geometry,
    pointing,
    posture,
    landmarkQuality: validCount >= 16 ? ("TRACKED" as const) : ("PARTIAL" as const),
  };
}
