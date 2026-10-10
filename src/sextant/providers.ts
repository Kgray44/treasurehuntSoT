import { z } from "zod";
import { frameSchema, stateSchema, type SextantProvider } from "./contracts";
import { SextantCapabilityRegistry } from "./capabilities";
const definitionSchema = z.strictObject({
  providerId: z.string().regex(/^[a-z][a-z0-9.-]+$/),
  providerVersion: z.number().int().positive(),
  platformFamily: z.enum(["WEB", "IOS", "ANDROID", "SYNTHETIC", "COMPATIBILITY"]),
  capabilities: z.array(z.string()).min(1),
  discoveryMethod: z.literal("EXPLICIT"),
  permissionRequirements: z.array(z.string()),
  lifecycleConstraints: z.literal("FOREGROUND_ONLY"),
  qualityMetadata: z.literal("PER_OBSERVATION"),
  referenceFrames: z.array(frameSchema).min(1),
  samplingBounds: z.strictObject({
    minimumIntervalMs: z.number().finite().positive(),
    maximumIntervalMs: z.number().finite().positive(),
  }),
  powerClass: z.enum(["LOW", "VARIABLE"]),
  privacyClass: z.literal("LOCAL_EPHEMERAL"),
  simulationSupport: z.boolean(),
});
export class SextantProviderRegistry {
  private readonly providers = new Map<string, SextantProvider>();
  private readonly definitions = new Map<string, SextantProvider["definition"]>();
  constructor(
    private readonly capabilities: SextantCapabilityRegistry,
    readonly mode: "PRODUCTION" | "DEVICE_LAB" = "PRODUCTION",
  ) {}
  register(provider: SextantProvider) {
    const d = definitionSchema.parse(provider.definition);
    if (
      this.providers.has(d.providerId) ||
      new Set(d.capabilities).size !== d.capabilities.length ||
      d.samplingBounds.minimumIntervalMs > d.samplingBounds.maximumIntervalMs
    )
      throw new Error("SEXTANT_PROVIDER_INVALID");
    if (
      (d.platformFamily === "SYNTHETIC") !== Boolean(provider.simulationIdentity) ||
      (provider.simulationIdentity && (this.mode !== "DEVICE_LAB" || !d.simulationSupport))
    )
      throw new Error("SEXTANT_SIMULATION_FORBIDDEN");
    for (const id of d.capabilities) {
      const c = this.capabilities.get(id);
      if (!c.frames.some((f) => d.referenceFrames.includes(f)) || !d.permissionRequirements.includes(c.permission))
        throw new Error("SEXTANT_PROVIDER_CONTRACT_MISMATCH");
    }
    this.definitions.set(d.providerId, structuredClone(d));
    this.providers.set(d.providerId, {
      definition: Object.freeze({
        ...structuredClone(d),
        capabilities: Object.freeze([...d.capabilities]) as unknown as string[],
        referenceFrames: Object.freeze([...d.referenceFrames]) as unknown as typeof d.referenceFrames,
        permissionRequirements: Object.freeze([...d.permissionRequirements]) as unknown as string[],
      }),
      simulationIdentity: provider.simulationIdentity,
      discover: (id) => provider.discover(id),
      start: (context) => provider.start(context),
      setUpdateClass: (updateClass) => provider.setUpdateClass(updateClass),
      stop: () => provider.stop(),
    });
  }
  definition(provider: SextantProvider) {
    const d = this.definitions.get(provider.definition.providerId);
    if (!d) throw new Error("SEXTANT_PROVIDER_UNKNOWN");
    return structuredClone(d);
  }
  candidates(id: string, frames?: readonly string[]) {
    this.capabilities.get(id);
    return [...this.providers.values()].filter((p) => {
      const d = this.definition(p);
      if (
        !d.capabilities.includes(id) ||
        (frames && !frames.some((f) => d.referenceFrames.includes(f as z.infer<typeof frameSchema>)))
      )
        return false;
      try {
        const s = stateSchema.parse(p.discover(id));
        return (
          s.support === "SUPPORTED" && ["AVAILABLE", "DEGRADED"].includes(s.availability) && s.lifecycle !== "SUSPENDED"
        );
      } catch {
        return false;
      }
    });
  }
  states(id: string) {
    this.capabilities.get(id);
    return [...this.providers.values()]
      .filter((p) => p.definition.capabilities.includes(id))
      .flatMap((p) => {
        try {
          return [stateSchema.parse(p.discover(id))];
        } catch {
          return [];
        }
      });
  }
  list() {
    return [...this.definitions.values()].map((d) => structuredClone(d));
  }
}
