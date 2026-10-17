import type { IndexImageObservation } from "./index-image-tracker";

export type IndexImageReadinessResult = {
  observation: IndexImageObservation;
  eligible: boolean;
  condition: "READY" | "ACQUIRING" | "RECOVERING" | "UNSEEDED" | "UNCERTAIN" | "LOST";
  guidance: string;
  changed: boolean;
};
const guidance: Record<IndexImageReadinessResult["condition"], string> = {
  READY: "Your fingertip is ready for image-based relative control.",
  ACQUIRING: "Keep your fingertip visible while image tracking settles.",
  RECOVERING: "Fingertip tracking is returning. Hold briefly while it settles.",
  UNSEEDED: "Show your index finger in the preview to begin image tracking.",
  UNCERTAIN: "Image tracking paused. Keep your fingertip visible while it reacquires.",
  LOST: "Fingertip tracking paused. Bring your finger back into view.",
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

/** Selection follows only the independently gated image track, never a model hand ID. */
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
      guidance:
        o.reason === "COHERENT_MODEL_CONTRARY"
          ? "Pointing posture changed. Show a relaxed index point again. If the hand stays cropped, mark the visible fingertip to start a fresh setup."
          : guidance[condition],
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
