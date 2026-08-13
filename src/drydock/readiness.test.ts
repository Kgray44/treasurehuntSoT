import { describe, expect, it } from "vitest";
import type { DrydockValidationReport } from "@/drydock/reports";
import { evaluateDrydockReadiness, type EvaluateDrydockReadinessInput } from "@/drydock/readiness";

const checksum = "a".repeat(64);

const report = (overrides: Partial<DrydockValidationReport> = {}): DrydockValidationReport => ({
  schemaVersion: 1,
  runId: "run-1",
  sourceChecksum: checksum,
  schemaRegistryVersion: 2,
  ruleCatalogVersion: 1,
  status: "VALID",
  startedAt: "2026-08-13T00:00:00.000Z",
  completedAt: "2026-08-13T00:00:01.000Z",
  generatedAt: "2026-08-13T00:00:01.000Z",
  summary: { total: 0, errors: 0, warnings: 0, infos: 0 },
  proof: { completeness: "COMPLETE", limitsEncountered: [] },
  compatibilitySummary: { current: 1, migrationRequired: 0, unsupported: 0 },
  providerStaticSummary: { unproven: 0 },
  accessibilityStaticSummary: { issueCount: 0 },
  privacyStaticSummary: { issueCount: 0 },
  performanceStaticSummary: { issueCount: 0 },
  issues: [],
  issueDigest: "issues",
  digest: "report",
  ...overrides,
});

const input = (overrides: Partial<EvaluateDrydockReadinessInput> = {}): EvaluateDrydockReadinessInput => ({
  sourceChecksum: checksum,
  report: report(),
  requirements: [],
  requiredSuites: [{ suiteId: "baseline", revision: 1, sourceChecksum: checksum, status: "PASSED", reason: "Current" }],
  compatibility: { sourceChecksum: checksum, policyVersion: "drydock-compatibility-v1", status: "COMPATIBLE", digest: "compat", warnings: [] },
  externalEvidence: [],
  activeWaiverIssueIds: [],
  activeWaiverIds: [],
  ...overrides,
});

describe("Drydock readiness", () => {
  it("returns one deterministic verified decision and evidence draft for exact-source evidence", () => {
    const decision = evaluateDrydockReadiness(input());
    expect(decision.status).toBe("VERIFIED");
    if (decision.status !== "VERIFIED") throw new Error("expected verified decision");
    expect(decision.evidenceDraft.sourceChecksum).toBe(checksum);
    expect(decision.evidenceDraft.draftDigest).toHaveLength(64);
  });

  it("fails closed when static evidence or compatibility is stale", () => {
    for (const changed of [
      input({ report: report({ sourceChecksum: "b".repeat(64) }) }),
      input({ compatibility: { sourceChecksum: "b".repeat(64), policyVersion: "v1", status: "COMPATIBLE", digest: "x", warnings: [] } }),
    ]) {
      expect(evaluateDrydockReadiness(changed).status).toBe("NEEDS_REPAIR");
    }
  });

  it("keeps current-source missing or stale Scenario evidence in a distinct trial state", () => {
    expect(
      evaluateDrydockReadiness(input({ requiredSuites: [{ suiteId: "timer", revision: 1, sourceChecksum: checksum, status: "STALE", reason: "Source changed" }] })).status,
    ).toBe("TRIALS_INCOMPLETE");
  });

  it("requires matching provider evidence instead of allowing an unrelated present reference", () => {
    const requirement = { id: "landfall", version: "1", capability: "LOCATION_PROVIDER", requirementType: "EXTERNAL" as const, mandatory: true, resolver: "Landfall", providerId: "landfall", providerVersion: "adapter-v1", evidenceKind: "field-evidence" };
    expect(evaluateDrydockReadiness(input({ requirements: [requirement], externalEvidence: [{ providerId: "other", providerVersion: "adapter-v1", evidenceKind: "field-evidence", status: "PRESENT", safeSummary: "Other provider" }] })).status).toBe("NEEDS_REPAIR");
    expect(evaluateDrydockReadiness(input({ requirements: [requirement], externalEvidence: [{ providerId: "landfall", providerVersion: "adapter-v1", evidenceKind: "field-evidence", status: "PRESENT", safeSummary: "Current reference" }] })).status).toBe("VERIFIED");
  });

  it("keeps valid source-bound warnings visible without treating them as a repair failure", () => {
    const warning = { id: "warning-1", code: "DD-WARN", severity: "WARNING" as const, ruleVersion: 1, category: "GRAPH" as const, location: {}, message: "Review", remediation: "Review" };
    expect(evaluateDrydockReadiness(input({ report: report({ issues: [warning], summary: { total: 1, errors: 0, warnings: 1, infos: 0 } }) })).status).toBe("READY_WITH_WARNINGS");
    expect(evaluateDrydockReadiness(input({ report: report({ issues: [warning], summary: { total: 1, errors: 0, warnings: 1, infos: 0 } }), activeWaiverIssueIds: [warning.id], activeWaiverIds: ["waiver-1"] })).status).toBe("READY_WITH_WARNINGS");
  });

  it("never represents a publication request as success before the authoritative transaction returns", () => {
    expect(evaluateDrydockReadiness(input({ publication: { status: "PENDING" } })).status).toBe("PUBLICATION_PENDING");
    expect(evaluateDrydockReadiness(input({ publication: { status: "FAILED", safeFailureCode: "PUBLISH_TRANSACTION_FAILED" } })).status).toBe("PUBLICATION_FAILED");
    expect(evaluateDrydockReadiness(input({ publication: { status: "PUBLISHED", publishedVersionId: "version-1", evidenceId: "evidence-1" } })).status).toBe("PUBLISHED");
  });
});
