import type { HandObservation } from "./hand-observation";
import { cosine, dot, handGeometry, subtract, vectorLength, type GeometryFrame } from "./hand-geometry";
type Hand = HandObservation["hands"][number];
export const pointingLandmarks = [0, 5, 6, 7, 8, 9, 17] as const;
/** Geometric posture evidence, not model confidence or a probability of intent. */
export function assessHand(hand: Hand, frame?: GeometryFrame) {
  const points = hand.landmarks;
  const validCount = points.filter((p) => p.valid).length;
  const requiredValid = pointingLandmarks.every((i) => points[i]?.valid);
  const framed =
    requiredValid &&
    pointingLandmarks.every((i) => {
      const p = points[i];
      return p.x > 0.015 && p.x < 0.985 && p.y > 0.015 && p.y < 0.985;
    });
  const shape = handGeometry(hand, frame);
  // A narrow projected palm is usable if its inferred depth and visible wrist
  // still form a coherent palm. Depth alone cannot rescue a tiny/collapsed hand.
  const geometry =
    requiredValid &&
    shape.scale >= 0.035 &&
    shape.scale <= 0.65 &&
    shape.palmLength >= shape.scale * 0.3 &&
    shape.palmLength <= shape.scale * 3 &&
    shape.projectedPalm >= 0.025 &&
    shape.palmArea >= 0.15;
  let pointing = false;
  let pointingEvidence: "DISTINCT" | "MARGINAL" | "NONE" = "NONE";
  let posture: "POINT" | "OPEN" | "BENT" | "UNKNOWN" = "UNKNOWN";
  let depthDominant = false;
  if (geometry) {
    const index = shape.finger(5)!;
    depthDominant = Math.abs(index.axis.z) > Math.hypot(index.axis.x, index.axis.y);
    const anatomical =
      index.chain >= shape.scale * 0.45 &&
      index.chain <= shape.scale * 3.5 &&
      index.lengths[0] >= shape.scale * 0.1 &&
      index.lengths[1] >= shape.scale * 0.055 &&
      index.lengths[2] >= shape.scale * 0.055 &&
      index.lengths[1] >= index.lengths[0] * 0.22 &&
      index.lengths[1] <= index.lengths[0] * 1.4 &&
      index.lengths[2] >= index.lengths[0] * 0.18 &&
      index.lengths[2] <= index.lengths[0] * 1.2 &&
      cosine(index.proximal, shape.forward) >= -0.35;
    // A comfortable bend is evidence of pointing. A folded-back or collapsed
    // joint is not; the endpoint distance alone cannot tell these apart.
    const extended = anatomical && index.straightness >= 0.78 && index.pipAlignment >= 0.2 && index.dipAlignment >= 0;
    const marginal =
      anatomical && index.straightness >= 0.7 && index.pipAlignment >= -0.1 && index.dipAlignment >= -0.1;
    const others = [9, 13, 17]
      .map(shape.finger)
      .filter(
        (finger) =>
          finger !== null &&
          finger.chain >= shape.scale * 0.45 &&
          finger.chain <= shape.scale * 3.5 &&
          finger.lengths.every((length) => length >= shape.scale * 0.04),
      )
      .filter((finger) => finger !== null);
    const open = others.filter(
      (finger) =>
        finger.chain >= shape.scale * 0.55 &&
        finger.straightness >= 0.93 &&
        finger.pipAlignment >= 0.7 &&
        finger.dipAlignment >= 0.7,
    ).length;
    // Relaxed fingers need not make a fist. Require a distinguishable index
    // rather than treating every gently bent open hand as an intended point.
    const similar = others.filter(
      (finger) =>
        finger.chain >= shape.scale * 0.5 &&
        dot(finger.axis, index.axis) / Math.max(1e-9, finger.chain * index.reach) >= index.straightness - 0.1 &&
        finger.pipAlignment >= 0.3 &&
        finger.dipAlignment >= 0.3,
    ).length;
    const pinched =
      shape.points[4].valid && vectorLength(subtract(shape.points[4], shape.points[8])) < shape.scale * 0.18;
    const competing = others.some(
      (finger) =>
        finger.straightness >= 0.96 &&
        finger.pipAlignment >= 0.85 &&
        finger.dipAlignment >= 0.85 &&
        cosine(finger.axis, shape.forward) >= 0.2 &&
        cosine(finger.axis, index.axis) >= 0.35,
    );
    const distinct = others.length >= 2 && open < 2 && similar < 2 && !pinched && !competing;
    pointing = extended && distinct;
    pointingEvidence = pointing ? "DISTINCT" : marginal && distinct ? "MARGINAL" : "NONE";
    posture = pointing ? "POINT" : open >= 2 || similar >= 2 ? "OPEN" : anatomical ? "BENT" : "UNKNOWN";
  }
  return {
    detected: validCount > 0,
    validCount,
    requiredValid,
    framed,
    geometry,
    pointing,
    pointingEvidence,
    posture,
    depthDominant,
    palmFacing: geometry ? shape.palmFacing : null,
    depthEvidence: "MONOCULAR_INFERRED" as const,
    landmarkQuality: validCount >= 16 ? ("TRACKED" as const) : ("PARTIAL" as const),
  };
}
