import { z } from "zod";
import { SpatialAssistantError } from "./spatial-assistant";
import { aiCapabilities, classifyAICapability, type AICapabilityId } from "./ai-capabilities";

export const aiModelIds = ["gpt-6-luna", "gpt-6.1-sol"] as const;
export type AIModelId = (typeof aiModelIds)[number];
const integer = (min: number, max: number) => z.number().int().min(min).max(max);
// USD nanodollars; $1 = 1,000,000,000 units. Public JSON uses safe integers.
export const USD_NANO = 1_000_000_000;
// Safe Creator projection shared by the server and canonical Studio adapter.
export const creatorAIUsageSchema = z.object({
  enabled: z.boolean(),
  advancedEnabled: z.boolean(),
  roomModel: z.enum(aiModelIds).optional(),
  allowance: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetAt: z.iso.datetime(),
  source: z.enum(["INHERITED", "OVERRIDE"]),
  nearingLimit: z.boolean(),
});
const money = integer(0, 1_000_000 * USD_NANO);
export const aiCapabilityPolicySchema = z.strictObject({
  enabled: z.boolean().optional(),
  monthlyRequests: integer(0, 1_000_000).nullable().optional(),
  monthlySpendNano: money.nullable().optional(),
  allowedModels: z.array(z.enum(aiModelIds)).min(1).max(aiModelIds.length).optional(),
});
const capabilityPolicies = z.record(z.string(), aiCapabilityPolicySchema).superRefine((policies, ctx) => {
  for (const id of Object.keys(policies))
    if (!aiCapabilities.some((capability) => capability.id === id))
      ctx.addIssue({ code: "custom", message: `Unknown capability: ${id}` });
});
export const aiPricingVersionSchema = z.strictObject({
  revision: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  model: z.enum(aiModelIds),
  effectiveAt: z.iso.datetime(),
  serviceTier: z.literal("default"),
  inputAccounting: z.literal("DISJOINT_CACHE_CATEGORIES"),
  inputNanoPerToken: integer(0, 1_000_000_000),
  cachedInputNanoPerToken: integer(0, 1_000_000_000),
  cacheWriteNanoPerToken: integer(0, 1_000_000_000),
  outputNanoPerToken: integer(0, 1_000_000_000),
  source: z.url().max(500),
});
export const aiGlobalPolicySchema = z
  .strictObject({
    capabilityPolicies: capabilityPolicies.optional(),
    pricingVersions: z.array(aiPricingVersionSchema).max(100).optional(),
    enabled: z.boolean(),
    provider: z.literal("OPENAI"),
    standardModel: z.enum(aiModelIds),
    advancedModel: z.enum(aiModelIds),
    roomModel: z.enum(aiModelIds).optional(),
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
    timeoutMs: integer(1000, 180000),
    maximumRequestSpendNano: money,
    retentionDays: integer(1, 90),
    allowedModels: z.array(z.enum(aiModelIds)).min(1).max(2),
  })
  .superRefine((policy, ctx) => {
    const revisions = new Set<string>();
    const dates = new Set<string>();
    for (const price of policy.pricingVersions ?? []) {
      const key = `${price.model}:${price.revision}`;
      if (revisions.has(key)) ctx.addIssue({ code: "custom", message: "Pricing revisions must be unique per model." });
      revisions.add(key);
      const dateKey = `${price.model}:${price.effectiveAt}`;
      if (dates.has(dateKey))
        ctx.addIssue({ code: "custom", message: "A model can have only one pricing revision per effective instant." });
      dates.add(dateKey);
      const builtIn = aiPricing[price.model];
      if (Date.parse(price.effectiveAt) === Date.parse(builtIn.effectiveAt) && price.revision !== builtIn.revision)
        ctx.addIssue({ code: "custom", message: "A new pricing revision needs a distinct effective instant." });
      if (
        price.revision === builtIn.revision &&
        Object.entries(builtIn).some(([field, value]) => price[field as keyof typeof price] !== value)
      )
        ctx.addIssue({ code: "custom", message: "Built-in pricing revisions are immutable. Add a new revision." });
    }
    for (const rule of Object.values(policy.capabilityPolicies ?? {}))
      if (rule.allowedModels?.some((model) => !policy.allowedModels.includes(model)))
        ctx.addIssue({ code: "custom", message: "Capability models must be allowed globally." });
    if (
      !policy.allowedModels.includes(policy.standardModel) ||
      (policy.roomModel !== undefined && !policy.allowedModels.includes(policy.roomModel)) ||
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
  roomModel: "gpt-6.1-sol",
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
  capabilityPolicies: capabilityPolicies.optional(),
  standardModel: z.enum(aiModelIds).nullable().optional(),
  advancedModel: z.enum(aiModelIds).nullable().optional(),
  roomModel: z.enum(aiModelIds).nullable().optional(),
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
    standardModel: active?.standardModel ?? global.standardModel,
    advancedModel: active?.advancedModel ?? global.advancedModel,
    roomModel: active?.roomModel ?? global.roomModel ?? "gpt-6.1-sol",
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
    capabilities: Object.fromEntries(
      aiCapabilities.map((capability) => {
        const platform = global.capabilityPolicies?.[capability.id];
        const personal = active?.capabilityPolicies?.[capability.id];
        return [
          capability.id,
          {
            enabled:
              global.enabled &&
              !active?.suspended &&
              platform?.enabled !== false &&
              personal?.enabled !== false &&
              (capability.id !== "ADVANCED_ASSISTANT" || Boolean(global.advancedEnabled && active?.advancedEnabled)),
            monthlyRequests: Math.min(
              personal?.monthlyRequests ??
                platform?.monthlyRequests ??
                active?.monthlyRequests ??
                global.defaultUserRequests,
              active?.monthlyRequests ?? global.defaultUserRequests,
              global.monthlyRequests,
            ),
            monthlySpendNano: Math.min(
              personal?.monthlySpendNano ??
                platform?.monthlySpendNano ??
                active?.monthlySpendNano ??
                global.defaultUserSpendNano ??
                global.monthlySpendNano,
              active?.monthlySpendNano ?? global.defaultUserSpendNano ?? global.monthlySpendNano,
              global.monthlySpendNano,
            ),
            allowedModels: (personal?.allowedModels ?? platform?.allowedModels ?? global.allowedModels).filter(
              (model) =>
                global.allowedModels.includes(model) &&
                (!platform?.allowedModels || platform.allowedModels.includes(model)),
            ),
            source: personal
              ? "PERSON_OVERRIDE"
              : platform
                ? "PLATFORM_CAPABILITY"
                : active
                  ? "ACCOUNT_OVERRIDE"
                  : "INHERITED",
            accessOrigin: !global.enabled
              ? "PLATFORM_DISABLED"
              : active?.suspended
                ? "ACCOUNT_SUSPENDED"
                : platform?.enabled === false
                  ? "PLATFORM_CAPABILITY_DISABLED"
                  : personal?.enabled !== undefined
                    ? "PERSON_CAPABILITY_OVERRIDE"
                    : capability.id === "ADVANCED_ASSISTANT"
                      ? "PLATFORM_AND_PERSON_ADVANCED_GRANT"
                      : "PLATFORM_DEFAULT",
            allowanceOrigin:
              personal?.monthlyRequests != null
                ? "PERSON_CAPABILITY_OVERRIDE"
                : platform?.monthlyRequests != null
                  ? "PLATFORM_CAPABILITY_DEFAULT"
                  : active?.monthlyRequests != null
                    ? "ACCOUNT_OVERRIDE"
                    : "PLATFORM_DEFAULT",
            spendingOrigin:
              personal?.monthlySpendNano != null
                ? "PERSON_CAPABILITY_OVERRIDE"
                : platform?.monthlySpendNano != null
                  ? "PLATFORM_CAPABILITY_DEFAULT"
                  : active?.monthlySpendNano != null
                    ? "ACCOUNT_OVERRIDE"
                    : "PLATFORM_DEFAULT",
          },
        ];
      }),
    ) as Record<
      AICapabilityId,
      {
        enabled: boolean;
        monthlyRequests: number;
        monthlySpendNano: number;
        allowedModels: AIModelId[];
        source: string;
        accessOrigin: string;
        allowanceOrigin: string;
        spendingOrigin: string;
      }
    >,
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
  // Absent on historical reservations; preserve their original settlement/replay arithmetic.
  inputAccounting?: "DISJOINT_CACHE_CATEGORIES";
  inputNanoPerToken: number;
  cachedInputNanoPerToken: number;
  cacheWriteNanoPerToken: number;
  outputNanoPerToken: number;
  source: string;
};
/** Admission snapshots the selected effective version; settlement never consults current prices. */
export function effectiveAIPricing(policy: AIGlobalPolicy, model: AIModelId, now: Date): AIModelPricing {
  const versions = [aiPricing[model], ...(policy.pricingVersions ?? [])].filter(
    (price) => price.model === model && Date.parse(price.effectiveAt) <= now.getTime(),
  );
  versions.sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt));
  return versions[0] ?? aiPricing[model];
}
export const aiPricing: Readonly<Record<AIModelId, AIModelPricing>> = Object.freeze({
  "gpt-6-luna": {
    revision: "openai-standard-text-2026-10-13-v2",
    model: "gpt-6-luna",
    effectiveAt: "2026-10-13T00:00:00.000Z",
    serviceTier: "default",
    inputAccounting: "DISJOINT_CACHE_CATEGORIES",
    inputNanoPerToken: 100,
    cachedInputNanoPerToken: 10,
    cacheWriteNanoPerToken: 125,
    outputNanoPerToken: 500,
    source: "https://developers.openai.com/api/docs/pricing",
  },
  "gpt-6.1-sol": {
    revision: "openai-standard-text-2026-10-13-v2",
    model: "gpt-6.1-sol",
    effectiveAt: "2026-10-13T00:00:00.000Z",
    serviceTier: "default",
    inputAccounting: "DISJOINT_CACHE_CATEGORIES",
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
      usage.cachedInputTokens + usage.cacheWriteTokens > usage.inputTokens ||
      usage.reasoningTokens > usage.outputTokens
    )
      ctx.addIssue({ code: "custom", message: "Provider usage is inconsistent." });
  });
export type AIUsage = z.infer<typeof aiUsageSchema>;
export const aiReportedUsageSchema = z.strictObject({
  inputTokens: integer(0, 1_000_000),
  outputTokens: integer(0, 1_000_000),
  cachedInputTokens: integer(0, 1_000_000).nullable(),
  cacheWriteTokens: integer(0, 1_000_000).nullable(),
  reasoningTokens: integer(0, 1_000_000).nullable(),
  imageInputTokens: integer(0, 1_000_000).nullable().optional(),
  audioInputTokens: integer(0, 1_000_000).nullable().optional(),
});
export type AIReportedUsage = z.infer<typeof aiReportedUsageSchema>;
export function aiReportedCost(price: AIModelPricing, usage: AIUsage, raw?: AIReportedUsage) {
  if (!raw) return { costNano: aiUsageCostNano(price, usage), basis: "CALCULATED" };
  const reported = aiReportedUsageSchema.parse(raw);
  if (reported.inputTokens !== usage.inputTokens || reported.outputTokens !== usage.outputTokens)
    throw new Error("Provider usage dimensions disagree.");
  const missing = reported.cachedInputTokens === null || reported.cacheWriteTokens === null;
  if (!missing) return { costNano: aiUsageCostNano(price, usage), basis: "CALCULATED" };
  const cached = reported.cachedInputTokens ?? 0,
    written = reported.cacheWriteTokens ?? 0;
  if (cached + written > reported.inputTokens) throw new Error("Provider cache dimensions disagree.");
  const maximumRate = Math.max(
    price.inputNanoPerToken,
    reported.cachedInputTokens === null ? price.cachedInputNanoPerToken : 0,
    reported.cacheWriteTokens === null ? price.cacheWriteNanoPerToken : 0,
  );
  return {
    basis: "ESTIMATED",
    costNano:
      BigInt(cached) * BigInt(price.cachedInputNanoPerToken) +
      BigInt(written) * BigInt(price.cacheWriteNanoPerToken) +
      BigInt(reported.inputTokens - cached - written) * BigInt(maximumRate) +
      BigInt(reported.outputTokens) * BigInt(price.outputNanoPerToken),
  };
}
export function aiUsageCostNano(price: AIModelPricing, raw: unknown): bigint {
  const usage = aiUsageSchema.parse(raw);
  // Reasoning is included in output. Cache-written input uses its own rate, not an additional input charge.
  const ordinaryInput =
    usage.inputTokens -
    usage.cachedInputTokens -
    (price.inputAccounting === "DISJOINT_CACHE_CATEGORIES" ? usage.cacheWriteTokens : 0);
  return (
    BigInt(ordinaryInput) * BigInt(price.inputNanoPerToken) +
    BigInt(usage.cachedInputTokens) * BigInt(price.cachedInputNanoPerToken) +
    BigInt(usage.cacheWriteTokens) * BigInt(price.cacheWriteNanoPerToken) +
    BigInt(usage.outputTokens) * BigInt(price.outputNanoPerToken)
  );
}
export function aiMaximumExposureNano(price: AIModelPricing, inputTokens: number, outputTokens: number) {
  const maximumInputRate =
    price.inputAccounting === "DISJOINT_CACHE_CATEGORIES"
      ? Math.max(price.inputNanoPerToken, price.cacheWriteNanoPerToken, price.cachedInputNanoPerToken)
      : price.inputNanoPerToken + price.cacheWriteNanoPerToken;
  return BigInt(inputTokens) * BigInt(maximumInputRate) + BigInt(outputTokens) * BigInt(price.outputNanoPerToken);
}
export function chooseAIModel(
  global: AIGlobalPolicy,
  effective: ReturnType<typeof effectiveAIUserPolicy>,
  mode: "STANDARD" | "ADVANCED",
  operationCategory?: string,
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
  if (operationCategory !== "ROOM_RECONSTRUCTION" && mode === "ADVANCED" && !effective.advancedEnabled)
    throw new SpatialAssistantError(
      "ADVANCED_UNAVAILABLE",
      "Advanced assistance is unavailable for this account.",
      403,
    );
  const model =
    operationCategory === "ROOM_RECONSTRUCTION"
      ? effective.roomModel
      : mode === "ADVANCED"
        ? effective.advancedModel
        : effective.standardModel;
  const capability = effective.capabilities[classifyAICapability(operationCategory ?? "AUTHORING", mode)];
  if (!capability.enabled)
    throw new SpatialAssistantError("CAPABILITY_DENIED", "This AI capability is unavailable for this account.", 403);
  if (!global.allowedModels.includes(model) || !capability.allowedModels.includes(model))
    throw new SpatialAssistantError("MODEL_UNAVAILABLE", "The configured assistance model is unavailable.", 503);
  return model;
}
