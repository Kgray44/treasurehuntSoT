import type { HandObservation } from "./hand-observation";
import { cosine, dot, handGeometry, subtract, vectorLength, type GeometryFrame } from "./hand-geometry";
type Hand = HandObservation["hands"][number];
// Calibration features require the complete index and the observed palm span.
// The wrist is orientation support, not a pointing feature or a framing target.
export const pointingLandmarks = [5, 6, 7, 8, 9, 17] as const;
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
  const observedIndex = shape.finger(5);
  // Visible joint tracking is weaker than pointing intent. This remains useful
  // for camera feedback when palm evidence cannot support a calibration sample.
  const indexTracked =
    [5, 6, 7, 8].every((i) => points[i]?.valid) &&
    observedIndex !== null &&
    observedIndex.lengths.every((length) => length > 1e-5) &&
    observedIndex.lengths[1] >= observedIndex.lengths[0] * 0.22 &&
    observedIndex.lengths[1] <= observedIndex.lengths[0] * 1.4 &&
    observedIndex.lengths[2] >= observedIndex.lengths[0] * 0.18 &&
    observedIndex.lengths[2] <= observedIndex.lengths[0] * 1.2;
  // A narrow projected palm is usable if its inferred depth and visible wrist
  // still form a coherent palm. Depth alone cannot rescue a tiny/collapsed hand.
  const geometry =
    requiredValid &&
    shape.palmBasis !== "UNAVAILABLE" &&
    shape.scale >= 0.035 &&
    shape.scale <= 0.65 &&
    (shape.palmBasis !== "WRIST" || (shape.palmLength >= shape.scale * 0.3 && shape.palmLength <= shape.scale * 3)) &&
    shape.projectedPalm >= 0.025 &&
    shape.palmArea >= 0.15;
  let pointing = false;
  let pointingEvidence: "DISTINCT" | "MARGINAL" | "NONE" = "NONE";
  let posture: "POINT" | "OPEN" | "BENT" | "UNKNOWN" = "UNKNOWN";
  let depthDominant = false;
  let partialFingerSupport = false;
  let offImageFingerSupport = false;
  let insufficientFingerEvidence = false;
  if (geometry) {
    const index = observedIndex!;
    // A knuckle arch supplies a plane, not a reliable wrist-to-finger direction.
    // With no wrist, evaluate pointing against observed finger relationships.
    const anatomyForward = shape.palmBasis === "WRIST" ? shape.forward : index.proximal;
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
      cosine(index.proximal, anatomyForward) >= -0.35;
    // A comfortable bend is evidence of pointing. A folded-back or collapsed
    // joint is not; the endpoint distance alone cannot tell these apart.
    const extended = anatomical && index.straightness >= 0.78 && index.pipAlignment >= 0.2 && index.dipAlignment >= 0;
    const marginal =
      anatomical && index.straightness >= 0.7 && index.pipAlignment >= -0.1 && index.dipAlignment >= -0.1;
    const others = [9, 13, 17]
      // Only non-index relationships may use the bounded auxiliary estimate.
      // All calibration features and framing still require observed index/core.
      .map((base) => shape.finger(base, true))
      .filter(
        (finger) =>
          finger !== null &&
          finger.chain >= shape.scale * 0.45 &&
          finger.chain <= shape.scale * 3.5 &&
          finger.lengths.every((length) => length >= shape.scale * 0.04),
      )
      .filter((finger) => finger !== null);
    offImageFingerSupport = others.some((finger) => finger.inferredOffImage);
    // A clipped non-index tip is positive relaxed-finger evidence only if the
    // remaining observed PIP visibly bends. Straight cropped fingers remain
    // unknown, so cropping an open palm cannot manufacture pointing intent.
    const partialRelaxed = [9, 13, 17].filter((base) => {
      if (others.some((finger) => finger.base === base)) return false;
      if (points[base + 3].valid || [base, base + 1, base + 2].some((index) => !points[index].valid)) return false;
      const proximal = subtract(shape.points[base + 1], shape.points[base]);
      const middle = subtract(shape.points[base + 2], shape.points[base + 1]);
      const a = vectorLength(proximal),
        b = vectorLength(middle);
      return (
        a >= shape.scale * 0.1 &&
        a <= shape.scale * 1.5 &&
        b >= shape.scale * 0.04 &&
        b >= a * 0.22 &&
        b <= a * 1.4 &&
        cosine(proximal, middle) <= 0.45
      );
    }).length;
    partialFingerSupport = partialRelaxed > 0;
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
        (cosine(finger.axis, anatomyForward) >= 0.2 || (depthDominant && cosine(finger.axis, index.axis) >= 0.8)) &&
        cosine(finger.axis, index.axis) >= 0.35,
    );
    const distinct = others.length + partialRelaxed >= 2 && open < 2 && similar < 2 && !pinched && !competing;
    insufficientFingerEvidence = extended && others.length + partialRelaxed < 2;
    pointing = extended && distinct;
    pointingEvidence = pointing ? "DISTINCT" : marginal && distinct ? "MARGINAL" : "NONE";
    posture = pointing ? "POINT" : open >= 2 || similar >= 2 ? "OPEN" : anatomical ? "BENT" : "UNKNOWN";
  }
  const wristAtEdge =
    points[0].valid && (points[0].x <= 0.015 || points[0].x >= 0.985 || points[0].y <= 0.015 || points[0].y >= 0.985);
  const partialFramingReason = !points[0].valid
    ? ("WRIST_UNAVAILABLE" as const)
    : wristAtEdge
      ? ("WRIST_AT_EDGE" as const)
      : offImageFingerSupport
        ? ("NON_INDEX_INFERRED_OFF_IMAGE" as const)
        : partialFingerSupport
          ? ("FOLDED_FINGERS_PARTIAL" as const)
          : null;
  return {
    detected: validCount > 0,
    indexTracked,
    validCount,
    requiredValid,
    framed,
    geometry,
    partialFraming: partialFramingReason !== null,
    partialFramingReason,
    palmBasis: shape.palmBasis,
    pointing,
    pointingEvidence,
    posture,
    depthDominant,
    offImageFingerSupport,
    insufficientFingerEvidence,
    palmFacing: geometry ? shape.palmFacing : null,
    depthEvidence: "MONOCULAR_INFERRED" as const,
    landmarkQuality: validCount >= 16 ? ("TRACKED" as const) : ("PARTIAL" as const),
  };
}
