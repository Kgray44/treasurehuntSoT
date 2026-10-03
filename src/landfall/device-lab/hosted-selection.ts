import { landfallDeviceScenario } from "@/landfall/device-lab/scenarios";
import { deviceLabProfileSchema, type DeviceLabProfile } from "./device-profile";

/** Impact selection stays inside the governed tier and never invents a profile. */
export function hostedDeviceLabProfiles(
  platform: "android" | "ios",
  tier: "development" | "candidate" | "closure",
  selection?: string,
): DeviceLabProfile[] {
  const available: DeviceLabProfile[] = ["primary-phone"];
  if (tier === "closure" || (platform === "android" && tier === "candidate")) available.push("compatibility-phone");
  if (tier === "closure") {
    if (platform === "android") available.push("low-resource");
    available.push("tablet");
  }
  if (selection === undefined) return available;
  if (selection.length > 128 || !/^[a-z-]+(?:,[a-z-]+)*$/.test(selection))
    throw new Error("LANDFALL_HOSTED_PROFILES_INVALID");
  const requested = selection.split(",").map((value) => deviceLabProfileSchema.parse(value));
  if (new Set(requested).size !== requested.length || requested.some((value) => !available.includes(value)))
    throw new Error("LANDFALL_HOSTED_PROFILES_INVALID");
  return available.filter((value) => requested.includes(value));
}

const common = [
  "gps-perfect-walk",
  "offline-native-canonical-reconcile",
  "offline-lost-response-canonical-reconcile",
  "offline-restart-canonical-reconcile",
  "virtual-player-navigation",
  "virtual-offline-canonical-reconcile",
];
const defaults = {
  ios: ["permission-denied-native", "permission-revoked-mid-route", ...common],
  android: [
    "permission-denied-native",
    "permission-approximate-native",
    "permission-revoked-mid-route",
    "motion-walk",
    "stationary",
    "barometer-floor-change",
    "orientation-turn",
    "heading-turn",
    ...common,
    "battery-normal",
    "battery-low",
    "battery-saver",
    "charger-change",
  ],
};

/** Only canonical IDs reach a hosted command; arbitrary command text is refused. */
export function hostedDeviceLabScenarios(platform: "ios" | "android" | "provider", selection?: string): string {
  if (selection === undefined) return platform === "provider" ? "all" : defaults[platform].join(",");
  if (selection.length > 4096 || !/^[a-z0-9-]+(?:,[a-z0-9-]+)*$/.test(selection))
    throw new Error("LANDFALL_HOSTED_SCENARIOS_INVALID");
  const ids = selection.split(",");
  if (ids.length > 128 || new Set(ids).size !== ids.length) throw new Error("LANDFALL_HOSTED_SCENARIOS_INVALID");
  const target =
    platform === "ios" ? "ios-simulator" : platform === "android" ? "android-emulator" : "provider-simulation";
  for (const id of ids)
    if (!landfallDeviceScenario(id).targets.includes(target))
      throw new Error("LANDFALL_HOSTED_SCENARIO_TARGET_UNSUPPORTED");
  return ids.join(",");
}
