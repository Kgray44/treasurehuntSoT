import { observationSchema, type Observation, type ProviderSample, type SextantProvider } from "./contracts";
import { SextantCapabilityRegistry } from "./capabilities";
/** Provider samples use a shared injected monotonic clock. Wall time is optional audit metadata only. */
export function normalizeObservation(
  registry: SextantCapabilityRegistry,
  provider: SextantProvider,
  sample: ProviderSample,
  context: { now: number; sequence: number; discontinuity: boolean },
): Observation {
  const c = registry.get(sample.capabilityId);
  if (
    !provider.definition.capabilities.includes(c.id) ||
    sample.units !== c.units ||
    !c.frames.includes(sample.referenceFrame) ||
    !provider.definition.referenceFrames.includes(sample.referenceFrame)
  )
    throw new Error("SEXTANT_SAMPLE_CONTRACT_INVALID");
  if (sample.timestampMonotonic > context.now) throw new Error("SEXTANT_SAMPLE_FUTURE");
  const value = c.valueSchema.parse(sample.value);
  return observationSchema.parse({
    ...sample,
    value,
    observationId: crypto.randomUUID(),
    semanticVersion: 1,
    ageMs: context.now - sample.timestampMonotonic,
    sequence: context.sequence,
    discontinuity: context.discontinuity,
    sourceClass: provider.simulationIdentity
      ? "SIMULATED"
      : provider.definition.platformFamily === "COMPATIBILITY"
        ? "COMPATIBILITY"
        : "HARDWARE",
    providerIdDiagnostic: provider.definition.providerId,
    provenanceRoot: `${provider.definition.providerId}@${provider.definition.providerVersion}`,
    syntheticFlag: Boolean(provider.simulationIdentity),
    ...(provider.simulationIdentity ? { simulationIdentity: provider.simulationIdentity } : {}),
    lifecycleState: "FOREGROUND_ONLY",
  });
}
export function projectObservation(observation: Observation, now: number, maxAgeMs: number) {
  const ageMs = now - observation.timestampMonotonic;
  if (!Number.isFinite(ageMs) || ageMs < 0 || !Number.isFinite(maxAgeMs) || maxAgeMs < 0)
    throw new Error("SEXTANT_CLOCK_INVALID");
  return {
    ...structuredClone(observation),
    ageMs,
    warnings: ageMs > maxAgeMs ? [...new Set([...observation.warnings, "STALE"])] : [...observation.warnings],
  };
}
