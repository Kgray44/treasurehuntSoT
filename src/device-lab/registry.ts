import { z } from "zod";
import baseline from "../../Development_Docs/Spatial_Experience/device-lab-scenario-registry.json";
import ownership from "../../Development_Docs/Spatial_Experience/spatial-capability-ownership.json";

export const deviceLabTierSchema = z.enum(["D0", "D1", "D2", "D3", "D4", "D5"]);
export type DeviceLabTier = z.infer<typeof deviceLabTierSchema>;
const identifier = z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/);
const owner = z.enum([
  "SOUNDING_LINE",
  "SEXTANT",
  "LANDFALL",
  "PARALLAX",
  "CROSSDECK",
  "WATCHGLASS",
  "WAKEBOOK",
  "STORYTIDE",
  "FIGUREHEAD",
  "DRYDOCK",
  "HARBORLIGHT",
  "SEALED_HOLD",
]);
export const deviceLabRegistryEntrySchema = z.strictObject({
  scenarioId: identifier,
  version: z.number().int().positive(),
  owner,
  requiredCapabilities: z.array(identifier).min(1),
  minimumTier: deviceLabTierSchema,
  eligibleTiers: z.array(deviceLabTierSchema).min(1),
  privacyClassification: z.enum(["SYNTHETIC_OR_BOUNDED_TEST_EVIDENCE", "PROTECTED_TEST_EVIDENCE"]),
  soundingLineRegistration: z.literal("NOT_YET_REGISTERED_UNTIL_IMPLEMENTATION"),
  oracleOwner: owner,
  cleanupRequired: z.literal(true),
  implementationState: z.literal("REGISTRY_BASELINE_ONLY"),
});
const registrySchema = z.strictObject({
  schemaVersion: z.literal(1),
  registry: z.literal("device-lab-scenario-registry"),
  title: z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  repositoryBaseline: z.string().regex(/^[a-f0-9]{40}$/),
  program: z.literal("Voyagewright Spatial Experience"),
  authority: z.string().min(1),
  status: z.literal("GOVERNING_MACHINE_READABLE_BASELINE"),
  implementationClaim: z.literal("NONE"),
  tierVocabulary: z.strictObject({
    D0: z.string().min(1),
    D1: z.string().min(1),
    D2: z.string().min(1),
    D3: z.string().min(1),
    D4: z.string().min(1),
    D5: z.string().min(1),
  }),
  scenarios: z.array(deviceLabRegistryEntrySchema).min(1),
});
export type DeviceLabRegistryEntry = z.infer<typeof deviceLabRegistryEntrySchema>;
export type DeviceLabRegistry = z.infer<typeof registrySchema>;

/** Load governance as declarations, never executable handlers or passing evidence. */
export function loadDeviceLabRegistry(
  input: unknown = baseline,
  capabilityIds: readonly string[] = ownership.capabilities.map((entry) => entry.id),
): DeviceLabRegistry {
  const registry = registrySchema.parse(input);
  const capabilities = new Set(capabilityIds);
  const ids = new Set<string>();
  for (const entry of registry.scenarios) {
    if (ids.has(entry.scenarioId)) throw new Error("DEVICE_LAB_DUPLICATE_SCENARIO");
    ids.add(entry.scenarioId);
    if (
      new Set(entry.eligibleTiers).size !== entry.eligibleTiers.length ||
      !entry.eligibleTiers.includes(entry.minimumTier)
    )
      throw new Error("DEVICE_LAB_TIERS_INVALID");
    if (
      new Set(entry.requiredCapabilities).size !== entry.requiredCapabilities.length ||
      entry.requiredCapabilities.some((id) => !capabilities.has(id))
    )
      throw new Error("DEVICE_LAB_CAPABILITY_UNRESOLVED");
    const namespace = entry.owner === "SOUNDING_LINE" ? "core" : entry.owner.toLowerCase();
    if (!entry.scenarioId.startsWith(`${namespace}.`) || entry.owner !== entry.oracleOwner)
      throw new Error("DEVICE_LAB_OWNER_MISMATCH");
  }
  return registry;
}
export function deviceLabTierForTarget(target: string): DeviceLabTier {
  const tiers: Record<string, DeviceLabTier> = {
    "provider-simulation": "D0",
    "browser-emulation": "D1",
    "android-emulator": "D2",
    "ios-simulator": "D3",
    "real-android": "D4",
    "real-ios": "D4",
    field: "D5",
  };
  if (!Object.hasOwn(tiers, target)) throw new Error("DEVICE_LAB_TARGET_INVALID");
  return tiers[target];
}
