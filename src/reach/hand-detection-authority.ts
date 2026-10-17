import type { HandObservation } from "@/watchglass/hand-observation";
import { cosine, dot, handGeometry, subtract, vectorLength } from "@/watchglass/hand-geometry";
import { indexGeometry } from "@/watchglass/index-geometry";
import { assessHand } from "@/watchglass/hand-posture";
import type { Point } from "./coordinates";
import type { IndexModelAnchor } from "./index-image-tracker";

/** Observed model geometry thresholds; none are probabilities or world measurements. */
export const fullHandDetectionPolicy = {
  palm: {
    minimumSpan: 0.035,
    maximumSpan: 0.65,
    minimumAlong: 0.05,
    maximumAlong: 0.95,
    minimumRowSeparation: 0.05,
    maximumArchRatio: 0.65,
  },
  fingers: {
    minimumComplete: 2,
    minimumChainPalmRatio: 0.45,
    maximumChainPalmRatio: 3.5,
    minimumBonePalmRatio: 0.04,
    maximumBonePalmRatio: 1.5,
    minimumBone: 0.001,
    minimumMiddleProximalRatio: 0.22,
    maximumMiddleProximalRatio: 1.4,
    minimumDistalProximalRatio: 0.18,
    maximumDistalProximalRatio: 1.2,
  },
  index: {
    minimumProximalPalmRatio: 0.1,
    minimumDistalPalmRatio: 0.055,
    minimumStraightness: 0.78,
    minimumPipAlignment: 0.2,
    minimumDipAlignment: 0,
  },
  open: { minimumStraightness: 0.93, minimumPipAlignment: 0.7, minimumDipAlignment: 0.7, minimumCount: 2 },
  similar: { straightnessTolerance: 0.1, minimumPipAlignment: 0.3, minimumDipAlignment: 0.3, minimumCount: 2 },
  competing: {
    minimumStraightness: 0.96,
    minimumPipAlignment: 0.85,
    minimumDipAlignment: 0.85,
    minimumIndexAlignment: 0.35,
  },
  pinchPalmRatio: 0.18,
} as const;

export type FullHandDecision = {
  decision: "FULL_POINT" | "FULL_CONTRARY" | "FULL_AMBIGUOUS" | "UNAVAILABLE";
  indexPoint: Point | null;
  sourceKey: string | null;
};
type Observation = Pick<HandObservation, "hands" | "frameWidth" | "frameHeight"> &
  Partial<
    Pick<
      HandObservation,
      | "providerId"
      | "providerVersion"
      | "modelDigest"
      | "providerGeneration"
      | "cameraLeaseId"
      | "cameraFrameVersion"
      | "mirrorTransform"
      | "orientation"
    >
  >;
type Hand = HandObservation["hands"][number];
const observed = (hand: Hand, id: number) => {
  const p = hand.landmarks[id];
  return !!p?.valid && [p.x, p.y, p.z].every(Number.isFinite) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
};
function fullCandidate(hand: Hand, frame: Observation) {
  // A count of in-bounds joints is insufficient: require a plausible observed
  // knuckle row and two complete other fingers. Off-image estimates never count.
  if (![5, 9, 13, 17].every((id) => observed(hand, id))) return null;
  const shape = handGeometry(hand, frame),
    p = fullHandDetectionPolicy;
  if (shape.scale < p.palm.minimumSpan || shape.scale > p.palm.maximumSpan) return null;
  const across = subtract(shape.points[17], shape.points[5]);
  const row = [9, 13].map((id) => {
    const middle = subtract(shape.points[id], shape.points[5]);
    const along = dot(middle, across) / (shape.scale * shape.scale);
    const perpendicular = {
      x: middle.x - across.x * along,
      y: middle.y - across.y * along,
      z: middle.z - across.z * along,
    };
    return { along, arch: vectorLength(perpendicular) / shape.scale };
  });
  if (
    row.some(
      (joint) =>
        joint.along < p.palm.minimumAlong || joint.along > p.palm.maximumAlong || joint.arch > p.palm.maximumArchRatio,
    ) ||
    row[1].along - row[0].along < p.palm.minimumRowSeparation
  )
    return null;
  const fingers = [9, 13, 17]
    .map((base) => {
      if (![base, base + 1, base + 2, base + 3].every((id) => observed(hand, id))) return null;
      return shape.finger(base);
    })
    .filter(
      (finger) =>
        finger !== null &&
        finger.chain >= shape.scale * p.fingers.minimumChainPalmRatio &&
        finger.chain <= shape.scale * p.fingers.maximumChainPalmRatio &&
        finger.lengths.every(
          (length) =>
            length >= Math.max(p.fingers.minimumBone, shape.scale * p.fingers.minimumBonePalmRatio) &&
            length <= shape.scale * p.fingers.maximumBonePalmRatio,
        ) &&
        finger.lengths[1] >= finger.lengths[0] * p.fingers.minimumMiddleProximalRatio &&
        finger.lengths[1] <= finger.lengths[0] * p.fingers.maximumMiddleProximalRatio &&
        finger.lengths[2] >= finger.lengths[0] * p.fingers.minimumDistalProximalRatio &&
        finger.lengths[2] <= finger.lengths[0] * p.fingers.maximumDistalProximalRatio,
    )
    .filter((finger) => finger !== null);
  return fingers.length < p.fingers.minimumComplete ? null : { hand, shape, fingers };
}

/** Same-capture gesture authority only; image matching remains the coordinate source. */
export function fullHandDecision(observation: Observation | null): FullHandDecision {
  const unavailable: FullHandDecision = { decision: "UNAVAILABLE", indexPoint: null, sourceKey: null };
  if (!observation) return unavailable;
  const candidates = observation.hands
    .map((hand) => fullCandidate(hand, observation))
    .filter((value) => value !== null);
  if (!candidates.length) return unavailable;
  if (candidates.length !== 1 || candidates[0].hand.continuity === "AMBIGUOUS")
    return { decision: "FULL_AMBIGUOUS", indexPoint: null, sourceKey: null };
  const { hand, shape, fingers } = candidates[0],
    p = fullHandDetectionPolicy;
  const index = indexGeometry(hand, observation);
  const indexPoint = index.tip ? { x: index.tip.x, y: index.tip.y } : null;
  // A model track is local continuity evidence, never handedness or a point-
  // derived identity. This key stays internal to the gesture handoff policy.
  const sourceKey = JSON.stringify([
    observation.providerId ?? null,
    observation.providerVersion ?? null,
    observation.modelDigest ?? null,
    observation.providerGeneration ?? null,
    observation.cameraLeaseId ?? null,
    observation.cameraFrameVersion ?? null,
    observation.frameWidth,
    observation.frameHeight,
    observation.mirrorTransform ?? null,
    observation.orientation ?? null,
    hand.trackId,
    hand.trackGeneration,
  ]);
  if (!index.complete || !index.geometry) return { decision: "FULL_AMBIGUOUS", indexPoint, sourceKey };
  const anatomical =
    index.chain >= shape.scale * p.fingers.minimumChainPalmRatio &&
    index.chain <= shape.scale * p.fingers.maximumChainPalmRatio &&
    index.lengths[0] >= shape.scale * p.index.minimumProximalPalmRatio &&
    index.lengths.slice(1).every((length) => length >= shape.scale * p.index.minimumDistalPalmRatio);
  if (!anatomical) return { decision: "FULL_AMBIGUOUS", indexPoint, sourceKey };
  const open = fingers.filter(
    (finger) =>
      finger.straightness >= p.open.minimumStraightness &&
      finger.pipAlignment >= p.open.minimumPipAlignment &&
      finger.dipAlignment >= p.open.minimumDipAlignment,
  ).length;
  const similar = fingers.filter(
    (finger) =>
      dot(finger.axis, index.axis) / Math.max(1e-9, finger.chain * index.reach) >=
        index.straightness - p.similar.straightnessTolerance &&
      finger.pipAlignment >= p.similar.minimumPipAlignment &&
      finger.dipAlignment >= p.similar.minimumDipAlignment,
  ).length;
  const competing = fingers.some(
    (finger) =>
      finger.straightness >= p.competing.minimumStraightness &&
      finger.pipAlignment >= p.competing.minimumPipAlignment &&
      finger.dipAlignment >= p.competing.minimumDipAlignment &&
      cosine(finger.axis, index.axis) >= p.competing.minimumIndexAlignment,
  );
  const pinched =
    observed(hand, 4) && vectorLength(subtract(shape.points[4], shape.points[8])) < shape.scale * p.pinchPalmRatio;
  const extended =
    index.straightness >= p.index.minimumStraightness &&
    index.pipAlignment >= p.index.minimumPipAlignment &&
    index.dipAlignment >= p.index.minimumDipAlignment;
  return {
    decision:
      extended && open < p.open.minimumCount && similar < p.similar.minimumCount && !competing && !pinched
        ? "FULL_POINT"
        : "FULL_CONTRARY",
    indexPoint,
    sourceKey,
  };
}

/** Exact runtime arbitration, also usable by private diagnostic replay. */
export function selectIndexModelAnchor(observation: Observation | null): IndexModelAnchor | null {
  const full = fullHandDecision(observation);
  if (full.decision !== "UNAVAILABLE")
    return {
      point: full.indexPoint,
      pointing: full.decision === "FULL_POINT",
      contrary: full.decision === "FULL_CONTRARY",
      ...(full.sourceKey === null ? {} : { authoritySource: full.sourceKey }),
      authority:
        full.decision === "FULL_POINT" ? "POINT" : full.decision === "FULL_CONTRARY" ? "CONTRARY" : "AMBIGUOUS",
    };
  if (observation?.hands.length !== 1) return null;
  const hand = observation.hands[0],
    index = indexGeometry(hand, observation),
    posture = assessHand(hand, observation);
  if (hand.continuity === "AMBIGUOUS" || !index.geometry || !index.complete || !index.tip) return null;
  return {
    point: { x: index.tip.x, y: index.tip.y },
    pointing: index.extended && posture.pointing,
    contrary: !posture.pointing && posture.validCount >= 16,
  };
}
