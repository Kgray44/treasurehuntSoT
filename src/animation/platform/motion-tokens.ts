import type { MotionMode } from "../core/animation-types";

export type PlatformMotionTier = "micro" | "state" | "layout" | "route" | "ceremony" | "ambient";

export type PlatformMotionToken = Readonly<{
  durationMs: Readonly<Record<MotionMode, number>>;
  distancePx: Readonly<Record<MotionMode, number>>;
  scaleDelta: Readonly<Record<MotionMode, number>>;
  easing: string;
}>;

export type ResolvedPlatformMotionToken = Readonly<{
  tier: PlatformMotionTier;
  durationMs: number;
  durationSeconds: number;
  distancePx: number;
  scaleDelta: number;
  easing: string;
}>;

export type MotionEasingTuple = readonly [number, number, number, number];

const platformMotionEasings: Record<PlatformMotionTier, MotionEasingTuple | "easeInOut"> = {
  micro: [0.2, 0.8, 0.2, 1],
  state: [0.22, 1, 0.36, 1],
  layout: [0.22, 1, 0.36, 1],
  route: [0.16, 1, 0.3, 1],
  ceremony: [0.34, 1, 0.64, 1],
  ambient: "easeInOut",
};

export const platformMotionTokens = {
  micro: {
    durationMs: { full: 180, gentle: 120, reduced: 40 },
    distancePx: { full: 4, gentle: 2, reduced: 0 },
    scaleDelta: { full: 0.015, gentle: 0.008, reduced: 0 },
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
  state: {
    durationMs: { full: 320, gentle: 200, reduced: 60 },
    distancePx: { full: 10, gentle: 4, reduced: 0 },
    scaleDelta: { full: 0.012, gentle: 0.006, reduced: 0 },
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  layout: {
    durationMs: { full: 420, gentle: 260, reduced: 0 },
    distancePx: { full: 18, gentle: 8, reduced: 0 },
    scaleDelta: { full: 0.01, gentle: 0.004, reduced: 0 },
    easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  route: {
    durationMs: { full: 460, gentle: 280, reduced: 0 },
    distancePx: { full: 22, gentle: 8, reduced: 0 },
    scaleDelta: { full: 0.008, gentle: 0.003, reduced: 0 },
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
  ceremony: {
    durationMs: { full: 1100, gentle: 700, reduced: 0 },
    distancePx: { full: 36, gentle: 14, reduced: 0 },
    scaleDelta: { full: 0.025, gentle: 0.01, reduced: 0 },
    easing: "cubic-bezier(0.34, 1.2, 0.64, 1)",
  },
  ambient: {
    durationMs: { full: 8000, gentle: 12000, reduced: 0 },
    distancePx: { full: 8, gentle: 3, reduced: 0 },
    scaleDelta: { full: 0.01, gentle: 0.004, reduced: 0 },
    easing: "ease-in-out",
  },
} as const satisfies Record<PlatformMotionTier, PlatformMotionToken>;

export function resolvePlatformMotionToken(
  tier: PlatformMotionTier,
  mode: MotionMode,
): ResolvedPlatformMotionToken {
  const token = platformMotionTokens[tier];
  const durationMs = token.durationMs[mode];
  return {
    tier,
    durationMs,
    durationSeconds: durationMs / 1000,
    distancePx: token.distancePx[mode],
    scaleDelta: token.scaleDelta[mode],
    easing: token.easing,
  };
}

export function platformMotionEasing(tier: PlatformMotionTier) {
  return platformMotionEasings[tier];
}
