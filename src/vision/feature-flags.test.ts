import { describe, expect, it } from "vitest";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";
describe("Vision feature flags", () => {
  it("enables the B-1 development path but keeps future capture and inference disabled", () => {
    expect(resolveVisionFeatureFlags({ NODE_ENV: "development" })).toMatchObject({
      vision_waypoints: true,
      player_hold_to_scan: true,
      creator_capture: false,
      vision_build_engine: false,
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
