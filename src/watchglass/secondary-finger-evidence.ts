import { cosine, handGeometry, subtract } from "./hand-geometry";
import { indexGeometry } from "./index-geometry";

/** Existing observed-projection and direction budgets, shared by gesture consumers. */
export const observedSecondaryFingerPolicy = {
  version: 2,
  minimumBonePixels: 3,
  minimumReachPixels: 12,
  minimumProjectionRatio: 0.5,
  minimumProjectedStraightness: 0.85,
  minimumTipSeparationPixels: 8,
  minimumPalmForwardAlignment: 0.2,
  minimumDepthIndexAlignment: 0.8,
  minimumParallelIndexAlignment: 0.85,
  bones: {
    minimumLength: 0.001,
    minimumMiddleProximalRatio: 0.22,
    maximumMiddleProximalRatio: 1.4,
    minimumDistalProximalRatio: 0.18,
    maximumDistalProximalRatio: 1.2,
  },
  forwardBasis: "OBSERVED_WRIST_OR_KNUCKLE_ARCH",
  uncertainty: "CURRENT_COMPLETE_POTENTIAL_NEGATIVE_WITHOUT_PROJECTED_FORWARD_SUPPORT_PAUSES_WITHOUT_VETO",
  directionConflict: "PROJECTED_PARALLEL_INDEX_AND_SECONDARY_CHAINS_WITH_OPPOSING_PALM_DIRECTION_ARE_UNCERTAIN",
} as const;

/** Current model evidence only; inferred depth and straightness do not prove visibility or intent. */
export function observedSecondaryFingers(
  shape: ReturnType<typeof handGeometry>,
  index: ReturnType<typeof indexGeometry>,
  pixelWidth: number,
) {
  const p = observedSecondaryFingerPolicy;
  const independentForward =
    (shape.palmBasis === "WRIST" || shape.palmBasis === "KNUCKLE_ARCH") &&
    [shape.forward.x, shape.forward.y, shape.forward.z].every(Number.isFinite) &&
    Math.hypot(shape.forward.x, shape.forward.y, shape.forward.z) > 1e-9;
  return [9, 13, 17].flatMap((base) => {
    // Auxiliary off-image estimates cannot supply contrary evidence.
    const finger = shape.finger(base);
    if (!finger) return [];
    if (
      !finger.lengths.every((length) => Number.isFinite(length) && length >= p.bones.minimumLength) ||
      finger.lengths[1] < finger.lengths[0] * p.bones.minimumMiddleProximalRatio ||
      finger.lengths[1] > finger.lengths[0] * p.bones.maximumMiddleProximalRatio ||
      finger.lengths[2] < finger.lengths[0] * p.bones.minimumDistalProximalRatio ||
      finger.lengths[2] > finger.lengths[0] * p.bones.maximumDistalProximalRatio
    )
      return [];
    const joints = [base, base + 1, base + 2, base + 3].map((id) => shape.points[id]);
    const lengths = joints.slice(1).map((point, i) => {
      const bone = subtract(point, joints[i]);
      return Math.hypot(bone.x, bone.y);
    });
    const projectedChain = lengths.reduce((sum, length) => sum + length, 0);
    const projectedReach = Math.hypot(finger.axis.x, finger.axis.y);
    const projectedCoherent =
      lengths.every((length) => length >= p.minimumBonePixels / pixelWidth) &&
      projectedReach >= p.minimumReachPixels / pixelWidth &&
      projectedReach / Math.max(1e-9, finger.chain) >= p.minimumProjectionRatio &&
      projectedReach / Math.max(1e-9, projectedChain) >= p.minimumProjectedStraightness &&
      Math.hypot(joints[3].x - shape.points[8].x, joints[3].y - shape.points[8].y) >=
        p.minimumTipSeparationPixels / pixelWidth;
    // Without a wrist or knuckle arch, the index cannot independently establish
    // the direction of a competing digit. Unknown is distinct from backward.
    const palmForward = independentForward && cosine(finger.axis, shape.forward) >= p.minimumPalmForwardAlignment;
    const indexAlignment = cosine(finger.axis, index.axis);
    const depthAligned = index.depthDominant && indexAlignment >= p.minimumDepthIndexAlignment;
    const directionConflict =
      independentForward &&
      !palmForward &&
      projectedCoherent &&
      Math.hypot(index.axis.x, index.axis.y) >= p.minimumReachPixels / pixelWidth &&
      indexAlignment >= p.minimumParallelIndexAlignment;
    // A questionable wrist/arch must not erase clearly observed parallel digit
    // evidence. Conflicting directions pause; neither side supplies a veto.
    const forwardSupported = !independentForward || directionConflict ? null : palmForward || depthAligned;
    return [{ ...finger, projectedCoherent, forwardSupported }];
  });
}

/** Unsupported potential negatives pause; missing chains and known backward chains do not vote. */
export function secondaryGestureEvidence(
  fingers: ReturnType<typeof observedSecondaryFingers>,
  predicate: (finger: ReturnType<typeof observedSecondaryFingers>[number]) => boolean,
  minimumCount = 1,
) {
  const matches = fingers.filter(predicate);
  const count = matches.filter((finger) => finger.projectedCoherent && finger.forwardSupported === true).length;
  return {
    count,
    uncertain:
      count < minimumCount && matches.filter((finger) => finger.forwardSupported !== false).length >= minimumCount,
  };
}
