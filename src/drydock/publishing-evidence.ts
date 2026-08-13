import { canonicalChecksum, canonicalizeValue } from "@/drydock/canonical";
import type { DrydockPublishingEvidenceDraft } from "@/drydock/readiness";

export type DrydockPublishingEvidencePayload = Readonly<{
  schemaVersion: number;
  sourceChecksum: string;
  schemaRegistryVersion: number;
  ruleCatalogVersion: number;
  validationRunId: string;
  requiredSuitePolicyVersion: string;
  requiredScenarioSuiteIds: readonly string[];
  scenarioRunIds: readonly string[];
  coverageDigest: string;
  compatibilityPolicyVersion: string;
  compatibilityDigest: string;
  externalEvidenceDigest: string;
  waiverIds: readonly string[];
  platformVersion: string;
  createdAt: string;
  digest: string;
}>;

const privateKey = /answer|secret|note|raw.*evidence|storage.*key|private.*location/iu;

function sortedIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

/** Creates a safe, deterministic evidence payload. The published version ID is bound only by persistence. */
export function createDrydockPublishingEvidencePayload(input: {
  draft: DrydockPublishingEvidenceDraft;
  scenarioRunIds: readonly string[];
  coverageDigest: string;
  platformVersion: string;
  createdAt: string;
}): DrydockPublishingEvidencePayload {
  const unsigned = {
    schemaVersion: input.draft.schemaVersion,
    sourceChecksum: input.draft.sourceChecksum,
    schemaRegistryVersion: input.draft.schemaRegistryVersion,
    ruleCatalogVersion: input.draft.ruleCatalogVersion,
    validationRunId: input.draft.validationRunId,
    requiredSuitePolicyVersion: input.draft.requiredSuitePolicyVersion,
    requiredScenarioSuiteIds: sortedIds(input.draft.requiredScenarioSuiteIds),
    scenarioRunIds: sortedIds(input.scenarioRunIds),
    coverageDigest: input.coverageDigest,
    compatibilityPolicyVersion: input.draft.compatibilityPolicyVersion,
    compatibilityDigest: input.draft.compatibilityDigest,
    externalEvidenceDigest: input.draft.externalEvidenceDigest,
    waiverIds: sortedIds(input.draft.waiverIds),
    platformVersion: input.platformVersion,
    createdAt: input.createdAt,
  } as const;
  return { ...unsigned, digest: canonicalChecksum(unsigned) };
}

/** A defense-in-depth guard for persistence boundaries receiving a JSON payload. */
export function assertSafeDrydockPublishingEvidencePayload(payload: DrydockPublishingEvidencePayload): void {
  const normalized = canonicalizeValue(payload) as Record<string, unknown>;
  const forbidden = Object.keys(normalized).filter((key) => privateKey.test(key));
  if (forbidden.length) throw new Error(`DRYDOCK_EVIDENCE_PRIVATE_FIELD:${forbidden.sort().join(",")}`);
  const { digest, ...unsigned } = payload;
  if (canonicalChecksum(unsigned) !== digest) throw new Error("DRYDOCK_EVIDENCE_DIGEST_MISMATCH");
}

export function creatorPublishingEvidenceProjection(payload: DrydockPublishingEvidencePayload) {
  assertSafeDrydockPublishingEvidencePayload(payload);
  return {
    schemaVersion: payload.schemaVersion,
    sourceChecksum: payload.sourceChecksum,
    schemaRegistryVersion: payload.schemaRegistryVersion,
    ruleCatalogVersion: payload.ruleCatalogVersion,
    validationRunId: payload.validationRunId,
    requiredSuitePolicyVersion: payload.requiredSuitePolicyVersion,
    requiredScenarioSuiteIds: payload.requiredScenarioSuiteIds,
    scenarioRunIds: payload.scenarioRunIds,
    coverageDigest: payload.coverageDigest,
    compatibilityPolicyVersion: payload.compatibilityPolicyVersion,
    compatibilityDigest: payload.compatibilityDigest,
    externalEvidenceDigest: payload.externalEvidenceDigest,
    waiverIds: payload.waiverIds,
    platformVersion: payload.platformVersion,
    createdAt: payload.createdAt,
    digest: payload.digest,
  };
}
