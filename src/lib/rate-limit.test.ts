import { describe, expect, it } from "vitest";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

describe("interactive endpoint rate limiter", () => {
  it("allows the configured burst and then returns retry metadata", () => {
    const key = `test-rate-${Math.random()}`;
    expect(consumeRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    expect(consumeRateLimit(key, { limit: 2, windowMs: 60_000 }).allowed).toBe(true);
    const rejected = consumeRateLimit(key, { limit: 2, windowMs: 60_000 });
    expect(rejected.allowed).toBe(false);
    expect(rejected.remaining).toBe(0);
    expect(Number(rateLimitHeaders(rejected)["Retry-After"])).toBeGreaterThan(0);
  });

  it("isolates independent route and actor keys", () => {
    const left = consumeRateLimit(`left-${Math.random()}`, { limit: 1, windowMs: 60_000 });
    const right = consumeRateLimit(`right-${Math.random()}`, { limit: 1, windowMs: 60_000 });
    expect(left.allowed).toBe(true);
    expect(right.allowed).toBe(true);
  });
});
