import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { aiUTCPeriod, aiUserPolicySchema, effectiveAIUserPolicy, aiPricing } from "./ai-policy";
import { readAIPolicy } from "./ai-ledger";
import { openAIProviderConfiguration } from "./openai-provider";

const consuming = ["RESERVED", "DISPATCHED", "UNKNOWN", "SETTLED"];
export async function aiQuotaOverview(store: PrismaClient = db, now = new Date()) {
  const { policy, revision, health } = await readAIPolicy(store),
    period = aiUTCPeriod(now);
  const where = { period: period.id, status: { in: consuming } };
  const [aggregate, byMode, byStatus, activeUsers, daily, unknown] = await Promise.all([
    store.aIUsageLedger.aggregate({
      where,
      _count: true,
      _sum: { exposureNano: true, settledCostNano: true, reservationNano: true },
    }),
    store.aIUsageLedger.groupBy({ by: ["mode"], where, _count: true, _sum: { exposureNano: true } }),
    store.aIUsageLedger.groupBy({ by: ["status"], where: { period: period.id }, _count: true }),
    store.aIUsageLedger.groupBy({ by: ["accountId"], where, _count: true }),
    Promise.all(
      Array.from({ length: now.getUTCDate() }, async (_, index) => {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), index + 1)),
          end = new Date(start.getTime() + 86400000);
        const total = await store.aIUsageLedger.aggregate({
          where: { ...where, createdAt: { gte: start, lt: end } },
          _count: true,
          _sum: { exposureNano: true, settledCostNano: true },
        });
        return {
          date: start.toISOString().slice(0, 10),
          requests: total._count,
          exposureNano: Number(total._sum.exposureNano ?? BigInt(0)),
          settledCostNano: Number(total._sum.settledCostNano ?? BigInt(0)),
        };
      }),
    ),
    store.aIUsageLedger.count({ where: { status: "UNKNOWN" } }),
  ]);
  const exposureNano = Number(aggregate._sum.exposureNano ?? BigInt(0));
  return {
    policy,
    revision,
    period: period.id,
    resetAt: period.reset.toISOString(),
    usage: {
      requests: aggregate._count,
      activeUsers: activeUsers.length,
      exposureNano,
      settledCostNano: Number(aggregate._sum.settledCostNano ?? BigInt(0)),
      budgetRemainingNano: Math.max(0, policy.monthlySpendNano - exposureNano),
      warning: exposureNano >= policy.warningSpendNano && policy.warningSpendNano > 0,
      overBudget: exposureNano > policy.monthlySpendNano,
    },
    byMode: byMode.map((group) => ({
      mode: group.mode,
      requests: group._count,
      exposureNano: Number(group._sum.exposureNano ?? BigInt(0)),
    })),
    byStatus: byStatus.map((group) => ({ status: group.status, requests: group._count })),
    daily,
    provider: {
      ...openAIProviderConfiguration(policy),
      ...health,
      pricing: Object.values(aiPricing),
      reconciliation: unknown ? "PENDING_UNKNOWN_USAGE" : "NO_UNKNOWN_USAGE",
      unknownUsageCount: unknown,
    },
  };
}

export async function aiQuotaUserDetail(accountId: string, store: PrismaClient = db, now = new Date()) {
  const { policy } = await readAIPolicy(store),
    period = aiUTCPeriod(now);
  const [account, override, usage, lastActivity] = await Promise.all([
    store.userAccount.findUnique({
      where: { id: accountId },
      select: { id: true, profile: { select: { displayName: true } } },
    }),
    store.aIQuotaUserPolicy.findUnique({ where: { accountId } }),
    store.aIUsageLedger.aggregate({
      where: { accountId, period: period.id, status: { in: consuming } },
      _count: true,
      _sum: { exposureNano: true, settledCostNano: true },
    }),
    store.aIUsageLedger.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  if (!account) return null;
  const userPolicy = override ? aiUserPolicySchema.nullable().parse(JSON.parse(override.policy)) : null,
    effective = effectiveAIUserPolicy(policy, userPolicy, now);
  return {
    accountId: account.id,
    displayName: account.profile?.displayName ?? "Voyagewright account",
    policy: userPolicy,
    revision: override?.revision ?? 0,
    effective,
    globalCeiling: { requests: policy.monthlyRequests, spendNano: policy.monthlySpendNano },
    used: usage._count,
    remaining: Math.max(0, effective.monthlyRequests - usage._count),
    percentageUsed: effective.monthlyRequests ? Math.min(100, (100 * usage._count) / effective.monthlyRequests) : 100,
    exposureNano: Number(usage._sum.exposureNano ?? BigInt(0)),
    settledCostNano: Number(usage._sum.settledCostNano ?? BigInt(0)),
    lastActivity: lastActivity?.createdAt.toISOString() ?? null,
    resetAt: period.reset.toISOString(),
  };
}

/** Deliberate select: private request fingerprints, retained proposals and authored scene content never enter admin history. */
export async function aiQuotaUsageHistory(
  filter: { accountId?: string; from: Date; to: Date; take?: number },
  store: PrismaClient = db,
) {
  const rows = await store.aIUsageLedger.findMany({
    where: { accountId: filter.accountId, createdAt: { gte: filter.from, lt: filter.to } },
    orderBy: { createdAt: "desc" },
    take: Math.min(filter.take ?? 100, 1000),
    select: {
      id: true,
      accountId: true,
      requestId: true,
      model: true,
      mode: true,
      operationCategory: true,
      pricingRevision: true,
      period: true,
      status: true,
      reservationNano: true,
      exposureNano: true,
      settledCostNano: true,
      inputTokens: true,
      cachedInputTokens: true,
      cacheWriteTokens: true,
      outputTokens: true,
      reasoningTokens: true,
      failureCode: true,
      createdAt: true,
      dispatchedAt: true,
      settledAt: true,
      timings: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    reservationNano: Number(row.reservationNano),
    exposureNano: Number(row.exposureNano),
    settledCostNano: row.settledCostNano === null ? null : Number(row.settledCostNano),
    createdAt: row.createdAt.toISOString(),
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    settledAt: row.settledAt?.toISOString() ?? null,
  }));
}
