import registry from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Capability_Registry.json";
import phase2Activation from "../../Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_2_Capability_Activation_Registry.json";
import { isAdmiraltyCapability } from "./capabilities";

export type AdmiraltyRegistryEntry = (typeof registry.entries)[number];

export function admiraltyCapabilityRegistry() {
  const activations = new Map(phase2Activation.activations.map((activation) => [activation.id, activation]));
  return registry.entries.map((entry) => {
    const activation = activations.get(entry.id);
    return activation
      ? {
          ...entry,
          lifecycleState: "IMPLEMENTED",
          uiMapping: activation.uiMapping,
          notes: `${entry.notes} Phase 2 read projection activated.`,
        }
      : entry;
  }) as readonly AdmiraltyRegistryEntry[];
}

export function admiraltyRegistrySummary() {
  const entries = admiraltyCapabilityRegistry();
  const byCategory = Object.fromEntries(
    [...new Set(entries.map((entry) => entry.category))]
      .sort()
      .map((category) => [category, entries.filter((entry) => entry.category === category).length]),
  );
  return {
    schemaVersion: registry.schemaVersion,
    total: entries.length,
    implemented: entries.filter((entry) => entry.lifecycleState === "IMPLEMENTED").length,
    dormant: entries.filter((entry) => entry.lifecycleState === "DORMANT").length,
    phase1Implemented: phase2Activation.baseImplemented,
    phase2Implemented: phase2Activation.newlyImplemented,
    byCategory,
  };
}

export function validateAdmiraltyRegistry() {
  const entries = admiraltyCapabilityRegistry();
  const ids = new Set<string>();
  const problems: string[] = [];
  for (const entry of entries) {
    if (ids.has(entry.id)) problems.push(`duplicate:${entry.id}`);
    ids.add(entry.id);
    if (!isAdmiraltyCapability(entry.requiredAdministrativeCapability)) problems.push(`unknown-capability:${entry.id}`);
  }
  const expected = {
    PLATFORM_OVERVIEW: 19,
    ACCOUNTS_AND_PEOPLE: 13,
    CHRONICLE_ADMINISTRATION: 12,
    COMMUNITY_ADMINISTRATION: 12,
    SYSTEM_CONFIGURATION: 27,
    AUDIT: 9,
  } as const;
  for (const [category, count] of Object.entries(expected))
    if (entries.filter((entry) => entry.category === category).length !== count) problems.push(`floor:${category}`);
  if (entries.length !== 92) problems.push("floor:total");
  return { valid: problems.length === 0, problems };
}
