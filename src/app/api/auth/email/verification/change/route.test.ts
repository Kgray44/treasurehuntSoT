import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), change: vi.fn() }));
vi.mock("@/wayfarer/http", () => ({ requireWayfarerVerification: mocks.session }));
vi.mock("@/wayfarer/accounts", () => ({
  AccountError: class AccountError extends Error {
    code = "INVALID";
  },
  changePendingVerificationEmail: mocks.change,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, limit: 4, remaining: 3, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
}));

import { POST } from "./route";

describe("pending registration email-change API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ accountId: "account-1" });
    mocks.change.mockResolvedValue({ maskedEmail: "n••••@example.test" });
  });

  it("requires bounded verification context", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/auth/email/verification/change", {
        method: "POST",
        body: JSON.stringify({ email: "next@example.test" }),
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.change).not.toHaveBeenCalled();
  });

  it("changes only the pending account email and reports that prior codes were replaced", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/email/verification/change", {
        method: "POST",
        body: JSON.stringify({ email: " Next@Example.test " }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.change).toHaveBeenCalledWith("account-1", "Next@Example.test");
    await expect(response.json()).resolves.toMatchObject({ codeState: "CODE_REPLACED", cooldownSeconds: 60 });
  });
});
