import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ register: vi.fn(), setCookie: vi.fn() }));
vi.mock("@/wayfarer/accounts", () => ({
  AccountError: class AccountError extends Error {
    constructor(
      message: string,
      readonly code: "INVALID" | "CONFLICT" | "UNAVAILABLE" = "INVALID",
      readonly kind?: string,
      readonly field?: string,
    ) {
      super(message);
    }
  },
  maskEmailAddress: () => "m••••@example.test",
  registerAccount: mocks.register,
}));
vi.mock("@/wayfarer/http", () => ({ setWayfarerCookie: mocks.setCookie }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, limit: 5, remaining: 4, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
}));

import { AccountError } from "@/wayfarer/accounts";
import { POST } from "./route";

const body = {
  displayName: "Mara Tide",
  email: "mara@example.test",
  password: "lantern-harbor-42-compass",
  confirmPassword: "lantern-harbor-42-compass",
};

describe("atomic registration API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.register.mockResolvedValue({
      account: { profile: { id: "profile-1", displayName: "Mara Tide" } },
      session: { token: "verification-token", csrfToken: "verification-csrf" },
      deliveryState: "SUBMITTED",
    });
  });

  it("reports a committed account separately from post-commit delivery failure", async () => {
    mocks.register.mockResolvedValueOnce({
      account: { profile: { id: "profile-1", displayName: "Mara Tide" } },
      session: { token: "verification-token", csrfToken: "verification-csrf" },
      deliveryState: "FAILED",
    });
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, returnTo: "/player/library" }),
      }),
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      registrationState: "ACCOUNT_CREATED_DELIVERY_FAILED",
      message: "Your account was created, but we could not send the verification email.",
      next: "/verify-email?returnTo=%2Fplayer%2Flibrary&delivery=failed",
    });
    expect(mocks.setCookie).toHaveBeenCalledWith("verification-token");
  });

  it("returns transparent existing-email handoff details", async () => {
    mocks.register.mockRejectedValueOnce(
      new AccountError(
        "An account already uses this email address. Sign in instead.",
        "CONFLICT",
        "EMAIL_CONFLICT",
        "email",
      ),
    );
    const response = await POST(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "An account already uses this email address. Sign in instead.",
      conflict: "EMAIL_CONFLICT",
      field: "email",
      handoff: { destination: "/sign-in", email: "mara@example.test", forgotPassword: "/forgot-password" },
    });
  });
});
