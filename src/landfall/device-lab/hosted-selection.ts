import { landfallDeviceScenario } from "@/landfall/device-lab/scenarios";

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
