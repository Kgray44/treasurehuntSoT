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
type Track = { id: number; center: { x: number; y: number }; at: number; scale: number | null };
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
    const hands = result.landmarks.slice(0, 2).map((points, i) => {
      const landmarks = Array.from({ length: 21 }, (_, j) => {
        const p = points[j];
        const valid = !!p && [p.x, p.y, p.z].every(Number.isFinite) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
        return { x: valid ? p.x : 0, y: valid ? p.y : 0, z: valid ? p.z : 0, valid };
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
        presenceScore: null,
        trackingScore: null,
        occluded: false,
        pose: "UNKNOWN" as "POINT_CANDIDATE" | "UNKNOWN",
        uncertainty: null,
      };
    });
    const centers = hands.map((h) => {
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
    // Keep the last observed location briefly through an occlusion. The record's
    // timestamp is not refreshed until a hand passes the existing spatial match;
    // ambiguity, a jump, or expiry still produces a fresh local generation.
    const eligibleTracks = this.tracks.filter((t) => capture - t.at <= HAND_CONTINUITY_GRACE_MS);
    const costs = centers.map((center, i) =>
      eligibleTracks.map((t) =>
        center
          ? Math.hypot(center.x - t.center.x, center.y - t.center.y) +
            (scales[i] !== null && t.scale !== null ? Math.abs(scales[i]! - t.scale) * 0.25 : 0)
          : Infinity,
      ),
    );
    const crossing =
      centers.length === 2 &&
      centers[0] &&
      centers[1] &&
      Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) < 0.09;
    const assignments = costs.map((row) => {
      const ranked = row.map((cost, index) => ({ cost, index })).sort((a, b) => a.cost - b.cost);
      if (!ranked.length || ranked[0].cost > 0.14) return -1;
      if (ranked[1] && ranked[1].cost - ranked[0].cost < 0.035) return -2;
      return ranked[0].index;
    });
    const collision = assignments.length === 2 && assignments[0] >= 0 && assignments[0] === assignments[1];
    const associationAmbiguous = !!crossing || collision || assignments.includes(-2);
    const next: Track[] = [];
    hands.forEach((hand, i) => {
      // A partial palm cannot establish a new usable track. Preserve prior
      // records without refreshing them so the original palm may recover.
      const ambiguous = !!crossing || collision || assignments[i] === -2 || centers[i] === null;
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
          center: centers[i]!,
          at: capture,
          scale: scales[i] ?? prior?.scale ?? null,
        });
    });
    // A different visible hand does not prove that an occluded hand vanished.
    // Actual crossing/assignment ambiguity still retires unmatched records.
    this.tracks = associationAmbiguous
      ? next
      : [...next, ...eligibleTracks.filter((track) => !next.some((matched) => matched.id === track.id))];
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
