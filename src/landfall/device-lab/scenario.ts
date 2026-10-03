import { z } from "zod";
import { landfallId, coordinateSchema } from "@/landfall/schema";
import { providerFamilySchema, providerHealthSchema, permissionNameSchema } from "@/landfall/provider-policy";

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
]);
export const deviceLabActionSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("LOCATION"),
    coordinate: coordinateSchema,
    accuracy: z.number().finite().positive().max(100000),
    ageMs: z.number().int().min(0).max(3600000),
    provider: z.enum(["BROWSER", "IOS", "ANDROID"]),
    duplicate: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("LIFECYCLE"),
    state: z.enum(["FOREGROUND", "BACKGROUND", "SCREEN_LOCKED", "SUSPENDED", "TERMINATED", "RELAUNCH"]),
    operation: z.enum(["DEFAULT", "FORCE_STOP", "PROCESS_KILL", "ACTIVITY_RECREATE", "REBOOT"]).optional(),
  }),
  z.strictObject({
    type: z.literal("PERMISSION"),
    permission: permissionNameSchema,
    state: z.enum(["GRANTED", "APPROXIMATE", "DENIED", "DENIED_PERMANENTLY", "REVOKED", "UNSUPPORTED"]),
  }),
  z.strictObject({
    type: z.literal("NETWORK"),
    state: z.enum(["ONLINE", "DEGRADED", "CAPTIVE_OR_UNUSABLE", "OFFLINE", "UNKNOWN"]),
    latencyMs: z.number().int().min(0).max(30000),
    packetLossPercent: z.number().min(0).max(100),
  }),
  z.strictObject({
    type: z.literal("POWER"),
    batteryPercent: z.number().int().min(0).max(100),
    saver: z.boolean(),
    charging: z.boolean(),
    thermal: z.boolean(),
    doze: z.boolean(),
  }),
  z.strictObject({ type: z.literal("PROVIDER"), family: providerFamilySchema, health: providerHealthSchema }),
  z.strictObject({
    type: z.literal("SENSOR"),
    kind: z.enum([
      "HEADING",
      "MOTION",
      "BAROMETER",
      "ORIENTATION",
      "ACCELEROMETER",
      "STATIONARY",
      "CONFLICT",
      "MISSING",
    ]),
    values: z.array(z.number().finite().min(-100000).max(100000)).max(4),
  }),
  z.strictObject({
    type: z.literal("GEOFENCE"),
    event: z.enum(["ENTER", "EXIT", "DWELL"]),
    ageMs: z.number().int().min(0).max(3600000),
    duplicate: z.boolean(),
  }),
  z.strictObject({
    type: z.literal("NEARBY"),
    family: z.enum(["BLE", "UWB"]),
    state: z.enum([
      "APPROACH",
      "RETREAT",
      "DIRECTION",
      "DISCONNECT",
      "RECONNECT",
      "PEER_LOST",
      "UNSUPPORTED",
      "STRONG",
      "WEAK",
      "MULTIPLE",
      "DISABLED",
    ]),
    distance: z.number().finite().min(0).max(10000).optional(),
    uncertainty: z.number().finite().min(0).max(10000).optional(),
  }),
  z.strictObject({
    type: z.literal("TOKEN"),
    medium: z.enum(["QR", "NFC"]),
    fixture: z.enum([
      "VALID",
      "EXPIRED",
      "DUPLICATE",
      "WRONG_CHRONICLE",
      "WRONG_VERSION",
      "TAMPERED",
      "MALFORMED",
      "UNSIGNED",
      "REPLAY",
      "UNRELATED",
    ]),
  }),
  z.strictObject({
    type: z.literal("PACKAGE"),
    operation: z.enum(["DOWNLOAD", "INTERRUPT", "CORRUPT", "STORAGE_LOW", "STALE", "DELETE", "EXPIRE"]),
  }),
  z.strictObject({
    type: z.literal("NOTIFICATION"),
    operation: z.enum(["DELIVER", "OPEN", "DUPLICATE", "EXPIRE", "REVOKE_SESSION", "COMPLETE_SESSION"]),
  }),
  z.strictObject({
    type: z.literal("RECONCILE"),
    outcome: z.enum(["ACCEPT", "CONFLICT", "REVOKED", "UNAVAILABLE", "DUPLICATE", "LOST_RESPONSE"]),
  }),
  z.strictObject({
    type: z.literal("ASSERT"),
    field: z.enum([
      "confidence",
      "rejection",
      "completionRequests",
      "serverConfirmed",
      "clientConfirmed",
      "backgroundResult",
      "notificationState",
      "packageState",
      "providerState",
      "powerProfile",
      "canonicalProgressionEvents",
      "sensorState",
      "nearbyState",
      "tokenState",
      "reconciliationState",
    ]),
    value: z.union([z.string().max(128), z.number().int().nonnegative(), z.boolean(), z.null()]),
  }),
]);
export type DeviceLabAction = z.infer<typeof deviceLabActionSchema>;
export const deviceLabScenarioSchema = z
  .strictObject({
    id: landfallId,
    version: z.number().int().positive(),
    description: z.string().min(1).max(1000),
    seed: z.number().int().min(1).max(2147483647),
    worldspace: z.enum(["PHYSICAL", "VIRTUAL"]),
    publishedFixture: z.literal("landfall-device-lab-v1"),
    canonicalAuthority: z.enum(["NONE", "ONE_VOYAGE"]).default("NONE"),
    targets: z.array(deviceLabTargetSchema).min(1).max(6),
    deviceProfiles: z
      .array(z.enum(["primary-phone", "compatibility-phone", "low-resource", "tablet", "nearby-peer"]))
      .min(1)
      .max(5),
    providers: z.array(providerFamilySchema).min(1).max(26),
    timing: z.enum(["LOGICAL", "WALL_CLOCK"]),
    toleranceMs: z.number().int().min(0).max(30000),
    physicalRequired: z
      .array(
        z.enum([
          "RF",
          "NFC_RADIO",
          "GPS_MULTIPATH",
          "BATTERY",
          "THERMAL",
          "CAMERA",
          "SUSPENSION",
          "OEM_PROCESS_POLICY",
          "ASSISTIVE_TECH",
          "FIELD_ENVIRONMENT",
          "SENSOR_DRIFT",
        ]),
      )
      .max(11),
    timeline: z
      .array(z.strictObject({ atMs: z.number().int().min(0).max(3600000), action: deviceLabActionSchema }))
      .min(1)
      .max(256),
  })
  .superRefine((scenario, context) => {
    if (new Set(scenario.targets).size !== scenario.targets.length)
      context.addIssue({ code: "custom", path: ["targets"], message: "Targets must be unique." });
    let previous = -1;
    scenario.timeline.forEach((step, index) => {
      if (step.atMs < previous)
        context.addIssue({ code: "custom", path: ["timeline", index, "atMs"], message: "Timeline must be ordered." });
      previous = step.atMs;
    });
    if (!scenario.timeline.some((step) => step.action.type === "ASSERT"))
      context.addIssue({
        code: "custom",
        path: ["timeline"],
        message: "A scenario needs explicit observed assertions.",
      });
  });
export type DeviceLabScenario = z.infer<typeof deviceLabScenarioSchema>;

export type DeviceLabStepResult = {
  index: number;
  action: DeviceLabAction["type"];
  state: "PASS" | "FAIL" | "UNSUPPORTED";
  reason?: string;
  translation?: {
    method:
      | "OS_POWER_CONTROL"
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
