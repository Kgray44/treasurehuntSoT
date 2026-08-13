import { canonicalChecksum } from "@/drydock/canonical";
import { validateTaleDraft } from "@/chronicle/validation";
import { db } from "@/lib/db";
import {
  DRYDOCK_COMPATIBILITY_POLICY_VERSION,
  DRYDOCK_REQUIRED_SUITE_POLICY_VERSION,
  evaluateDrydockReadiness,
  type DrydockCompatibilityResult,
  type DrydockEvidenceRequirement,
  type DrydockReadinessDecision,
  type ExternalEvidenceSummary,
  type RequiredSuiteStatus,
} from "@/drydock/readiness";
import { evaluateDrydockWaiver, type DrydockRuleWaiver } from "@/drydock/waivers";

const requirements: readonly DrydockEvidenceRequirement[] = [
  { id: "DD-R-STATIC", version: "1", capability: "BASELINE", requirementType: "STATIC", mandatory: true, resolver: "Drydock validation report" },
  { id: "DD-R-SCENARIOS", version: "1", capability: "BASELINE", requirementType: "SCENARIO_SUITE", mandatory: true, resolver: "Drydock Scenario Suite" },
  { id: "DD-R-COMPATIBILITY", version: "1", capability: "BASELINE", requirementType: "COMPATIBILITY", mandatory: true, resolver: "Drydock compatibility" },
];

function compatibilityFor(source: string): DrydockCompatibilityResult {
  const unsigned = { sourceChecksum: source, policyVersion: DRYDOCK_COMPATIBILITY_POLICY_VERSION, status: "COMPATIBLE" as const, warnings: [] as string[] };
  return { ...unsigned, digest: canonicalChecksum(unsigned) };
}

async function currentSuiteStatus(taleId: string, checksum: string): Promise<RequiredSuiteStatus[]> {
  const suites = await db.drydockScenarioSuite.findMany({
    where: { draft: { is: { taleId } }, archivedAt: null },
    include: { members: { include: { scenarioRevision: true } } },
    take: 100,
  });
  if (!suites.length) return [{ suiteId: "required-suite", revision: 0, sourceChecksum: checksum, status: "MISSING", reason: "No current Scenario Suite exists." }];
  return suites.map((suite) => {
    const memberCurrent = suite.members.length > 0 && suite.members.every((member) => member.scenarioRevision.sourceChecksum === checksum);
    return {
      suiteId: suite.suiteId,
      revision: 1,
      sourceChecksum: suite.sourceChecksum,
      status: suite.sourceChecksum !== checksum || !memberCurrent ? "STALE" : "MISSING",
      reason: suite.sourceChecksum !== checksum || !memberCurrent ? "The Suite or a member Scenario is stale." : "No completed Phase 4 launch evidence has been recorded for this Suite.",
    };
  });
}

async function currentWaivers(
  taleId: string,
  source: string,
  report: Awaited<ReturnType<typeof validateTaleDraft>>["drydockReport"],
) {
  if (!report) return { issueIds: [], ids: [] };
  const rows = await db.drydockRuleWaiver.findMany({ where: { draft: { is: { taleId } }, sourceChecksum: source, revokedAt: null }, take: 100 });
  const active: string[] = [];
  const ids: string[] = [];
  for (const row of rows) {
    const issue = report.issues.find((candidate) => candidate.id === row.issueId);
    if (!issue) continue;
    const waiver: DrydockRuleWaiver = {
      id: row.id,
      issueId: row.issueId,
      ruleCode: row.ruleCode,
      ruleVersion: row.ruleVersion,
      sourceChecksum: row.sourceChecksum,
      rationale: row.rationale,
      authorizedBy: row.authorizedByAccountId,
      authorizedAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString(),
    };
    if (evaluateDrydockWaiver({ waiver, issue, sourceChecksum: source }).allowed) {
      active.push(issue.id);
      ids.push(row.id);
    }
  }
  return { issueIds: active, ids };
}

async function externalEvidenceFor(taleId: string, checksum: string): Promise<ExternalEvidenceSummary[]> {
  const rows = await db.drydockExternalEvidenceReference.findMany({ where: { draft: { is: { taleId } }, sourceChecksum: checksum }, take: 100 });
  return rows.map((row) => ({
    providerId: row.providerId,
    providerVersion: row.providerVersion,
    evidenceKind: row.evidenceKind,
    status: row.expiresAt && row.expiresAt <= new Date() ? "EXPIRED" : (row.status as ExternalEvidenceSummary["status"]),
    safeSummary: row.safeSummary,
  }));
}

/** Resolves the exact same persisted facts for every delivery surface. */
export async function getDrydockReadiness(taleId: string): Promise<DrydockReadinessDecision> {
  const validation = await validateTaleDraft(taleId);
  const report = validation.drydockReport;
  const checksum = report?.sourceChecksum ?? canonicalChecksum({ taleId, state: "MISSING_DRYDOCK_REPORT" });
  const [requiredSuites, externalEvidence, waivers] = await Promise.all([
    currentSuiteStatus(taleId, checksum),
    externalEvidenceFor(taleId, checksum),
    currentWaivers(taleId, checksum, report),
  ]);
  return evaluateDrydockReadiness({
    sourceChecksum: checksum,
    report,
    requirements,
    requiredSuites,
    compatibility: compatibilityFor(checksum),
    externalEvidence,
    activeWaiverIssueIds: waivers.issueIds,
    activeWaiverIds: waivers.ids,
  });
}

export function drydockReadinessRequirements() {
  return { policyVersion: DRYDOCK_REQUIRED_SUITE_POLICY_VERSION, requirements };
}
