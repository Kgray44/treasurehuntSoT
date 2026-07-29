import { describe, expect, it } from "vitest";
import { communityRateLimitKeyHash, LocalCommunityRateLimiter } from "./rate-limit";

describe("Community rate limiting", () => {
  it("hashes all privacy-sensitive dimensions without preserving raw input", () => {
    const hash = communityRateLimitKeyHash({
      scope: "report",
      accountId: "account@example.test",
      network: "203.0.113.1",
      subject: "listing-a",
      action: "submit",
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("203.0.113.1");
    expect(hash).not.toContain("account@example.test");
  });

  it("enforces a window, returns retry-after, and rolls over deterministically", () => {
    let now = new Date("2026-07-29T12:00:00.000Z");
    const limiter = new LocalCommunityRateLimiter(() => now);
    const key = { scope: "report", accountId: "account-a", subject: "listing-a", action: "submit" };
    expect(limiter.consume(key, 2, 10_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.consume(key, 2, 10_000)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.consume(key, 2, 10_000)).toMatchObject({ allowed: false, retryAfterSeconds: 10 });
    now = new Date("2026-07-29T12:00:10.000Z");
    expect(limiter.consume(key, 2, 10_000)).toMatchObject({ allowed: true, remaining: 1 });
  });
});
