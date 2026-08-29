import type { NextConfig } from "next";
import { homeportAllowedDevOrigins } from "./src/homeport/dev-origin-config";

const taskOwnedSoundingLineBuild =
  process.env.SOUNDING_LINE_TASK_OWNED_HTTP === "1" && Boolean(process.env.SOUNDING_LINE_SUITE_PROFILE);

if (taskOwnedSoundingLineBuild) {
  process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER = "TASK_OWNED_TEST";
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: homeportAllowedDevOrigins(),
  ...(taskOwnedSoundingLineBuild
    ? {
        env: {
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
