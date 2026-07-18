import type { MotionMode } from "./animation-types";

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

export function scaledDuration(seconds: number, mode: MotionMode) {
  return Math.max(0.01, seconds * motionPolicy[mode].duration);
}

export function scaledDistance(pixels: number, mode: MotionMode) {
  return Math.round(pixels * motionPolicy[mode].distance);
}
