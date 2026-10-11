import { handObservationSchema, type HandObservation } from "@/watchglass/hand-observation";
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
    this.sequence = o.sequence;
    this.capture = o.monotonicCaptureTime;
    const frame = `${o.frameWidth}:${o.frameHeight}`;
    if (this.frame !== null && this.frame !== frame) throw new Error("OBSERVATION_FRAME_CHANGED");
    this.frame = frame;
    return o;
  }
}
/** The model exposes handedness confidence, not per-result presence/tracking probabilities. */
export function usableHand(o: HandObservation) {
  if (o.quality !== "USABLE" || o.reason !== "NONE" || o.hands.length !== 1) return null;
  const hand = o.hands[0];
  if (hand.occluded || hand.pose !== "POINT_CANDIDATE" || hand.landmarks.some((p) => !p.valid)) return null;
  const a = hand.landmarks[5],
    b = hand.landmarks[17];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 0.04) return null;
  return hand;
}
