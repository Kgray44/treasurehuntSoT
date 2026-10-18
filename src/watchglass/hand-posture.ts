import type { HandObservation } from "./hand-observation";
import { cosine, handGeometry, subtract, vectorLength, type GeometryFrame } from "./hand-geometry";
import { indexGeometry, indexLandmarks } from "./index-geometry";
import {
  observedSecondaryFingerPolicy,
  observedSecondaryFingers,
  secondaryGestureEvidence,
} from "./secondary-finger-evidence";

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
  const currentOthers = observedSecondaryFingers(shape, index, pixelWidth).filter(
    (finger) =>
      finger.chain >= index.chain * 0.35 &&
      finger.chain <= index.chain * 2.5 &&
      finger.lengths.every((length) => length >= 0.001),
  );
  const others = currentOthers.filter((finger) => finger.projectedCoherent);
  const openEvidence = secondaryGestureEvidence(
    currentOthers,
    (finger) => finger.straightness >= 0.93 && finger.pipAlignment >= 0.7 && finger.dipAlignment >= 0.7,
    2,
  );
  const similarEvidence = secondaryGestureEvidence(
    currentOthers,
    (finger) =>
      finger.straightness >= index.straightness - 0.1 &&
      cosine(finger.axis, index.axis) >= observedSecondaryFingerPolicy.minimumParallelIndexAlignment &&
      finger.pipAlignment >= 0.3 &&
      finger.dipAlignment >= 0.3,
    2,
  );
  const competingEvidence = secondaryGestureEvidence(
    currentOthers,
    (finger) =>
      finger.straightness >= 0.96 &&
      finger.pipAlignment >= 0.85 &&
      finger.dipAlignment >= 0.85 &&
      cosine(finger.axis, index.axis) >= 0.35,
  );
  const open = openEvidence.count,
    similar = similarEvidence.count,
    competing = competingEvidence.count > 0;
  const uncertainSecondary = openEvidence.uncertain || similarEvidence.uncertain || competingEvidence.uncertain;
  const pinched =
    index.complete && points[4].valid && vectorLength(subtract(shape.points[4], shape.points[8])) < index.chain * 0.12;
  const clearBent = index.anatomical && !index.extended && !index.marginal;
  const contrary = open >= 2 || similar >= 2 || competing || pinched || clearBent;
  const pointing = index.extended && !contrary && !uncertainSecondary;
  const pointingEvidence = pointing
    ? ("DISTINCT" as const)
    : index.marginal && !contrary && !uncertainSecondary
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
      : uncertainSecondary
        ? ("UNKNOWN" as const)
        : contrary
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
    contrary,
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
