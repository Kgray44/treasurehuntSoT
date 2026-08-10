import { createHash } from "node:crypto";
import { canonicalJson } from "@/drydock/canonical";
import { sanitizedIssueProjection, type DrydockIssue } from "@/drydock/issues";

export type DrydockProofCompleteness = "COMPLETE" | "INCOMPLETE_PROOF";
export type DrydockValidationStatus = "VALID" | "INVALID" | "INCOMPLETE_PROOF";

export type DrydockValidationReport = {
  schemaVersion: 1;
  runId: string;
  sourceChecksum: string;
  sourceRevision?: number;
  schemaRegistryVersion: 2;
  ruleCatalogVersion: 1;
  status: DrydockValidationStatus;
  startedAt: string;
  completedAt: string;
  /** Compatibility alias for consumers of the pre-Phase-2 receipt shape. */
  generatedAt: string;
  summary: { total: number; errors: number; warnings: number; infos: number };
  proof: { completeness: DrydockProofCompleteness; limitsEncountered: readonly string[] };
  compatibilitySummary: { current: number; migrationRequired: number; unsupported: number };
  providerStaticSummary: { unproven: number };
  accessibilityStaticSummary: { issueCount: number };
  privacyStaticSummary: { issueCount: number };
  performanceStaticSummary: { issueCount: number };
  issues: readonly DrydockIssue[];
  issueDigest: string;
  digest: string;
};

export type CreateDrydockValidationReportInput = {
  source: unknown;
  issues: readonly DrydockIssue[];
  /** `generatedAt` remains accepted while older callers move to started/completed timestamps. */
  generatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  proofCompleteness?: DrydockProofCompleteness;
  analysisLimits?: readonly string[];
  sourceRevision?: number;
};

const sha256 = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const count = (issues: readonly DrydockIssue[], predicate: (issue: DrydockIssue) => boolean) =>
  issues.filter(predicate).length;

/**
 * Creates an immutable, source-bound static-validation receipt.  The report deliberately
 * stores only IDs, codes, and metadata already present in issues; authored prose remains
 * in the draft and is never copied into this durable summary.
 */
export function createDrydockValidationReport(input: CreateDrydockValidationReportInput): DrydockValidationReport {
  const sourceChecksum = sha256(input.source);
  const issues = [...input.issues].sort((left, right) => left.id.localeCompare(right.id, "en"));
  const completedAt = input.completedAt ?? input.generatedAt ?? new Date().toISOString();
  const startedAt = input.startedAt ?? completedAt;
  const limitsEncountered = [...new Set(input.analysisLimits ?? [])].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const completeness = input.proofCompleteness ?? (limitsEncountered.length ? "INCOMPLETE_PROOF" : "COMPLETE");
  const summary = {
    total: issues.length,
    errors: count(issues, (issue) => issue.severity === "ERROR"),
    warnings: count(issues, (issue) => issue.severity === "WARNING"),
    infos: count(issues, (issue) => issue.severity === "INFO"),
  };
  const issueDigest = sha256(issues);
  const unsigned = {
    schemaVersion: 1 as const,
    sourceChecksum,
    ...(input.sourceRevision !== undefined ? { sourceRevision: input.sourceRevision } : {}),
    schemaRegistryVersion: 2 as const,
    ruleCatalogVersion: 1 as const,
    status: summary.errors
      ? ("INVALID" as const)
      : completeness === "INCOMPLETE_PROOF"
        ? ("INCOMPLETE_PROOF" as const)
        : ("VALID" as const),
    startedAt,
    completedAt,
    generatedAt: completedAt,
    summary,
    proof: { completeness, limitsEncountered },
    compatibilitySummary: {
      current: count(issues, (issue) => issue.compatibilityStatus === "CURRENT"),
      migrationRequired: count(issues, (issue) => issue.compatibilityStatus === "MIGRATION_REQUIRED"),
      unsupported: count(issues, (issue) => issue.compatibilityStatus === "UNSUPPORTED"),
    },
    providerStaticSummary: {
      unproven: count(issues, (issue) => issue.category === "PROVIDER" || issue.category === "PROVIDER_CONTRACT"),
    },
    accessibilityStaticSummary: {
      issueCount: count(
        issues,
        (issue) => issue.category === "ACCESSIBILITY" || issue.category === "ACCESSIBILITY_CONTRACT",
      ),
    },
    privacyStaticSummary: { issueCount: count(issues, (issue) => issue.category === "PRIVACY") },
    performanceStaticSummary: { issueCount: count(issues, (issue) => issue.category === "PERFORMANCE") },
    issues,
    issueDigest,
  };
  const runId = `drydock-run-${sha256({ sourceChecksum, issueDigest, startedAt, completedAt }).slice(0, 24)}`;
  const signed = { ...unsigned, runId };
  return { ...signed, digest: sha256(signed) };
}

const semanticKey = (issue: DrydockIssue) =>
  canonicalJson({ code: issue.code, category: issue.category, location: issue.location });
const familyKey = (issue: DrydockIssue) => canonicalJson({ code: issue.code, category: issue.category });

export function diffDrydockReports(previous: DrydockValidationReport, next: DrydockValidationReport) {
  const oldIds = new Set(previous.issues.map((issue) => issue.id));
  const nextIds = new Set(next.issues.map((issue) => issue.id));
  const oldBySemantic = new Map(previous.issues.map((issue) => [semanticKey(issue), issue]));
  const nextBySemantic = new Map(next.issues.map((issue) => [semanticKey(issue), issue]));
  const retained = next.issues.filter((issue) => oldIds.has(issue.id));
  const missing = previous.issues.filter((issue) => !nextIds.has(issue.id));
  const added = next.issues.filter((issue) => !oldIds.has(issue.id));
  const missingByFamily = new Map<string, DrydockIssue[]>();
  const addedByFamily = new Map<string, DrydockIssue[]>();
  for (const issue of missing)
    missingByFamily.set(familyKey(issue), [...(missingByFamily.get(familyKey(issue)) ?? []), issue]);
  for (const issue of added)
    addedByFamily.set(familyKey(issue), [...(addedByFamily.get(familyKey(issue)) ?? []), issue]);
  const locationChanged = [...missingByFamily.entries()].flatMap(([key, before]) => {
    const after = addedByFamily.get(key) ?? [];
    return before.length === 1 &&
      after.length === 1 &&
      canonicalJson(before[0].location) !== canonicalJson(after[0].location)
      ? [{ before: before[0], after: after[0] }]
      : [];
  });
  const movedOldIds = new Set(locationChanged.map((change) => change.before.id));
  const movedNextIds = new Set(locationChanged.map((change) => change.after.id));
  return {
    sourceChanged: previous.sourceChecksum !== next.sourceChecksum,
    introduced: added.filter((issue) => !movedNextIds.has(issue.id)),
    resolved: missing.filter((issue) => !movedOldIds.has(issue.id)),
    retained,
    locationChanged,
    severityChanged: [...nextBySemantic.entries()].flatMap(([key, issue]) => {
      const before = oldBySemantic.get(key);
      return before && before.severity !== issue.severity ? [{ before, after: issue }] : [];
    }),
    ruleVersionChanged: [...nextBySemantic.entries()].flatMap(([key, issue]) => {
      const before = oldBySemantic.get(key);
      return before && before.ruleVersion !== issue.ruleVersion ? [{ before, after: issue }] : [];
    }),
    proofCompletenessChanged: previous.proof.completeness !== next.proof.completeness,
    compatibilityChanged: canonicalJson(previous.compatibilitySummary) !== canonicalJson(next.compatibilitySummary),
  };
}

export function creatorReportProjection(report: DrydockValidationReport) {
  return {
    schemaVersion: report.schemaVersion,
    runId: report.runId,
    sourceChecksum: report.sourceChecksum,
    sourceRevision: report.sourceRevision ?? null,
    status: report.status,
    completedAt: report.completedAt,
    proof: report.proof,
    summary: report.summary,
    issues: report.issues.map(sanitizedIssueProjection),
  };
}

export function supportReportProjection(report: DrydockValidationReport) {
  return {
    schemaVersion: report.schemaVersion,
    runId: report.runId,
    sourceChecksum: report.sourceChecksum,
    sourceRevision: report.sourceRevision ?? null,
    status: report.status,
    completedAt: report.completedAt,
    proof: report.proof,
    summary: report.summary,
    compatibilitySummary: report.compatibilitySummary,
    issueCounts: Object.fromEntries(
      report.issues.reduce(
        (counts, issue) => counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1),
        new Map<string, number>(),
      ),
    ),
    issues: report.issues.map((issue) => ({
      id: issue.id,
      code: issue.code,
      category: issue.category,
      severity: issue.severity,
      ruleVersion: issue.ruleVersion,
    })),
  };
}

/** Publication accepts only a fresh report whose static proof is complete and error-free. */
export function isDrydockReportPublicationEligible(report: DrydockValidationReport | undefined): boolean {
  return report?.status === "VALID" && report.proof.completeness === "COMPLETE" && report.summary.errors === 0;
}
