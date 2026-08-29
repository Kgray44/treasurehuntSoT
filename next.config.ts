import type { NextConfig } from "next";
import { homeportAllowedDevOrigins } from "./src/homeport/dev-origin-config";

const taskOwnedSoundingLineBuild =
  process.env.SOUNDING_LINE_TASK_OWNED_HTTP === "1" && Boolean(process.env.SOUNDING_LINE_SUITE_PROFILE);

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: homeportAllowedDevOrigins(),
  ...(taskOwnedSoundingLineBuild
    ? {
        env: {
          HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
          HOMEPORT_PHASE7_TASK_ROOT: process.env.HOMEPORT_PHASE7_TASK_ROOT ?? "",
          HOMEPORT_SYNTHETIC_OUTBOX_PATH: process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH ?? "",
        },
      }
    : {}),
};

export default nextConfig;
