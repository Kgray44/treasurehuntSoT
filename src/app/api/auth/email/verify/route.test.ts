import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  verify: vi.fn(),
  createSession: vi.fn(),
  revoke: vi.fn(),
  cookie: vi.fn(),
}));

vi.mock("@/wayfarer/http", () => ({
  requireWayfarerVerification: mocks.session,
  setWayfarerCookie: mocks.cookie,
}));
vi.mock("@/wayfarer/accounts", () => ({
  AccountError: class AccountError extends Error {
    code = "INVALID";
  },
  verifyAccountEmail: mocks.verify,
  createAccountSession: mocks.createSession,
  revokeAccountSession: mocks.revoke,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, limit: 8, remaining: 7, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
}));

import { POST } from "./route";

describe("verification-code API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session.mockResolvedValue({ id: "verification-session", accountId: "account-1" });
    mocks.verify.mockResolvedValue(undefined);
    mocks.createSession.mockResolvedValue({ token: "ordinary-token", csrfToken: "ordinary-csrf" });
    mocks.revoke.mockResolvedValue(undefined);
  });

  it("rejects malformed code input before account activation", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/email/verify", {
        method: "POST",
        body: JSON.stringify({ code: "12x" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("activates through the scoped challenge, rotates into one ordinary session, and revokes verification context", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/email/verify", {
        method: "POST",
        headers: { "user-agent": "Round 3 browser" },
        body: JSON.stringify({ code: "123456", returnTo: "/workspaces" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("account-1", "123456");
    expect(mocks.createSession).toHaveBeenCalledWith("account-1", "Round 3 browser", "ORDINARY");
    expect(mocks.revoke).toHaveBeenCalledWith("account-1", "verification-session");
    expect(mocks.cookie).toHaveBeenCalledWith("ordinary-token");
    await expect(response.json()).resolves.toMatchObject({
      codeState: "EMAIL_VERIFIED",
      csrfToken: "ordinary-csrf",
      next: "/workspaces",
    });
  });
});
