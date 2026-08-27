import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  executeMembershipReconcile,
  previewMembershipReconcile,
  verifyMembershipReconcile,
} from "@/helm/support-repairs";
import {
  executeWayfarerProfileReconcile,
  executeWayfarerStaleSessionRevoke,
  previewWayfarerProfileReconcile,
  previewWayfarerStaleSessionRevoke,
  verifyWayfarerProfileReconcile,
  verifyWayfarerStaleSessionRevoke,
} from "@/wayfarer/support-repairs";
import { writeAdministrativeAudit } from "./audit";
import { privilegedAssuranceState } from "./assurance";
import type { AdmiraltyCurrentOperator } from "./authorization";
import { AdmiraltyError } from "./errors";
import { authorizeSupportRepair, type SupportRepairAuthority } from "./support-repair-policy";
import {
  getRegisteredSupportRepair,
  isSupportRiskClass,
  supportRepairRegistrySchemaVersion,
  supportRiskRank,
  type SupportRiskClass,
} from "./support-repair-registry";
import { parseSupportRepairIds } from "./support-access";
import { parseSupportScopes } from "./support-pilot";

const leaseLifetimeMs = 2 * 60 * 1000;

type OwnerPreview = Readonly<{
  targetId: string;
  targetRevision: string;
  affectedRecords: number;
  currentState: Record<string, unknown>;
  resultingState: Record<string, unknown>;
}>;

type RepairAuthorityContext = Readonly<{
  authority: SupportRepairAuthority;
  executionGrantId: string;
  latestExecutionSessionId: string;
}>;

function parseDomains(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").sort() : [];
  } catch {
    return [];
  }
}

function activeParentGrant(
  grant: { status: string; expiresAt: Date; revokedAt: Date | null; request: { status: string } },
  now: Date,
) {
  return grant.status === "ACTIVE" && !grant.revokedAt && grant.expiresAt > now && grant.request.status === "APPROVED";
}

async function loadRepairAuthority(
  operator: AdmiraltyCurrentOperator,
  input: { caseId: string; grantId: string },
  now: Date,
): Promise<RepairAuthorityContext> {
  const supportCase = await db.supportCase.findFirst({
    where: { id: input.caseId, requestingOperatorId: operator.accountId },
    select: {
      id: true,
      status: true,
      revision: true,
      targetAccountId: true,
      supportAccessRequest: {
        select: {
          grant: {
            select: {
              id: true,
              status: true,
              expiresAt: true,
              revokedAt: true,
              grantedScopes: true,
              grantedRepairIds: true,
              maximumRiskClass: true,
              request: { select: { status: true } },
            },
          },
        },
      },
      executionGrants: {
        where: { parentSupportGrantId: input.grantId, status: "ACTIVE", expiresAt: { gt: now } },
        orderBy: { issuedAt: "desc" },
        take: 1,
        select: {
          id: true,
          parentSupportGrantId: true,
          maximumRiskClass: true,
          permittedRepairIds: true,
          remainingCommands: true,
          remainingAffectedRecords: true,
          maximumDomains: true,
          usedDomains: true,
          expiresAt: true,
          sessions: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true, status: true } },
        },
      },
    },
  });
  if (!supportCase) throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support case was not found.", 404);
  const parentGrant = supportCase.supportAccessRequest?.grant;
  if (!parentGrant || parentGrant.id !== input.grantId || !activeParentGrant(parentGrant, now))
    throw new AdmiraltyError(
      "SUPPORT_GRANT_REVOKED",
      "The account owner's current Support Access grant is not active.",
      403,
    );
  const executionGrant = supportCase.executionGrants[0];
  if (!executionGrant || executionGrant.parentSupportGrantId !== parentGrant.id)
    throw new AdmiraltyError(
      "SUPPORT_GRANT_REQUIRED",
      "Run the current scoped diagnosis before requesting a repair.",
      409,
    );
  const latestExecutionSession = executionGrant.sessions[0];
  if (!latestExecutionSession || latestExecutionSession.status !== "COMPLETE")
    throw new AdmiraltyError("SUPPORT_GRANT_REQUIRED", "The support diagnosis has not completed successfully.", 409);
  const assurance = await privilegedAssuranceState(operator, now);
  const parentRisk: SupportRiskClass = isSupportRiskClass(parentGrant.maximumRiskClass)
    ? parentGrant.maximumRiskClass
    : "R0";
  const executionRisk: SupportRiskClass = isSupportRiskClass(executionGrant.maximumRiskClass)
    ? executionGrant.maximumRiskClass
    : "R0";
  const riskCeiling = supportRiskRank(parentRisk) < supportRiskRank(executionRisk) ? parentRisk : executionRisk;
  const parentRepairIds = parseSupportRepairIds(parentGrant.grantedRepairIds);
  const permittedRepairIds = new Set(parseSupportRepairIds(executionGrant.permittedRepairIds));
  return {
    authority: {
      caseStatus: supportCase.status,
      caseRevision: supportCase.revision,
      supportCaseId: supportCase.id,
      operatorAccountId: operator.accountId,
      targetAccountId: supportCase.targetAccountId,
      parentGrantActive: true,
      parentGrantRepairIds: parentRepairIds.filter((repairId) => permittedRepairIds.has(repairId)),
      parentGrantScopes: parseSupportScopes(parentGrant.grantedScopes),
      riskCeiling,
      administratorCapabilities: operator.capabilities,
      recentAssurance: assurance.recent,
      budget: {
        remainingCommands: executionGrant.remainingCommands,
        remainingAffectedRecords: executionGrant.remainingAffectedRecords,
        maximumDomains: executionGrant.maximumDomains,
        usedDomains: parseDomains(executionGrant.usedDomains),
        expiresAt: executionGrant.expiresAt,
      },
    },
    executionGrantId: executionGrant.id,
    latestExecutionSessionId: latestExecutionSession.id,
  };
}

async function previewOwnerRepair(
  repairId: string,
  targetAccountId: string,
  targetId: string,
  now = new Date(),
): Promise<OwnerPreview> {
  switch (repairId) {
    case "wayfarer.profile.reconcile":
      return previewWayfarerProfileReconcile(targetAccountId, targetId);
    case "wayfarer.session.revoke-stale":
      return previewWayfarerStaleSessionRevoke(targetAccountId, targetId, now);
    case "one-voyage.membership.reconcile":
      return previewMembershipReconcile(targetAccountId, targetId);
    default:
      throw new AdmiraltyError(
        "SUPPORT_REPAIR_UNREGISTERED",
        "This repair is not registered for Support Pilot execution.",
        403,
      );
  }
}

async function executeOwnerRepair(input: {
  repairId: string;
  operator: AdmiraltyCurrentOperator;
  targetAccountId: string;
  targetId: string;
  targetRevision: string;
  correlationId: string;
  idempotencyKey: string;
}) {
  const actor = {
    accountId: input.operator.accountId,
    accountSessionId: input.operator.accountSessionId,
    role: input.operator.roles[0] ?? "SUPPORT_OPERATOR",
    capability: input.repairId === "one-voyage.membership.reconcile" ? "VOYAGE_OPERATE" : "ACCOUNT_OPERATE",
    authorizationBasis: `${input.operator.authorizationBasis};SUPPORT_EXECUTION_GRANT`,
  } as const;
  switch (input.repairId) {
    case "wayfarer.profile.reconcile":
      return executeWayfarerProfileReconcile({
        targetAccountId: input.targetAccountId,
        targetId: input.targetId,
        targetRevision: input.targetRevision,
      });
    case "wayfarer.session.revoke-stale":
      return executeWayfarerStaleSessionRevoke({
        actor,
        targetAccountId: input.targetAccountId,
        targetId: input.targetId,
        targetRevision: input.targetRevision,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      });
    case "one-voyage.membership.reconcile":
      return executeMembershipReconcile({
        targetAccountId: input.targetAccountId,
        targetId: input.targetId,
        targetRevision: input.targetRevision,
        actorAccountId: input.operator.accountId,
        correlationId: input.correlationId,
      });
    default:
      throw new AdmiraltyError(
        "SUPPORT_REPAIR_UNREGISTERED",
        "This repair is not registered for Support Pilot execution.",
        403,
      );
  }
}

async function verifyOwnerRepair(repairId: string, targetAccountId: string, targetId: string) {
  switch (repairId) {
    case "wayfarer.profile.reconcile":
      return verifyWayfarerProfileReconcile(targetAccountId, targetId);
    case "wayfarer.session.revoke-stale":
      return verifyWayfarerStaleSessionRevoke(targetAccountId, targetId);
    case "one-voyage.membership.reconcile":
      return verifyMembershipReconcile(targetAccountId, targetId);
    default:
      return false;
  }
}

export async function createSupportRepairProposal(
  operator: AdmiraltyCurrentOperator,
  input: { caseId: string; grantId: string; repairId: string; targetId: string },
  now = new Date(),
) {
  const context = await loadRepairAuthority(operator, input, now);
  const repair = getRegisteredSupportRepair(input.repairId);
  if (!repair)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_UNREGISTERED",
      "This repair is not registered for Support Pilot execution.",
      403,
    );
  const ownerPreview = await previewOwnerRepair(repair.id, context.authority.targetAccountId, input.targetId, now);
  const authorization = authorizeSupportRepair({
    authority: context.authority,
    repairId: repair.id,
    targetAccountId: context.authority.targetAccountId,
    requestedAffectedRecords: ownerPreview.affectedRecords,
    now,
  });
  const preview = {
    command: repair.id,
    owningSubsystem: repair.owningSubsystem,
    riskClass: repair.riskClass,
    target: { type: repair.targetType, id: ownerPreview.targetId, revision: ownerPreview.targetRevision },
    currentState: ownerPreview.currentState,
    expectedState: ownerPreview.resultingState,
    maximumAffectedRecords: repair.maximumAffectedRecords,
    affectedRecords: ownerPreview.affectedRecords,
    requiredSupportScopes: repair.requiredSupportScopes,
    verificationContract: repair.verificationContract,
    rollbackOrCompensation: repair.rollbackOrCompensation,
    autonomous: repair.autonomousExecutionAllowed,
    budgetAfter: authorization.remainingAfter,
  };
  const correlationId = randomUUID();
  const proposal = await db.$transaction(async (tx) => {
    const created = await tx.supportRepairProposal.create({
      data: {
        supportExecutionSessionId: context.latestExecutionSessionId,
        proposalType: repair.id,
        repairId: repair.id,
        targetType: repair.targetType,
        targetId: ownerPreview.targetId,
        targetRevision: ownerPreview.targetRevision,
        proposalRevision: context.authority.caseRevision,
        summary: repair.mutationPreview,
        preview: JSON.stringify(preview),
        requiredUserConsent: repair.userConsentRequired,
        requiresAdministrator: true,
        requiresHumanApproval: !repair.autonomousExecutionAllowed || repair.riskClass === "R4",
        state: "READY",
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
        capability: "SUPPORT_USE",
        action: "ADMIRALTY_SUPPORT_REPAIR_PROPOSED",
        targetType: repair.targetType,
        targetId: ownerPreview.targetId,
        reason: "A registered Support Pilot repair proposal was generated.",
        authorizationBasis: `${operator.authorizationBasis};SUPPORT_EXECUTION_GRANT`,
        accountSessionId: operator.accountSessionId,
        supportGrantId: input.grantId,
        correlationId,
        afterSummary: {
          repairId: repair.id,
          riskClass: repair.riskClass,
          proposalId: created.id,
          affectedRecords: ownerPreview.affectedRecords,
        },
      },
      tx,
    );
    return created;
  });
  return { proposal, preview };
}

async function acquireRepairLease(input: { targetType: string; targetId: string; supportCaseId: string; now: Date }) {
  const expiresAt = new Date(input.now.getTime() + leaseLifetimeMs);
  const leaseToken = randomUUID();
  const leaseTarget = {
    targetType: input.targetType,
    targetId: input.targetId,
    supportCaseId: input.supportCaseId,
  };
  try {
    return await db.supportRepairLease.create({ data: { ...leaseTarget, expiresAt, leaseToken } });
  } catch {
    const existing = await db.supportRepairLease.findUnique({
      where: { targetType_targetId: { targetType: input.targetType, targetId: input.targetId } },
    });
    if (existing && existing.expiresAt <= input.now) {
      await db.supportRepairLease.delete({ where: { id: existing.id } });
      return db.supportRepairLease.create({ data: { ...leaseTarget, expiresAt, leaseToken } });
    }
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_CONFLICT",
      "Another support case currently holds the mutation lease for this target.",
      409,
    );
  }
}

async function reconcileAmbiguousExecution(executionId: string) {
  const execution = await db.supportRepairExecution.findUnique({
    where: { id: executionId },
    include: { supportCase: { select: { targetAccountId: true } } },
  });
  if (!execution) return null;
  if (!["EXECUTING", "COMMITTED", "VERIFICATION_INCONCLUSIVE"].includes(execution.state)) return execution;
  const verified = await verifyOwnerRepair(
    execution.repairId,
    execution.supportCase.targetAccountId,
    execution.targetId,
  ).catch(() => false);
  if (!verified) return execution;
  return db.supportRepairExecution.update({
    where: { id: execution.id },
    data: {
      state: "VERIFIED_RESOLVED",
      verificationState: "VERIFIED_RESOLVED",
      verifiedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

export async function executeSupportRepair(
  operator: AdmiraltyCurrentOperator,
  input: { caseId: string; grantId: string; proposalId: string; idempotencyKey: string; humanApproval?: boolean },
  now = new Date(),
) {
  const prior = await db.supportRepairExecution.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) {
    const reconciled = await reconcileAmbiguousExecution(prior.id);
    if (
      !reconciled ||
      reconciled.supportCaseId !== input.caseId ||
      reconciled.supportRepairProposalId !== input.proposalId
    )
      throw new AdmiraltyError(
        "ADMIN_CONFLICT",
        "This idempotency key belongs to another support repair request.",
        409,
      );
    return { execution: reconciled, idempotent: true };
  }
  const context = await loadRepairAuthority(operator, input, now);
  const proposal = await db.supportRepairProposal.findFirst({
    where: { id: input.proposalId, executionSession: { supportCaseId: input.caseId } },
  });
  if (
    !proposal ||
    !proposal.repairId ||
    !proposal.targetType ||
    !proposal.targetId ||
    !proposal.targetRevision ||
    proposal.proposalRevision === null
  )
    throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The registered repair proposal was not found.", 404);
  if (proposal.state !== "READY" || proposal.proposalRevision !== context.authority.caseRevision)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_STALE",
      "The proposal is stale; reload the current support case before execution.",
      409,
    );
  const currentProposal = {
    repairId: proposal.repairId,
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    targetRevision: proposal.targetRevision,
    proposalRevision: proposal.proposalRevision,
  };
  const ownerPreview = await previewOwnerRepair(
    currentProposal.repairId,
    context.authority.targetAccountId,
    currentProposal.targetId,
    now,
  );
  if (ownerPreview.targetRevision !== currentProposal.targetRevision)
    throw new AdmiraltyError("SUPPORT_REPAIR_STALE", "The target changed after the proposal was created.", 409);
  const authorization = authorizeSupportRepair({
    authority: context.authority,
    repairId: currentProposal.repairId,
    targetAccountId: context.authority.targetAccountId,
    requestedAffectedRecords: ownerPreview.affectedRecords,
    requiresHumanApproval: input.humanApproval,
    now,
  });
  const lease = await acquireRepairLease({
    targetType: currentProposal.targetType,
    targetId: currentProposal.targetId,
    supportCaseId: input.caseId,
    now,
  });
  const correlationId = randomUUID();
  let execution: Awaited<ReturnType<typeof db.supportRepairExecution.create>> | null = null;
  let ownerCommandCommitted = false;
  try {
    execution = await db.$transaction(async (tx) => {
      const debit = await tx.supportExecutionGrant.updateMany({
        where: {
          id: context.executionGrantId,
          remainingCommands: { gte: 1 },
          remainingAffectedRecords: { gte: ownerPreview.affectedRecords },
          expiresAt: { gt: now },
          status: "ACTIVE",
        },
        data: {
          remainingCommands: { decrement: 1 },
          remainingAffectedRecords: { decrement: ownerPreview.affectedRecords },
          usedDomains: JSON.stringify(
            [...new Set([...context.authority.budget.usedDomains, authorization.repair.owningSubsystem])].sort(),
          ),
        },
      });
      if (!debit.count)
        throw new AdmiraltyError("SUPPORT_REPAIR_BUDGET_DENIED", "The delegated repair budget is exhausted.", 403);
      const created = await tx.supportRepairExecution.create({
        data: {
          supportCaseId: input.caseId,
          supportExecutionGrantId: context.executionGrantId,
          supportRepairProposalId: proposal.id,
          repairId: currentProposal.repairId,
          registrySchemaVersion: supportRepairRegistrySchemaVersion,
          targetType: currentProposal.targetType,
          targetId: currentProposal.targetId,
          targetRevision: currentProposal.targetRevision,
          proposalRevision: currentProposal.proposalRevision,
          idempotencyKey: input.idempotencyKey,
          state: "EXECUTING",
          affectedRecords: ownerPreview.affectedRecords,
          correlationId,
        },
      });
      await tx.supportRepairLease.update({ where: { id: lease.id }, data: { supportRepairExecutionId: created.id } });
      // This audit write is intentionally in the same transaction as the durable
      // execution record and budget debit. If audit persistence is unavailable,
      // no owner command has begun.
      await writeAdministrativeAudit(
        {
          actorAccountId: operator.accountId,
          actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
          capability: "SUPPORT_USE",
          action: "ADMIRALTY_SUPPORT_REPAIR_STARTED",
          targetType: currentProposal.targetType,
          targetId: currentProposal.targetId,
          reason: "A registered, consented support repair passed all execution gates.",
          authorizationBasis: `${operator.authorizationBasis};SUPPORT_EXECUTION_GRANT`,
          accountSessionId: operator.accountSessionId,
          supportGrantId: input.grantId,
          correlationId,
          afterSummary: {
            repairId: currentProposal.repairId,
            executionId: created.id,
            affectedRecords: ownerPreview.affectedRecords,
          },
        },
        tx,
      );
      return created;
    });
    const canonicalResult = await executeOwnerRepair({
      repairId: currentProposal.repairId,
      operator,
      targetAccountId: context.authority.targetAccountId,
      targetId: currentProposal.targetId,
      targetRevision: currentProposal.targetRevision,
      correlationId,
      idempotencyKey: input.idempotencyKey,
    });
    ownerCommandCommitted = true;
    // Persist the owner receipt before verification.  A later interruption is
    // reconciled through the declared postcondition instead of retrying blind.
    await db.supportRepairExecution.update({
      where: { id: execution.id },
      data: {
        state: "COMMITTED",
        ownerReceipt: JSON.stringify(canonicalResult),
        committedAt: new Date(),
      },
    });
    const verified = await verifyOwnerRepair(
      currentProposal.repairId,
      context.authority.targetAccountId,
      currentProposal.targetId,
    );
    const finalState = verified ? "VERIFIED_RESOLVED" : "VERIFICATION_INCONCLUSIVE";
    const completed = await db.$transaction(async (tx) => {
      const updated = await tx.supportRepairExecution.update({
        where: { id: execution!.id },
        data: {
          state: finalState,
          verificationState: finalState,
          ownerReceipt: JSON.stringify(canonicalResult),
          resultSummary: JSON.stringify({
            owner: authorization.repair.owningSubsystem,
            verified,
            affectedRecords: ownerPreview.affectedRecords,
          }),
          committedAt: now,
          verifiedAt: new Date(),
          completedAt: new Date(),
        },
      });
      await tx.supportCase.update({
        where: { id: input.caseId },
        data: { status: finalState, revision: { increment: 1 }, ...(verified ? { closedAt: new Date() } : {}) },
      });
      await writeAdministrativeAudit(
        {
          actorAccountId: operator.accountId,
          actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
          capability: "SUPPORT_USE",
          action: verified ? "ADMIRALTY_SUPPORT_REPAIR_VERIFIED" : "ADMIRALTY_SUPPORT_REPAIR_VERIFICATION_INCONCLUSIVE",
          targetType: currentProposal.targetType,
          targetId: currentProposal.targetId,
          outcome: verified ? "SUCCEEDED" : "FAILED",
          reason: verified
            ? "The registered repair passed its postcondition verification."
            : "The owner command returned but postcondition verification did not prove resolution.",
          authorizationBasis: `${operator.authorizationBasis};SUPPORT_EXECUTION_GRANT`,
          accountSessionId: operator.accountSessionId,
          supportGrantId: input.grantId,
          correlationId,
          afterSummary: {
            repairId: currentProposal.repairId,
            executionId: execution!.id,
            verificationState: finalState,
          },
        },
        tx,
      );
      return updated;
    });
    return { execution: completed, idempotent: false };
  } catch (cause) {
    if (execution && !ownerCommandCommitted) {
      await db.supportRepairExecution
        .update({
          where: { id: execution.id },
          data: {
            state: "FAILED",
            verificationState: "NOT_RUN",
            failureCode: cause instanceof AdmiraltyError ? cause.code : "OWNER_COMMAND_FAILED",
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
    throw cause;
  } finally {
    await db.supportRepairLease.delete({ where: { id: lease.id } }).catch(() => undefined);
  }
}
