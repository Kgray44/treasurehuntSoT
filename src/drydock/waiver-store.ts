import { db } from "@/lib/db";
import type { DrydockValidationReport } from "@/drydock/reports";
import { createDrydockRuleWaiver, evaluateDrydockWaiver } from "@/drydock/waivers";

export type DrydockWaiverReceipt = {
  id: string;
  issueId: string;
  ruleCode: string;
  ruleVersion: number;
  sourceChecksum: string;
  sourceRevision: number;
  scope: string;
  authorizedRole: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  auditReference: string | null;
};

const receiptProjection = (waiver: {
  id: string;
  issueId: string;
  ruleCode: string;
  ruleVersion: number;
  sourceChecksum: string;
  sourceRevision: number;
  scope: string;
  authorizedRole: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  auditReference: string | null;
}): DrydockWaiverReceipt => ({
  id: waiver.id,
  issueId: waiver.issueId,
  ruleCode: waiver.ruleCode,
  ruleVersion: waiver.ruleVersion,
  sourceChecksum: waiver.sourceChecksum,
  sourceRevision: waiver.sourceRevision,
  scope: waiver.scope,
  authorizedRole: waiver.authorizedRole,
  createdAt: waiver.createdAt.toISOString(),
  expiresAt: waiver.expiresAt?.toISOString() ?? null,
  revokedAt: waiver.revokedAt?.toISOString() ?? null,
  auditReference: waiver.auditReference,
});

export async function listDrydockWaivers(taleId: string): Promise<DrydockWaiverReceipt[]> {
  const waivers = await db.drydockRuleWaiver.findMany({
    where: { draft: { is: { taleId } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return waivers.map(receiptProjection);
}

/** Authorizes a warning-only waiver against an immutable, source-bound validation receipt. */
export async function createDrydockWaiverFromRun(input: {
  taleId: string;
  runId: string;
  issueId: string;
  rationale: string;
  scope: string;
  expiresAt?: string;
  reviewCondition?: string;
  auditReference?: string;
  authorizedByAccountId: string;
  authorizedRole: "ADMINISTRATOR";
}): Promise<DrydockWaiverReceipt> {
  const run = await db.drydockValidationRun.findFirst({
    where: { runId: input.runId, draft: { is: { taleId: input.taleId } } },
    select: { draftId: true, sourceChecksum: true, sourceRevision: true, report: true },
  });
  if (!run) throw new Error("DRYDOCK_WAIVER_RUN_NOT_FOUND");
  const report = JSON.parse(run.report) as DrydockValidationReport;
  const issue = report.issues.find((candidate) => candidate.id === input.issueId);
  if (!issue) throw new Error("DRYDOCK_WAIVER_ISSUE_NOT_FOUND");
  const waiver = createDrydockRuleWaiver({
    issueId: issue.id,
    ruleCode: issue.code,
    ruleVersion: issue.ruleVersion,
    sourceChecksum: run.sourceChecksum,
    rationale: input.rationale,
    authorizedBy: input.authorizedByAccountId,
    authorizedAt: new Date().toISOString(),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });
  const decision = evaluateDrydockWaiver({ waiver, issue, sourceChecksum: run.sourceChecksum });
  if (!decision.allowed) throw new Error(`DRYDOCK_WAIVER_REJECTED:${decision.code ?? "UNKNOWN"}`);
  const created = await db.drydockRuleWaiver.create({
    data: {
      id: waiver.id,
      draftId: run.draftId,
      issueId: waiver.issueId,
      ruleCode: waiver.ruleCode,
      ruleVersion: waiver.ruleVersion,
      sourceChecksum: waiver.sourceChecksum,
      sourceRevision: run.sourceRevision,
      rationale: waiver.rationale,
      scope: input.scope,
      authorizedByAccountId: input.authorizedByAccountId,
      authorizedRole: input.authorizedRole,
      ...(input.expiresAt ? { expiresAt: new Date(input.expiresAt) } : {}),
      ...(input.reviewCondition ? { reviewCondition: input.reviewCondition } : {}),
      ...(input.auditReference ? { auditReference: input.auditReference } : {}),
    },
  });
  return receiptProjection(created);
}
