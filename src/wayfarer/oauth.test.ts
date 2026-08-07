import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ attemptCreate: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    providerLinkAttempt: { create: mocks.attemptCreate },
  },
}));

import {
  beginOAuthAuthorization,
  oauthProviderConfiguration,
  publicOAuthProviderConfiguration,
} from "@/wayfarer/oauth";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const managedEnvironment = [
  "VOYAGEWRIGHT_GOOGLE_CLIENT_ID",
  "VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET",
  "VOYAGEWRIGHT_GOOGLE_REDIRECT_URI",
  "VOYAGEWRIGHT_GITHUB_CLIENT_ID",
  "VOYAGEWRIGHT_GITHUB_CLIENT_SECRET",
  "VOYAGEWRIGHT_GITHUB_REDIRECT_URI",
  "VOYAGEWRIGHT_OAUTH_TEST_MODE",
] as const;
const originalEnvironment = Object.fromEntries(managedEnvironment.map((name) => [name, process.env[name]]));

describe("Voyagewright Google and GitHub OAuth contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VOYAGEWRIGHT_OAUTH_TEST_MODE = "0";
    process.env.VOYAGEWRIGHT_GOOGLE_CLIENT_ID = "synthetic-google-client";
    process.env.VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET = "synthetic-google-secret";
    process.env.VOYAGEWRIGHT_GOOGLE_REDIRECT_URI =
      "https://staging.absoluterelativesystems.com/api/auth/providers/google/callback";
    process.env.VOYAGEWRIGHT_GITHUB_CLIENT_ID = "synthetic-github-client";
    process.env.VOYAGEWRIGHT_GITHUB_CLIENT_SECRET = "synthetic-github-secret";
    process.env.VOYAGEWRIGHT_GITHUB_REDIRECT_URI =
      "https://staging.absoluterelativesystems.com/api/auth/providers/github/callback";
    mocks.attemptCreate.mockResolvedValue({ id: "attempt-1" });
  });

  afterEach(() => {
    for (const name of managedEnvironment) {
      const value = originalEnvironment[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("creates a Google server-code request with exact callback, state, nonce, PKCE, and minimum identity scopes", async () => {
    const result = await beginOAuthAuthorization({
      provider: "GOOGLE",
      intent: "SIGN_IN",
      redirectPath: "/passport",
    });
    const authorization = new URL(result.authorizationUrl);
    const state = authorization.searchParams.get("state")!;
    const nonce = authorization.searchParams.get("nonce")!;
    const stored = mocks.attemptCreate.mock.calls[0][0].data;
    expect(authorization.origin).toBe("https://accounts.google.com");
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "https://staging.absoluterelativesystems.com/api/auth/providers/google/callback",
    );
    expect(authorization.searchParams.get("scope")).toBe("openid email profile");
    expect(authorization.searchParams.get("response_type")).toBe("code");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(stored).toMatchObject({
      accountId: undefined,
      provider: "GOOGLE",
      intent: "SIGN_IN",
      stateHash: digest(state),
      nonceHash: digest(nonce),
    });
    expect(stored.pkceVerifier).not.toBe(authorization.searchParams.get("code_challenge"));
  });

  it("creates a GitHub request with exact callback, state, S256 PKCE, and no repository scope", async () => {
    const result = await beginOAuthAuthorization({ provider: "GITHUB", intent: "SIGN_IN" });
    const authorization = new URL(result.authorizationUrl);
    const state = authorization.searchParams.get("state")!;
    const stored = mocks.attemptCreate.mock.calls[0][0].data;
    expect(authorization.origin).toBe("https://github.com");
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "https://staging.absoluterelativesystems.com/api/auth/providers/github/callback",
    );
    expect(authorization.searchParams.get("scope")).toBe("user:email");
    expect(authorization.searchParams.get("scope")).not.toMatch(/repo|gist/u);
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(stored.stateHash).toBe(digest(state));
  });

  it("reports providers unavailable when any required server-only setting is absent", () => {
    delete process.env.VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET;
    expect(oauthProviderConfiguration("GOOGLE")).toMatchObject({ configured: false, available: false });
    expect(publicOAuthProviderConfiguration()).toContainEqual(
      expect.objectContaining({ provider: "GOOGLE", status: "IMPLEMENTED_CONFIGURATION_REQUIRED" }),
    );
  });

  it("binds link intent to the canonical signed-in account and rejects unsafe return paths", async () => {
    await beginOAuthAuthorization({
      provider: "GITHUB",
      intent: "LINK",
      accountId: "canonical-account-1",
      redirectPath: "//attacker.invalid/steal",
    });
    expect(mocks.attemptCreate.mock.calls[0][0].data).toMatchObject({
      accountId: "canonical-account-1",
      intent: "LINK",
      redirectPath: "/account/linked-identities",
    });
  });
});
