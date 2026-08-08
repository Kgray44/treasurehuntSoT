import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  createCode: vi.fn(() => "synthetic-code"),
}));

vi.mock("@/wayfarer/oauth", () => ({
  beginOAuthAuthorization: mocks.begin,
  createSyntheticOAuthCode: mocks.createCode,
  isOAuthProvider: (provider: string) => ["GOOGLE", "GITHUB"].includes(provider.toUpperCase()),
  oauthTestMode: () => true,
}));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 }),
  rateLimitHeaders: () => ({}),
}));
vi.mock("@/lib/security", () => ({ hashToken: (value: string) => `hashed:${value}` }));

import { GET as simulate } from "../simulate/route";
import { GET as start } from "./route";

const publicOrigin = "https://staging.absoluterelativesystems.com";
const providers = ["google", "github"] as const;

function hostileRequest(provider: (typeof providers)[number], route: "start" | "simulate", query = "") {
  return new Request(`http://0.0.0.0:3000/api/auth/providers/${provider}/${route}${query}`, {
    headers: { host: "oauth-container:3000", "x-forwarded-host": "attacker.example" },
  });
}

describe("OAuth start and simulator public redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", publicOrigin);
  });

  it.each(providers)("uses the staging origin for %s provider-unavailable fallback", async (provider) => {
    mocks.begin.mockRejectedValue(new Error("Provider unavailable"));
    const response = await start(hostileRequest(provider, "start"), { params: Promise.resolve({ provider }) });
    expect(response.headers.get("location")).toBe(
      `${publicOrigin}/sign-in?reason=oauth-unavailable&provider=${provider}`,
    );
  });

  it("keeps an external provider authorization URL exact", async () => {
    const authorizationUrl =
      "https://github.com/login/oauth/authorize?client_id=client&redirect_uri=https%3A%2F%2Fstaging.absoluterelativesystems.com%2Fapi%2Fauth%2Fproviders%2Fgithub%2Fcallback";
    mocks.begin.mockResolvedValue({ authorizationUrl });
    const response = await start(hostileRequest("github", "start", "?returnTo=/passport"), {
      params: Promise.resolve({ provider: "github" }),
    });
    expect(response.headers.get("location")).toBe(authorizationUrl);
    expect(mocks.begin).toHaveBeenCalledWith(expect.objectContaining({ redirectPath: "/passport" }));
  });

  it.each(providers)("uses the staging origin for the %s synthetic callback", async (provider) => {
    const response = await simulate(hostileRequest(provider, "simulate", "?state=state-1&nonce=nonce-1"), {
      params: Promise.resolve({ provider }),
    });
    expect(response.headers.get("location")).toBe(
      `${publicOrigin}/api/auth/providers/${provider}/callback?state=state-1&code=synthetic-code`,
    );
  });

  it("fails closed rather than using Host or forwarded Host when the public origin is missing", async () => {
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const response = await start(hostileRequest("google", "start"), {
      params: Promise.resolve({ provider: "google" }),
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.begin).not.toHaveBeenCalled();
  });
});
