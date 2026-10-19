import type { IndexImageObservation } from "./index-image-tracker";

export type IndexImageReadinessResult = {
  observation: IndexImageObservation;
  eligible: boolean;
  condition: "READY" | "ACQUIRING" | "RECOVERING" | "UNSEEDED" | "UNCERTAIN" | "LOST";
  guidance: string;
  changed: boolean;
};
const guidance: Record<IndexImageReadinessResult["condition"], string> = {
  READY: "Your fingertip is ready for relative control.",
  ACQUIRING: "Keep your fingertip visible while tracking settles.",
  RECOVERING: "Fingertip tracking is returning. Hold briefly while it settles.",
  UNSEEDED: "Show your index finger in the preview to begin image tracking.",
  UNCERTAIN: "Tracking paused. Keep the same fingertip visible; saved targets are kept.",
  LOST: "Fingertip tracking paused. Bring the same finger back into view; saved targets are kept.",
};
const postureGuidance: Record<string, string> = {
  APPEARANCE_MISMATCH:
    "The fingertip image no longer matches its reference. Tracking is trying to reacquire it; saved targets are kept.",
  APPEARANCE_AMBIGUOUS:
    "Several image locations look like the fingertip. Tracking is paused while a clear match returns; saved targets are kept.",
  FORWARD_BACKWARD_DISAGREEMENT:
    "The fingertip image match is inconsistent. Tracking is paused while it reacquires; saved targets are kept.",
  IMAGE_MOTION_TOO_LARGE:
    "The fingertip moved beyond the current image match. Tracking is trying to reacquire it; saved targets are kept.",
  INDEX_SOURCE_ASSOCIATION_PENDING:
    "The hand model returned a different track. Keep the same index visible while its identity is checked; saved targets are kept.",
  FINGERTIP_RECONFIRMED_SETTLING:
    "The same fingertip is reacquired. Hold briefly while tracking settles; saved targets are kept.",
  SAME_HAND_POSITION_UNCERTAIN: "Your hand is still tracked. Fingertip position is settling; saved targets are kept.",
  MANUAL_SELECTION_REQUIRED:
    "Your selected fingertip could not be acquired or its image track expired. Mark the visible fingertip again, or choose automatic fingertip selection; the hand model will not replace your selection.",
  IMAGE_REFERENCE_CONFLICT:
    "Fingertip appearance matches disagree. Tracking is paused to avoid a jump; keep the same fingertip visible while it reacquires. Saved targets are kept.",
  IMAGE_REFERENCE_EXPIRED:
    "The fingertip image needs a fresh match. Keep the same index visible while tracking reacquires; saved targets are kept.",
  IMAGE_OUTSIDE_OBSERVED_HAND:
    "The image tracker drifted away from your hand. Pointer sampling is paused while index tracking settles; saved targets are kept.",
  INDEX_SHAFT_MATCH_NOT_TIP:
    "Your index is still associated, but its tip position is settling. Sampling is paused; saved targets are kept.",
  INDEX_SHAFT_MODEL_TIP: "Following the hand model's fingertip while the index image changes.",
  IMAGE_TIP_MODEL_ENDPOINT_UNCERTAIN: "Following the tracked fingertip while the hand model's endpoint is uncertain.",
  FULL_HAND_POINT_PENDING: "Full-hand pointing evidence is settling; saved targets are kept.",
  COHERENT_MODEL_CONTRARY:
    "Pointing posture changed. Show a relaxed index point again. If the hand stays cropped, mark the visible fingertip to start a fresh setup.",
  FULL_HAND_CONTRARY:
    "The full hand is visible and is not pointing. Show a relaxed index point; an image hint cannot override this posture.",
  FULL_HAND_CONTRARY_PENDING:
    "The hand posture changed. Pointing is paused while it settles; the dashed ring still shows the matched fingertip image.",
  FULL_HAND_CONTRARY_CONFIRMED:
    "The full hand is visible and is not pointing. Show a relaxed index point; an image hint cannot override this posture.",
  FULL_HAND_CONTRARY_AWAITING_POINT:
    "Pointing is paused after an open or bent hand. Show a relaxed index point again. If the hand stays cropped, mark the visible fingertip for a fresh setup.",
  FULL_HAND_AMBIGUOUS:
    "Full-hand detection is ambiguous. Keep one pointing hand visible while tracking settles; saved targets are kept.",
  FULL_HAND_INDEX_CONFLICT:
    "The hand model and selected fingertip disagree. Keep your index visible while they agree again; the cursor will not jump to another finger.",
  INDEX_MODEL_IMAGE_CONFLICT:
    "The visible index and tracked image disagree. Sampling is paused while they agree again; saved targets are kept.",
  INDEX_IDENTITY_RECONFIRM_REQUIRED:
    "Fingertip identity is being checked after a disagreement. Keep the same index visible; saved targets are kept.",
};
function identity(o: IndexImageObservation): string | null {
  if (o.trackId === null || o.trackGeneration <= 0) return null;
  return JSON.stringify([
    o.providerId,
    o.providerVersion,
    o.algorithmDigest,
    o.providerGeneration,
    o.cameraLeaseId,
    o.cameraFrameVersion,
    o.frameWidth,
    o.frameHeight,
    o.mirrorTransform,
    o.orientation,
    o.trackId,
    o.trackGeneration,
  ]);
}

/** Selection follows the independently gated fused producer, never a model ID alone. */
export class IndexImageReadiness {
  private established: string | null = null;
  private candidate: string | null = null;
  private evidence: { at: number; weight: number }[] = [];
  private lastGoodCapture: number | null = null;
  private lastInputCapture: number | null = null;
  private interrupted = false;
  reset() {
    this.established = null;
    this.candidate = null;
    this.evidence = [];
    this.lastGoodCapture = null;
    this.lastInputCapture = null;
    this.interrupted = false;
  }
  private interrupt() {
    if (this.established !== null && !this.interrupted) {
      this.interrupted = true;
      this.candidate = this.established;
      this.evidence = [];
      this.lastGoodCapture = null;
    }
  }
  /** A stale callback gap pauses readiness without inventing an observation. */
  pause() {
    this.interrupt();
    this.lastInputCapture = null;
  }
  update(o: IndexImageObservation): IndexImageReadinessResult {
    const result = (condition: IndexImageReadinessResult["condition"], changed = false): IndexImageReadinessResult => ({
      observation: o,
      eligible: condition === "READY",
      condition,
      guidance: postureGuidance[o.reason] ?? guidance[condition],
      changed,
    });
    const at = o.monotonicCaptureTime;
    const previousInput = this.lastInputCapture;
    this.lastInputCapture = at;
    if (this.lastGoodCapture !== null && at - this.lastGoodCapture > 250) {
      this.interrupt();
      this.evidence = [];
      this.lastGoodCapture = null;
    }
    this.evidence = this.evidence.filter((sample) => at - sample.at <= 1000);
    const key = identity(o);
    if (o.state !== "TRACKING" || o.point === null || key === null) {
      this.interrupt();
      return result(o.state === "TRACKING" ? "UNCERTAIN" : o.state);
    }
    if (this.established === key && !this.interrupted) {
      this.lastGoodCapture = o.monotonicCaptureTime;
      return result("READY");
    }
    if (this.candidate !== key) {
      this.candidate = key;
      this.evidence = [];
      this.lastGoodCapture = null;
      if (this.established !== null) this.interrupted = true;
    }
    // Readiness uses bounded fresh-frame weights, not calibration sample time.
    // A bad frame receives no weight and does not erase other recent good frames.
    // Long losses above clear the buffer; their first returning frame gets none.
    if (this.lastGoodCapture !== null && previousInput !== null)
      this.evidence.push({ at, weight: Math.max(0, Math.min(50, at - previousInput)) });
    this.lastGoodCapture = at;
    const recovering = this.established === key;
    if (this.evidence.reduce((sum, sample) => sum + sample.weight, 0) < (recovering ? 120 : 250))
      return result(recovering ? "RECOVERING" : "ACQUIRING");
    const changed = this.established !== null && this.established !== key;
    this.established = key;
    this.candidate = null;
    this.evidence = [];
    this.interrupted = false;
    return result("READY", changed);
  }
}
