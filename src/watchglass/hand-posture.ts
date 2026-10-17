import type { HandObservation } from "./hand-observation";
import { cosine, handGeometry, subtract, vectorLength, type GeometryFrame } from "./hand-geometry";
import { indexGeometry, indexLandmarks } from "./index-geometry";

type Hand = HandObservation["hands"][number];
export const pointingLandmarks = indexLandmarks;

/**
 * Index-led intent heuristic. A coherent visible index has priority when other
 * fingers are cropped or their projected shape cannot support contrary evidence.
 * Neither inferred image depth nor absence of other fingers proves intent.
 */
export function assessHand(hand: Hand, frame?: GeometryFrame) {
  const points = hand.landmarks;
  const validCount = points.filter((point) => point.valid).length;
  const index = indexGeometry(hand, frame);
  const shape = handGeometry(hand, frame);
  const pixelWidth = frame?.frameWidth ?? 640;
  const others = [9, 13, 17]
    .map((base) => {
      // Auxiliary off-image estimates cannot veto an observed index-only point.
      const finger = shape.finger(base);
      if (!finger) return null;
      const joints = [base, base + 1, base + 2, base + 3].map((id) => shape.points[id]);
      const lengths = joints.slice(1).map((point, i) => {
        const bone = subtract(point, joints[i]);
        return Math.hypot(bone.x, bone.y);
      });
      const projectedChain = lengths.reduce((sum, length) => sum + length, 0);
      const projectedReach = Math.hypot(finger.axis.x, finger.axis.y);
      // In-bounds model joints have no per-joint visibility score. Demand a
      // separated, coherent projected chain before calling it contrary evidence;
      // a depth-overlapping or collapsed inferred finger remains uncertain.
      const projectedCoherent =
        lengths.every((length) => length >= 3 / pixelWidth) &&
        projectedReach >= 12 / pixelWidth &&
        projectedReach / Math.max(1e-9, finger.chain) >= 0.5 &&
        projectedReach / Math.max(1e-9, projectedChain) >= 0.85 &&
        Math.hypot(joints[3].x - shape.points[8].x, joints[3].y - shape.points[8].y) >= 8 / pixelWidth;
      return { ...finger, projectedCoherent };
    })
    .filter(
      (finger) =>
        finger !== null &&
        finger.projectedCoherent &&
        finger.chain >= index.chain * 0.35 &&
        finger.chain <= index.chain * 2.5 &&
        finger.lengths.every((length) => length >= 0.001),
    )
    .filter((finger) => finger !== null);
  const open = others.filter(
    (finger) => finger.straightness >= 0.93 && finger.pipAlignment >= 0.7 && finger.dipAlignment >= 0.7,
  ).length;
  const similar = others.filter(
    (finger) =>
      finger.straightness >= index.straightness - 0.1 &&
      cosine(finger.axis, index.axis) >= 0.85 &&
      finger.pipAlignment >= 0.3 &&
      finger.dipAlignment >= 0.3,
  ).length;
  const anatomyForward = shape.palmBasis === "WRIST" ? shape.forward : subtract(shape.points[6], shape.points[5]);
  const competing = others.some(
    (finger) =>
      finger.straightness >= 0.96 &&
      finger.pipAlignment >= 0.85 &&
      finger.dipAlignment >= 0.85 &&
      (cosine(finger.axis, anatomyForward) >= 0.2 || (index.depthDominant && cosine(finger.axis, index.axis) >= 0.8)) &&
      cosine(finger.axis, index.axis) >= 0.35,
  );
  const pinched =
    index.complete && points[4].valid && vectorLength(subtract(shape.points[4], shape.points[8])) < index.chain * 0.12;
  const contrary = open >= 2 || similar >= 2 || competing || pinched;
  const pointing = index.extended && !contrary;
  const pointingEvidence = pointing
    ? ("DISTINCT" as const)
    : index.marginal && !contrary
      ? ("MARGINAL" as const)
      : ("NONE" as const);
  const intentEvidence = pointing
    ? others.length >= 2
      ? ("COMPARED_PROJECTED_FINGERS" as const)
      : ("HEURISTIC_INDEX_ONLY" as const)
    : ("NONE" as const);
  const posture = pointing
    ? ("POINT" as const)
    : open >= 2 || similar >= 2
      ? ("OPEN" as const)
      : index.anatomical
        ? ("BENT" as const)
        : ("UNKNOWN" as const);
  const wristAtEdge =
    points[0].valid && (points[0].x <= 0.015 || points[0].x >= 0.985 || points[0].y <= 0.015 || points[0].y >= 0.985);
  const partialFramingReason = !points[0].valid
    ? ("WRIST_UNAVAILABLE" as const)
    : wristAtEdge
      ? ("WRIST_AT_EDGE" as const)
      : [9, 13, 17].some((base) => [base, base + 1, base + 2, base + 3].some((id) => !points[id].valid))
        ? ("NON_INDEX_UNAVAILABLE" as const)
        : null;
  return {
    detected: validCount > 0,
    indexTracked: index.indexTracked,
    validCount,
    requiredValid: index.complete,
    framed: index.indexFramed,
    geometry: index.geometry,
    partialFraming: partialFramingReason !== null,
    partialFramingReason,
    palmBasis: shape.palmBasis,
    pointing,
    pointingEvidence,
    intentEvidence,
    posture,
    depthDominant: index.depthDominant,
    offImageFingerSupport: false,
    insufficientFingerEvidence: false,
    projectedContraryFingerCount: others.length,
    palmFacing: shape.palmBasis === "UNAVAILABLE" ? null : shape.palmFacing,
    depthEvidence: "MONOCULAR_INFERRED" as const,
    landmarkQuality: validCount >= 16 ? ("TRACKED" as const) : ("PARTIAL" as const),
  };
}
