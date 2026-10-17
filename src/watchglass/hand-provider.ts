import type { HandObservation } from "./hand-observation";
import { assessHand } from "./hand-posture";
export const handModel = {
  providerId: "watchglass.hand-observation",
  providerVersion: "1.2.0",
  modelId: "mediapipe.hand-landmarker.float16",
  modelVersion: "1",
  modelDigest: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  runtimeVersion: "0.10.32",
  backend: "CPU_WASM",
  maxHands: 2,
} as const;
type Landmark = { x: number; y: number; z: number };
export type HandResult = { landmarks: Landmark[][]; handedness: { categoryName: string; score: number }[][] };
type PalmCenter = { x: number; y: number };
type PalmCapture = { center: PalmCenter; at: number; inferredSpan: number };
type PalmSnapshot = (PalmCenter | null)[];
type Track = {
  id: number;
  center: PalmCenter;
  palm: PalmSnapshot;
  at: number;
  scale: number | null;
  recent: PalmCapture[];
  established: boolean;
};
type ObservedHand = HandObservation["hands"][number];
const palmIndices = [0, 5, 9, 17] as const;
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
const palmCenter = (hand: ObservedHand) => {
  // A fixed knuckle reference avoids inventing motion as an optional wrist
  // enters or leaves the camera image.
  const visible = [5, 9, 17].map((i) => hand.landmarks[i]);
  return {
    x: visible.reduce((sum, p) => sum + p.x, 0) / visible.length,
    y: visible.reduce((sum, p) => sum + p.y, 0) / visible.length,
  };
};
const observedPalm = (hand: ObservedHand): PalmSnapshot =>
  palmIndices.map((i) => (hand.landmarks[i].valid ? { x: hand.landmarks[i].x, y: hand.landmarks[i].y } : null));
function palmDisplacement(current: PalmSnapshot, previous: PalmSnapshot) {
  const core = [1, 2, 3];
  const common = core.every((i) => current[i] && previous[i])
    ? core
    : [0, 1, 2, 3].filter((i) => current[i] && previous[i]);
  if (common.length < 3) return Infinity;
  return Math.hypot(
    common.reduce((sum, i) => sum + current[i]!.x - previous[i]!.x, 0) / common.length,
    common.reduce((sum, i) => sum + current[i]!.y - previous[i]!.y, 0) / common.length,
  );
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
  const centers = [palmCenter(a), palmCenter(b)];
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
    const centers = [palmCenter(a), palmCenter(b)];
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
  ) {}
  envelope(result: HandResult, capture: number, inference: number, width: number, height: number): HandObservation {
    if (!Number.isFinite(capture) || !Number.isFinite(inference) || capture <= this.capture || inference < capture)
      throw new Error("HAND_PROVIDER_CLOCK_INVALID");
    this.capture = capture;
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
    const reliablePalm = hands.map((h) => [5, 9, 17].every((i) => h.landmarks[i].valid));
    const palms = hands.map(observedPalm);
    const centers = hands.map((h, i) => {
      if (reliablePalm[i]) return palmCenter(h);
      const palm = [0, 5, 9, 17].map((i) => h.landmarks[i]).filter((p) => p.valid);
      return palm.length >= 3
        ? { x: palm.reduce((s, p) => s + p.x, 0) / palm.length, y: palm.reduce((s, p) => s + p.y, 0) / palm.length }
        : null;
    });
    // Track association uses palm evidence only. An uncertain index tip or a
    // temporarily ineligible point must not manufacture a different identity.
    const scales = hands.map((h) =>
      h.landmarks[5].valid && h.landmarks[17].valid
        ? Math.hypot(h.landmarks[5].x - h.landmarks[17].x, h.landmarks[5].y - h.landmarks[17].y)
        : null,
    );
    // Aspect-corrected image coordinates and relative inferred depth keep the
    // same palm span through yaw. This is shape coherence, never metric size.
    const inferredSpans = hands.map((h) =>
      h.landmarks[5].valid && h.landmarks[17].valid
        ? Math.hypot(
            h.landmarks[5].x - h.landmarks[17].x,
            ((h.landmarks[5].y - h.landmarks[17].y) * height) / width,
            h.landmarks[5].z - h.landmarks[17].z,
          )
        : null,
    );
    // Keep the last observed location briefly through an occlusion. The record's
    // timestamp is not refreshed until a hand passes the existing spatial match.
    // Ambiguous output is never evidence that a retained record was observed.
    const costs = centers.map((center, i) =>
      eligibleTracks.map((t) =>
        center
          ? palmDisplacement(palms[i], t.palm) +
            (scales[i] !== null && t.scale !== null ? Math.abs(scales[i]! - t.scale) * 0.25 : 0)
          : Infinity,
      ),
    );
    // Recent coherent motion can cross the static association radius between
    // frames. Extrapolation is deliberately short, capped, and available only
    // from two observed core-knuckle references; it is not identity evidence after loss.
    const predictedCosts = centers.map((center, i) =>
      eligibleTracks.map((track) => {
        if (!center || !reliablePalm[i] || track.recent.length !== 2) return Infinity;
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
          Math.min(...spans) < 0.025 ||
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
    const crossing =
      centers.length === 2 &&
      centers[0] &&
      centers[1] &&
      Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) < 0.09;
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
    const collision = assignments.length === 2 && assignments[0] >= 0 && assignments[0] === assignments[1];
    const associationAmbiguous = !!crossing || collision || assignments.includes(-2);
    const establishedMatched = assignments.some(
      (assignment) => !associationAmbiguous && assignment >= 0 && eligibleTracks[assignment].established,
    );
    const next: Track[] = [];
    hands.forEach((hand, i) => {
      // A partial palm cannot establish a new usable track. Preserve prior
      // records without refreshing them so the original palm may recover.
      const ambiguous = associationAmbiguous || centers[i] === null || (!reliablePalm[i] && assignments[i] < 0);
      const prior = !ambiguous && assignments[i] >= 0 ? eligibleTracks[assignments[i]] : null;
      const id = prior?.id ?? ++this.generation;
      hand.trackId = `local-${id}`;
      hand.trackGeneration = id;
      hand.continuity = ambiguous ? "AMBIGUOUS" : prior ? "CONTINUOUS" : "ACQUIRED";
      const assessment = assessHand(hand, { frameWidth: width, frameHeight: height });
      hand.occluded = !assessment.requiredValid;
      hand.pose = assessment.pointing ? "POINT_CANDIDATE" : "UNKNOWN";
      if (centers[i] && !ambiguous)
        next.push({
          id,
          // A matched partial palm can confirm raw local continuity without
          // replacing the core reference or supplying prediction history.
          center: reliablePalm[i] ? centers[i]! : prior!.center,
          palm: reliablePalm[i] ? palms[i] : prior!.palm,
          at: capture,
          scale: reliablePalm[i] ? (scales[i] ?? prior?.scale ?? null) : prior!.scale,
          // A second hypothesis beside an existing hand must be observed again
          // unambiguously before it can survive absence and compete later.
          // This is temporal association evidence, never model confidence.
          established: prior ? prior.established || reliablePalm[i] : !establishedMatched,
          recent: reliablePalm[i]
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
    this.tracks = [
      ...next,
      ...eligibleTracks
        .filter((track) => retainEstablished && track.established && !next.some((matched) => matched.id === track.id))
        .map((track) => ({ ...track, recent: [] })),
    ];
    const rawTracked = hands.some((h) => assessHand(h, { frameWidth: width, frameHeight: height }).validCount >= 16);
    return {
      observationVersion: 1,
      ...this.binding,
      providerId: handModel.providerId,
      providerVersion: handModel.providerVersion,
      modelId: handModel.modelId,
      modelVersion: handModel.modelVersion,
      modelDigest: handModel.modelDigest,
      observationId: `observation-${this.sequence}`,
      sequence: this.sequence++,
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
  }
}
