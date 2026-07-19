import type { MotionMode, ResolvedMotionPolicy } from "./animation-types";

export const motionModeOrder = ["full", "gentle", "reduced"] as const satisfies readonly MotionMode[];

export const motionPolicy = {
  full: { duration: 1, distance: 1, particles: 1, ambient: true, pageFlip: true },
  gentle: { duration: 0.58, distance: 0.42, particles: 0.35, ambient: true, pageFlip: true },
  reduced: { duration: 0.08, distance: 0, particles: 0, ambient: false, pageFlip: false },
} satisfies Record<
  MotionMode,
  { duration: number; distance: number; particles: number; ambient: boolean; pageFlip: boolean }
>;

export function resolveMotionMode(productMode: MotionMode, prefersReducedMotion: boolean): MotionMode {
  return prefersReducedMotion ? "reduced" : productMode;
}

type ResolvedLevelPolicy = Omit<ResolvedMotionPolicy, "level" | "source">;

const resolvedLevelPolicy = {
  full: {
    allowSpatialTravel: true,
    allowContinuousAmbientMotion: true,
    allowPageCurl: true,
    allowRiveStateTravel: true,
    allowLottiePlayback: true,
    allowMotionCues: true,
    durationScale: motionPolicy.full.duration,
    distanceScale: motionPolicy.full.distance,
    preserveSemanticStaging: true,
  },
  gentle: {
    allowSpatialTravel: true,
    allowContinuousAmbientMotion: true,
    allowPageCurl: true,
    allowRiveStateTravel: true,
    allowLottiePlayback: true,
    allowMotionCues: true,
    durationScale: motionPolicy.gentle.duration,
    distanceScale: motionPolicy.gentle.distance,
    preserveSemanticStaging: true,
  },
  reduced: {
    allowSpatialTravel: false,
    allowContinuousAmbientMotion: false,
    allowPageCurl: false,
    allowRiveStateTravel: false,
    allowLottiePlayback: false,
    allowMotionCues: false,
    durationScale: motionPolicy.reduced.duration,
    distanceScale: motionPolicy.reduced.distance,
    preserveSemanticStaging: true,
  },
} satisfies Record<MotionMode, ResolvedLevelPolicy>;

export function isMotionMode(value: unknown): value is MotionMode {
  return typeof value === "string" && (motionModeOrder as readonly string[]).includes(value);
}

export function resolveMotionPolicy(productSetting: MotionMode, browserPrefersReduced: boolean): ResolvedMotionPolicy {
  const level = resolveMotionMode(productSetting, browserPrefersReduced);
  return {
    level,
    source: { productSetting, browserPrefersReduced },
    ...resolvedLevelPolicy[level],
  };
}

export function scaledDuration(seconds: number, mode: MotionMode) {
  return Math.max(0.01, seconds * motionPolicy[mode].duration);
}

export function scaledDistance(pixels: number, mode: MotionMode) {
  return Math.round(pixels * motionPolicy[mode].distance);
}
