"use client";

import { motion } from "motion/react";
import type { MotionMode } from "@/animation/core/animation-types";
import { platformMotionEasing, resolvePlatformMotionToken } from "@/animation/platform/motion-tokens";

export type PlatformRelicKind =
  | "player-journal"
  | "captain-lock"
  | "creator-quill"
  | "invitation-seal"
  | "journal-clasp"
  | "voyage-compass";

export type PlatformRelicState =
  | "idle"
  | "hover"
  | "pressed"
  | "resolving"
  | "valid"
  | "invalid"
  | "expired"
  | "revoked"
  | "pin-progress"
  | "accepting"
  | "opening"
  | "open"
  | "declined"
  | "locked"
  | "breathing"
  | "connecting"
  | "live"
  | "launch-ready"
  | "releasing"
  | "seeking"
  | "bearing"
  | "arrived"
  | "offline"
  | "failure";

export function PlatformRelic({
  kind,
  state,
  mode,
  layoutId,
}: {
  kind: PlatformRelicKind;
  state: PlatformRelicState;
  mode: MotionMode;
  layoutId?: string;
}) {
  const token = resolvePlatformMotionToken(state === "open" || state === "releasing" ? "ceremony" : "state", mode);
  return (
    <motion.div
      className={`platform-relic relic-${kind}`}
      data-rive-interface={kind}
      data-rive-fallback="css-svg"
      data-relic-state={state}
      data-motion-mode={mode}
      layoutId={layoutId}
      initial={false}
      animate={{
        opacity: state === "failure" || state === "invalid" ? 0.78 : 1,
        scale: mode === "reduced" ? 1 : state === "open" || state === "arrived" ? 1.025 : 1,
        rotate: mode === "reduced" ? 0 : state === "seeking" ? -2 : state === "bearing" ? 2 : 0,
      }}
      transition={{ duration: token.durationSeconds, ease: platformMotionEasing("state") }}
      aria-hidden="true"
    >
      <i />
      <b />
      <span />
    </motion.div>
  );
}
