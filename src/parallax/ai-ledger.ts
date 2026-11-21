import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import {
  aiGlobalPolicySchema,
  aiUserPolicySchema,
  defaultAIGlobalPolicy,
  effectiveAIUserPolicy,
  aiUTCPeriod,
  chooseAIModel,
  aiPricing,
  effectiveAIPricing,
  aiMaximumExposureNano,
  aiReportedCost,
  aiUsageSchema,
  creatorAIUsageSchema,
  type AIGlobalPolicy,
  type AIUsage,
  type AIModelPricing,
  type AIReportedUsage,
} from "./ai-policy";
import { SpatialAssistantError } from "./spatial-assistant";
import { AI_CAPABILITY_VERSION, classifyAICapability, failureOutcome } from "./ai-capabilities";

export function recordedAIOutcome(result: unknown, category: string) {
  const value = result as { status?: string; code?: string } | undefined;
  if (value?.status === "PROPOSED") return category === "ROOM_RECONSTRUCTION" ? "GENERATED" : "PROPOSED";
  if (value?.status === "FAILED") return failureOutcome(value.code ?? "APPLICATION_FAILURE", true);
  if (value?.status === "CLARIFICATION") return "PARTIAL";
  return undefined;
}

export const AI_CONTROL_ID = "PARALLAX_SPATIAL_ASSISTANT";
const consuming = ["RESERVED", "DISPATCHED", "UNKNOWN", "SETTLED"];
const inFlight = ["RESERVED", "DISPATCHED"];
type Transaction = Prisma.TransactionClient;
type UsageRow = Prisma.AIUsageLedgerGetPayload<Record<string, never>>;
export type AIAdmission = { record: UsageRow; policy: AIGlobalPolicy; model: keyof typeof aiPricing; replay: boolean };

/** All monetary admissions, dispatches, settlements and policy changes acquire this same DB row first.
 * An UPDATE takes an exclusive SQLite write/MySQL row lock before any budget read. */
export async function lockAIControl(tx: Transaction) {
  const control = await tx.aIQuotaControl.upsert({
    where: { id: AI_CONTROL_ID },
    create: { id: AI_CONTROL_ID, policy: JSON.stringify(defaultAIGlobalPolicy) },
    update: { lockVersion: { increment: 1 } },
  });
  return { control, policy: aiGlobalPolicySchema.parse(JSON.parse(control.policy)) };
}
async function expireReservations(tx: Transaction, now: Date) {
  // Undispatched reservations provably spent nothing. Dispatched requests remain fully exposed.
  await tx.aIUsageLedger.updateMany({
    where: { status: "RESERVED", leaseExpiresAt: { lte: now } },
    data: {
      status: "RELEASED",
      exposureNano: BigInt(0),
      settledCostNano: BigInt(0),
      costBasis: "NO_CHARGE",
      outcome: "CANCELLED_BEFORE_EXECUTION",
      outcomeAt: now,
      failureCode: "UNDISPATCHED_EXPIRED",
      settledAt: now,
    },
  });
  await tx.aIUsageLedger.updateMany({
    where: { status: "DISPATCHED", leaseExpiresAt: { lte: now } },
    data: { status: "UNKNOWN", failureCode: "DISPATCHED_EXPIRED", outcome: "TIMEOUT", outcomeAt: now },
  });
  await tx.aIUsageLedger.updateMany({
    where: { resultExpiresAt: { lte: now }, result: { not: null } },
    data: { result: null },
  });
}
export async function readAIPolicy(store: PrismaClient = db) {
  const control = await store.aIQuotaControl.findUnique({ where: { id: AI_CONTROL_ID } });
  return {
    policy: control ? aiGlobalPolicySchema.parse(JSON.parse(control.policy)) : { ...defaultAIGlobalPolicy },
    revision: control?.revision ?? 0,
    health: {
      lastSuccessAt: control?.lastSuccessAt?.toISOString() ?? null,
      lastFailureCode: control?.lastFailureCode ?? null,
      lastFailureAt: control?.lastFailureAt?.toISOString() ?? null,
    },
  };
}
async function effectiveFor(tx: Transaction | PrismaClient, global: AIGlobalPolicy, accountId: string, now: Date) {
  const override = await tx.aIQuotaUserPolicy.findUnique({ where: { accountId } });
  return {
    ...effectiveAIUserPolicy(
      global,
      override ? aiUserPolicySchema.nullable().parse(JSON.parse(override.policy)) : null,
      now,
    ),
    revision: override?.revision ?? 0,
  };
}
function exceeded(code: string, message: string): never {
  throw new SpatialAssistantError(code, message, 429);
}

export async function reserveAIUsage(
  input: {
    accountId: string;
    requestId: string;
    idempotencyKey: string;
    fingerprint: string;
    definitionId: string;
    operationCategory: string;
    logicalParentId?: string;
    mode: "STANDARD" | "ADVANCED";
  },
  store: PrismaClient = db,
  now = new Date(),
): Promise<AIAdmission> {
  return store.$transaction(
    async (tx) => {
      const { control, policy } = await lockAIControl(tx);
      await expireReservations(tx, now);
      const existing = await tx.aIUsageLedger.findUnique({
        where: { accountId_idempotencyKey: { accountId: input.accountId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) {
        if (existing.fingerprint !== input.fingerprint)
          throw new SpatialAssistantError(
            "IDEMPOTENCY_CONFLICT",
            "This request identity belongs to another instruction.",
            409,
          );
        return { record: existing, policy, model: existing.model as keyof typeof aiPricing, replay: true };
      }
      const effective = await effectiveFor(tx, policy, input.accountId, now);
      const model = chooseAIModel(policy, effective, input.mode, input.operationCategory);
      const capabilityId = classifyAICapability(input.operationCategory, input.mode);
      const capabilityPolicy = effective.capabilities[capabilityId];
      const price = effectiveAIPricing(policy, model, now),
        reservationNano = aiMaximumExposureNano(price, policy.maximumInputTokens, policy.maximumOutputTokens);
      if (reservationNano > BigInt(policy.maximumRequestSpendNano))
        exceeded("REQUEST_BUDGET", "This request exceeds the configured assistance allowance.");
      const period = aiUTCPeriod(now);
      const globalWhere = { period: period.id, status: { in: consuming } };
      const userWhere = { ...globalWhere, accountId: input.accountId };
      const global = await tx.aIUsageLedger.aggregate({
        where: globalWhere,
        _count: true,
        _sum: { exposureNano: true },
      });
      const user = await tx.aIUsageLedger.aggregate({ where: userWhere, _count: true, _sum: { exposureNano: true } });
      const capabilityUsage = await tx.aIUsageLedger.aggregate({
        where: { ...userWhere, capabilityId },
        _count: true,
        _sum: { exposureNano: true },
      });
      if (user._count >= effective.monthlyRequests)
        exceeded(
          "USER_MONTHLY_REQUESTS",
          "You've used your Spatial Assistant allowance for this month. Your drafts are safe, and manual editing remains available.",
        );
      if (global._count >= policy.monthlyRequests)
        exceeded(
          "GLOBAL_MONTHLY_REQUESTS",
          "Spatial Assistant is temporarily unavailable because the platform allowance has been reached.",
        );
      if ((user._sum.exposureNano ?? BigInt(0)) + reservationNano > BigInt(effective.monthlySpendNano))
        exceeded(
          "USER_MONTHLY_BUDGET",
          "There isn't enough monthly AI spending allowance left to start this request. Manual editing remains available.",
        );
      if ((global._sum.exposureNano ?? BigInt(0)) + reservationNano > BigInt(policy.monthlySpendNano))
        exceeded(
          "GLOBAL_MONTHLY_BUDGET",
          "Spatial Assistant is temporarily unavailable because the platform AI budget has been reached.",
        );
      if (capabilityUsage._count >= capabilityPolicy.monthlyRequests)
        exceeded(
          "CAPABILITY_ALLOWANCE",
          "This capability's monthly allowance has been reached. Manual editing remains available.",
        );
      if (
        (capabilityUsage._sum.exposureNano ?? BigInt(0)) + reservationNano >
        BigInt(capabilityPolicy.monthlySpendNano)
      )
        exceeded("CAPABILITY_BUDGET", "This capability's monthly spending allowance has been reached.");
      const recentWhere = { createdAt: { gt: new Date(now.getTime() - 60000) }, status: { in: consuming } };
      if (
        (await tx.aIUsageLedger.count({ where: { ...recentWhere, accountId: input.accountId } })) >=
        effective.requestsPerMinute
      )
        exceeded("USER_RATE", "Please wait a minute before requesting more assistance.");
      if ((await tx.aIUsageLedger.count({ where: recentWhere })) >= policy.globalRequestsPerMinute)
        exceeded("GLOBAL_RATE", "Spatial Assistant is busy. Please try again shortly.");
      const activeWhere = { status: { in: inFlight }, leaseExpiresAt: { gt: now } };
      if (
        (await tx.aIUsageLedger.count({ where: { ...activeWhere, accountId: input.accountId } })) >=
        effective.concurrency
      )
        exceeded("USER_CONCURRENCY", "Your previous request is still working.");
      if ((await tx.aIUsageLedger.count({ where: activeWhere })) >= policy.globalConcurrency)
        exceeded("GLOBAL_CONCURRENCY", "Spatial Assistant is helping other Creators. Please try again shortly.");
      const record = await tx.aIUsageLedger.create({
        data: {
          id: randomUUID(),
          ...input,
          capabilityId,
          capabilityVersion: AI_CAPABILITY_VERSION,
          outcome: "IN_PROGRESS",
          utcDay: now.toISOString().slice(0, 10),
          applicationVersion: /^[a-f0-9]{40}$/i.test(process.env.VOYAGEWRIGHT_SOURCE_SHA ?? "")
            ? process.env.VOYAGEWRIGHT_SOURCE_SHA
            : null,
          period: period.id,
          provider: policy.provider,
          model,
          pricingRevision: price.revision,
          pricing: JSON.stringify(price),
          policyRevision: control.revision,
          userPolicyRevision: effective.revision,
          policySnapshot: JSON.stringify({
            globalRevision: control.revision,
            userRevision: effective.revision,
            capability: capabilityPolicy,
            combinedMonthlyRequests: effective.monthlyRequests,
            combinedMonthlySpendNano: effective.monthlySpendNano,
            advancedEnabled: effective.advancedEnabled,
          }),
          status: "RESERVED",
          reservationNano,
          exposureNano: reservationNano,
          createdAt: now,
          leaseExpiresAt: new Date(now.getTime() + policy.timeoutMs + 60000),
        },
      });
      return { record, policy, model, replay: false };
    },
    { maxWait: 10000, timeout: 15000 },
  );
}

export async function markAIDispatched(id: string, store: PrismaClient = db, now = new Date()) {
  return store.$transaction(async (tx) => {
    const { policy } = await lockAIControl(tx);
    const row = await tx.aIUsageLedger.findUniqueOrThrow({ where: { id } });
    const effective = await effectiveFor(tx, policy, row.accountId, now);
    chooseAIModel(policy, effective, row.mode as "STANDARD" | "ADVANCED", row.operationCategory);
    if (
      !policy.allowedModels.includes(row.model as keyof typeof aiPricing) ||
      !effective.capabilities[classifyAICapability(row.operationCategory, row.mode)].allowedModels.includes(
        row.model as keyof typeof aiPricing,
      )
    )
      throw new SpatialAssistantError("MODEL_UNAVAILABLE", "The configured model is no longer allowed.", 503);
    const changed = await tx.aIUsageLedger.updateMany({
      where: { id, status: "RESERVED", leaseExpiresAt: { gt: now } },
      data: { status: "DISPATCHED", dispatchedAt: now },
    });
    if (!changed.count)
      throw new SpatialAssistantError(
        "REQUEST_ALREADY_DISPATCHED",
        "This request has already been dispatched or expired.",
        409,
      );
    await tx.aIProviderAttempt.create({
      data: {
        id: `${id}:1`,
        operationId: id,
        sequence: 1,
        provider: row.provider,
        model: row.model,
        pricingRevision: row.pricingRevision,
        pricing: row.pricing,
        status: "DISPATCHED",
        exposureNano: row.reservationNano,
        startedAt: now,
      },
    });
  });
}

export async function settleAIUsage(
  id: string,
  input: {
    usage: AIUsage;
    reportedUsage?: AIReportedUsage | null;
    providerResponseId: string;
    result?: unknown;
    timings?: Record<string, number>;
  },
  store: PrismaClient = db,
  now = new Date(),
) {
  const usage = aiUsageSchema.parse(input.usage);
  return store.$transaction(async (tx) => {
    const { control, policy } = await lockAIControl(tx);
    const row = await tx.aIUsageLedger.findUniqueOrThrow({ where: { id } });
    const price = JSON.parse(row.pricing) as AIModelPricing,
      calculated = aiReportedCost(price, usage, input.reportedUsage ?? undefined),
      costNano = calculated.costNano;
    if (row.status === "SETTLED") {
      if (row.providerResponseId !== input.providerResponseId || row.settledCostNano !== costNano)
        throw new SpatialAssistantError(
          "SETTLEMENT_CONFLICT",
          "Provider usage conflicts with the settled receipt.",
          409,
        );
      return row;
    }
    if (!["DISPATCHED", "UNKNOWN"].includes(row.status))
      throw new SpatialAssistantError("SETTLEMENT_STATE", "Only a dispatched request can receive provider usage.", 409);
    const result = input.result === undefined ? undefined : JSON.stringify(input.result);
    if (result && Buffer.byteLength(result) > 64000)
      throw new SpatialAssistantError("RESULT_SIZE", "The proposal exceeds the retained result limit.");
    const updated = await tx.aIUsageLedger.update({
      where: { id },
      data: {
        status: "SETTLED",
        exposureNano: costNano,
        settledCostNano: costNano,
        costBasis: calculated.basis,
        ...(recordedAIOutcome(input.result, row.operationCategory) &&
        !["PREVIEWED", "REJECTED", "ACCEPTED", "ACCEPTED_THEN_EDITED", "APPLIED", "UNDONE"].includes(row.outcome)
          ? {
              outcome: recordedAIOutcome(input.result, row.operationCategory),
              outcomeAt: now,
            }
          : {}),
        ...((input.result as { status?: string } | undefined)?.status === "PROPOSED"
          ? { generatedAt: row.generatedAt ?? now }
          : {}),
        ...usage,
        ...(input.reportedUsage
          ? {
              cachedInputTokens: input.reportedUsage.cachedInputTokens,
              cacheWriteTokens: input.reportedUsage.cacheWriteTokens,
              reasoningTokens: input.reportedUsage.reasoningTokens,
            }
          : {}),
        providerResponseId: input.providerResponseId,
        settledAt: now,
        result,
        resultExpiresAt: result ? new Date(now.getTime() + policy.retentionDays * 86400000) : null,
        timings: input.timings ? JSON.stringify(input.timings) : undefined,
        failureCode:
          costNano > row.reservationNano
            ? "EXPOSURE_EXCEEDED"
            : ((input.result as { code?: string } | undefined)?.code ?? row.failureCode),
      },
    });
    await tx.aIProviderAttempt.upsert({
      where: { operationId_sequence: { operationId: id, sequence: 1 } },
      create: {
        id: `${id}:1`,
        operationId: id,
        sequence: 1,
        provider: row.provider,
        model: row.model,
        pricingRevision: row.pricingRevision,
        pricing: row.pricing,
        startedAt: row.dispatchedAt ?? now,
        status: (input.result as { status?: string } | undefined)?.status === "FAILED" ? "FAILED" : "COMPLETED",
        failureCode:
          (input.result as { code?: string } | undefined)?.code ??
          ((input.result as { status?: string } | undefined)?.status === "PROPOSED" ? null : row.failureCode),
        costBasis: calculated.basis,
        costNano,
        exposureNano: costNano,
        usage: JSON.stringify(input.reportedUsage ?? usage),
        providerResponseId: input.providerResponseId,
        completedAt: now,
      },
      update: {
        status: (input.result as { status?: string } | undefined)?.status === "FAILED" ? "FAILED" : "COMPLETED",
        failureCode:
          (input.result as { code?: string } | undefined)?.code ??
          ((input.result as { status?: string } | undefined)?.status === "PROPOSED" ? null : row.failureCode),
        costBasis: calculated.basis,
        costNano,
        exposureNano: costNano,
        usage: JSON.stringify(input.reportedUsage ?? usage),
        providerResponseId: input.providerResponseId,
        completedAt: now,
        reconciledAt: now,
      },
    });
    // Unexpected billing never disappears; fail closed for subsequent paid calls.
    await tx.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data:
        costNano > row.reservationNano
          ? {
              policy: JSON.stringify({ ...policy, enabled: false }),
              revision: { increment: 1 },
              lastFailureCode: "EXPOSURE_EXCEEDED",
              lastFailureAt: now,
            }
          : { lastSuccessAt: now },
    });
    if (costNano > row.reservationNano)
      await tx.aIQuotaPolicyRevision.create({
        data: {
          id: randomUUID(),
          targetAccountId: null,
          actorAccountId: "SYSTEM:PARALLAX_EXPOSURE_GUARD",
          idempotencyKey: `system-exposure-${row.id}`,
          fingerprint: createHash("sha256").update(`${row.id}:${costNano}`).digest("hex"),
          previousRevision: control.revision,
          resultingRevision: control.revision + 1,
          beforeState: JSON.stringify(policy),
          afterState: JSON.stringify({ ...policy, enabled: false }),
          reason: "Automatic disable: reported provider usage exceeded reserved exposure.",
          createdAt: now,
        },
      });
    return updated;
  });
}

export async function failAIUsage(
  id: string,
  code: string,
  definitelyUnbilled: boolean,
  store: PrismaClient = db,
  now = new Date(),
  retained?: {
    result: unknown;
    timings: Record<string, number>;
    reportedUsage?: AIReportedUsage | null;
    providerResponseId?: string;
  },
) {
  return store.$transaction(async (tx) => {
    const { policy } = await lockAIControl(tx);
    const row = await tx.aIUsageLedger.findUniqueOrThrow({ where: { id } });
    if (["SETTLED", "RELEASED"].includes(row.status)) return row;
    const unbilled = row.status === "RESERVED" || definitelyUnbilled;
    const result = retained ? JSON.stringify(retained.result) : undefined;
    if (result && Buffer.byteLength(result) > 64000)
      throw new SpatialAssistantError("RESULT_SIZE", "The proposal exceeds the retained result limit.");
    const updated = await tx.aIUsageLedger.update({
      where: { id },
      data: {
        status: unbilled ? "RELEASED" : "UNKNOWN",
        failureCode: code,
        outcome:
          recordedAIOutcome(retained?.result, row.operationCategory) ?? failureOutcome(code, Boolean(row.dispatchedAt)),
        outcomeAt: now,
        ...((retained?.result as { status?: string } | undefined)?.status === "PROPOSED" ? { generatedAt: now } : {}),
        costBasis: unbilled ? "NO_CHARGE" : "UNKNOWN",
        ...(unbilled ? { exposureNano: BigInt(0), settledCostNano: BigInt(0), settledAt: now } : {}),
        ...(retained
          ? {
              result,
              resultExpiresAt: new Date(now.getTime() + policy.retentionDays * 86400000),
              timings: JSON.stringify(retained.timings),
              ...(retained.providerResponseId ? { providerResponseId: retained.providerResponseId } : {}),
              ...(retained.reportedUsage
                ? {
                    inputTokens: retained.reportedUsage.inputTokens,
                    outputTokens: retained.reportedUsage.outputTokens,
                    cachedInputTokens: retained.reportedUsage.cachedInputTokens,
                    cacheWriteTokens: retained.reportedUsage.cacheWriteTokens,
                    reasoningTokens: retained.reportedUsage.reasoningTokens,
                  }
                : {}),
            }
          : {}),
      },
    });
    await tx.aIProviderAttempt.updateMany({
      where: { operationId: id, status: "DISPATCHED" },
      data: {
        status: unbilled ? "FAILED" : "UNKNOWN",
        failureCode:
          code === "UNKNOWN_PROVIDER_USAGE" &&
          (retained?.result as { status?: string } | undefined)?.status === "PROPOSED"
            ? null
            : code,
        completedAt: now,
        ...(retained?.reportedUsage ? { usage: JSON.stringify(retained.reportedUsage) } : {}),
        ...(retained?.providerResponseId ? { providerResponseId: retained.providerResponseId } : {}),
        ...(unbilled ? { costNano: BigInt(0), exposureNano: BigInt(0), costBasis: "NO_CHARGE" } : {}),
      },
    });
    await tx.aIQuotaControl.update({
      where: { id: AI_CONTROL_ID },
      data: { lastFailureCode: code, lastFailureAt: now },
    });
    return updated;
  });
}
export async function creatorAIUsage(accountId: string, store: PrismaClient = db, now = new Date()) {
  const { policy } = await readAIPolicy(store),
    effective = await effectiveFor(store, policy, accountId, now),
    period = aiUTCPeriod(now);
  const used = await store.aIUsageLedger.count({ where: { accountId, period: period.id, status: { in: consuming } } });
  return creatorAIUsageSchema.parse({
    enabled: policy.enabled && !effective.suspended,
    advancedEnabled: effective.advancedEnabled,
    roomModel: effective.roomModel,
    allowance: effective.monthlyRequests,
    used,
    remaining: Math.max(0, effective.monthlyRequests - used),
    resetAt: period.reset.toISOString(),
    source: effective.source,
    nearingLimit: effective.monthlyRequests > 0 && used / effective.monthlyRequests >= 0.8,
  });
}
