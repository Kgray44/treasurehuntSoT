import { validateTaleDraft } from "@/chronicle/validation";
import { getStudioTale } from "@/chronicle/studio-service";
import { publishedSourceChecksum, snapshotFromStudio } from "@/chronicle/snapshot";
import { db } from "@/lib/db";
import { assessDrydockCompatibility } from "@/drydock/compatibility";
import { requiredScenarioClasses } from "@/drydock/required-suite-policy";
import { baseDrydockEvidenceRequirements, deriveDrydockEvidenceRequirements } from "@/drydock/evidence-requirements";
import { parseDrydockScenario } from "@/drydock/simulation/schema";
import { ONE_VOYAGE_TRANSITION_ADAPTER_VERSION } from "@/drydock/simulation/engine";
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

async function compatibilityFor(
  taleId: string,
  snapshot: ReturnType<typeof snapshotFromStudio>,
): Promise<DrydockCompatibilityResult> {
  const assessment = assessDrydockCompatibility(snapshot);
  const draft = await db.taleDraft.findFirst({
    where: { taleId },
    orderBy: { revisionNumber: "desc" },
    select: { id: true },
  });
  if (!draft) return assessment;
  const existing = await db.drydockCompatibilityRun.findFirst({
    where: {
      draftId: draft.id,
      sourceChecksum: assessment.sourceChecksum,
      policyVersion: assessment.policyVersion,
      digest: assessment.digest,
    },
    select: { id: true },
  });
  if (!existing)
    await db.drydockCompatibilityRun.create({
      data: {
        draftId: draft.id,
        runId: `drydock-compatibility-${crypto.randomUUID()}`,
        sourceChecksum: assessment.sourceChecksum,
        policyVersion: assessment.policyVersion,
        status: assessment.status,
        digest: assessment.digest,
        result: JSON.stringify(assessment),
      },
    });
  return assessment;
}

/** Returns the current, owner-scoped compatibility assessment without exposing draft prose. */
export async function getDrydockCurrentCompatibility(taleId: string): Promise<DrydockCompatibilityResult> {
  const snapshot = snapshotFromStudio(await getStudioTale(taleId));
  return compatibilityFor(taleId, snapshot);
}

async function currentSuiteStatus(
  taleId: string,
  snapshot: ReturnType<typeof snapshotFromStudio>,
): Promise<RequiredSuiteStatus[]> {
  const checksum = publishedSourceChecksum(snapshot);
  const requiredClasses = requiredScenarioClasses(snapshot);
  const suites = await db.drydockScenarioSuite.findMany({
    where: { draft: { is: { taleId } }, archivedAt: null },
    include: {
      members: { include: { scenarioRevision: true } },
      launchEvidence: {
        where: {
          sourceChecksum: checksum,
          requiredSuitePolicyVersion: DRYDOCK_REQUIRED_SUITE_POLICY_VERSION,
          compatibilityPolicyVersion: DRYDOCK_COMPATIBILITY_POLICY_VERSION,
          runtimeAdapterVersion: ONE_VOYAGE_TRANSITION_ADAPTER_VERSION,
          proofStatus: "COMPLETE",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 100,
  });
  if (!suites.length)
    return [
      {
        suiteId: "required-suite",
        revision: 0,
        sourceChecksum: checksum,
        status: "MISSING",
        reason: "No current Scenario Suite exists.",
      },
    ];
  return Promise.all(
    suites.map(async (suite) => {
      const memberCurrent =
        suite.members.length > 0 &&
        suite.members.every((member) => member.scenarioRevision.sourceChecksum === checksum);
      const base = {
        suiteId: suite.suiteId,
        revision: suite.revision,
        sourceChecksum: suite.sourceChecksum,
      } as const;
      if (suite.sourceChecksum !== checksum || !memberCurrent)
        return { ...base, status: "STALE" as const, reason: "The Suite or a member Scenario is stale." };
      const tags = new Set<string>();
      try {
        suite.members.forEach((member) =>
          parseDrydockScenario(JSON.parse(member.scenarioRevision.scenario)).tags.forEach((tag) => tags.add(tag)),
        );
      } catch {
        return { ...base, status: "INCOMPLETE" as const, reason: "A required Scenario revision is malformed." };
      }
      const missingClasses = requiredClasses.filter((required) => !tags.has(`required:${required.id}`));
      if (missingClasses.length)
        return {
          ...base,
          status: "INCOMPLETE" as const,
          reason: `Required Scenario classes are missing: ${missingClasses.map((item) => item.id).join(", ")}.`,
        };
      const evidence = suite.launchEvidence[0];
      if (!evidence)
        return {
          ...base,
          status: "MISSING" as const,
          reason: "No completed current-policy launch evidence has been recorded for this Suite.",
        };
      let runIds: string[];
      try {
        const parsed = JSON.parse(evidence.runIds);
        if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) throw new Error("invalid");
        runIds = [...new Set(parsed)].sort((left, right) => left.localeCompare(right, "en"));
      } catch {
        return { ...base, status: "INCOMPLETE" as const, reason: "The Suite evidence run identity is malformed." };
      }
      const runs = await db.drydockSimulationRun.findMany({
        where: { runId: { in: runIds }, sourceChecksum: checksum, status: "COMPLETED" },
        select: { runId: true, adapterVersion: true },
      });
      if (
        runs.length !== runIds.length ||
        runs.some((run) => run.adapterVersion !== ONE_VOYAGE_TRANSITION_ADAPTER_VERSION)
      )
        return {
          ...base,
          status: "STALE" as const,
          reason: "A required Scenario receipt is missing, stale, or uses a different runtime adapter.",
        };
      return {
        ...base,
        status: "PASSED" as const,
        reason: "Current-source Scenario, policy, and coverage evidence are complete.",
        runIds,
        coverageDigest: evidence.coverageDigest,
      };
    }),
  );
}

async function currentWaivers(
  taleId: string,
  source: string,
  report: Awaited<ReturnType<typeof validateTaleDraft>>["drydockReport"],
) {
  if (!report) return { issueIds: [], ids: [] };
  const rows = await db.drydockRuleWaiver.findMany({
    where: { draft: { is: { taleId } }, sourceChecksum: source, revokedAt: null },
    take: 100,
  });
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
  const rows = await db.drydockExternalEvidenceReference.findMany({
    where: { draft: { is: { taleId } }, sourceChecksum: checksum },
    take: 100,
  });
  return rows.map((row) => ({
    providerId: row.providerId,
    providerVersion: row.providerVersion,
    evidenceKind: row.evidenceKind,
    status:
      row.expiresAt && row.expiresAt <= new Date() ? "EXPIRED" : (row.status as ExternalEvidenceSummary["status"]),
    safeSummary: row.safeSummary,
  }));
}

/** Resolves the exact same persisted facts for every delivery surface. */
export async function getDrydockReadiness(taleId: string): Promise<DrydockReadinessDecision> {
  const validation = await validateTaleDraft(taleId);
  const report = validation.drydockReport;
  const snapshot = snapshotFromStudio(await getStudioTale(taleId));
  const requirements = deriveDrydockEvidenceRequirements(snapshot);
  const checksum = publishedSourceChecksum(snapshot);
  const [requiredSuites, externalEvidence, waivers, compatibility] = await Promise.all([
    currentSuiteStatus(taleId, snapshot),
    externalEvidenceFor(taleId, checksum),
    currentWaivers(taleId, checksum, report),
    compatibilityFor(taleId, snapshot),
  ]);
  return evaluateDrydockReadiness({
    sourceChecksum: checksum,
    report,
    requirements,
    requiredSuites,
    compatibility,
    externalEvidence,
    activeWaiverIssueIds: waivers.issueIds,
    activeWaiverIds: waivers.ids,
  });
}

export async function drydockReadinessRequirements(taleId?: string) {
  const snapshot = taleId ? snapshotFromStudio(await getStudioTale(taleId)) : null;
  return {
    policyVersion: DRYDOCK_REQUIRED_SUITE_POLICY_VERSION,
    requirements: snapshot ? deriveDrydockEvidenceRequirements(snapshot) : baseDrydockEvidenceRequirements(),
  };
}
