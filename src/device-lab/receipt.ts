import { z } from "zod";
import { deviceLabProfileSchema, validateDeviceLabProfile, type DeviceLabConfiguration } from "./device-profile";

export const deviceLabTargetSchema = z.enum([
  "provider-simulation",
  "android-emulator",
  "ios-simulator",
  "real-android",
  "real-ios",
  "field",
]);
export type DeviceLabTarget = z.infer<typeof deviceLabTargetSchema>;
export const deviceLabEvidenceClassSchema = z.enum([
  "UNIT_PROVEN",
  "PROVIDER_SIMULATION_PROVEN",
  "EMULATOR_PROVEN",
  "SIMULATOR_PROVEN",
  "HOSTED_WINDOWS_PROVEN",
  "HOSTED_LINUX_PROVEN",
  "HOSTED_MACOS_PROVEN",
  "REAL_DEVICE_PROVEN",
  "FIELD_PROVEN",
  "REAL_DEVICE_REQUIRED",
  "FIELD_REQUIRED",
  "UNSUPPORTED_IN_CURRENT_LAB",
  "NOT_CONFIGURED",
  "EXECUTION_FAILED",
]);
export type DeviceLabStepResult = {
  index: number;
  action: string;
  state: "PASS" | "FAIL" | "UNSUPPORTED";
  reason?: string;
  translation?: {
    method:
      | "OS_POWER_CONTROL"
      | "OS_PERMISSION_CONTROL"
      | "OS_SENSOR_CONTROL"
      | "OS_NEARBY_SESSION"
      | "OS_CAMERA_ACQUISITION"
      | "OS_GEOFENCE_REGISTRATION"
      | "OS_GEOFENCE_TRANSITION"
      | "OS_NOTIFICATION_UI"
      | "LOGICAL_PROVIDER"
      | "OS_LOCATION_INJECTION"
      | "OS_LIFECYCLE"
      | "OS_NETWORK_AND_SERVICE_FAULT"
      | "CONTROLLED_SERVICE_FAULT"
      | "REAL_CANONICAL_AUTHORITY"
      | "SHARED_WEB_CONTRACT";
    limitation?: string;
  };
};
export type DeviceLabReceipt = {
  version: 1;
  scenarioId: string;
  scenarioVersion: number;
  seed: number;
  sourceSha: string;
  sourceTree: string;
  sourceFingerprint: string;
  dirty: boolean;
  target: DeviceLabTarget;
  hostPlatform: string;
  environment: string;
  deviceProfile: string;
  deviceConfiguration?: DeviceLabConfiguration;
  osVersion: string;
  runtimeVersion: string;
  providerVersions: Record<string, string>;
  publishedFixture: string;
  fixtureHash: string;
  timing: "LOGICAL" | "WALL_CLOCK";
  toleranceMs: number;
  startedAt: string;
  endedAt: string;
  evidenceClass: z.infer<typeof deviceLabEvidenceClassSchema>;
  result: "PASS" | "FAIL" | "UNSUPPORTED" | "NOT_CONFIGURED";
  steps: DeviceLabStepResult[];
  canonicalProgressionEvents: number | null;
  canonicalAuthority?: "ONE_VOYAGE_REAL_SQLITE";
  authorityFixtureHash?: string;
  artifacts: { path: string; sha256: string; kind: "LOG" | "SCREENSHOT" | "VIDEO" | "TEST_RESULT" | "METRIC" }[];
  externalRequirements: string[];
  cleanup: { result: "PASS" | "FAIL"; ownedResources: string[]; remainingResources: string[] };
};

/** Receipts must make the fidelity boundary explicit, even if every software assertion passed. */
export function validateDeviceLabFidelity(receipt: DeviceLabReceipt): void {
  if (receipt.result === "PASS" && ["android-emulator", "ios-simulator"].includes(receipt.target)) {
    if (!receipt.deviceConfiguration) throw new Error("LANDFALL_LAB_DEVICE_CONFIGURATION_UNBOUND");
    validateDeviceLabProfile(deviceLabProfileSchema.parse(receipt.deviceProfile), receipt.deviceConfiguration);
    if ((receipt.target === "android-emulator") !== (receipt.deviceConfiguration.platform === "ANDROID"))
      throw new Error("LANDFALL_LAB_PROFILE_MISMATCH");
  }
  const actualClass = {
    "provider-simulation": "PROVIDER_SIMULATION_PROVEN",
    "android-emulator": "EMULATOR_PROVEN",
    "ios-simulator": "SIMULATOR_PROVEN",
    "real-android": "REAL_DEVICE_PROVEN",
    "real-ios": "REAL_DEVICE_PROVEN",
    field: "FIELD_PROVEN",
  } as const;
  if (
    !/^[a-f0-9]{40}$/.test(receipt.sourceSha) ||
    !/^[a-f0-9]{40}$/.test(receipt.sourceTree) ||
    !/^[a-f0-9]{64}$/.test(receipt.sourceFingerprint) ||
    !/^[a-f0-9]{64}$/.test(receipt.fixtureHash)
  )
    throw new Error("LANDFALL_LAB_SOURCE_UNBOUND");
  if (
    receipt.result === "PASS" &&
    (receipt.evidenceClass !== actualClass[receipt.target] ||
      receipt.steps.some((step) => step.state !== "PASS") ||
      receipt.cleanup.result !== "PASS" ||
      receipt.cleanup.remainingResources.length)
  )
    throw new Error("LANDFALL_LAB_FIDELITY_INVALID");
  if (
    receipt.canonicalProgressionEvents !== null &&
    (receipt.canonicalAuthority !== "ONE_VOYAGE_REAL_SQLITE" ||
      !/^[a-f0-9]{64}$/.test(receipt.authorityFixtureHash ?? ""))
  )
    throw new Error("LANDFALL_LAB_CANONICAL_PROOF_REQUIRES_ONE_VOYAGE");
}
