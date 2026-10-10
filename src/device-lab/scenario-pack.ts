import { z } from "zod";
import {
  deviceLabTierSchema,
  type DeviceLabRegistry,
  type DeviceLabRegistryEntry,
  type DeviceLabTier,
} from "./registry";

export const deviceLabExecutionSchema = z.strictObject({
  scenarioId: z.string().min(1),
  version: z.number().int().positive(),
  owner: z.string().min(1),
  description: z.string().min(1).max(1000),
  tiers: z.array(deviceLabTierSchema).min(1),
  preferredProfiles: z.array(z.string().min(1)).min(1),
  fixtures: z.array(z.string().min(1)).min(1),
  protectedContracts: z.array(z.string().min(1)).min(1),
  expectedArtifacts: z.array(z.string().min(1)),
  timeoutMs: z.number().int().min(1).max(3600000),
  soundingLineTests: z.array(z.string().regex(/^(src|tests)\/.*\.test\.(ts|tsx|mjs)$/)).min(1),
  requiredFutureGates: z.array(z.string().min(1)),
});
export type DeviceLabExecution = z.infer<typeof deviceLabExecutionSchema>;
export type DeviceLabAssertion = { id: string; state: "PASS" | "FAIL" | "UNSUPPORTED"; reason?: string };
export type DeviceLabExecutionResult = {
  assertions: DeviceLabAssertion[];
  unsupportedCapabilities: string[];
  artifacts: { path: string; sha256: string; kind: "LOG" | "SCREENSHOT" | "VIDEO" | "TEST_RESULT" | "METRIC" }[];
};
/** Resources are acquired by adapters through the existing verification resource governor.
 * Adapters must settle on abort; cleanup must report anything still owned. No parallel lock system. */
export type DeviceLabAdapter = {
  execute(context: { signal: AbortSignal; tier: DeviceLabTier; profile: string }): Promise<DeviceLabExecutionResult>;
  cleanup(): Promise<{ result: "PASS" | "FAIL"; ownedResources: string[]; remainingResources: string[] }>;
};
export type DeviceLabScenarioPack = {
  owner: string;
  scenarios: { definition: DeviceLabExecution; createAdapter: () => DeviceLabAdapter }[];
};

export class DeviceLabScenarioPacks {
  private readonly registered = new Map<
    string,
    { declaration: DeviceLabRegistryEntry; definition: DeviceLabExecution; createAdapter: () => DeviceLabAdapter }
  >();
  private readonly registry: DeviceLabRegistry;
  constructor(registry: DeviceLabRegistry) {
    this.registry = structuredClone(registry);
  }
  register(pack: DeviceLabScenarioPack) {
    const entries = pack.scenarios.map(({ definition: input, createAdapter }) => {
      const definition = deviceLabExecutionSchema.parse(input);
      const declaration = this.registry.scenarios.find((entry) => entry.scenarioId === definition.scenarioId);
      if (
        !declaration ||
        declaration.owner !== pack.owner ||
        definition.owner !== pack.owner ||
        declaration.version !== definition.version
      )
        throw new Error("DEVICE_LAB_REGISTRATION_MISMATCH");
      if (
        new Set(definition.tiers).size !== definition.tiers.length ||
        definition.tiers.some((tier) => !declaration.eligibleTiers.includes(tier)) ||
        typeof createAdapter !== "function"
      )
        throw new Error("DEVICE_LAB_REGISTRATION_INVALID");
      return { declaration: structuredClone(declaration), definition, createAdapter };
    });
    const ids = entries.map((entry) => entry.definition.scenarioId);
    if (new Set(ids).size !== ids.length || ids.some((id) => this.registered.has(id)))
      throw new Error("DEVICE_LAB_DUPLICATE_EXECUTABLE");
    // Commit only after validating the whole pack.
    for (const entry of entries) this.registered.set(entry.definition.scenarioId, entry);
  }
  resolve(id: string) {
    const entry = this.registered.get(id);
    if (!entry) throw new Error("DEVICE_LAB_NOT_IMPLEMENTED");
    return { ...entry, declaration: structuredClone(entry.declaration), definition: structuredClone(entry.definition) };
  }
  status() {
    return this.registry.scenarios.map((entry) => ({
      scenarioId: entry.scenarioId,
      state: this.registered.has(entry.scenarioId) ? "EXECUTABLE_REGISTERED" : "REGISTRY_BASELINE_ONLY",
    }));
  }
}
