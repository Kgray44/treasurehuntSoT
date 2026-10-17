import { assessHand } from "@/watchglass/hand-posture";
import type { IndexImageObservation } from "./index-image-tracker";
import type { HandObservation, ReachReadiness } from "./observation";

export const trialEntryGraceMs = 300;

/** Opening a target does not authorize collection or extend observation freshness. */
export function canOpenReachTrial({
  mode,
  source,
  readiness,
  observation,
  imageObservation,
  now,
}: {
  mode: "ABSOLUTE" | "RELATIVE";
  source: "OFF" | "LIVE" | "DEMO";
  readiness: ReachReadiness;
  observation: HandObservation | null;
  imageObservation: IndexImageObservation | null;
  now: number;
}): boolean {
  if (source === "OFF" || readiness.condition !== "READY" || readiness.changed || !Number.isFinite(now)) return false;
  const capturedAt = mode === "RELATIVE" ? imageObservation?.monotonicCaptureTime : observation?.monotonicCaptureTime;
  if (
    capturedAt === undefined ||
    !Number.isFinite(capturedAt) ||
    now - capturedAt < 0 ||
    now - capturedAt > trialEntryGraceMs
  )
    return false;
  if (mode === "RELATIVE") return imageObservation?.state === "TRACKING" && imageObservation.point !== null;
  if (!observation || !readiness.hand || ["MODEL_FAILURE", "INTERRUPTED"].includes(observation.reason)) return false;
  const hand = observation.hands.find(
    (candidate) =>
      candidate.trackId === readiness.hand!.trackId && candidate.trackGeneration === readiness.hand!.trackGeneration,
  );
  if (!hand || hand.continuity === "AMBIGUOUS") return false;
  const posture = assessHand(hand, observation);
  return posture.pointing && posture.framed;
}
