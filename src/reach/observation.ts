import { handObservationSchema, type HandObservation } from "@/watchglass/hand-observation";
import { assessHand } from "@/watchglass/hand-posture";
import { HAND_CONTINUITY_GRACE_MS } from "@/watchglass/hand-provider";
export { handObservationSchema, type HandObservation } from "@/watchglass/hand-observation";
export type ObservationBinding = {
  providerGeneration: number;
  cameraLeaseId: string;
  cameraFrameVersion: number;
  orientation: 0 | 90 | 180 | 270;
  mirrorTransform: "NONE" | "PREVIEW_X";
};
export class ObservationGate {
  private sequence = -1;
  private capture = -1;
  private frame: string | null = null;
  constructor(
    readonly binding: ObservationBinding,
    readonly maxAgeMs = 150,
  ) {}
  accept(input: unknown, now: number): HandObservation {
    const o = handObservationSchema.parse(input);
    if (
      !Number.isFinite(now) ||
      Object.entries(this.binding).some(([key, value]) => o[key as keyof HandObservation] !== value)
    )
      throw new Error("OBSERVATION_BINDING_MISMATCH");
    if (o.sequence <= this.sequence || o.monotonicCaptureTime <= this.capture) throw new Error("OBSERVATION_REORDERED");
    if (
      now - o.monotonicCaptureTime > this.maxAgeMs ||
      o.monotonicCaptureTime > now + 5 ||
      o.monotonicInferenceTime < o.monotonicCaptureTime ||
      o.monotonicInferenceTime > now + 5
    )
      throw new Error("OBSERVATION_CLOCK_OR_FRESHNESS");
    const frame = `${o.frameWidth}:${o.frameHeight}`;
    if (this.frame !== null && this.frame !== frame) throw new Error("OBSERVATION_FRAME_CHANGED");
    this.sequence = o.sequence;
    this.capture = o.monotonicCaptureTime;
    this.frame = frame;
    return o;
  }
}
/** The model exposes handedness confidence, not per-result presence/tracking probabilities. */
export function usableHand(o: HandObservation, trackId?: string) {
  if (["MODEL_FAILURE", "INTERRUPTED"].includes(o.reason)) return null;
  const hand = trackId ? o.hands.find((h) => h.trackId === trackId) : o.hands.length === 1 ? o.hands[0] : null;
  if (!hand || hand.continuity === "AMBIGUOUS") return null;
  const assessment = assessHand(hand, o);
  return assessment.framed && assessment.geometry && assessment.pointing ? hand : null;
}
export type ReachReadiness = {
  detectedCount: number;
  hand: HandObservation["hands"][number] | null;
  eligible: boolean;
  changed: boolean;
  condition:
    | "READY"
    | "ACQUIRING"
    | "NO_HAND"
    | "RECOVERING"
    | "CHOOSE_HAND"
    | "AMBIGUOUS"
    | "FRAMING"
    | "GEOMETRY"
    | "POSTURE";
  guidance: string;
};
const guidance = {
  READY: "Your hand is ready. Keep a relaxed index point.",
  ACQUIRING: "Hold your hand here briefly while tracking settles.",
  NO_HAND: "Show your hand to the camera.",
  RECOVERING: "Tracking paused. Bring the same hand back; completed targets stay saved.",
  CHOOSE_HAND: "Choose the hand you want to use, or show just one pointing hand.",
  AMBIGUOUS: "Separate your hands briefly so tracking can recover safely.",
  FRAMING: "Move your hand slightly toward the center.",
  GEOMETRY: "Turn your hand slightly so your index finger and palm are visible.",
  POSTURE: "Extend your index finger comfortably; a gentle bend and relaxed fingers are fine.",
};
/** Selection is sticky to a local track. Handedness never proves identity. */
export class ActiveHandSelector {
  private active: string | null = null;
  private activeGeneration: number | null = null;
  private lastSeen = -Infinity;
  private candidate: string | null = null;
  private candidateSince = 0;
  private context: string | null = null;
  private manual: string | null = null;
  private interrupted = false;
  private readySince: number | null = null;
  choose(trackId: string | null) {
    this.manual = trackId;
    this.active = null;
    this.activeGeneration = null;
    this.candidate = null;
    this.readySince = null;
    this.interrupted = false;
  }
  reset() {
    this.active = null;
    this.activeGeneration = null;
    this.candidate = null;
    this.context = null;
    this.manual = null;
    this.lastSeen = -Infinity;
    this.readySince = null;
    this.interrupted = false;
  }
  update(o: HandObservation): ReachReadiness {
    const at = o.monotonicCaptureTime;
    const context = `${o.providerId}:${o.modelDigest}:${o.providerGeneration}:${o.cameraLeaseId}:${o.cameraFrameVersion}:${o.orientation}:${o.mirrorTransform}:${o.frameWidth}:${o.frameHeight}`;
    let changed = this.context !== null && this.context !== context;
    if (changed) this.reset();
    this.context = context;
    const result = (condition: ReachReadiness["condition"], hand: ReachReadiness["hand"] = null): ReachReadiness => ({
      detectedCount: o.hands.length,
      hand,
      changed,
      eligible: condition === "READY",
      condition,
      guidance: guidance[condition],
    });
    // An uncertain frame pauses output immediately, but is not evidence of a
    // different hand. Only a confirmed new binding may invalidate saved work.
    if (["MODEL_FAILURE", "INTERRUPTED"].includes(o.reason)) {
      this.interrupted = true;
      this.readySince = null;
      return result("RECOVERING");
    }
    if (o.hands.some((h) => h.continuity === "AMBIGUOUS")) {
      this.interrupted = true;
      this.readySince = null;
      return result("AMBIGUOUS");
    }
    let hand = o.hands.find((h) => h.trackId === this.active && h.trackGeneration === this.activeGeneration);
    if (this.active && !hand) {
      this.interrupted = true;
      this.readySince = null;
      // Absence alone never clears a calibration. A replacement must settle
      // below; its original provider identity/generation is never rewritten.
      if (!o.hands.length || at - this.lastSeen <= HAND_CONTINUITY_GRACE_MS) {
        this.candidate = null;
        return result("RECOVERING");
      }
    }
    if (!hand) {
      const candidates = this.manual
        ? o.hands.filter((h) => h.trackId === this.manual)
        : o.hands.length === 1
          ? o.hands
          : o.hands.filter((h) => !!usableHand(o, h.trackId));
      if (candidates.length !== 1) return result(o.hands.length ? "CHOOSE_HAND" : "NO_HAND");
      hand = candidates[0];
      const candidate = `${hand.trackId}:${hand.trackGeneration}`;
      if (this.candidate !== candidate) {
        this.candidate = candidate;
        this.candidateSince = at;
      }
      if (at - this.candidateSince < 250) return result("ACQUIRING", hand);
      changed ||= this.active !== null;
      this.active = hand.trackId;
      this.activeGeneration = hand.trackGeneration;
      this.interrupted = false;
      this.readySince = at;
    }
    if (at - this.lastSeen > 300 && this.lastSeen !== -Infinity) {
      this.interrupted = true;
      this.readySince = null;
    }
    this.lastSeen = at;
    const quality = assessHand(hand, o);
    const condition =
      !quality.requiredValid || !quality.framed
        ? "FRAMING"
        : !quality.geometry
          ? "GEOMETRY"
          : !quality.pointing
            ? "POSTURE"
            : "READY";
    if (condition !== "READY") {
      this.interrupted = true;
      this.readySince = null;
      return result(condition, hand);
    }
    // Bad/unknown frames never sample. Require a short run of fresh good
    // anatomy after an interruption rather than bouncing eligibility per frame.
    if (this.interrupted) {
      this.readySince ??= at;
      if (at - this.readySince < 120) return result("ACQUIRING", hand);
    }
    this.interrupted = false;
    return result("READY", hand);
  }
}
