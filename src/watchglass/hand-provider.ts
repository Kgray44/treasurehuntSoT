import type { HandObservation } from "./hand-observation";
export const handModel = {
  providerId: "watchglass.hand-observation",
  providerVersion: "1.0.0",
  modelId: "mediapipe.hand-landmarker.float16",
  modelVersion: "1",
  modelDigest: "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1",
  runtimeVersion: "0.10.32",
  backend: "CPU_WASM",
  maxHands: 2,
} as const;
type Landmark = { x: number; y: number; z: number };
export type HandResult = { landmarks: Landmark[][]; handedness: { categoryName: string; score: number }[][] };
/** Conservative continuity: gaps, ambiguous multi-hand frames and implausible jumps get new local identities. */
export class BrowserHandAdapter {
  private sequence = 0;
  private trackGeneration = 0;
  private wrist: Landmark | null = null;
  private at = -Infinity;
  constructor(
    private binding: Pick<
      HandObservation,
      "providerGeneration" | "cameraLeaseId" | "cameraFrameVersion" | "mirrorTransform"
    >,
    private tier: HandObservation["evidenceTier"] = "UNQUALIFIED",
  ) {}
  envelope(result: HandResult, capture: number, inference: number, width: number, height: number): HandObservation {
    const single = result.landmarks.length === 1 && result.landmarks[0].length === 21;
    const wrist = single ? result.landmarks[0][0] : null;
    if (
      !wrist ||
      !this.wrist ||
      capture - this.at > 150 ||
      Math.hypot(wrist.x - this.wrist.x, wrist.y - this.wrist.y) > 0.12
    )
      ++this.trackGeneration;
    this.wrist = wrist;
    this.at = capture;
    let allValid = true;
    const hands = result.landmarks.slice(0, 2).map((points, i) => {
      const landmarks = points.map((p) => {
        const valid = [p.x, p.y, p.z].every(Number.isFinite) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
        allValid &&= valid;
        return { x: valid ? p.x : 0, y: valid ? p.y : 0, z: valid ? p.z : 0, valid };
      });
      const category = result.handedness[i]?.[0];
      const visible =
        landmarks.length === 21 &&
        landmarks.every((p) => p.valid && p.x > 0.01 && p.x < 0.99 && p.y > 0.01 && p.y < 0.99);
      const extended =
        visible &&
        Math.hypot(landmarks[8].x - landmarks[5].x, landmarks[8].y - landmarks[5].y) >
          Math.hypot(landmarks[6].x - landmarks[5].x, landmarks[6].y - landmarks[5].y) * 1.4;
      return {
        trackId: `local-${this.trackGeneration}-${i}`,
        trackGeneration: this.trackGeneration,
        handedness:
          category?.categoryName === "Left"
            ? ("LEFT" as const)
            : category?.categoryName === "Right"
              ? ("RIGHT" as const)
              : ("UNKNOWN" as const),
        handednessConfidence: Number.isFinite(category?.score) ? category.score : null,
        coordinateFrame: "CAMERA_IMAGE_NORMALIZED" as const,
        landmarks,
        presenceScore: null,
        trackingScore: null,
        occluded: !visible,
        pose: extended ? ("POINT_CANDIDATE" as const) : ("UNKNOWN" as const),
        uncertainty: null,
      };
    });
    const reason =
      hands.length === 0
        ? "NO_HAND"
        : hands.length > 1
          ? "MULTIPLE_HANDS"
          : !allValid || hands[0].occluded
            ? "LOW_VISIBILITY"
            : "NONE";
    return {
      observationVersion: 1,
      providerId: handModel.providerId,
      providerVersion: handModel.providerVersion,
      modelId: handModel.modelId,
      modelVersion: handModel.modelVersion,
      modelDigest: handModel.modelDigest,
      ...this.binding,
      observationId: `observation-${this.sequence}`,
      sequence: this.sequence++,
      monotonicCaptureTime: capture,
      monotonicInferenceTime: inference,
      frameWidth: width,
      frameHeight: height,
      orientation: 0,
      evidenceTier: this.tier,
      hands,
      quality: reason === "NONE" ? "USABLE" : "LOW",
      reason,
    };
  }
}
