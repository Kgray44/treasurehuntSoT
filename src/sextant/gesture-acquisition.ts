import type { GestureConfig } from "./gestures";
import { updateInterval, type ReferenceFrame, type UpdateClass } from "./contracts";

/** Requested delivery cadence is a ceiling on throttling, never a promise of sensor capture rate. */
export function gestureAcquisition(config: GestureConfig) {
  const motion = ["motion.gravity", "motion.linear-acceleration", "motion.angular-velocity", "motion.stability"];
  const ids =
    config.kind === "HOLD_STEADY"
      ? ["motion.stability"]
      : config.kind === "TURN_TO_BEARING"
        ? ["heading.estimate", "motion.stability"]
        : config.kind === "TILT_BAND"
          ? ["orientation.attitude", "motion.stability"]
          : motion;
  return {
    version: 1 as const,
    channels: ids.map((id) => ({
      capabilityId: `sextant.${id}`,
      frames: (id === "heading.estimate"
        ? [config.kind === "TURN_TO_BEARING" && config.northReference === "TRUE" ? "EARTH_TRUE" : "EARTH_MAGNETIC"]
        : id === "orientation.attitude"
          ? ["LOCAL_ARBITRARY", "EARTH_MAGNETIC", "EARTH_TRUE"]
          : ["DEVICE"]) as ReferenceFrame[],
    })),
    maxAgeMs: 500,
    maxGapMs: 500,
    maxSkewMs: 100,
    maximumDeliveryIntervalMs: 100,
    stabilityDwellMs: 600,
    dwellMs: config.dwellMs,
    timeoutMs: config.timeoutMs,
    maximumBurstMs: 30000,
    northReference: config.kind === "TURN_TO_BEARING" ? config.northReference : null,
  };
}
export function assertGestureCadence(config: GestureConfig, updateClass: UpdateClass, remainingMs: number) {
  const policy = gestureAcquisition(config);
  if (updateInterval[updateClass] > policy.maximumDeliveryIntervalMs)
    throw new Error("SEXTANT_GESTURE_CADENCE_INCOMPATIBLE");
  if (remainingMs < policy.stabilityDwellMs + policy.dwellMs) throw new Error("SEXTANT_GESTURE_LIFETIME_INSUFFICIENT");
  if (updateClass === "HIGH_FIDELITY_BURST" && remainingMs > policy.maximumBurstMs)
    throw new Error("SEXTANT_GESTURE_BURST_TOO_LONG");
}
