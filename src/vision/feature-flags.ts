export const visionFeatureKeys = [
  "vision_waypoints",
  "vision_waypoint_library",
  "desktop_shell",
  "pwa_install",
  "creator_capture",
  "vision_build_engine",
  "player_hold_to_scan",
  "shadow_verification",
  "automatic_progression",
  "automatic_vision_progression",
  "live_external_ar",
] as const;

export type VisionFeatureKey = (typeof visionFeatureKeys)[number];
export type VisionFeatureFlags = Record<VisionFeatureKey, boolean>;

const environmentNames: Record<VisionFeatureKey, string> = {
  vision_waypoints: "VISION_WAYPOINTS",
  vision_waypoint_library: "VISION_WAYPOINT_LIBRARY",
  desktop_shell: "DESKTOP_SHELL",
  pwa_install: "PWA_INSTALL",
  creator_capture: "CREATOR_CAPTURE",
  vision_build_engine: "VISION_BUILD_ENGINE",
  player_hold_to_scan: "PLAYER_HOLD_TO_SCAN",
  shadow_verification: "SHADOW_VERIFICATION",
  automatic_progression: "AUTOMATIC_PROGRESSION",
  automatic_vision_progression: "AUTOMATIC_VISION_PROGRESSION",
  live_external_ar: "LIVE_EXTERNAL_AR",
};

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on", "enabled"].includes(value.toLocaleLowerCase());
}

export function resolveVisionFeatureFlags(environment: Record<string, string | undefined> = process.env) {
  const development = environment.NODE_ENV !== "production";
  const read = (key: VisionFeatureKey, fallback: boolean) =>
    readBoolean(
      environment[`NEXT_PUBLIC_${environmentNames[key]}`] ?? environment[`FEATURE_${environmentNames[key]}`],
      fallback,
    );
  const vision = read("vision_waypoints", development);
  return {
    vision_waypoints: vision,
    vision_waypoint_library: read("vision_waypoint_library", vision),
    desktop_shell: read("desktop_shell", environment.TALL_TALE_DESKTOP === "1"),
    pwa_install: read("pwa_install", true),
    creator_capture: read("creator_capture", false),
    vision_build_engine: read("vision_build_engine", false),
    player_hold_to_scan: read("player_hold_to_scan", development && vision),
    shadow_verification: read("shadow_verification", false),
    automatic_progression: read("automatic_progression", false),
    automatic_vision_progression: read("automatic_vision_progression", false),
    live_external_ar: read("live_external_ar", false),
  } satisfies VisionFeatureFlags;
}

export const publicVisionFeatureFlags = resolveVisionFeatureFlags();

export function requireVisionFeature(key: VisionFeatureKey) {
  if (!resolveVisionFeatureFlags()[key]) {
    const error = new Error(`Feature ${key} is disabled.`);
    error.name = "VisionFeatureDisabledError";
    throw error;
  }
}
