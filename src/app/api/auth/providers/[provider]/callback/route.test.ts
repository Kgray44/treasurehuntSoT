import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class MockOAuthError extends Error {
    constructor(
      message: string,
      readonly code:
        | "ACCOUNT_RESTRICTED"
        | "CANCELLED"
        | "EMAIL_COLLISION"
        | "EMAIL_REQUIRED"
        | "IDENTITY_CONFLICT"
        | "INVALID_CALLBACK"
        | "PROVIDER_UNAVAILABLE"
        | "STATE_INVALID",
    ) {
      super(message);
    }
  }
  return {
    cancel: vi.fn(),
    complete: vi.fn(),
    session: vi.fn(),
    setCookie: vi.fn(),
    OAuthError: MockOAuthError,
  };
});

vi.mock("@/wayfarer/oauth", () => ({
  cancelOAuthAuthorization: mocks.cancel,
  completeOAuthAuthorization: mocks.complete,
  isOAuthProvider: (provider: string) => ["GOOGLE", "GITHUB"].includes(provider.toUpperCase()),
  OAuthError: mocks.OAuthError,
}));
vi.mock("@/wayfarer/http", () => ({
  requireWayfarerAccount: mocks.session,
  setWayfarerCookie: mocks.setCookie,
}));

import { GET } from "./route";

const publicOrigin = "https://staging.absoluterelativesystems.com";
const internalOrigins = ["0.0.0.0", "localhost", "127.0.0.1"];
const providers = ["google", "github"] as const;

function request(provider: (typeof providers)[number], query: string) {
  return new Request(`http://0.0.0.0:3000/api/auth/providers/${provider}/callback?${query}`, {
    headers: {
      host: "internal-oauth-container:3000",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
    },
  });
}

async function callback(provider: (typeof providers)[number], query: string) {
  return GET(request(provider, query), { params: Promise.resolve({ provider }) });
}

function expectPublicLocation(response: Response, expected: string) {
  const location = response.headers.get("location");
  expect(location).toBe(`${publicOrigin}${expected}`);
  for (const internalOrigin of internalOrigins) expect(location).not.toContain(internalOrigin);
}

describe("OAuth callback public redirects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", publicOrigin);
    mocks.session.mockResolvedValue(null);
    mocks.cancel.mockResolvedValue(undefined);
  });

  it.each(providers)("uses the staging origin for %s sign-in success", async (provider) => {
    mocks.complete.mockResolvedValue({
      kind: "SIGNED_IN",
      redirectPath: "/",
      session: { token: `${provider}-session` },
    });
    const response = await callback(provider, "state=valid-state&code=valid-code");
    expectPublicLocation(response, `/?signedInWith=${provider}`);
    expect(mocks.setCookie).toHaveBeenCalledWith(`${provider}-session`);
  });

  it.each(providers)("uses the staging origin for %s cancellation", async (provider) => {
    const response = await callback(provider, "state=valid-state&error=access_denied");
    expectPublicLocation(response, `/sign-in?reason=oauth-cancelled&provider=${provider}`);
    expect(mocks.cancel).toHaveBeenCalledWith(provider.toUpperCase(), "valid-state");
  });

  it.each(providers)("uses the staging origin for %s invalid or expired state", async (provider) => {
    mocks.complete.mockRejectedValue(new mocks.OAuthError("OAuth state is invalid or expired.", "STATE_INVALID"));
    const response = await callback(provider, "state=expired-state&code=invalid-code");
    expectPublicLocation(response, `/sign-in?reason=oauth-invalid&provider=${provider}`);
  });

  it.each(providers)("uses the staging origin for %s account-link success", async (provider) => {
    mocks.session.mockResolvedValue({ id: "session-1", accountId: "account-1" });
    mocks.complete.mockResolvedValue({ kind: "LINKED", redirectPath: "/account/linked-identities" });
    const response = await callback(provider, "state=valid-link-state&code=valid-code");
    expectPublicLocation(response, `/account/linked-identities?linked=${provider}`);
  });

  it.each(providers)("uses the staging origin for %s account-link failure", async (provider) => {
    mocks.session.mockResolvedValue({ id: "session-1", accountId: "account-1" });
    mocks.complete.mockRejectedValue(
      new mocks.OAuthError("That identity belongs to another account.", "IDENTITY_CONFLICT"),
    );
    const response = await callback(provider, "state=valid-link-state&code=valid-code");
    expectPublicLocation(
      response,
      `/account/linked-identities?providerError=oauth-identity-conflict&provider=${provider}`,
    );
  });

  it.each([
    ["EMAIL_COLLISION", "oauth-email-collision"],
    ["ACCOUNT_RESTRICTED", "oauth-account-restricted"],
    ["EMAIL_REQUIRED", "oauth-email-required"],
    ["PROVIDER_UNAVAILABLE", "oauth-unavailable"],
    ["INVALID_CALLBACK", "oauth-invalid"],
  ] as const)("maps %s without exposing the request origin", async (code, reason) => {
    mocks.complete.mockRejectedValue(new mocks.OAuthError("Provider callback failed.", code));
    const response = await callback("github", "state=valid-state&code=invalid-code");
    expectPublicLocation(response, `/sign-in?reason=${reason}&provider=github`);
  });

  it("fails closed when production has no trusted public origin", async () => {
    vi.stubEnv("HOMEPORT_PUBLIC_APP_ORIGIN", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const response = await callback("github", "state=valid-state&code=valid-code");
    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
