import { z } from "zod";
import { SextantCapabilityRegistry } from "./capabilities";
import { qualitySchema } from "./contracts";
import { magneticHuntSchema } from "./field-context";

const identifier = z.string().regex(/^[a-z][a-z0-9.-]{1,100}$/);
export const capabilityRequirementSchema = z
  .strictObject({
    capabilityId: identifier,
    semanticVersionRange: z.strictObject({ minimum: z.literal(1), maximum: z.literal(1) }),
    importance: z.enum(["PREFERRED", "REQUIRED_RESTRICTED"]),
    minimumQuality: qualitySchema,
    fallbackIds: z.array(identifier).min(1).max(8),
    accessibilityAlternative: z.string().trim().min(1).max(500),
    userPurposeCopy: z.string().trim().min(1).max(500),
    foregroundOnly: z.literal(true),
    drydockScenarioRequirements: z
      .array(z.enum(["UNAVAILABLE", "DENIED", "DEGRADED", "ACCESSIBLE_ALTERNATIVE"]))
      .min(4)
      .max(4),
    evidenceUse: z.enum(["LOCAL_GUIDANCE", "CONSUMER_REQUALIFIED"]),
  })
  .superRefine((v, ctx) => {
    const registry = new SextantCapabilityRegistry();
    try {
      registry.get(v.capabilityId);
    } catch {
      ctx.addIssue({ code: "custom", message: "SEXTANT_CAPABILITY_UNKNOWN" });
    }
    if (new Set(v.drydockScenarioRequirements).size !== 4 || new Set(v.fallbackIds).size !== v.fallbackIds.length)
      ctx.addIssue({ code: "custom", message: "SEXTANT_REQUIRED_SCENARIOS_OR_FALLBACK_INVALID" });
    if (v.evidenceUse === "CONSUMER_REQUALIFIED" && ["UNKNOWN", "LOW"].includes(v.minimumQuality))
      ctx.addIssue({ code: "custom", message: "SEXTANT_COMPLETION_QUALITY_INSUFFICIENT" });
  });
/** Immutable authored data only; no hardware APIs, calibration fingerprints, nearby identities or raw media. */
export const sextantAuthoringSchema = z
  .strictObject({
    version: z.literal(1),
    requirements: z.array(capabilityRequirementSchema).min(1).max(32),
    fallbacks: z
      .array(z.strictObject({ id: identifier, text: z.string().trim().min(1).max(500) }))
      .min(1)
      .max(32),
    audience: z.enum(["GENERAL", "RESTRICTED_HARDWARE"]),
    prePlayDisclosure: z.string().trim().max(1000),
    targetProfile: z.enum(["WEB_BASELINE", "ENHANCED_WEB", "NATIVE_STANDARD", "NATIVE_ADVANCED", "ACCESSORY_REQUIRED"]),
    magneticHunt: magneticHuntSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const ids = new Set(v.fallbacks.map((f) => f.id));
    if (
      ids.size !== v.fallbacks.length ||
      new Set(v.requirements.map((r) => r.capabilityId)).size !== v.requirements.length
    )
      ctx.addIssue({ code: "custom", message: "SEXTANT_AUTHORING_DUPLICATE" });
    if (v.requirements.some((r) => r.fallbackIds.some((id) => !ids.has(id))))
      ctx.addIssue({ code: "custom", message: "SEXTANT_FALLBACK_UNRESOLVED" });
    if (
      v.requirements.some((r) => r.importance === "REQUIRED_RESTRICTED") &&
      (v.audience !== "RESTRICTED_HARDWARE" || !v.prePlayDisclosure.trim() || v.targetProfile === "WEB_BASELINE")
    )
      ctx.addIssue({ code: "custom", message: "SEXTANT_RESTRICTED_AUDIENCE_REQUIRED" });
    if (
      v.magneticHunt &&
      !v.requirements.some(
        (r) => r.capabilityId === "sextant.magnetic.field" || r.capabilityId === "sextant.magnetic.context",
      )
    )
      ctx.addIssue({ code: "custom", message: "SEXTANT_MAGNETIC_REQUIREMENT_REQUIRED" });
  });
export type SextantAuthoring = z.infer<typeof sextantAuthoringSchema>;
/** Deterministic unavailable/denied/degraded branches. This models content reachability, not sensor physics. */
export function simulateSextantRequirement(
  input: unknown,
  capabilityId: string,
  outcome: "AVAILABLE" | "UNAVAILABLE" | "DENIED" | "DEGRADED" | "ACCESSIBLE_ALTERNATIVE",
) {
  const authored = sextantAuthoringSchema.parse(input),
    r = authored.requirements.find((r) => r.capabilityId === capabilityId);
  if (!r) throw new Error("SEXTANT_REQUIREMENT_UNDECLARED");
  return {
    state: outcome === "AVAILABLE" ? ("OPTIONAL_DEVICE_GUIDANCE" as const) : ("FALLBACK" as const),
    canonicalProgression: false as const,
    simulation: true as const,
    alternative: r.accessibilityAlternative,
    fallbacks: r.fallbackIds.map((id) => authored.fallbacks.find((f) => f.id === id)!),
    physicalQualified: false as const,
  };
}
