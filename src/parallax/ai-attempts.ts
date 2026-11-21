import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { lockAIControl } from "./ai-ledger";
import {
  aiUsageSchema,
  aiUsageCostNano,
  effectiveAIUserPolicy,
  aiUserPolicySchema,
  aiUTCPeriod,
  aiMaximumExposureNano,
  effectiveAIPricing,
  chooseAIModel,
  type AIModelPricing,
} from "./ai-policy";
import { classifyAICapability, aiFailureOutcomes } from "./ai-capabilities";
import { SpatialAssistantError } from "./spatial-assistant";

/** Explicit owner retry seam. Providers still perform no automatic paid retries.
 * An unresolved prior attempt cannot be retried while its billing/execution is uncertain. */
export async function beginAIProviderRetry(operationId: string, store: PrismaClient = db, now = new Date()) {
  return store.$transaction(async (tx) => {
    const { policy } = await lockAIControl(tx);
    const row = await tx.aIUsageLedger.findUniqueOrThrow({ where: { id: operationId }, include: { attempts: true } });
    if (row.period !== aiUTCPeriod(now).id)
      throw new SpatialAssistantError(
        "RETRY_PERIOD",
        "Start a new logical operation in the current allowance period.",
        409,
      );
    if (
      !aiFailureOutcomes.some((outcome) => outcome === row.outcome) ||
      row.status !== "SETTLED" ||
      row.attempts.some((attempt) => attempt.costNano === null || attempt.status === "DISPATCHED")
    )
      throw new SpatialAssistantError("RETRY_UNRESOLVED", "Resolve the previous attempt before retrying.", 409);
    const user = await tx.aIQuotaUserPolicy.findUnique({ where: { accountId: row.accountId } });
    const effective = effectiveAIUserPolicy(
      policy,
      user ? aiUserPolicySchema.nullable().parse(JSON.parse(user.policy)) : null,
      now,
    );
    const model = chooseAIModel(policy, effective, row.mode as "STANDARD" | "ADVANCED", row.operationCategory);
    const price = effectiveAIPricing(policy, model, now);
    const reservation = aiMaximumExposureNano(price, policy.maximumInputTokens, policy.maximumOutputTokens);
    const rows = await tx.aIUsageLedger.aggregate({ where: { period: row.period }, _sum: { exposureNano: true } });
    const personal = await tx.aIUsageLedger.aggregate({
      where: { period: row.period, accountId: row.accountId },
      _sum: { exposureNano: true },
    });
    const capability = effective.capabilities[classifyAICapability(row.operationCategory, row.mode)];
    const capabilityUsage = await tx.aIUsageLedger.aggregate({
      where: { period: row.period, accountId: row.accountId, capabilityId: row.capabilityId },
      _sum: { exposureNano: true },
    });
    if (
      (rows._sum.exposureNano ?? BigInt(0)) + reservation > BigInt(policy.monthlySpendNano) ||
      (personal._sum.exposureNano ?? BigInt(0)) + reservation > BigInt(effective.monthlySpendNano) ||
      (capabilityUsage._sum.exposureNano ?? BigInt(0)) + reservation > BigInt(capability.monthlySpendNano) ||
      row.exposureNano + reservation > BigInt(policy.maximumRequestSpendNano)
    )
      throw new SpatialAssistantError("RETRY_BUDGET", "The retry exceeds an effective spending ceiling.", 429);
    const active = { status: "DISPATCHED", completedAt: null };
    if (
      (await tx.aIProviderAttempt.count({ where: active })) >= policy.globalConcurrency ||
      (await tx.aIProviderAttempt.count({ where: { ...active, operation: { accountId: row.accountId } } })) >=
        effective.concurrency
    )
      throw new SpatialAssistantError("RETRY_CONCURRENCY", "The provider concurrency limit has been reached.", 429);
    const recent = { startedAt: { gt: new Date(now.getTime() - 60000) } };
    if (
      (await tx.aIProviderAttempt.count({ where: recent })) >= policy.globalRequestsPerMinute ||
      (await tx.aIProviderAttempt.count({ where: { ...recent, operation: { accountId: row.accountId } } })) >=
        effective.requestsPerMinute
    )
      throw new SpatialAssistantError("RETRY_RATE", "Wait before retrying this provider operation.", 429);
    const sequence = Math.max(0, ...row.attempts.map((attempt) => attempt.sequence)) + 1;
    const attempt = await tx.aIProviderAttempt.create({
      data: {
        id: randomUUID(),
        operationId,
        sequence,
        provider: policy.provider,
        model,
        pricingRevision: price.revision,
        pricing: JSON.stringify(price),
        status: "DISPATCHED",
        exposureNano: reservation,
        startedAt: now,
      },
    });
    await tx.aIUsageLedger.update({
      where: { id: operationId },
      data: {
        status: "DISPATCHED",
        outcome: "IN_PROGRESS",
        exposureNano: { increment: reservation },
        reservationNano: { increment: reservation },
        leaseExpiresAt: new Date(now.getTime() + policy.timeoutMs + 60000),
      },
    });
    return attempt;
  });
}

const reconciliationSchema = z
  .strictObject({
    providerResponseId: z.string().min(1).max(200),
    usage: aiUsageSchema.optional(),
    confirmedCostNano: z
      .string()
      .regex(/^\d{1,18}$/)
      .optional(),
  })
  .refine(
    (input) => input.usage !== undefined || input.confirmedCostNano !== undefined,
    "Reconciliation requires reported usage or confirmed billed cost.",
  );

/** Server/provider settlement seam, never an admin assertion of acceptance.
 * Confirmed billed costs require a provider billing adapter's evidence, not estimates. */
export async function reconcileAIProviderAttempt(
  attemptId: string,
  raw: unknown,
  store: PrismaClient = db,
  now = new Date(),
) {
  const input = reconciliationSchema.parse(raw);
  return store.$transaction(async (tx) => {
    const { control, policy } = await lockAIControl(tx);
    const attempt = await tx.aIProviderAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (attempt.providerResponseId && attempt.providerResponseId !== input.providerResponseId)
      throw new SpatialAssistantError("SETTLEMENT_CONFLICT", "Provider response identity changed.", 409);
    if (attempt.usage && input.usage) {
      const previous = JSON.parse(attempt.usage) as Record<string, number | null>;
      if (Object.entries(input.usage).some(([key, value]) => previous[key] != null && previous[key] !== value))
        throw new SpatialAssistantError(
          "SETTLEMENT_CONFLICT",
          "Reported usage quantities cannot be silently rewritten.",
          409,
        );
    }
    const cost =
      input.confirmedCostNano !== undefined
        ? BigInt(input.confirmedCostNano)
        : aiUsageCostNano(JSON.parse(attempt.pricing) as AIModelPricing, input.usage);
    const basis = input.confirmedCostNano !== undefined ? "CONFIRMED" : "CALCULATED";
    if (attempt.costBasis === "CONFIRMED" && (cost !== attempt.costNano || basis !== "CONFIRMED"))
      throw new SpatialAssistantError("SETTLEMENT_CONFLICT", "Confirmed billing cannot be silently rewritten.", 409);
    if (attempt.costBasis === "CALCULATED" && basis === "CALCULATED" && attempt.costNano !== cost)
      throw new SpatialAssistantError(
        "SETTLEMENT_CONFLICT",
        "Reported usage conflicts with the existing receipt.",
        409,
      );
    await tx.aIProviderAttempt.update({
      where: { id: attemptId },
      data: {
        costNano: cost,
        exposureNano: cost,
        costBasis: basis,
        usage: input.usage ? JSON.stringify(input.usage) : undefined,
        providerResponseId: input.providerResponseId,
        completedAt: attempt.completedAt ?? now,
        reconciledAt: now,
        status: attempt.failureCode ? "FAILED" : "COMPLETED",
      },
    });
    const attempts = await tx.aIProviderAttempt.findMany({ where: { operationId: attempt.operationId } });
    const known = attempts.filter((item) => item.costNano !== null);
    const exposure = attempts.reduce((sum, item) => sum + item.exposureNano, BigInt(0));
    const total = known.reduce((sum, item) => sum + item.costNano!, BigInt(0));
    const confirmed = known
      .filter((item) => item.costBasis === "CONFIRMED")
      .reduce((sum, item) => sum + item.costNano!, BigInt(0));
    const pending = attempts.some((item) => item.costNano === null);
    const row = await tx.aIUsageLedger.update({
      where: { id: attempt.operationId },
      data: {
        status: pending ? "UNKNOWN" : "SETTLED",
        exposureNano: exposure,
        settledCostNano: known.length ? total : null,
        confirmedCostNano: known.some((item) => item.costBasis === "CONFIRMED") ? confirmed : null,
        costBasis: pending
          ? "UNKNOWN"
          : known.every((item) => item.costBasis === "CONFIRMED")
            ? "CONFIRMED"
            : known.some((item) => item.costBasis === "ESTIMATED")
              ? "ESTIMATED"
              : "CALCULATED",
        settledAt: pending ? null : now,
      },
    });
    if (exposure > row.reservationNano && policy.enabled) {
      await tx.aIQuotaControl.update({
        where: { id: "PARALLAX_SPATIAL_ASSISTANT" },
        data: {
          policy: JSON.stringify({ ...policy, enabled: false }),
          revision: { increment: 1 },
          lastFailureCode: "EXPOSURE_EXCEEDED",
          lastFailureAt: now,
        },
      });
      await tx.aIQuotaPolicyRevision.create({
        data: {
          id: randomUUID(),
          actorAccountId: "SYSTEM:PARALLAX_EXPOSURE_GUARD",
          idempotencyKey: `system-reconciled-exposure-${attemptId}`,
          fingerprint: `${attemptId}:${exposure}`,
          previousRevision: control.revision,
          resultingRevision: control.revision + 1,
          beforeState: JSON.stringify(policy),
          afterState: JSON.stringify({ ...policy, enabled: false }),
          reason: "Automatic disable: reconciled provider cost exceeded reserved exposure.",
          createdAt: now,
        },
      });
    }
    return row;
  });
}
