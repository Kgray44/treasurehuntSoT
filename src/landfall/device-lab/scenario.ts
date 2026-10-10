import { z } from "zod";
import { landfallId, coordinateSchema } from "@/landfall/schema";
import { providerFamilySchema, providerHealthSchema, permissionNameSchema } from "@/landfall/provider-policy";

export { deviceLabTargetSchema, deviceLabEvidenceClassSchema, validateDeviceLabFidelity } from "@/device-lab/receipt";
export type { DeviceLabTarget, DeviceLabReceipt } from "@/device-lab/receipt";
import { deviceLabTargetSchema, type DeviceLabStepResult as SharedStepResult } from "@/device-lab/receipt";

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
    type: z.literal("REMOTE_DATA"),
    operation: z.enum(["STATUS", "SEARCH", "REVERSE", "ROUTE", "ELEVATION"]),
    fixture: z.enum(["VALID", "NOT_CONFIGURED", "RATE_LIMITED", "MALFORMED", "ABORTED"]),
  }),
  z.strictObject({
    type: z.literal("WATCHGLASS"),
    fixture: z.enum([
      "MATCH",
      "UNCERTAIN",
      "NOT_MATCH",
      "NOT_CONFIGURED",
      "WRONG_SCOPE",
      "WRONG_PACKAGE",
      "EXPIRED",
      "CIRCULAR",
    ]),
  }),
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
    type: z.literal("NATIVE_GEOFENCE"),
    operation: z.enum(["REGISTER", "ENTER", "CLEAR"]),
  }),
  z
    .strictObject({
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
      protocol: z.enum(["GENERIC", "IBEACON", "EDDYSTONE_UID"]).optional(),
      unverifiedPeer: z.boolean().optional(),
    })
    .refine((value) => value.family === "BLE" || value.protocol === undefined, "BLE protocol requires BLE family"),
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
    type: z.literal("INSTALLATION_TOKEN"),
    medium: z.enum(["QR", "NFC"]),
    fixture: z.enum([
      "VALID",
      "DUPLICATE",
      "EXPIRED",
      "WRONG_CHRONICLE",
      "WRONG_VERSION",
      "WRONG_WAYPOINT",
      "WRONG_MEDIUM",
      "TAMPERED",
      "MALFORMED",
      "UNKNOWN_KEY",
    ]),
  }),
  z.strictObject({
    type: z.literal("PACKAGE"),
    operation: z.enum(["DOWNLOAD", "INTERRUPT", "CORRUPT", "STORAGE_LOW", "STALE", "DELETE", "EXPIRE"]),
  }),
  z.strictObject({
    type: z.literal("NOTIFICATION"),
    operation: z.enum(["DELIVER", "OPEN", "DUPLICATE", "EXPIRE", "REVOKE_SESSION", "COMPLETE_SESSION"]),
    permissionDecision: z.enum(["GRANTED", "DENIED"]).optional(),
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
      "physicalAcquisitionStarts",
      "watchglassState",
      "reconciliationState",
      "remoteDataState",
      "remoteDataRequests",
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
    publishedFixture: z.enum(["landfall-device-lab-v1", "landfall-device-lab-restart-v2"]),
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

export type DeviceLabStepResult = Omit<SharedStepResult, "action"> & { action: DeviceLabAction["type"] };
