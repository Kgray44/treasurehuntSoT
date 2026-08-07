import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), setCookie: vi.fn() }));
vi.mock("@/wayfarer/accounts", () => ({ authenticateAccount: mocks.authenticate }));
vi.mock("@/wayfarer/http", () => ({ setWayfarerRoleCookie: mocks.setCookie }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, limit: 6, remaining: 5, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
}));

import { POST } from "./route";

describe("ordinary sign-in API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticate.mockResolvedValue({
      account: {
        status: "PENDING_VERIFICATION",
        profile: { id: "profile-1", displayName: "Mara Tide" },
        roles: [{ role: "PLAYER" }],
      },
      session: { token: "ordinary-token", csrfToken: "ordinary-csrf" },
    });
  });

  it("homeport.owner-correction.round3.patch-a never converts returning sign-in into a code gate", async () => {
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "Patch A browser" },
        body: JSON.stringify({
          login: "mara@example.test",
          password: "lantern-harbor-42-compass",
          returnTo: "/player/library",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      verificationRequired: false,
      emailVerification: "UNVERIFIED",
      next: "/player/library",
      csrfToken: "ordinary-csrf",
    });
    expect(mocks.setCookie).toHaveBeenCalledWith("ordinary-token", ["PLAYER"]);
  });

  it.each([
    ["unknown legacy Player name", "missing-player", "lantern-harbor-42-compass"],
    ["unknown email", "missing@example.test", "lantern-harbor-42-compass"],
    ["wrong password", "mara@example.test", "incorrect-password"],
  ])("returns the same non-enumerating response for %s", async (_scenario, login, password) => {
    mocks.authenticate.mockResolvedValueOnce(null);
    const response = await POST(
      new Request("http://localhost/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, password }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Those credentials were not accepted." });
    expect(mocks.setCookie).not.toHaveBeenCalled();
  });
});
