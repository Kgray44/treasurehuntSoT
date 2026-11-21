// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  defaultAIGlobalPolicy,
  effectiveAIUserPolicy,
  aiUTCPeriod,
  aiPricing,
  aiUsageCostNano,
  aiMaximumExposureNano,
  chooseAIModel,
  aiGlobalPolicySchema,
  type AIUserPolicy,
} from "./ai-policy";
const override: AIUserPolicy = {
  monthlyRequests: 900,
  monthlySpendNano: 20_000_000_000,
  advancedEnabled: true,
  requestsPerMinute: 80,
  suspended: false,
  expiresAt: null,
};
describe("AI policy and versioned integer pricing", () => {
  it("rejects duplicate effective instants even when their UTC text formats differ", () => {
    expect(
      aiGlobalPolicySchema.safeParse({
        ...defaultAIGlobalPolicy,
        pricingVersions: [
          { ...aiPricing["gpt-6-luna"], revision: "equivalent-one", effectiveAt: "2026-11-01T00:00:00Z" },
          { ...aiPricing["gpt-6-luna"], revision: "equivalent-two", effectiveAt: "2026-11-01T00:00:00.000Z" },
        ],
      }).success,
    ).toBe(false);
  });
  it("routes photo reconstruction independently of text mode and permits bounded per-user model exceptions", () => {
    const global = { ...defaultAIGlobalPolicy, enabled: true };
    const inherited = effectiveAIUserPolicy(global, null);
    expect(chooseAIModel(global, inherited, "STANDARD")).toBe("gpt-6-luna");
    expect(chooseAIModel(global, inherited, "STANDARD", "ROOM_RECONSTRUCTION")).toBe("gpt-6.1-sol");
    const user = { ...override, standardModel: "gpt-6.1-sol" as const, roomModel: "gpt-6-luna" as const };
    const effective = effectiveAIUserPolicy(global, user);
    expect(chooseAIModel(global, effective, "STANDARD")).toBe("gpt-6.1-sol");
    expect(chooseAIModel(global, effective, "STANDARD", "ROOM_RECONSTRUCTION")).toBe("gpt-6-luna");
    expect(() => chooseAIModel({ ...global, allowedModels: ["gpt-6-luna"] }, effective, "STANDARD")).toThrow(
      /unavailable/,
    );
    const expired = effectiveAIUserPolicy(
      global,
      { ...user, expiresAt: "2026-10-01T00:00:00Z" },
      new Date("2026-10-14"),
    );
    expect(chooseAIModel(global, expired, "STANDARD", "ROOM_RECONSTRUCTION")).toBe("gpt-6.1-sol");
  });
  it("inherits defaults and retains global ceilings", () => {
    expect(effectiveAIUserPolicy(defaultAIGlobalPolicy, null).monthlyRequests).toBe(500);
    const policy = effectiveAIUserPolicy(defaultAIGlobalPolicy, override);
    expect(policy.monthlySpendNano).toBe(10_000_000_000);
    expect(policy.requestsPerMinute).toBe(10);
    expect(policy.advancedEnabled).toBe(false);
  });
  it("expires exceptions without deleting historical policy", () => {
    expect(
      effectiveAIUserPolicy(
        defaultAIGlobalPolicy,
        { ...override, expiresAt: "2026-10-01T00:00:00Z" },
        new Date("2026-10-11T00:00:00Z"),
      ).source,
    ).toBe("INHERITED");
  });
  it("uses exact UTC calendar months across year and leap-year rollover", () => {
    expect(aiUTCPeriod(new Date("2026-12-31T23:59:59.999Z")).reset.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(aiUTCPeriod(new Date("2028-02-29T23:59:59.999Z")).id).toBe("2028-02");
    expect(aiUTCPeriod(new Date("2026-11-01T00:00:00Z")).id).toBe("2026-11");
  });
  it("prices cached input, cache writes and reasoning without floating-point money", () => {
    expect(
      aiUsageCostNano(aiPricing["gpt-6-luna"], {
        inputTokens: 1000,
        cachedInputTokens: 200,
        cacheWriteTokens: 100,
        outputTokens: 500,
        reasoningTokens: 300,
      }),
    ).toBe(BigInt(334500));
    expect(aiMaximumExposureNano(aiPricing["gpt-6.1-sol"], 8000, 4000)).toBe(BigInt(60000000));
  });
  it("preserves historical pricing snapshots while new writes receive only the cache-write rate", () => {
    const legacy = { ...aiPricing["gpt-6-luna"] };
    delete legacy.inputAccounting;
    const usage = {
      inputTokens: 1000,
      cachedInputTokens: 0,
      cacheWriteTokens: 1000,
      outputTokens: 0,
      reasoningTokens: 0,
    };
    expect(aiUsageCostNano(legacy, usage)).toBe(BigInt(225000));
    expect(aiUsageCostNano(aiPricing["gpt-6-luna"], usage)).toBe(BigInt(125000));
    expect(aiMaximumExposureNano(legacy, 1000, 0)).toBe(BigInt(225000));
    expect(aiMaximumExposureNano(aiPricing["gpt-6-luna"], 1000, 0)).toBe(BigInt(125000));
    expect(() => aiUsageCostNano(aiPricing["gpt-6-luna"], { ...usage, cachedInputTokens: 1 })).toThrow();
  });
  it("rejects inconsistent usage", () => {
    expect(() =>
      aiUsageCostNano(aiPricing["gpt-6-luna"], {
        inputTokens: 100,
        cachedInputTokens: 101,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      }),
    ).toThrow();
  });
  it("requires explicit policy and advanced eligibility", () => {
    expect(() =>
      chooseAIModel(defaultAIGlobalPolicy, effectiveAIUserPolicy(defaultAIGlobalPolicy, null), "STANDARD"),
    ).toThrow(/disabled/);
    const global = { ...defaultAIGlobalPolicy, enabled: true, advancedEnabled: true };
    expect(() => chooseAIModel(global, effectiveAIUserPolicy(global, null), "ADVANCED")).toThrow(/unavailable/);
    expect(chooseAIModel(global, effectiveAIUserPolicy(global, override), "ADVANCED")).toBe("gpt-6.1-sol");
    expect(chooseAIModel(global, effectiveAIUserPolicy(global, override), "STANDARD")).toBe("gpt-6-luna");
  });
  it("rejects the owner-rejected Astra model at policy admission", () => {
    expect(defaultAIGlobalPolicy.allowedModels).not.toContain("gpt-6-astra");
    expect(
      aiGlobalPolicySchema.safeParse({
        ...defaultAIGlobalPolicy,
        enabled: true,
        advancedEnabled: true,
        advancedModel: "gpt-6-astra",
        allowedModels: [...defaultAIGlobalPolicy.allowedModels, "gpt-6-astra"],
      }).success,
    ).toBe(false);
  });
  it("range-checks administrator policy and rejects allowlist bypass", () => {
    expect(aiGlobalPolicySchema.safeParse(defaultAIGlobalPolicy).success).toBe(true);
    expect(
      aiGlobalPolicySchema.safeParse({ ...defaultAIGlobalPolicy, allowedModels: ["arbitrary-model"] }).success,
    ).toBe(false);
    expect(aiGlobalPolicySchema.safeParse({ ...defaultAIGlobalPolicy, monthlySpendNano: -1 }).success).toBe(false);
    expect(
      aiGlobalPolicySchema.safeParse({ ...defaultAIGlobalPolicy, userConcurrency: 3, globalConcurrency: 1 }).success,
    ).toBe(false);
  });
});
