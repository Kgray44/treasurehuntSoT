import type { HandObservation } from "@/watchglass/hand-observation";
import { cosine, dot, handGeometry, subtract, vectorLength } from "@/watchglass/hand-geometry";
import { indexGeometry } from "@/watchglass/index-geometry";
import { assessHand } from "@/watchglass/hand-posture";
import {
  observedSecondaryFingerPolicy,
  observedSecondaryFingers,
  secondaryGestureEvidence,
} from "@/watchglass/secondary-finger-evidence";
import type { Point } from "./coordinates";
import type { IndexModelAnchor } from "./index-image-tracker";

/** Observed model geometry thresholds; none are probabilities or world measurements. */
const minimumForwardDigitAlignment = 0.35;
export const fullHandDetectionPolicy = {
  secondaryEvidence: observedSecondaryFingerPolicy,
  uncertainGesture: "MARGINAL_INDEX_OR_UNSUPPORTED_POTENTIAL_CONTRARY_GESTURE_IS_AMBIGUOUS_NEVER_NEGATIVE",
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
    minimumBone: observedSecondaryFingerPolicy.bones.minimumLength,
    minimumMiddleProximalRatio: observedSecondaryFingerPolicy.bones.minimumMiddleProximalRatio,
    maximumMiddleProximalRatio: observedSecondaryFingerPolicy.bones.maximumMiddleProximalRatio,
    minimumDistalProximalRatio: observedSecondaryFingerPolicy.bones.minimumDistalProximalRatio,
    maximumDistalProximalRatio: observedSecondaryFingerPolicy.bones.maximumDistalProximalRatio,
  },
  index: {
    minimumProximalPalmRatio: 0.1,
    minimumDistalPalmRatio: 0.055,
    minimumStraightness: 0.78,
    minimumPipAlignment: 0.2,
    minimumDipAlignment: 0,
  },
  open: {
    minimumStraightness: 0.93,
    minimumPipAlignment: 0.7,
    minimumDipAlignment: 0.7,
    minimumCount: 2,
    minimumIndexAlignment: minimumForwardDigitAlignment,
  },
  similar: { straightnessTolerance: 0.1, minimumPipAlignment: 0.3, minimumDipAlignment: 0.3, minimumCount: 2 },
  competing: {
    minimumStraightness: 0.96,
    minimumPipAlignment: 0.85,
    minimumDipAlignment: 0.85,
    minimumIndexAlignment: minimumForwardDigitAlignment,
  },
  pinchPalmRatio: 0.18,
  imageSupport: {
    minimumObservedJoints: 12,
    minimumStructuredObservedJoints: 9,
    minimumProximalSegments: 2,
    minimumMarginAnalysisPixels: 8,
    palmMarginRatio: 0.3,
  },
} as const;

export type FullHandDecision = {
  decision: "FULL_POINT" | "FULL_CONTRARY" | "FULL_AMBIGUOUS" | "UNAVAILABLE";
  indexPoint: Point | null;
  sourceKey: string | null;
  geometry?: IndexModelAnchor["geometry"];
  identityObserved?: boolean;
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
function modelSource(observation: Observation, hand: Hand) {
  return JSON.stringify([
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
}
function observedIndexChain(hand: Hand): NonNullable<IndexModelAnchor["geometry"]>["index"] {
  const point = (id: number) => {
    const { x, y, z } = hand.landmarks[id];
    return { x, y, z };
  };
  return [point(5), point(6), point(7), point(8)];
}
function observedPalm(hand: Hand, frame: Observation) {
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
  return shape;
}
function fullCandidate(hand: Hand, frame: Observation) {
  const shape = observedPalm(hand, frame),
    p = fullHandDetectionPolicy;
  if (!shape) return null;
  const index = indexGeometry(hand, frame);
  const fingers = observedSecondaryFingers(shape, index, frame.frameWidth)
    .filter((finger) =>
      [finger.base, finger.base + 1, finger.base + 2, finger.base + 3].every((id) => observed(hand, id)),
    )
    .filter(
      (finger) =>
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
    );
  return fingers.length < p.fingers.minimumComplete ? null : { hand, shape, fingers, index };
}

/** Same-capture gesture authority and conditioned anatomy for the fused producer. */
export function fullHandDecision(observation: Observation | null): FullHandDecision {
  const unavailable: FullHandDecision = { decision: "UNAVAILABLE", indexPoint: null, sourceKey: null };
  if (!observation) return unavailable;
  const candidates = observation.hands
    .map((hand) => fullCandidate(hand, observation))
    .filter((value) => value !== null);
  if (!candidates.length) return unavailable;
  if (candidates.length !== 1 || candidates[0].hand.continuity === "AMBIGUOUS")
    return { decision: "FULL_AMBIGUOUS", indexPoint: null, sourceKey: null };
  const { hand, shape, fingers, index } = candidates[0],
    p = fullHandDetectionPolicy;
  const indexPoint = index.tip ? { x: index.tip.x, y: index.tip.y } : null;
  // A model track is local continuity evidence, never handedness or a point-
  // derived identity. This key stays internal to the gesture handoff policy.
  const sourceKey = modelSource(observation, hand);
  if (!index.complete || !index.geometry) return { decision: "FULL_AMBIGUOUS", indexPoint, sourceKey };
  const anatomical =
    index.chain >= shape.scale * p.fingers.minimumChainPalmRatio &&
    index.chain <= shape.scale * p.fingers.maximumChainPalmRatio &&
    index.lengths[0] >= shape.scale * p.index.minimumProximalPalmRatio &&
    index.lengths.slice(1).every((length) => length >= shape.scale * p.index.minimumDistalPalmRatio);
  if (!anatomical) return { decision: "FULL_AMBIGUOUS", indexPoint, sourceKey };
  const openFinger = (finger: (typeof fingers)[number]) =>
    finger.straightness >= p.open.minimumStraightness &&
    finger.pipAlignment >= p.open.minimumPipAlignment &&
    finger.dipAlignment >= p.open.minimumDipAlignment &&
    // A straight inferred chain folded back across the hand is not an open
    // finger. Reuse the competing-finger forward-direction requirement.
    cosine(finger.axis, index.axis) >= p.open.minimumIndexAlignment;
  const similarFinger = (finger: (typeof fingers)[number]) =>
    dot(finger.axis, index.axis) / Math.max(1e-9, finger.chain * index.reach) >=
      index.straightness - p.similar.straightnessTolerance &&
    finger.pipAlignment >= p.similar.minimumPipAlignment &&
    finger.dipAlignment >= p.similar.minimumDipAlignment;
  const competingFinger = (finger: (typeof fingers)[number]) =>
    finger.straightness >= p.competing.minimumStraightness &&
    finger.pipAlignment >= p.competing.minimumPipAlignment &&
    finger.dipAlignment >= p.competing.minimumDipAlignment &&
    cosine(finger.axis, index.axis) >= p.competing.minimumIndexAlignment;
  const openEvidence = secondaryGestureEvidence(fingers, openFinger, p.open.minimumCount);
  const similarEvidence = secondaryGestureEvidence(fingers, similarFinger, p.similar.minimumCount);
  const competingEvidence = secondaryGestureEvidence(fingers, competingFinger);
  const open = openEvidence.count,
    similar = similarEvidence.count,
    competing = competingEvidence.count > 0;
  // Unprojectable or directionless secondary geometry may pause whole-hand
  // authority, but is not positive evidence of a contrary gesture. A current
  // independently observed backward direction excludes that secondary claim.
  const uncertainSecondary = openEvidence.uncertain || similarEvidence.uncertain || competingEvidence.uncertain;
  const pinched =
    observed(hand, 4) && vectorLength(subtract(shape.points[4], shape.points[8])) < shape.scale * p.pinchPalmRatio;
  const extended =
    index.straightness >= p.index.minimumStraightness &&
    index.pipAlignment >= p.index.minimumPipAlignment &&
    index.dipAlignment >= p.index.minimumDipAlignment;
  const contrary = open >= p.open.minimumCount || similar >= p.similar.minimumCount || competing || pinched;
  const clearBent = !extended && !index.marginal;
  const pointing = extended && !contrary && !uncertainSecondary;
  const geometry: IndexModelAnchor["geometry"] = pointing
    ? {
        index: observedIndexChain(hand),
        palmSpan: shape.scale,
      }
    : undefined;
  return {
    decision: pointing ? "FULL_POINT" : contrary || clearBent ? "FULL_CONTRARY" : "FULL_AMBIGUOUS",
    indexPoint,
    sourceKey,
    identityObserved: true,
    ...(geometry ? { geometry } : {}),
  };
}

/** Exact runtime arbitration, also usable by private diagnostic replay. */
export function selectIndexModelAnchor(observation: Observation | null): IndexModelAnchor | null {
  const full = fullHandDecision(observation);
  const only = observation?.hands.length === 1 ? observation.hands[0] : null;
  const support = only?.continuity === "CONTINUOUS" && observation && observedPalm(only, observation);
  const points =
    support && only
      ? only.landmarks.flatMap((point, id) => (id !== 0 && observed(only, id) ? [{ x: point.x, y: point.y }] : []))
      : [];
  const indexSupport = only && observation && indexGeometry(only, observation);
  const proximalSegments =
    support && only
      ? [
          [1, 2],
          [2, 3],
          [9, 10],
          [13, 14],
          [17, 18],
        ].filter(([a, b]) => {
          if (!observed(only, a) || !observed(only, b)) return false;
          const length = vectorLength(subtract(support.points[a], support.points[b]));
          return (
            length >= fullHandDetectionPolicy.fingers.minimumBone &&
            length <= support.scale * fullHandDetectionPolicy.fingers.maximumBonePalmRatio
          );
        }).length
      : 0;
  const structuredSupport =
    indexSupport?.extended && proximalSegments >= fullHandDetectionPolicy.imageSupport.minimumProximalSegments;
  // This is a negative spatial constraint, never a hand mask or proof of a
  // selected finger. It may reject a beard/background match well outside the
  // observed hand; it cannot resolve two candidates inside the same hand.
  const region =
    support && (points.length >= fullHandDetectionPolicy.imageSupport.minimumObservedJoints || structuredSupport)
      ? {
          handRegion: {
            source: modelSource(observation!, only!),
            points,
            palmSpan: support.scale,
            structuredSupport: !!structuredSupport,
            otherFingerPoints: only!.landmarks.flatMap((point, id) =>
              ((id >= 1 && id <= 4) || id >= 9) && observed(only!, id) ? [{ x: point.x, y: point.y }] : [],
            ),
            otherFingerSegments: [1, 9, 13, 17].flatMap((base) =>
              [0, 1, 2].flatMap((offset) => {
                const a = base + offset,
                  b = a + 1;
                return observed(only!, a) && observed(only!, b)
                  ? [
                      [
                        { x: only!.landmarks[a].x, y: only!.landmarks[a].y },
                        { x: only!.landmarks[b].x, y: only!.landmarks[b].y },
                      ] as [Point, Point],
                    ]
                  : [];
              }),
            ),
          },
        }
      : {};
  const currentIdentity = (hand: Hand | undefined) =>
    hand?.continuity === "CONTINUOUS" ? { identitySource: modelSource(observation!, hand) } : {};
  const fullIdentity = full.sourceKey
    ? currentIdentity(observation?.hands.find((hand) => modelSource(observation!, hand) === full.sourceKey))
    : {};
  const currentIndex =
    only && observation && only.continuity === "CONTINUOUS" ? indexGeometry(only, observation) : null;
  const indexIdentity =
    currentIndex?.geometry && currentIndex.complete
      ? {
          indexIdentityGeometry: {
            source: modelSource(observation!, only!),
            index: observedIndexChain(only!),
            ...(only!.associationBasis ? { associationBasis: only!.associationBasis } : {}),
          },
        }
      : {};
  const indexJoints =
    only?.continuity === "CONTINUOUS" && only.associationBasis === "INDEX_CHAIN_V1"
      ? [5, 6, 7, 8]
          .filter((index) => observed(only, index))
          .map((index) => ({ index, x: only.landmarks[index].x, y: only.landmarks[index].y }))
      : [];
  const indexEvidence =
    indexJoints.length >= 3
      ? {
          indexIdentityEvidence: {
            source: modelSource(observation!, only!),
            associationBasis: "INDEX_CHAIN_V1" as const,
            joints: indexJoints,
          },
        }
      : {};
  const digitEvidence =
    only?.continuity === "CONTINUOUS"
      ? {
          otherDigitEvidence: {
            source: modelSource(observation!, only),
            points: only.landmarks.flatMap((point, id) =>
              ((id >= 1 && id <= 4) || id >= 9) && observed(only, id) ? [{ x: point.x, y: point.y }] : [],
            ),
            segments: [1, 9, 13, 17].flatMap((base) =>
              [0, 1, 2].flatMap((offset) => {
                const a = base + offset,
                  b = a + 1;
                return observed(only, a) && observed(only, b)
                  ? [
                      [
                        { x: only.landmarks[a].x, y: only.landmarks[a].y },
                        { x: only.landmarks[b].x, y: only.landmarks[b].y },
                      ] as [Point, Point],
                    ]
                  : [];
              }),
            ),
          },
        }
      : {};
  if (full.decision !== "UNAVAILABLE")
    return {
      point: full.indexPoint,
      ...fullIdentity,
      ...indexIdentity,
      ...indexEvidence,
      ...digitEvidence,
      ...region,
      pointing: full.decision === "FULL_POINT",
      contrary: full.decision === "FULL_CONTRARY",
      ...(full.sourceKey === null ? {} : { authoritySource: full.sourceKey }),
      ...(full.geometry ? { geometry: full.geometry } : {}),
      ...(full.identityObserved ? { identityObserved: true } : {}),
      authority:
        full.decision === "FULL_POINT" ? "POINT" : full.decision === "FULL_CONTRARY" ? "CONTRARY" : "AMBIGUOUS",
    };
  if (observation?.hands.length !== 1) return null;
  const hand = observation.hands[0],
    index = indexGeometry(hand, observation),
    posture = assessHand(hand, observation);
  if (hand.continuity === "AMBIGUOUS") return null;
  if (!index.geometry || !index.complete || !index.tip)
    return hand.continuity === "CONTINUOUS"
      ? {
          point: null,
          pointing: false,
          contrary: false,
          ...currentIdentity(hand),
          ...indexIdentity,
          ...indexEvidence,
          ...digitEvidence,
        }
      : null;
  const pointing = index.extended && posture.pointing;
  return {
    point: { x: index.tip.x, y: index.tip.y },
    ...currentIdentity(hand),
    ...indexIdentity,
    ...indexEvidence,
    ...digitEvidence,
    ...region,
    pointing,
    contrary: posture.contrary && posture.validCount >= 16,
    ...(pointing ? { indexCue: { source: modelSource(observation!, hand), index: observedIndexChain(hand) } } : {}),
  };
}
