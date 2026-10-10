import { createHash } from "node:crypto";
import { z } from "zod";
import { deviceLabTierSchema, type DeviceLabTier } from "./registry";
import { DeviceLabScenarioPacks, type DeviceLabAdapter, type DeviceLabExecutionResult } from "./scenario-pack";

const sourceSchema = z.strictObject({
  sourceSha: z.string().regex(/^[a-f0-9]{40}$/),
  sourceTree: z.string().regex(/^[a-f0-9]{40}$/),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  dirty: z.boolean(),
});
const contextSchema = z.strictObject({
  source: sourceSchema,
  baseSha: z.string().regex(/^[a-f0-9]{40}$/),
  tier: deviceLabTierSchema,
  profile: z.string().min(1),
  hostOs: z.string().min(1),
  runtimeVersion: z.string().min(1),
  capabilitySnapshot: z.array(z.string().min(1)),
});
export type DeviceLabRunContext = z.infer<typeof contextSchema>;
const resultSchema = z.strictObject({
  assertions: z
    .array(
      z.strictObject({
        id: z.string().min(1),
        state: z.enum(["PASS", "FAIL", "UNSUPPORTED"]),
        reason: z.string().optional(),
      }),
    )
    .min(1),
  unsupportedCapabilities: z.array(z.string().min(1)),
  artifacts: z.array(
    z.strictObject({
      path: z.string().min(1),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      kind: z.enum(["LOG", "SCREENSHOT", "VIDEO", "TEST_RESULT", "METRIC"]),
    }),
  ),
});
const cleanupSchema = z.strictObject({
  result: z.enum(["PASS", "FAIL"]),
  ownedResources: z.array(z.string()),
  remainingResources: z.array(z.string()),
});
const evidenceByTier: Record<DeviceLabTier, string> = {
  D0: "PROVIDER_SIMULATION_PROVEN",
  D1: "BROWSER_EMULATION_PROVEN",
  D2: "EMULATOR_PROVEN",
  D3: "SIMULATOR_PROVEN",
  D4: "REAL_DEVICE_PROVEN",
  D5: "FIELD_PROVEN",
};

/** v2 is a new platform envelope. Historical v1 Landfall receipts are never rewritten. */
export async function runDeviceLabScenario(packs: DeviceLabScenarioPacks, id: string, input: DeviceLabRunContext) {
  const context = contextSchema.parse(input);
  const { declaration, definition, createAdapter } = packs.resolve(id);
  const startedAt = new Date().toISOString();
  let disposition: "PASS" | "FAIL" | "UNSUPPORTED" = "UNSUPPORTED";
  let failureClassification: string | undefined;
  let result: DeviceLabExecutionResult = { assertions: [], unsupportedCapabilities: [], artifacts: [] };
  let cleanup: z.infer<typeof cleanupSchema> = { result: "PASS", ownedResources: [], remainingResources: [] };
  const missing = declaration.requiredCapabilities.filter(
    (capability) => !context.capabilitySnapshot.includes(capability),
  );
  if (
    !definition.tiers.includes(context.tier) ||
    !definition.preferredProfiles.includes(context.profile) ||
    missing.length
  ) {
    failureClassification = "TARGET_PROFILE_OR_CAPABILITY_UNSUPPORTED";
    result.unsupportedCapabilities = missing;
  } else {
    let adapter: DeviceLabAdapter | undefined;
    const controller = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      adapter = createAdapter();
      const execution = Promise.resolve()
        .then(() => adapter!.execute({ signal: controller.signal, tier: context.tier, profile: context.profile }))
        .finally(() => {
          settled = true;
        });
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("DEVICE_LAB_TIMEOUT"));
        }, definition.timeoutMs);
      });
      result = resultSchema.parse(await Promise.race([execution, deadline]));
      if (
        new Set(result.assertions.map((assertion) => assertion.id)).size !== result.assertions.length ||
        definition.protectedContracts.some((id) => !result.assertions.some((assertion) => assertion.id === id)) ||
        definition.expectedArtifacts.some((kind) => !result.artifacts.some((artifact) => artifact.kind === kind))
      )
        throw new Error("DEVICE_LAB_ASSERTIONS_INVALID");
      disposition = result.assertions.some((assertion) => assertion.state === "FAIL")
        ? "FAIL"
        : result.unsupportedCapabilities.length ||
            result.assertions.some((assertion) => assertion.state === "UNSUPPORTED")
          ? "UNSUPPORTED"
          : "PASS";
      if (disposition === "FAIL") failureClassification = "PRODUCT_ASSERTION_FAILURE";
    } catch (error) {
      disposition = "FAIL";
      failureClassification =
        error instanceof Error && error.message === "DEVICE_LAB_TIMEOUT" ? "TIMEOUT" : "EXECUTION_OR_RESULT_INVALID";
    } finally {
      if (timer) clearTimeout(timer);
      controller.abort();
      if (adapter) {
        let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
        try {
          cleanup = cleanupSchema.parse(
            await Promise.race([
              adapter.cleanup(),
              new Promise<never>((_, reject) => {
                cleanupTimer = setTimeout(() => reject(new Error("DEVICE_LAB_CLEANUP_TIMEOUT")), definition.timeoutMs);
              }),
            ]),
          );
        } catch {
          cleanup = { result: "FAIL", ownedResources: [], remainingResources: ["adapter-cleanup-unconfirmed"] };
        } finally {
          if (cleanupTimer) clearTimeout(cleanupTimer);
        }
        if (!settled) {
          cleanup.result = "FAIL";
          cleanup.remainingResources.push("adapter-execution-unsettled");
        }
      }
      if (cleanup.result !== "PASS" || cleanup.remainingResources.length) {
        disposition = "FAIL";
        failureClassification = failureClassification ?? "CLEANUP_FAILURE";
      }
    }
  }
  return {
    version: 2 as const,
    scenarioId: id,
    scenarioVersion: definition.version,
    owningProject: definition.owner,
    scenarioFingerprint: createHash("sha256").update(JSON.stringify({ declaration, definition })).digest("hex"),
    ...context,
    physicalOrVirtual: ["D4", "D5"].includes(context.tier) ? "PHYSICAL" : "VIRTUAL",
    startedAt,
    completedAt: new Date().toISOString(),
    assertions: result.assertions,
    evidenceClass:
      disposition === "PASS"
        ? evidenceByTier[context.tier]
        : disposition === "FAIL"
          ? "EXECUTION_FAILED"
          : "UNSUPPORTED_IN_CURRENT_LAB",
    unsupportedCapabilities: result.unsupportedCapabilities,
    requiredFutureGates: definition.requiredFutureGates,
    artifacts: result.artifacts,
    privacyClassification: declaration.privacyClassification,
    cleanupReceipt: cleanup,
    passFailDisposition: disposition,
    ...(failureClassification ? { failureClassification } : {}),
  };
}
