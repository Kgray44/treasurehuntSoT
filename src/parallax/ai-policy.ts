import { z } from "zod";
import { SpatialAssistantError } from "./spatial-assistant";

export const aiModelIds = ["gpt-6-luna", "gpt-6.1-sol"] as const;
export type AIModelId = (typeof aiModelIds)[number];
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
// USD nanodollars; $1 = 1,000,000,000 units. Public JSON uses safe integers.
export const USD_NANO = 1_000_000_000;
// Safe Creator projection shared by the server and canonical Studio adapter.
export const creatorAIUsageSchema = z.object({
  enabled: z.boolean(),
  advancedEnabled: z.boolean(),
  allowance: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetAt: z.iso.datetime(),
  source: z.enum(["INHERITED", "OVERRIDE"]),
  nearingLimit: z.boolean(),
});
const money = integer(0, 1_000_000 * USD_NANO);
export const aiGlobalPolicySchema = z
  .strictObject({
    enabled: z.boolean(),
    provider: z.literal("OPENAI"),
    standardModel: z.enum(aiModelIds),
    advancedModel: z.enum(aiModelIds),
    advancedEnabled: z.boolean(),
    standardReasoning: z.enum(["low", "medium"]),
    advancedReasoning: z.enum(["low", "medium"]),
    monthlyRequests: integer(0, 1_000_000),
    monthlySpendNano: money,
    warningSpendNano: money,
    defaultUserRequests: integer(0, 1_000_000),
    defaultUserSpendNano: money.nullable(),
    userRequestsPerMinute: integer(1, 100),
    globalRequestsPerMinute: integer(1, 1000),
    userConcurrency: integer(1, 3),
    globalConcurrency: integer(1, 20),
    maximumInputTokens: integer(1000, 32000),
    maximumOutputTokens: integer(256, 16000),
    timeoutMs: integer(1000, 60000),
    maximumRequestSpendNano: money,
    retentionDays: integer(1, 90),
    allowedModels: z.array(z.enum(aiModelIds)).min(1).max(2),
  })
  .superRefine((policy, ctx) => {
    if (
      !policy.allowedModels.includes(policy.standardModel) ||
      (policy.advancedEnabled && !policy.allowedModels.includes(policy.advancedModel))
    )
      ctx.addIssue({ code: "custom", message: "Every active model must be allowed." });
    if (new Set(policy.allowedModels).size !== policy.allowedModels.length)
      ctx.addIssue({ code: "custom", message: "Allowed models must be unique." });
    if (policy.warningSpendNano > policy.monthlySpendNano)
      ctx.addIssue({ code: "custom", message: "Warning cannot exceed the budget." });
    if (
      policy.userConcurrency > policy.globalConcurrency ||
      policy.userRequestsPerMinute > policy.globalRequestsPerMinute
    )
      ctx.addIssue({ code: "custom", message: "User safety limits cannot exceed global limits." });
  });
export type AIGlobalPolicy = z.infer<typeof aiGlobalPolicySchema>;
export const defaultAIGlobalPolicy: Readonly<AIGlobalPolicy> = Object.freeze<AIGlobalPolicy>({
  enabled: false,
  provider: "OPENAI",
  standardModel: "gpt-6-luna",
  advancedModel: "gpt-6.1-sol",
  advancedEnabled: false,
  standardReasoning: "low",
  advancedReasoning: "low",
  monthlyRequests: 10000,
  monthlySpendNano: 10 * USD_NANO,
  warningSpendNano: 5 * USD_NANO,
  defaultUserRequests: 500,
  defaultUserSpendNano: null,
  userRequestsPerMinute: 10,
  globalRequestsPerMinute: 60,
  userConcurrency: 1,
  globalConcurrency: 3,
  maximumInputTokens: 12000,
  maximumOutputTokens: 4000,
  timeoutMs: 20000,
  maximumRequestSpendNano: USD_NANO / 10,
  retentionDays: 30,
  allowedModels: ["gpt-6-luna", "gpt-6.1-sol"],
});
export const aiUserPolicySchema = z.strictObject({
  monthlyRequests: integer(0, 1_000_000).nullable(),
  monthlySpendNano: money.nullable(),
  advancedEnabled: z.boolean().nullable(),
  requestsPerMinute: integer(1, 100).nullable(),
  suspended: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
});
export type AIUserPolicy = z.infer<typeof aiUserPolicySchema>;
export function effectiveAIUserPolicy(global: AIGlobalPolicy, override: AIUserPolicy | null, now = new Date()) {
  const active = override && (!override.expiresAt || Date.parse(override.expiresAt) > now.getTime()) ? override : null;
  return {
    source: active ? ("OVERRIDE" as const) : ("INHERITED" as const),
    monthlyRequests: Math.min(active?.monthlyRequests ?? global.defaultUserRequests, global.monthlyRequests),
    monthlySpendNano: Math.min(
      active?.monthlySpendNano ?? global.defaultUserSpendNano ?? global.monthlySpendNano,
      global.monthlySpendNano,
    ),
    advancedEnabled: global.advancedEnabled && (active?.advancedEnabled ?? false),
    requestsPerMinute: Math.min(
      active?.requestsPerMinute ?? global.userRequestsPerMinute,
      global.userRequestsPerMinute,
      global.globalRequestsPerMinute,
    ),
    concurrency: Math.min(global.userConcurrency, global.globalConcurrency),
    suspended: active?.suspended ?? false,
    expiresAt: active?.expiresAt ?? null,
  };
}
export function aiUTCPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { id: start.toISOString().slice(0, 7), start, reset };
}
export type AIModelPricing = {
  revision: string;
  model: AIModelId;
  effectiveAt: string;
  serviceTier: "default";
  inputNanoPerToken: number;
  cachedInputNanoPerToken: number;
  cacheWriteNanoPerToken: number;
  outputNanoPerToken: number;
  source: string;
};
export const aiPricing: Readonly<Record<AIModelId, AIModelPricing>> = Object.freeze({
  "gpt-6-luna": {
    revision: "openai-standard-text-2026-10-11-v1",
    model: "gpt-6-luna",
    effectiveAt: "2026-10-11T00:00:00.000Z",
    serviceTier: "default",
    inputNanoPerToken: 100,
    cachedInputNanoPerToken: 10,
    cacheWriteNanoPerToken: 125,
    outputNanoPerToken: 500,
    source: "https://developers.openai.com/api/docs/pricing",
  },
  "gpt-6.1-sol": {
    revision: "openai-standard-text-2026-10-11-v1",
    model: "gpt-6.1-sol",
    effectiveAt: "2026-10-11T00:00:00.000Z",
    serviceTier: "default",
    inputNanoPerToken: 2000,
    cachedInputNanoPerToken: 100,
    cacheWriteNanoPerToken: 2500,
    outputNanoPerToken: 10000,
    source: "https://developers.openai.com/api/docs/pricing",
  },
});
export const aiUsageSchema = z
  .strictObject({
    inputTokens: integer(0, 1_000_000),
    cachedInputTokens: integer(0, 1_000_000),
    cacheWriteTokens: integer(0, 1_000_000),
    outputTokens: integer(0, 1_000_000),
    reasoningTokens: integer(0, 1_000_000),
  })
  .superRefine((usage, ctx) => {
    if (
      usage.cachedInputTokens > usage.inputTokens ||
      usage.cacheWriteTokens > usage.inputTokens ||
      usage.reasoningTokens > usage.outputTokens
    )
      ctx.addIssue({ code: "custom", message: "Provider usage is inconsistent." });
  });
export type AIUsage = z.infer<typeof aiUsageSchema>;
export function aiUsageCostNano(price: AIModelPricing, raw: unknown): bigint {
  const usage = aiUsageSchema.parse(raw);
  // Reasoning is part of billed output, never charged twice. Cache-write exposure is additional conservatively.
  return (
    BigInt(usage.inputTokens - usage.cachedInputTokens) * BigInt(price.inputNanoPerToken) +
    BigInt(usage.cachedInputTokens) * BigInt(price.cachedInputNanoPerToken) +
    BigInt(usage.cacheWriteTokens) * BigInt(price.cacheWriteNanoPerToken) +
    BigInt(usage.outputTokens) * BigInt(price.outputNanoPerToken)
  );
}
export function aiMaximumExposureNano(price: AIModelPricing, inputTokens: number, outputTokens: number) {
  return (
    BigInt(inputTokens) * BigInt(price.inputNanoPerToken + price.cacheWriteNanoPerToken) +
    BigInt(outputTokens) * BigInt(price.outputNanoPerToken)
  );
}
export function chooseAIModel(
  global: AIGlobalPolicy,
  effective: ReturnType<typeof effectiveAIUserPolicy>,
  mode: "STANDARD" | "ADVANCED",
) {
  if (!global.enabled)
    throw new SpatialAssistantError(
      "AI_DISABLED",
      "Spatial Assistant is disabled. You can continue editing manually.",
      503,
    );
  if (effective.suspended)
    throw new SpatialAssistantError(
      "AI_SUSPENDED",
      "Spatial Assistant access is paused for your account. Manual editing remains available.",
      403,
    );
  if (mode === "ADVANCED" && !effective.advancedEnabled)
    throw new SpatialAssistantError(
      "ADVANCED_UNAVAILABLE",
      "Advanced assistance is unavailable for this account.",
      403,
    );
  const model = mode === "ADVANCED" ? global.advancedModel : global.standardModel;
  if (!global.allowedModels.includes(model))
    throw new SpatialAssistantError("MODEL_UNAVAILABLE", "The configured assistance model is unavailable.", 503);
  return model;
}
