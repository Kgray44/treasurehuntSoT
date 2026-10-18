import type { HandInferenceBackend, HandObservation } from "./hand-observation";
export type { HandInferenceBackend } from "./hand-observation";
import { assessHand } from "./hand-posture";
import { indexGeometry } from "./index-geometry";
export const handModel = {
  providerId: "watchglass.hand-observation",
  providerVersion: "1.6.0",
  modelId: "mediapipe.hand-landmarker.float16",
  modelVersion: "1",
  modelDigest: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  runtimeVersion: "0.10.32",
  preferredBackend: "GPU_WEBGL",
  supportedBackends: ["CPU_WASM", "GPU_WEBGL"],
  maxHands: 2,
} as const;
export type HandInferencePolicy = "ORIGINAL_CPU" | "WATCHGLASS_ACTUAL_ROI_RECOVERY_V1";
/** Device-independent startup policy. Live observation/inference deadlines are separate. */
export const handStartupPolicy = Object.freeze({ version: 1, totalMs: 15000, optionalAccelerationMs: 12000 });
export const handProviderVersion = (policy: HandInferencePolicy) =>
  policy === "ORIGINAL_CPU" ? handModel.providerVersion : `${handModel.providerVersion}+actual-roi-v1`;
type Landmark = { x: number; y: number; z: number };
export type HandResult = { landmarks: Landmark[][]; handedness: { categoryName: string; score: number }[][] };
type IndexCenter = { x: number; y: number };
type IndexCapture = { center: IndexCenter; at: number; inferredSpan: number };
type IndexSnapshot = (IndexCenter | null)[];
type PalmSnapshot = { points: { x: number; y: number; z: number }[]; span: number };
type PalmCapture = { shape: PalmSnapshot; at: number; width: number; height: number };
type Track = {
  id: number;
  center: IndexCenter;
  index: IndexSnapshot;
  at: number;
  scale: number | null;
  recent: IndexCapture[];
  established: boolean;
  palm: PalmCapture | null;
  /** Same-capture partner of index; frozen with it throughout palm quarantine. */
  indexPalm: PalmCapture | null;
  palmOnly: boolean;
};
type ObservedHand = HandObservation["hands"][number];
const associationIndices = [5, 6, 7, 8] as const;
/** Observed MCP geometry only; this policy neither detects nor qualifies pointing. */
export const observedPalmContinuityPolicy = Object.freeze({
  version: 3,
  minimumSpan: 0.035,
  maximumSpan: 0.65,
  minimumAlong: 0.05,
  maximumAlong: 0.95,
  minimumRowSeparation: 0.05,
  maximumArchRatio: 0.65,
  maximumGapMs: 200,
  maximumTranslation: 0.14,
  maximumScaleRatio: 1.2,
  maximumShapeRatio: 1.2,
  minimumProjectedPalmSpreadPixels: 1,
  maximumTransportResidualRatio: 0.2,
  rejoin:
    "PROPER_OBSERVED_PALM_SIMILARITY_TRANSPORTS_FIXED_SAME_CAPTURE_INDEX_REFERENCE_ALL_JOINT_ABSOLUTE_AND_PROJECTED_CHAIN_RELATIVE_RESIDUALS_NO_DEGENERATE_OR_REFLECTED_REPROOF",
});
function observedPalm(hand: ObservedHand, aspect: number): PalmSnapshot | null {
  if (!Number.isFinite(aspect) || aspect <= 0 || ![5, 9, 13, 17].every((i) => hand.landmarks[i].valid)) return null;
  const origin = hand.landmarks[5];
  const points = [5, 9, 13, 17].map((i) => ({
    x: hand.landmarks[i].x,
    y: hand.landmarks[i].y * aspect,
    z: hand.landmarks[i].z - origin.z,
  }));
  const across = { x: points[3].x - origin.x, y: points[3].y - points[0].y, z: points[3].z };
  const span = Math.hypot(across.x, across.y, across.z),
    p = observedPalmContinuityPolicy;
  if (!Number.isFinite(span) || span < p.minimumSpan || span > p.maximumSpan) return null;
  const row = points.slice(1, 3).map((point) => {
    const relative = { x: point.x - origin.x, y: point.y - points[0].y, z: point.z };
    const along = (relative.x * across.x + relative.y * across.y + relative.z * across.z) / span ** 2;
    return {
      along,
      arch:
        Math.hypot(relative.x - along * across.x, relative.y - along * across.y, relative.z - along * across.z) / span,
    };
  });
  return row.every(
    (point) => point.along >= p.minimumAlong && point.along <= p.maximumAlong && point.arch <= p.maximumArchRatio,
  ) && row[1].along - row[0].along >= p.minimumRowSeparation
    ? { points, span }
    : null;
}
function palmContinues(current: PalmSnapshot, previous: PalmCapture, at: number, width: number, height: number) {
  const p = observedPalmContinuityPolicy;
  if (previous.width !== width || previous.height !== height || at - previous.at > p.maximumGapMs) return false;
  if (Math.max(current.span, previous.shape.span) / Math.min(current.span, previous.shape.span) > p.maximumScaleRatio)
    return false;
  const dx = current.points.reduce((sum, point, i) => sum + point.x - previous.shape.points[i].x, 0) / 4;
  const dy = current.points.reduce((sum, point, i) => sum + point.y - previous.shape.points[i].y, 0) / 4;
  if (Math.hypot(dx, dy) > p.maximumTranslation) return false;
  for (let i = 0; i < 4; ++i)
    for (let j = i + 1; j < 4; ++j) {
      const distance = (shape: PalmSnapshot) =>
        Math.hypot(
          shape.points[i].x - shape.points[j].x,
          shape.points[i].y - shape.points[j].y,
          shape.points[i].z - shape.points[j].z,
        ) / shape.span;
      const lengths = [distance(current), distance(previous.shape)];
      if (Math.min(...lengths) <= 0 || Math.max(...lengths) / Math.min(...lengths) > p.maximumShapeRatio) return false;
    }
  return true;
}
const handBones = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;
const indexCenter = (hand: ObservedHand) => {
  // The same observed index chain remains the reference when the rest of the
  // hand enters or leaves view. No inferred palm or missing joint is invented.
  const visible = associationIndices.map((i) => hand.landmarks[i]);
  return {
    x: visible.reduce((sum, p) => sum + p.x, 0) / visible.length,
    y: visible.reduce((sum, p) => sum + p.y, 0) / visible.length,
  };
};
const observedIndex = (hand: ObservedHand): IndexSnapshot =>
  associationIndices.map((i) => (hand.landmarks[i].valid ? { x: hand.landmarks[i].x, y: hand.landmarks[i].y } : null));
function indexDisplacement(current: IndexSnapshot, previous: IndexSnapshot) {
  const common = [0, 1, 2, 3].filter((i) => current[i] && previous[i]);
  if (common.length < 3) return Infinity;
  return Math.hypot(
    common.reduce((sum, i) => sum + current[i]!.x - previous[i]!.x, 0) / common.length,
    common.reduce((sum, i) => sum + current[i]!.y - previous[i]!.y, 0) / common.length,
  );
}
function indexChain(hand: ObservedHand, aspect: number): number | null {
  if (!associationIndices.every((i) => hand.landmarks[i].valid)) return null;
  return [5, 6, 7].reduce((sum, i) => {
    const a = hand.landmarks[i],
      b = hand.landmarks[i + 1];
    return sum + Math.hypot(b.x - a.x, (b.y - a.y) * aspect, b.z - a.z);
  }, 0);
}
function palmTransportedIndex(track: Track, palm: PalmSnapshot, width: number, height: number) {
  const reference = track.indexPalm,
    p = observedPalmContinuityPolicy;
  if (
    !reference ||
    reference.width !== width ||
    reference.height !== height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    track.scale === null ||
    !track.index.every((point) => point !== null)
  )
    return null;
  const center = (shape: PalmSnapshot) => ({
    x: shape.points.reduce((sum, point) => sum + point.x, 0) / 4,
    y: shape.points.reduce((sum, point) => sum + point.y, 0) / 4,
  });
  const oldCenter = center(reference.shape),
    currentCenter = center(palm);
  let spread = 0,
    currentSpread = 0,
    dot = 0,
    cross = 0;
  for (let i = 0; i < 4; i++) {
    const x = reference.shape.points[i].x - oldCenter.x,
      y = reference.shape.points[i].y - oldCenter.y;
    const xx = palm.points[i].x - currentCenter.x,
      yy = palm.points[i].y - currentCenter.y;
    spread += x * x + y * y;
    currentSpread += xx * xx + yy * yy;
    dot += x * xx + y * yy;
    cross += x * yy - y * xx;
  }
  const oldRms = Math.sqrt(spread / 4),
    currentRms = Math.sqrt(currentSpread / 4);
  if (oldRms * width < p.minimumProjectedPalmSpreadPixels || currentRms * width < p.minimumProjectedPalmSpreadPixels)
    return null;
  const a = dot / spread,
    b = cross / spread,
    scale = Math.hypot(a, b);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  // The proper similarity has positive determinant. Current index guesses
  // never participate in its fit; a reflected/nonrigid palm must fit on its
  // own or remain identity-only. A nonzero row area is not required.
  const transport = (point: IndexCenter) => ({
    x: currentCenter.x + a * (point.x - oldCenter.x) - b * (point.y - oldCenter.y),
    y: currentCenter.y + b * (point.x - oldCenter.x) + a * (point.y - oldCenter.y),
  });
  if (
    reference.shape.points.some((point, i) => {
      const predicted = transport(point);
      return (
        Math.hypot(predicted.x - palm.points[i].x, predicted.y - palm.points[i].y) >
        p.maximumTransportResidualRatio * currentRms
      );
    })
  )
    return null;
  const aspect = height / width;
  const index = track.index.map((point) => {
    const predicted = transport({ x: point!.x, y: point!.y * aspect });
    return { x: predicted.x, y: predicted.y / aspect };
  });
  const projectedChain = index
    .slice(1)
    .reduce((sum, point, i) => sum + Math.hypot(point.x - index[i].x, (point.y - index[i].y) * aspect), 0);
  return { index, projectedChain, span: (track.scale * palm.span) / reference.shape.span };
}
function palmIndexRejoinCost(
  current: IndexSnapshot,
  span: number | null,
  track: Track,
  palm: PalmSnapshot | null,
  capture: number,
  width: number,
  height: number,
) {
  const p = observedPalmContinuityPolicy;
  if (!track.palm || !palm || span === null || !palmContinues(palm, track.palm, capture, width, height))
    return Infinity;
  const predicted = palmTransportedIndex(track, palm, width, height);
  if (
    !predicted ||
    Math.min(span, predicted.span) <= 0 ||
    !Number.isFinite(predicted.projectedChain) ||
    predicted.projectedChain <= 0 ||
    Math.max(span, predicted.span) / Math.min(span, predicted.span) > p.maximumScaleRatio ||
    current.some(
      (joint, i) =>
        joint === null ||
        Math.hypot(joint.x - predicted.index[i].x, joint.y - predicted.index[i].y) > p.maximumTranslation ||
        Math.hypot(joint.x - predicted.index[i].x, ((joint.y - predicted.index[i].y) * height) / width) >
          p.maximumTransportResidualRatio * predicted.projectedChain,
    )
  )
    return Infinity;
  return indexDisplacement(current, predicted.index) + Math.abs(span - predicted.span) * 0.25;
}
/** Suppress only near-identical visible hypotheses, never infer identity from handedness. */
function duplicateHypotheses(a: ObservedHand, b: ObservedHand, aspect: number) {
  // These scores describe handedness classification, not presence, tracking,
  // posture, or confidence that two physical hands are the same hand.
  if (
    a.handedness === "UNKNOWN" ||
    a.handedness !== b.handedness ||
    a.handednessConfidence === null ||
    b.handednessConfidence === null ||
    a.handednessConfidence < 0.8 ||
    b.handednessConfidence < 0.8 ||
    a.landmarks.some((p, i) => i !== 0 && p.valid !== b.landmarks[i].valid) ||
    ![5, 6, 7, 8, 9, 17].every((i) => a.landmarks[i].valid)
  )
    return false;
  const visible = a.landmarks.flatMap((p, i) => (p.valid && b.landmarks[i].valid ? [i] : []));
  if (visible.length < 15) return false;
  const points = [a, b].map((hand) =>
    hand.landmarks.map((p) => ({ x: p.x, y: p.y * aspect, z: p.z - hand.landmarks[5].z })),
  );
  const spans = points.map((hand) => Math.hypot(hand[5].x - hand[17].x, hand[5].y - hand[17].y));
  const span = (spans[0] + spans[1]) / 2;
  if (Math.min(...spans) < 0.025 || Math.abs(spans[0] - spans[1]) / span > 0.05) return false;
  const centers = [indexCenter(a), indexCenter(b)];
  if (Math.hypot(centers[0].x - centers[1].x, (centers[0].y - centers[1].y) * aspect) / span > 0.06) return false;
  const xyErrors = visible.map(
    (i) => Math.hypot(points[0][i].x - points[1][i].x, points[0][i].y - points[1][i].y) / span,
  );
  const zErrors = visible.map((i) => Math.abs(points[0][i].z - points[1][i].z) / span);
  const rms = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
  if (Math.max(...xyErrors) > 0.08 || rms(xyErrors) > 0.04 || Math.max(...zErrors) > 0.12 || rms(zErrors) > 0.06)
    return false;
  const visibleBones = handBones.filter(
    ([base, tip]) =>
      a.landmarks[base].valid && a.landmarks[tip].valid && b.landmarks[base].valid && b.landmarks[tip].valid,
  );
  if (visibleBones.length < 10) return false;
  return visibleBones.every(([base, tip]) => {
    const vectors = points.map((hand) => ({
      x: hand[tip].x - hand[base].x,
      y: hand[tip].y - hand[base].y,
      z: hand[tip].z - hand[base].z,
    }));
    const lengths = vectors.map((v) => Math.hypot(v.x, v.y, v.z));
    return (
      Math.hypot(vectors[0].x - vectors[1].x, vectors[0].y - vectors[1].y, vectors[0].z - vectors[1].z) / span <=
        0.05 && Math.abs(lengths[0] - lengths[1]) / Math.max(span * 0.1, ...lengths) <= 0.1
    );
  });
}
function preferredHypothesis(a: ObservedHand, b: ObservedHand, prior?: Track) {
  if (prior) {
    const centers = [indexCenter(a), indexCenter(b)];
    const distances = centers.map((center) => Math.hypot(center.x - prior.center.x, center.y - prior.center.y));
    if (Math.abs(distances[0] - distances[1]) > 1e-9) return distances[0] < distances[1] ? 0 : 1;
  }
  const validCounts = [a, b].map((hand) => hand.landmarks.filter((p) => p.valid).length);
  if (validCounts[0] !== validCounts[1]) return validCounts[0] > validCounts[1] ? 0 : 1;
  // Keep ties independent of provider array order or fabricated probabilities.
  for (let i = 0; i < 21; i++)
    if (a.landmarks[i].valid)
      for (const axis of ["x", "y", "z"] as const) {
        const difference = a.landmarks[i][axis] - b.landmarks[i][axis];
        if (difference !== 0) return difference < 0 ? 0 : 1;
      }
  return 0;
}
const motionContinuity = {
  maximumGapMs: 200,
  maximumSpeed: 4,
  maximumStep: 0.24,
  maximumPredictionError: 0.07,
  maximumScaleRatio: 1.2,
} as const;
/** A bounded recovery opportunity, never evidence of identity while a hand is absent. */
export const HAND_CONTINUITY_GRACE_MS = 1200;
/** Local spatial continuity only. Crossings and long gaps create a new generation, never biometric identity. */
export class BrowserHandAdapter {
  private sequence = 0;
  private generation = 0;
  private tracks: Track[] = [];
  private capture = -Infinity;
  constructor(
    private binding: Pick<
      HandObservation,
      "providerGeneration" | "cameraLeaseId" | "cameraFrameVersion" | "mirrorTransform"
    >,
    private tier: HandObservation["evidenceTier"] = "UNQUALIFIED",
    private readonly backend: HandInferenceBackend = "CPU_WASM",
    private readonly policy: HandInferencePolicy = "ORIGINAL_CPU",
  ) {}
  envelope(
    result: HandResult,
    capture: number,
    inference: number,
    width: number,
    height: number,
    acceptCapture?: (observation?: HandObservation) => boolean,
  ): HandObservation {
    if (!Number.isFinite(capture) || !Number.isFinite(inference) || capture <= this.capture || inference < capture)
      throw new Error("HAND_PROVIDER_CLOCK_INVALID");
    if (acceptCapture && !acceptCapture()) throw new Error("HAND_PROVIDER_CAPTURE_REJECTED");
    let generation = this.generation;
    const eligibleTracks = this.tracks.filter((t) => capture - t.at <= HAND_CONTINUITY_GRACE_MS);
    const hands = result.landmarks.slice(0, 2).map((points, i) => {
      const landmarks = Array.from({ length: 21 }, (_, j) => {
        const p = points[j];
        const valid = !!p && [p.x, p.y, p.z].every(Number.isFinite) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
        return { x: valid ? p.x : 0, y: valid ? p.y : 0, z: valid ? p.z : 0, valid };
      });
      // Keep bounded raw inference for secondary-finger posture assessment only.
      // It never makes an out-of-image point observed, or rescues index/core
      // geometry used by tracking, calibration, and pointing features.
      const offImageFingerLandmarks = [10, 11, 12, 13, 14, 15, 16, 18, 19, 20].flatMap((index) => {
        const point = points[index];
        return point &&
          [point.x, point.y, point.z].every(Number.isFinite) &&
          point.x >= -0.15 &&
          point.x <= 1.15 &&
          point.y >= -0.15 &&
          point.y <= 1.15 &&
          (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)
          ? [{ index, x: point.x, y: point.y, z: point.z }]
          : [];
      });
      const category = result.handedness[i]?.[0];
      return {
        trackId: "pending",
        trackGeneration: 1,
        continuity: "ACQUIRED" as "ACQUIRED" | "CONTINUOUS" | "AMBIGUOUS",
        handedness:
          category?.categoryName === "Left"
            ? ("LEFT" as const)
            : category?.categoryName === "Right"
              ? ("RIGHT" as const)
              : ("UNKNOWN" as const),
        handednessConfidence:
          Number.isFinite(category?.score) && category.score >= 0 && category.score <= 1 ? category.score : null,
        coordinateFrame: "CAMERA_IMAGE_NORMALIZED" as const,
        associationBasis: "INDEX_CHAIN_V1" as NonNullable<ObservedHand["associationBasis"]>,
        landmarks,
        ...(offImageFingerLandmarks.length ? { offImageFingerLandmarks } : {}),
        presenceScore: null,
        trackingScore: null,
        occluded: false,
        pose: "UNKNOWN" as "POINT_CANDIDATE" | "UNKNOWN",
        uncertainty: null,
      };
    });
    // Known separate tracks remain unresolved overlap. Otherwise only stringent
    // observed-pose agreement can suppress a duplicated model hypothesis.
    if (hands.length === 2 && eligibleTracks.length <= 1 && duplicateHypotheses(hands[0], hands[1], height / width)) {
      const preferred = preferredHypothesis(hands[0], hands[1], eligibleTracks[0]);
      hands.splice(preferred === 0 ? 1 : 0, 1);
    }
    const inferredSpans = hands.map((h) => indexChain(h, height / width));
    const reliableIndex = hands.map(
      (h, i) =>
        indexGeometry(h, { frameWidth: width, frameHeight: height }).geometry &&
        inferredSpans[i] !== null &&
        inferredSpans[i]! >= 0.012 &&
        inferredSpans[i]! <= 1,
    );
    const indices = hands.map(observedIndex);
    const palms = hands.map((hand) => observedPalm(hand, height / width));
    const centers = hands.map((h, i) => {
      if (reliableIndex[i]) return indexCenter(h);
      const index = associationIndices.map((j) => h.landmarks[j]).filter((p) => p.valid);
      // Four present but malformed joints must never masquerade as a partial
      // chain. Three actual joints can confirm an incumbent only when they
      // retain nondegenerate 3D structure; end-on XY overlap is still allowed.
      if (index.length !== 3) return null;
      const segments = index.slice(1).map((point, j) => {
        const prior = index[j];
        return Math.hypot(point.x - prior.x, ((point.y - prior.y) * height) / width, point.z - prior.z);
      });
      const partialChain = segments.reduce((sum, segment) => sum + segment, 0);
      if (segments.some((segment) => segment < 0.001) || partialChain < 0.006 || partialChain > 1) return null;
      return {
        x: index.reduce((s, p) => s + p.x, 0) / index.length,
        y: index.reduce((s, p) => s + p.y, 0) / index.length,
      };
    });
    // The fixed observed index reference is independent of pointing intent.
    // Its inferred 3D chain scale is not shortened by end-on projection.
    const scales = inferredSpans;
    // Keep the last observed location briefly through an occlusion. The record's
    // timestamp is not refreshed until a hand passes the existing spatial match.
    // Ambiguous output is never evidence that a retained record was observed.
    const costs = centers.map((center, i) =>
      eligibleTracks.map((t) =>
        !center
          ? Infinity
          : t.palmOnly
            ? reliableIndex[i]
              ? palmIndexRejoinCost(indices[i], scales[i], t, palms[i], capture, width, height)
              : Infinity
            : indexDisplacement(indices[i], t.index) +
              (scales[i] !== null && t.scale !== null ? Math.abs(scales[i]! - t.scale) * 0.25 : 0),
      ),
    );
    // Recent coherent motion can cross the static association radius between
    // frames. Extrapolation is deliberately short, capped, and available only
    // from two observed index-chain references; it is not identity evidence after loss.
    const predictedCosts = centers.map((center, i) =>
      eligibleTracks.map((track) => {
        if (!center || !reliableIndex[i] || track.palmOnly || track.recent.length !== 2) return Infinity;
        const [previous, last] = track.recent;
        const historyMs = last.at - previous.at,
          gapMs = capture - last.at;
        // An extrapolated position cannot compensate for a sudden anatomical
        // scale change. Require coherent observed palm spans across the whole
        // short history; ordinary spatial matching remains unchanged.
        const spans = [previous.inferredSpan, last.inferredSpan, inferredSpans[i]!];
        const step = Math.hypot(center.x - track.center.x, center.y - track.center.y);
        if (
          historyMs <= 0 ||
          historyMs > motionContinuity.maximumGapMs ||
          gapMs <= 0 ||
          gapMs > motionContinuity.maximumGapMs ||
          step > motionContinuity.maximumStep ||
          Math.min(...spans) < 0.012 ||
          Math.max(...spans) / Math.min(...spans) > motionContinuity.maximumScaleRatio
        )
          return Infinity;
        const vx = ((last.center.x - previous.center.x) * 1000) / historyMs,
          vy = ((last.center.y - previous.center.y) * 1000) / historyMs;
        const speed = Math.hypot(vx, vy);
        const cap = speed > motionContinuity.maximumSpeed ? motionContinuity.maximumSpeed / speed : 1;
        const predictionError = Math.hypot(
          center.x - (last.center.x + (vx * cap * gapMs) / 1000),
          center.y - (last.center.y + (vy * cap * gapMs) / 1000),
        );
        if (predictionError > motionContinuity.maximumPredictionError) return Infinity;
        return (
          predictionError + (scales[i] !== null && track.scale !== null ? Math.abs(scales[i]! - track.scale) * 0.25 : 0)
        );
      }),
    );
    // Even a malformed hypothesis can make an overlapping observation
    // ambiguous. These means are used only to abstain; they never associate a
    // track, supply prediction history or refresh an incumbent's timestamp.
    const overlapCenters = hands.map((hand) => {
      const visible = associationIndices.map((index) => hand.landmarks[index]).filter((point) => point.valid);
      return visible.length >= 3
        ? {
            x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
            y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length,
          }
        : null;
    });
    const crossing =
      overlapCenters.length === 2 &&
      overlapCenters[0] &&
      overlapCenters[1] &&
      Math.hypot(overlapCenters[0].x - overlapCenters[1].x, overlapCenters[0].y - overlapCenters[1].y) < 0.09;
    const assignments = costs.map((row, i) => {
      let ranked = row.map((cost, index) => ({ cost, index })).sort((a, b) => a.cost - b.cost);
      // Preserve ordinary spatial association and its existing ambiguity gate.
      // Prediction extends an unmatched trajectory; it cannot break a raw tie.
      if (!ranked.length || ranked[0].cost > 0.14)
        ranked = predictedCosts[i].map((cost, index) => ({ cost, index })).sort((a, b) => a.cost - b.cost);
      if (!ranked.length || ranked[0].cost > 0.14) return -1;
      if (ranked[1] && ranked[1].cost - ranked[0].cost < 0.035) return -2;
      return ranked[0].index;
    });
    // A qualified palm may only continue one already known hand. It never
    // creates a cold malformed track, breaks a tie or resolves two hands.
    // A palm fallback never replaces the index reference, including when a
    // newly plausible model chain is present. Rejoin requires a separate
    // ordinary index match plus a current coherent palm above.
    let palmAssignment = -1;
    if (hands.length === 1 && eligibleTracks.length === 1 && assignments[0] === -1) {
      const prior = eligibleTracks[0];
      if (prior.established && prior.palm && palms[0] && palmContinues(palms[0], prior.palm, capture, width, height)) {
        assignments[0] = 0;
        palmAssignment = 0;
      }
    }
    const collision = assignments.length === 2 && assignments[0] >= 0 && assignments[0] === assignments[1];
    const associationAmbiguous = !!crossing || collision || assignments.includes(-2);
    const establishedMatched = assignments.some(
      (assignment) => !associationAmbiguous && assignment >= 0 && eligibleTracks[assignment].established,
    );
    const next: Track[] = [];
    hands.forEach((hand, i) => {
      // A partial index cannot establish a new track. Three common observed
      // joints may confirm an incumbent without replacing its fixed reference.
      const palmMatched = palmAssignment === i;
      const indexMatched = reliableIndex[i] && !palmMatched;
      const ambiguous =
        associationAmbiguous || (!palmMatched && (centers[i] === null || (!reliableIndex[i] && assignments[i] < 0)));
      const prior = !ambiguous && assignments[i] >= 0 ? eligibleTracks[assignments[i]] : null;
      const id = prior?.id ?? ++generation;
      hand.trackId = `local-${id}`;
      hand.trackGeneration = id;
      hand.continuity = ambiguous ? "AMBIGUOUS" : prior ? "CONTINUOUS" : "ACQUIRED";
      if (palmMatched) hand.associationBasis = "OBSERVED_PALM_CONTINUITY_V1";
      const assessment = assessHand(hand, { frameWidth: width, frameHeight: height });
      hand.occluded = !assessment.requiredValid;
      hand.pose = assessment.pointing ? "POINT_CANDIDATE" : "UNKNOWN";
      if ((centers[i] || palmMatched) && !ambiguous)
        next.push({
          id,
          center: indexMatched ? centers[i]! : prior!.center,
          index: indexMatched ? indices[i] : prior!.index,
          at: capture,
          scale: indexMatched ? (scales[i] ?? prior?.scale ?? null) : prior!.scale,
          // A second hypothesis beside an existing hand must be observed again
          // unambiguously before it can survive absence and compete later.
          // This is temporal association evidence, never model confidence.
          established: prior ? prior.established || reliableIndex[i] : !establishedMatched,
          palm: palms[i] ? { shape: palms[i]!, at: capture, width, height } : (prior?.palm ?? null),
          indexPalm: indexMatched
            ? palms[i]
              ? { shape: palms[i]!, at: capture, width, height }
              : null
            : prior!.indexPalm,
          palmOnly: indexMatched ? false : palmMatched || (prior?.palmOnly ?? false),
          recent: palmMatched
            ? prior!.recent
            : indexMatched
              ? [
                  ...(prior?.recent.filter((sample) => capture - sample.at <= motionContinuity.maximumGapMs) ?? []),
                  { center: centers[i]!, at: capture, inferredSpan: inferredSpans[i]! },
                ].slice(-2)
              : [],
        });
    });
    // A temporary extra hypothesis cannot erase a lone established history.
    // Retain its last reliable location/time, never the ambiguous hypotheses;
    // reacquisition still needs the ordinary spatial gate within the same grace.
    // Crossing or a tie between two established histories remains irreversible.
    const retainEstablished = !associationAmbiguous || eligibleTracks.filter((track) => track.established).length === 1;
    const nextTracks = [
      ...next,
      ...eligibleTracks
        .filter((track) => retainEstablished && track.established && !next.some((matched) => matched.id === track.id))
        .map((track) => ({ ...track, recent: [] })),
    ];
    const rawTracked = hands.some((h) => assessHand(h, { frameWidth: width, frameHeight: height }).validCount >= 16);
    const observation: HandObservation = {
      observationVersion: 1,
      ...this.binding,
      providerId: handModel.providerId,
      providerVersion: handProviderVersion(this.policy),
      modelId: handModel.modelId,
      modelVersion: handModel.modelVersion,
      modelDigest: handModel.modelDigest,
      inferenceBackend: this.backend,
      observationId: `observation-${this.sequence}`,
      sequence: this.sequence,
      monotonicCaptureTime: capture,
      monotonicInferenceTime: inference,
      frameWidth: width,
      frameHeight: height,
      orientation: 0,
      evidenceTier: this.tier,
      hands,
      quality: rawTracked ? "USABLE" : "LOW",
      reason: !hands.length
        ? "NO_HAND"
        : hands.length > 1
          ? "MULTIPLE_HANDS"
          : !assessHand(hands[0], { frameWidth: width, frameHeight: height }).framed
            ? "LOW_VISIBILITY"
            : "NONE",
    };
    // Association state is evidence too. Rejected or processing-expired pixels
    // cannot renew a hand's history merely because no observation was published.
    if (acceptCapture && !acceptCapture(observation)) throw new Error("HAND_PROVIDER_CAPTURE_REJECTED");
    this.capture = capture;
    this.generation = generation;
    this.tracks = nextTracks;
    ++this.sequence;
    return observation;
  }
}
