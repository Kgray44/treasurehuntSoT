import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { writeAdministrativeAudit } from "./audit";
import type { AdmiraltyCurrentOperator } from "./authorization";
import { AdmiraltyError } from "./errors";
import { parseSupportRepairIds, readSupportAccessGrant } from "./support-access";
import type { SupportAccessScope } from "./schemas";
import {
  createSupportExecutionCapability,
  deriveSupportDiagnosis,
  deterministicDiagnosticReceipt,
  parseSupportScopes,
  requireSupportExecutionScope,
  sanitizeSupportNarrative,
  supportScopeDataClass,
  type SupportPilotObservation,
} from "./support-pilot";
import { getRegisteredSupportRepair } from "./support-repair-registry";

type CaseInput = Readonly<{
  targetAccountId: string;
  title: string;
  summary: string;
  requestedScopes: readonly SupportAccessScope[];
  requestedRepairIds?: readonly string[];
}>;

const requestLifetimeMs = 24 * 60 * 60 * 1000;

export async function createSupportCase(operator: AdmiraltyCurrentOperator, input: CaseInput, now = new Date()) {
  if (operator.accountId === input.targetAccountId)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "Choose a different support target account.", 400);
  const target = await db.userAccount.findUnique({ where: { id: input.targetAccountId }, select: { id: true } });
  if (!target) throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support target was not found.", 404);
  const requestedScopes = [...new Set(input.requestedScopes)].sort();
  const requestedRepairIds = [...new Set(input.requestedRepairIds ?? [])]
    .filter((id) => Boolean(getRegisteredSupportRepair(id)))
    .sort();
  if (
    requestedRepairIds.some((id) =>
      getRegisteredSupportRepair(id)?.requiredSupportScopes.some((scope) => !requestedScopes.includes(scope)),
    )
  )
    throw new AdmiraltyError(
      "ADMIN_VALIDATION_FAILED",
      "Each requested repair must include every diagnostic scope required for its future verification.",
      400,
    );
  const title = sanitizeSupportNarrative(input.title, 160);
  const safeSummary = sanitizeSupportNarrative(input.summary, 480);
  if (!title || !safeSummary)
    throw new AdmiraltyError("ADMIN_VALIDATION_FAILED", "Provide a safe case title and support summary.", 400);
  const correlationId = randomUUID();
  const caseNumber = `S1-${randomUUID().slice(0, 8).toUpperCase()}`;
  return db.$transaction(async (tx) => {
    const request = await tx.supportAccessRequest.create({
      data: {
        requestingAdminAccountId: operator.accountId,
        targetAccountId: target.id,
        purpose: safeSummary,
        requestedScopes: JSON.stringify(requestedScopes),
        requestedRepairIds: JSON.stringify(requestedRepairIds),
        requestedAt: now,
        expiresAt: new Date(now.getTime() + requestLifetimeMs),
        correlationId,
        supportCase: {
          create: {
            caseNumber,
            requestingOperatorId: operator.accountId,
            targetAccountId: target.id,
            title,
            safeSummary,
            status: "AWAITING_CONSENT",
            correlationId,
            openedAt: now,
          },
        },
      },
      include: { supportCase: true },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
        capability: "SUPPORT_REQUEST",
        action: "ADMIRALTY_SUPPORT_CASE_OPENED",
        targetType: "SupportCase",
        targetId: request.supportCase?.id ?? caseNumber,
        reason: safeSummary,
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
        correlationId,
        afterSummary: {
          caseNumber,
          targetAccountId: target.id,
          requestedScopes,
          requestedRepairIds,
          readOnly: true,
          supportAccessRequestId: request.id,
        },
      },
      tx,
    );
    return { supportCase: request.supportCase!, request };
  });
}

export async function listSupportCases(operator: AdmiraltyCurrentOperator, now = new Date()) {
  const cases = await db.supportCase.findMany({
    where: { requestingOperatorId: operator.accountId },
    select: {
      id: true,
      caseNumber: true,
      targetAccountId: true,
      title: true,
      safeSummary: true,
      status: true,
      openedAt: true,
      correlationId: true,
      supportAccessRequest: {
        select: {
          id: true,
          requestedScopes: true,
          requestedRepairIds: true,
          status: true,
          expiresAt: true,
          grant: {
            select: {
              id: true,
              status: true,
              expiresAt: true,
              revokedAt: true,
              grantedRepairIds: true,
              maximumRiskClass: true,
            },
          },
        },
      },
      executionSessions: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          deniedAccessCount: true,
          redactionCount: true,
          receiptDigest: true,
          supportExecutionGrant: {
            select: {
              maximumRiskClass: true,
              remainingCommands: true,
              remainingAffectedRecords: true,
              maximumDomains: true,
              usedDomains: true,
              expiresAt: true,
            },
          },
          diagnosis: { select: { primaryCause: true, confidence: true, uncertainty: true, unresolvedQuestions: true } },
          findings: {
            select: { code: true, summary: true, confidence: true, uncertainty: true },
            orderBy: { createdAt: "asc" },
          },
          repairProposals: {
            select: {
              id: true,
              proposalType: true,
              repairId: true,
              targetType: true,
              targetId: true,
              targetRevision: true,
              proposalRevision: true,
              preview: true,
              summary: true,
              requiredUserConsent: true,
              requiresAdministrator: true,
              state: true,
              requiresHumanApproval: true,
            },
          },
          evidenceReferences: {
            select: {
              sourceDomain: true,
              sourceReference: true,
              dataClassification: true,
              digest: true,
              redacted: true,
            },
            orderBy: { observedAt: "asc" },
            take: 20,
          },
        },
      },
    },
    orderBy: { openedAt: "desc" },
    take: 30,
  });
  return cases.map((supportCase) => {
    const grant = supportCase.supportAccessRequest?.grant;
    const activeGrant = Boolean(
      grant && grant.status === "ACTIVE" && !grant.revokedAt && grant.expiresAt.getTime() > now.getTime(),
    );
    return {
      ...supportCase,
      requestedScopes: parseSupportScopes(supportCase.supportAccessRequest?.requestedScopes ?? "[]"),
      requestedRepairIds: parseSupportRepairIds(supportCase.supportAccessRequest?.requestedRepairIds ?? "[]"),
      consent: {
        requestId: supportCase.supportAccessRequest?.id ?? null,
        status: supportCase.supportAccessRequest?.status ?? "NOT_REQUESTED",
        expiresAt: supportCase.supportAccessRequest?.expiresAt ?? null,
        grantId: activeGrant ? (grant?.id ?? null) : null,
        grantStatus: activeGrant ? "ACTIVE" : grant?.revokedAt ? "REVOKED" : (grant?.status ?? "NOT_GRANTED"),
        grantExpiresAt: grant?.expiresAt ?? null,
        grantedRepairIds: activeGrant ? parseSupportRepairIds(grant?.grantedRepairIds ?? "[]") : [],
        maximumRiskClass: activeGrant ? (grant?.maximumRiskClass ?? "R0") : "R0",
      },
      latestExecution: supportCase.executionSessions[0] ?? null,
    };
  });
}

export async function runSupportCaseDiagnostic(
  operator: AdmiraltyCurrentOperator,
  input: Readonly<{ caseId: string; grantId: string }>,
  now = new Date(),
) {
  const supportCase = await db.supportCase.findFirst({
    where: { id: input.caseId, requestingOperatorId: operator.accountId },
    select: {
      id: true,
      requestingOperatorId: true,
      targetAccountId: true,
      supportAccessRequestId: true,
      caseNumber: true,
    },
  });
  if (!supportCase) throw new AdmiraltyError("ADMIN_TARGET_NOT_FOUND", "The support case was not found.", 404);
  const grant = await db.supportAccessGrant.findUnique({ where: { id: input.grantId }, include: { request: true } });
  let capability;
  try {
    capability = createSupportExecutionCapability(supportCase, grant, operator.accountId, now);
  } catch (cause) {
    await recordDeniedExecution(operator, supportCase.id, cause, now);
    throw cause;
  }

  const correlationId = randomUUID();
  const executionGrant = await db.supportExecutionGrant.create({
    data: {
      supportCaseId: capability.supportCaseId,
      parentSupportGrantId: capability.parentSupportGrantId,
      operatorAccountId: capability.operatorAccountId,
      targetAccountId: capability.targetAccountId,
      grantedScopes: JSON.stringify(capability.scopes),
      dataClasses: JSON.stringify(capability.dataClasses),
      riskCeiling: capability.riskCeiling,
      permittedRepairIds: JSON.stringify(capability.permittedRepairIds),
      maximumRiskClass: capability.maximumRiskClass,
      maximumCommands: capability.maximumCommands,
      remainingCommands: capability.maximumCommands,
      maximumAffectedRecords: capability.maximumAffectedRecords,
      remainingAffectedRecords: capability.maximumAffectedRecords,
      maximumDomains: capability.maximumDomains,
      usedDomains: "[]",
      issuedAt: now,
      expiresAt: capability.expiresAt,
      correlationId,
    },
  });
  const session = await db.supportExecutionSession.create({
    data: {
      supportCaseId: supportCase.id,
      supportExecutionGrantId: executionGrant.id,
      operatorAccountId: operator.accountId,
      status: "RUNNING",
      queriedDomains: "[]",
      dataClasses: JSON.stringify(capability.dataClasses),
      startedAt: now,
      correlationId,
    },
  });
  try {
    const observations: SupportPilotObservation[] = [];
    for (const scope of capability.scopes) {
      requireSupportExecutionScope(capability, scope);
      const projection = await readSupportAccessGrant(
        operator,
        { grantId: capability.parentSupportGrantId, targetAccountId: capability.targetAccountId, scope },
        now,
      );
      observations.push(toObservation(scope, capability.targetAccountId, projection));
    }
    const diagnosisResult = deriveSupportDiagnosis(observations);
    const receiptDigest = deterministicDiagnosticReceipt({
      caseId: supportCase.id,
      executionGrantId: executionGrant.id,
      scopes: capability.scopes,
      observations,
      findings: diagnosisResult.findings,
    });
    await db.$transaction(async (tx) => {
      const evidenceIds: string[] = [];
      for (const observation of observations) {
        const stored = await tx.supportObservation.create({
          data: {
            supportExecutionSessionId: session.id,
            domain: observation.domain,
            scope: observation.scope,
            dataClassification: observation.dataClassification,
            sourceType: observation.sourceType,
            sourceId: observation.sourceId,
            sourceDigest: observation.sourceDigest,
            safeSummary: observation.safeSummary,
            observedAt: now,
          },
        });
        const evidence = await tx.supportEvidenceReference.create({
          data: {
            supportExecutionSessionId: session.id,
            supportObservationId: stored.id,
            sourceDomain: observation.domain,
            sourceReference: `${observation.sourceType}:${observation.sourceId}`,
            dataClassification: observation.dataClassification,
            digest: observation.sourceDigest,
            sanitizedExcerpt: observation.safeSummary,
            redacted: true,
            observedAt: now,
          },
        });
        evidenceIds.push(evidence.id);
      }
      for (const finding of diagnosisResult.findings)
        await tx.supportFinding.create({
          data: {
            supportExecutionSessionId: session.id,
            code: finding.code,
            summary: finding.summary,
            confidence: finding.confidence,
            uncertainty: finding.uncertainty,
            evidenceLinks: {
              create: evidenceIds.map((supportEvidenceReferenceId) => ({ supportEvidenceReferenceId })),
            },
          },
        });
      await tx.supportDiagnosis.create({
        data: {
          supportExecutionSessionId: session.id,
          primaryCause: diagnosisResult.diagnosis.primaryCause,
          confidence: diagnosisResult.diagnosis.confidence,
          uncertainty: diagnosisResult.diagnosis.uncertainty,
          unresolvedQuestions: JSON.stringify(diagnosisResult.diagnosis.unresolvedQuestions),
          evidenceDigest: receiptDigest,
        },
      });
      await tx.supportRepairProposal.create({
        data: { supportExecutionSessionId: session.id, ...diagnosisResult.diagnosis.proposal },
      });
      await tx.supportExecutionSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETE",
          queriedDomains: JSON.stringify([...new Set(observations.map((observation) => observation.domain))].sort()),
          dataClasses: JSON.stringify(capability.dataClasses),
          redactionCount: observations.length,
          receiptDigest,
          completedAt: now,
        },
      });
      await tx.supportCase.update({
        where: { id: supportCase.id },
        data: { status: "DIAGNOSED", revision: { increment: 1 } },
      });
      await writeAdministrativeAudit(
        {
          actorAccountId: operator.accountId,
          actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
          capability: "SUPPORT_USE",
          action: "ADMIRALTY_SUPPORT_CASE_DIAGNOSED",
          targetType: "SupportCase",
          targetId: supportCase.id,
          reason: "Bounded read-only support diagnosis completed.",
          authorizationBasis: `${operator.authorizationBasis};SUPPORT_EXECUTION_GRANT`,
          accountSessionId: operator.accountSessionId,
          supportGrantId: capability.parentSupportGrantId,
          correlationId,
          afterSummary: {
            executionGrantId: executionGrant.id,
            executionSessionId: session.id,
            queriedDomains: observations.map((observation) => observation.domain),
            dataClasses: capability.dataClasses,
            findingCodes: diagnosisResult.findings.map((finding) => finding.code),
            receiptDigest,
            autonomousMutation: false,
          },
        },
        tx,
      );
    });
    return { executionGrantId: executionGrant.id, executionSessionId: session.id, receiptDigest };
  } catch (cause) {
    const denied = cause instanceof AdmiraltyError && cause.code.startsWith("SUPPORT_GRANT");
    await db.supportExecutionSession.update({
      where: { id: session.id },
      data: {
        status: denied ? "DENIED" : "FAILED",
        deniedAccessCount: denied ? 1 : 0,
        denialCode: denied ? cause.code : "DIAGNOSTIC_SOURCE_UNAVAILABLE",
        completedAt: now,
      },
    });
    throw cause;
  }
}

function toObservation(
  scope: SupportAccessScope,
  targetAccountId: string,
  projection: unknown,
): SupportPilotObservation {
  const value = projection as { scope: SupportAccessScope; [key: string]: unknown };
  const sourceType = `SupportAccess.${scope}`;
  const facts = observationFacts(scope, value);
  return {
    scope,
    domain: domainForScope(scope),
    dataClassification: supportScopeDataClass(scope),
    sourceType,
    sourceId: targetAccountId,
    sourceDigest: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
    safeSummary: `${domainForScope(scope)} supplied a bounded ${scope.toLocaleLowerCase("en-US").replaceAll("_", " ")} projection.`,
    facts,
  };
}

function observationFacts(
  scope: SupportAccessScope,
  value: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  if (scope === "ACCOUNT_STATE") {
    const account = (value.account ?? {}) as Record<string, unknown>;
    return { accountStatus: String(account.status ?? "UNKNOWN"), accountLocked: Boolean(account.lockedAt) };
  }
  if (scope === "SESSION_DIAGNOSTICS") {
    const sessions = Array.isArray(value.sessions) ? value.sessions : [];
    const activeSessionCount = sessions.filter((session) => {
      const item = session as Record<string, unknown>;
      return !item.revokedAt && new Date(String(item.expiresAt)).getTime() > Date.now();
    }).length;
    return { activeSessionCount, sessionCount: Number(value.sessionCount ?? sessions.length) };
  }
  if (scope === "VOYAGE_MEMBERSHIP") return { membershipCount: Number(value.membershipCount ?? 0) };
  if (scope === "RUNTIME_STATUS") {
    const runtime = (value.runtime ?? {}) as Record<string, unknown>;
    return {
      mutationAvailable: Boolean(runtime.mutationAvailable),
      databaseConfigured: Boolean(runtime.databaseConfigured),
    };
  }
  if (scope === "AUDIT_CORRELATION") return { eventCount: Number(value.eventCount ?? 0) };
  if (scope === "CHRONICLE_HISTORY_METADATA") return { recordCount: Number(value.recordCount ?? 0) };
  return {};
}

function domainForScope(scope: SupportAccessScope) {
  if (["ACCOUNT_STATE", "AUTH_EVENTS", "SESSION_DIAGNOSTICS", "PROFILE_DIAGNOSTICS"].includes(scope)) return "Wayfarer";
  if (["CHRONICLE_HISTORY_METADATA", "VOYAGE_MEMBERSHIP", "TIDEGLASS_DIAGNOSTICS"].includes(scope)) return "OneVoyage";
  if (scope === "COMMUNITY_ACTIVITY") return "Harborlight";
  if (scope === "RUNTIME_STATUS") return "PlatformRuntime";
  return "AdmiraltyAudit";
}

async function recordDeniedExecution(
  operator: AdmiraltyCurrentOperator,
  supportCaseId: string,
  cause: unknown,
  now: Date,
) {
  const denialCode = cause instanceof AdmiraltyError ? cause.code : "SUPPORT_GRANT_REQUIRED";
  const correlationId = randomUUID();
  await db.$transaction(async (tx) => {
    const session = await tx.supportExecutionSession.create({
      data: {
        supportCaseId,
        operatorAccountId: operator.accountId,
        status: "DENIED",
        deniedAccessCount: 1,
        denialCode,
        startedAt: now,
        completedAt: now,
        correlationId,
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: operator.accountId,
        actorRole: operator.roles[0] ?? "SUPPORT_OPERATOR",
        capability: "SUPPORT_USE",
        action: "ADMIRALTY_SUPPORT_CASE_DIAGNOSTIC_DENIED",
        targetType: "SupportCase",
        targetId: supportCaseId,
        outcome: "DENIED",
        reason: "The scoped read-only diagnostic capability was denied.",
        authorizationBasis: operator.authorizationBasis,
        accountSessionId: operator.accountSessionId,
        correlationId,
        afterSummary: { executionSessionId: session.id, denialCode, autonomousMutation: false },
      },
      tx,
    );
  });
}
