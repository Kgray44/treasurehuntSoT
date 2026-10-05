import { z } from "zod";
import { deviceLabEvidenceClassSchema, deviceLabTargetSchema } from "@/landfall/device-lab/scenario";
import { deviceLabProfileSchema } from "@/landfall/device-lab/device-profile";
import { landfallDeviceScenario } from "@/landfall/device-lab/scenarios";
import { providerFamilySchema } from "@/landfall/provider-policy";

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
export const drydockDeviceLabReferenceSchema = z.strictObject({
  kind: z.literal("LANDFALL_DEVICE_LAB_REFERENCE"),
  sourceChecksum: checksum,
  receiptChecksum: checksum,
  sourceSha: commit,
  sourceTree: commit,
  fixtureHash: checksum,
  scenarioId: z
    .string()
    .min(1)
    .max(96)
    .regex(/^[a-z0-9-]+$/),
  scenarioVersion: z.number().int().min(1).max(1000),
  target: deviceLabTargetSchema,
  deviceProfile: deviceLabProfileSchema,
  providerFamily: providerFamilySchema,
  evidenceClass: deviceLabEvidenceClassSchema,
  result: z.enum(["PASS", "FAIL", "UNSUPPORTED", "NOT_CONFIGURED"]),
  expiresAt: z.string().datetime().optional(),
});

/** An Administrator references evidence; Drydock does not execute or promote it. */
export function drydockDeviceLabReference(input: unknown) {
  const reference = drydockDeviceLabReferenceSchema.parse(input);
  const scenario = landfallDeviceScenario(reference.scenarioId);
  if (scenario.version !== reference.scenarioVersion) throw new Error("DRYDOCK_DEVICE_LAB_SCENARIO_STALE");
  if (
    !scenario.targets.includes(reference.target) ||
    !scenario.providers.includes(reference.providerFamily) ||
    !scenario.deviceProfiles.includes(reference.deviceProfile)
  )
    throw new Error("DRYDOCK_DEVICE_LAB_SCOPE_MISMATCH");
  const provenClass = {
    "provider-simulation": "PROVIDER_SIMULATION_PROVEN",
    "android-emulator": "EMULATOR_PROVEN",
    "ios-simulator": "SIMULATOR_PROVEN",
    "real-android": "REAL_DEVICE_PROVEN",
    "real-ios": "REAL_DEVICE_PROVEN",
    field: "FIELD_PROVEN",
  };
  if (reference.result === "PASS" && reference.evidenceClass !== provenClass[reference.target])
    throw new Error("DRYDOCK_DEVICE_LAB_FIDELITY_MISMATCH");
  return {
    providerId: "landfall-device-lab",
    providerVersion: reference.sourceSha,
    evidenceKind: `DEVICE_LAB:${reference.scenarioId}:${reference.target}:${reference.deviceProfile}`,
    status: reference.result === "PASS" ? ("EXTERNAL_VALIDATION_REQUIRED" as const) : ("UNAVAILABLE" as const),
    safeSummary: `${reference.scenarioId} v${reference.scenarioVersion}: ${reference.evidenceClass}/${reference.result}; ${reference.providerFamily}/${reference.deviceProfile}. Code ${reference.sourceSha}; fixture ${reference.fixtureHash}. Evidence is referenced; Chronicle-specific acceptance and physical gates require review.`,
    sourceReference: `sha256:${reference.receiptChecksum};tree:${reference.sourceTree};target:${reference.target}`,
    expectedSourceChecksum: reference.sourceChecksum,
    expiresAt: reference.expiresAt ? new Date(reference.expiresAt) : undefined,
  };
}
