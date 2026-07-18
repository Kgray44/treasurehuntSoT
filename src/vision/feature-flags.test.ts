import { describe, expect, it } from "vitest";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";
describe("Vision feature flags", () => {
  it("enables B-2 capture surfaces in development but keeps inference disabled", () => {
    expect(resolveVisionFeatureFlags({ NODE_ENV: "development" })).toMatchObject({
      vision_waypoints: true,
      player_hold_to_scan: true,
      vision_companion: true,
      native_window_capture: true,
      creator_capture: true,
      mock_verification_consumer: true,
      vision_build_engine: false,
      automatic_vision_progression: false,
      live_external_ar: false,
    });
  });
  it("defaults production to unavailable and honors server configuration", () => {
    expect(resolveVisionFeatureFlags({ NODE_ENV: "production" }).vision_waypoints).toBe(false);
    expect(
      resolveVisionFeatureFlags({
        NODE_ENV: "production",
        FEATURE_VISION_WAYPOINTS: "true",
        FEATURE_PLAYER_HOLD_TO_SCAN: "true",
      }),
    ).toMatchObject({ vision_waypoints: true, player_hold_to_scan: true });
  });
});
