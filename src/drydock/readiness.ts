import { canonicalChecksum } from "@/drydock/canonical";
import type { DrydockIssue } from "@/drydock/issues";
import type { DrydockValidationReport } from "@/drydock/reports";

export const DRYDOCK_READINESS_SCHEMA_VERSION = 1;
export const DRYDOCK_REQUIRED_SUITE_POLICY_VERSION = "drydock-required-suite-v1";
export const DRYDOCK_COMPATIBILITY_POLICY_VERSION = "drydock-compatibility-v1";
export const DRYDOCK_PUBLISHING_EVIDENCE_SCHEMA_VERSION = 1;

export type DrydockReadinessIssueRef = Readonly<{
  id: string;
  code: string;
  severity: DrydockIssue["severity"];
  location: DrydockIssue["location"];
}>;

export type DrydockEvidenceRequirement = Readonly<{
  id: string;
  version: string;
  capability: string;
  requirementType: "STATIC" | "SCENARIO_SUITE" | "COMPATIBILITY" | "EXTERNAL" | "SECURITY" | "ACCESSIBILITY";
  mandatory: boolean;
  resolver: string;
}>;

export type RequiredSuiteStatus = Readonly<{
  suiteId: string;
  revision: number;
  sourceChecksum: string;
  status: "PASSED" | "FAILED" | "MISSING" | "STALE" | "INCOMPLETE";
  reason: string;
  runIds?: readonly string[];
  coverageDigest?: string;
}>;

export type DrydockCompatibilityStatus =
  | "COMPATIBLE"
  | "COMPATIBLE_WITH_UPCAST"
  | "COMPATIBLE_WITH_WARNINGS"
  | "MIGRATION_AVAILABLE"
  | "EXTERNAL_REQUIREMENT_PENDING"
  | "UNSUPPORTED"
  | "CORRUPT_OR_INVALID";

export type DrydockCompatibilityResult = Readonly<{
  sourceChecksum: string;
  policyVersion: string;
  status: DrydockCompatibilityStatus;
  digest: string;
  warnings: readonly string[];
}>;

export type ExternalEvidenceSummary = Readonly<{
  providerId: string;
  providerVersion: string;
  evidenceKind: string;
  status: "NOT_REQUIRED" | "PRESENT" | "EXPIRED" | "MISSING" | "UNAVAILABLE" | "EXTERNAL_VALIDATION_REQUIRED";
  safeSummary: string;
}>;

export type DrydockPublishingEvidenceDraft = Readonly<{
  schemaVersion: typeof DRYDOCK_PUBLISHING_EVIDENCE_SCHEMA_VERSION;
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
  draftDigest: string;
}>;

export type DrydockReadinessDecision =
  | Readonly<{ status: "CHECKING"; sourceChecksum: string }>
  | Readonly<{
      status: "NEEDS_REPAIR";
      sourceChecksum: string;
      blockingIssues: readonly DrydockReadinessIssueRef[];
      missingEvidence: readonly DrydockEvidenceRequirement[];
    }>
  | Readonly<{ status: "TRIALS_INCOMPLETE"; sourceChecksum: string; requiredSuites: readonly RequiredSuiteStatus[] }>
  | Readonly<{
      status: "READY_WITH_WARNINGS";
      sourceChecksum: string;
      warnings: readonly DrydockReadinessIssueRef[];
      waivers: readonly string[];
      externalEvidence: readonly ExternalEvidenceSummary[];
    }>
  | Readonly<{ status: "VERIFIED"; sourceChecksum: string; evidenceDraft: DrydockPublishingEvidenceDraft }>
  | Readonly<{ status: "PUBLICATION_PENDING"; sourceChecksum: string }>
  | Readonly<{ status: "PUBLISHED"; sourceChecksum: string; publishedVersionId: string; evidenceId: string }>
  | Readonly<{ status: "PUBLICATION_FAILED"; sourceChecksum: string; safeFailureCode: string }>;

export type EvaluateDrydockReadinessInput = Readonly<{
  sourceChecksum: string;
  checking?: boolean;
  publication?:
    | Readonly<{ status: "PENDING" }>
    | Readonly<{ status: "PUBLISHED"; publishedVersionId: string; evidenceId: string }>
    | Readonly<{ status: "FAILED"; safeFailureCode: string }>;
  report?: DrydockValidationReport;
  requirements: readonly DrydockEvidenceRequirement[];
  requiredSuites: readonly RequiredSuiteStatus[];
  compatibility?: DrydockCompatibilityResult;
  externalEvidence: readonly ExternalEvidenceSummary[];
  activeWaiverIssueIds: readonly string[];
  activeWaiverIds: readonly string[];
  allowWarnings?: boolean;
}>;

const issueRef = (issue: DrydockIssue): DrydockReadinessIssueRef => ({
  id: issue.id,
  code: issue.code,
  severity: issue.severity,
  location: issue.location,
});

function stable<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => key(left).localeCompare(key(right), "en"));
}

function requirementMissing(requirement: DrydockEvidenceRequirement, input: EvaluateDrydockReadinessInput): boolean {
  if (!requirement.mandatory) return false;
  if (requirement.requirementType === "STATIC")
    return !input.report || input.report.sourceChecksum !== input.sourceChecksum || input.report.status !== "VALID";
  if (requirement.requirementType === "SCENARIO_SUITE")
    return !input.requiredSuites.some((suite) => suite.status === "PASSED" && suite.sourceChecksum === input.sourceChecksum);
  if (requirement.requirementType === "COMPATIBILITY")
    return !input.compatibility || input.compatibility.sourceChecksum !== input.sourceChecksum || !compatibilityAllowsLaunch(input.compatibility.status);
  if (requirement.requirementType === "EXTERNAL")
    return input.externalEvidence.some((evidence) => evidence.status !== "PRESENT" && evidence.status !== "NOT_REQUIRED");
  return false;
}

export function compatibilityAllowsLaunch(status: DrydockCompatibilityStatus): boolean {
  return status === "COMPATIBLE" || status === "COMPATIBLE_WITH_UPCAST" || status === "COMPATIBLE_WITH_WARNINGS";
}

/**
 * The only readiness evaluator. Callers must supply exact-source evidence; this function
 * deliberately has no persistence or client-state dependency so Studio, CLI, CI, and One
 * Voyage make the same decision from the same facts.
 */
export function evaluateDrydockReadiness(input: EvaluateDrydockReadinessInput): DrydockReadinessDecision {
  if (input.checking) return { status: "CHECKING", sourceChecksum: input.sourceChecksum };
  if (input.publication?.status === "PENDING") return { status: "PUBLICATION_PENDING", sourceChecksum: input.sourceChecksum };
  if (input.publication?.status === "PUBLISHED")
    return {
      status: "PUBLISHED",
      sourceChecksum: input.sourceChecksum,
      publishedVersionId: input.publication.publishedVersionId,
      evidenceId: input.publication.evidenceId,
    };
  if (input.publication?.status === "FAILED")
    return { status: "PUBLICATION_FAILED", sourceChecksum: input.sourceChecksum, safeFailureCode: input.publication.safeFailureCode };

  const report = input.report;
  const waiverIssueIds = new Set(input.activeWaiverIssueIds);
  const blockingIssues = stable(
    report?.issues.filter((issue) => issue.severity === "ERROR") ?? [],
    (issue) => issue.id,
  ).map(issueRef);
  const missingEvidence = stable(
    input.requirements.filter((requirement) => requirementMissing(requirement, input)),
    (requirement) => requirement.id,
  );
  const compatibilityBlocked = !input.compatibility ||
    input.compatibility.sourceChecksum !== input.sourceChecksum ||
    !compatibilityAllowsLaunch(input.compatibility.status);

  if (!report || report.sourceChecksum !== input.sourceChecksum || report.status !== "VALID" || report.proof.completeness !== "COMPLETE" || blockingIssues.length || missingEvidence.length || compatibilityBlocked)
    return { status: "NEEDS_REPAIR", sourceChecksum: input.sourceChecksum, blockingIssues, missingEvidence };

  const requiredSuites = stable(input.requiredSuites, (suite) => `${suite.suiteId}:${suite.revision}`);
  if (requiredSuites.some((suite) => suite.status !== "PASSED" || suite.sourceChecksum !== input.sourceChecksum))
    return { status: "TRIALS_INCOMPLETE", sourceChecksum: input.sourceChecksum, requiredSuites };

  const warnings = stable(
    report.issues.filter((issue) => issue.severity === "WARNING" && !waiverIssueIds.has(issue.id)),
    (issue) => issue.id,
  ).map(issueRef);
  const externalEvidence = stable(input.externalEvidence, (evidence) => `${evidence.providerId}:${evidence.evidenceKind}`);
  if ((warnings.length || input.activeWaiverIds.length) && input.allowWarnings !== false)
    return {
      status: "READY_WITH_WARNINGS",
      sourceChecksum: input.sourceChecksum,
      warnings,
      waivers: [...input.activeWaiverIds].sort((left, right) => left.localeCompare(right, "en")),
      externalEvidence,
    };

  const evidenceDraft = {
    schemaVersion: DRYDOCK_PUBLISHING_EVIDENCE_SCHEMA_VERSION,
    sourceChecksum: input.sourceChecksum,
    schemaRegistryVersion: report.schemaRegistryVersion,
    ruleCatalogVersion: report.ruleCatalogVersion,
    validationRunId: report.runId,
    requiredSuitePolicyVersion: DRYDOCK_REQUIRED_SUITE_POLICY_VERSION,
    requiredScenarioSuiteIds: requiredSuites.map((suite) => suite.suiteId),
    scenarioRunIds: requiredSuites.flatMap((suite) => suite.runIds ?? []).sort((left, right) => left.localeCompare(right, "en")),
    coverageDigest: canonicalChecksum(requiredSuites.map((suite) => ({ suiteId: suite.suiteId, coverageDigest: suite.coverageDigest ?? null }))),
    compatibilityPolicyVersion: input.compatibility.policyVersion,
    compatibilityDigest: input.compatibility.digest,
    externalEvidenceDigest: canonicalChecksum(externalEvidence),
    waiverIds: [...input.activeWaiverIds].sort((left, right) => left.localeCompare(right, "en")),
  } as const;
  return { status: "VERIFIED", sourceChecksum: input.sourceChecksum, evidenceDraft: { ...evidenceDraft, draftDigest: canonicalChecksum(evidenceDraft) } };
}
