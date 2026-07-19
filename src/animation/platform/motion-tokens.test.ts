import { describe, expect, it } from "vitest";
import { resolveMotionPolicy } from "../core/quality";
import { platformMotionTokens, resolvePlatformMotionToken } from "./motion-tokens";

describe("platform motion tokens", () => {
  it.each([
    ["M1 full", "full", false, "full"],
    ["M2 gentle", "gentle", false, "gentle"],
    ["M3 product reduced", "reduced", false, "reduced"],
    ["M4 browser reduced", "full", true, "reduced"],
    ["M5 both reduced", "reduced", true, "reduced"],
  ] as const)("resolves %s through the shared policy", (_label, product, browserReduced, expected) => {
    const policy = resolveMotionPolicy(product, browserReduced);
    const token = resolvePlatformMotionToken("route", policy.level);
    expect(policy.level).toBe(expected);
    expect(token.durationMs).toBe(platformMotionTokens.route.durationMs[expected]);
    expect(token.distancePx).toBe(platformMotionTokens.route.distancePx[expected]);
  });

  it("removes travel and continuous duration from every reduced token", () => {
    for (const tier of Object.keys(platformMotionTokens) as Array<keyof typeof platformMotionTokens>) {
      const token = resolvePlatformMotionToken(tier, "reduced");
      expect(token.distancePx).toBe(0);
      expect(token.scaleDelta).toBe(0);
      if (tier === "ambient" || tier === "layout" || tier === "route" || tier === "ceremony") {
        expect(token.durationMs).toBe(0);
      }
    }
  });

  it("keeps tier limits inside the frozen Phase 4 budgets", () => {
    expect(platformMotionTokens.micro.durationMs.full).toBeLessThanOrEqual(260);
    expect(platformMotionTokens.state.durationMs.full).toBeLessThanOrEqual(420);
    expect(platformMotionTokens.layout.durationMs.full).toBeLessThanOrEqual(520);
    expect(platformMotionTokens.route.durationMs.full).toBeLessThanOrEqual(520);
    expect(platformMotionTokens.ceremony.durationMs.full).toBeLessThanOrEqual(1400);
    expect(platformMotionTokens.route.distancePx.full).toBeLessThanOrEqual(22);
  });
});

