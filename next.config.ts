import type { NextConfig } from "next";
import { homeportAllowedDevOrigins } from "./src/homeport/dev-origin-config";

const taskOwnedSoundingLineBuild =
  process.env.SOUNDING_LINE_TASK_OWNED_HTTP === "1" && Boolean(process.env.SOUNDING_LINE_SUITE_PROFILE);

if (taskOwnedSoundingLineBuild) {
  process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER = "TASK_OWNED_TEST";
}

const nextConfig: NextConfig = {
  // Preserve the frozen source of the separate synthetic photo development journey.
  ...(process.env.SPATIAL_PILOT_ENABLED === "1" ||
  ["SYNTHETIC_DEVELOPMENT", "OWNER_AUTHORIZED_LIVE_DEVELOPMENT"].includes(process.env.PARALLAX_ROOM_PHOTO_RUNTIME ?? "")
    ? { agentRules: false }
    : {}),
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: homeportAllowedDevOrigins(),
  // Keep opted-in local validation builds within the same one-worker budget as Vitest.
  ...(process.env.SEALED_HOLD_SINGLE_FORK === "1" ? { experimental: { cpus: 1 } } : {}),
  ...(taskOwnedSoundingLineBuild
    ? {
        env: {
          FOREVER_TASK_OWNED_ANIMATION_FAILPOINTS: "1",
          HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
          HOMEPORT_PHASE7_TASK_ROOT: process.env.HOMEPORT_PHASE7_TASK_ROOT ?? "",
          HOMEPORT_SYNTHETIC_OUTBOX_PATH: process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH ?? "",
          // This is compiled into only the task-owned browser build so the
          // ordinary browser proof can reach its existing local animation lab.
          // It is never enabled in a normal production build.
          NEXT_PUBLIC_ENABLE_ANIMATION_LAB: "true",
        },
      }
    : {}),
};

export default nextConfig;
