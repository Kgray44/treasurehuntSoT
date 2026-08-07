import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { exchangeGitHub, exchangeGoogle, type ProviderAttempt } from "@/wayfarer/oauth";

const originalFetch = global.fetch;
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

const nonce = "nonce-for-provider-exchange";
const attempt = (provider: "GOOGLE" | "GITHUB"): ProviderAttempt => ({
  id: `attempt-${provider.toLowerCase()}`,
  accountId: null,
  provider,
  intent: "SIGN_IN",
  pkceVerifier: "provider-code-verifier",
  nonceHash: createHash("sha256").update(nonce).digest("hex"),
  redirectPath: "/passport",
  expiresAt: new Date(Date.now() + 60_000),
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("live-provider exchange verification", () => {
  beforeEach(() => {
    process.env.VOYAGEWRIGHT_OAUTH_TEST_MODE = "0";
    process.env.VOYAGEWRIGHT_GOOGLE_CLIENT_ID = "google-client-for-test";
    process.env.VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET = "google-secret-for-test";
    process.env.VOYAGEWRIGHT_GOOGLE_REDIRECT_URI =
      "https://staging.absoluterelativesystems.com/api/auth/providers/google/callback";
    process.env.VOYAGEWRIGHT_GITHUB_CLIENT_ID = "github-client-for-test";
    process.env.VOYAGEWRIGHT_GITHUB_CLIENT_SECRET = "github-secret-for-test";
    process.env.VOYAGEWRIGHT_GITHUB_REDIRECT_URI =
      "https://staging.absoluterelativesystems.com/api/auth/providers/github/callback";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const name of managedEnvironment) {
      const value = originalEnvironment[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    vi.restoreAllMocks();
  });

  it("verifies a Google RS256 ID token, exact audience, nonce, issuer, time, and verified email", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "google-test-key" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const claims = Buffer.from(
      JSON.stringify({
        iss: "https://accounts.google.com",
        aud: "google-client-for-test",
        sub: "google-stable-subject-001",
        email: "google.member@example.test",
        email_verified: true,
        name: "Google Member",
        picture: "https://images.example.test/google-member.png",
        nonce,
        iat: now,
        exp: now + 300,
      }),
    ).toString("base64url");
    const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey).toString("base64url");
    const idToken = `${header}.${claims}.${signature}`;
    const providerFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id_token: idToken, scope: "openid email profile" }))
      .mockResolvedValueOnce(
        jsonResponse({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "google-test-key", alg: "RS256" }] }),
      );
    global.fetch = providerFetch as typeof fetch;

    await expect(exchangeGoogle("single-use-code", attempt("GOOGLE"))).resolves.toMatchObject({
      providerAccountId: "google-stable-subject-001",
      displayName: "Google Member",
      email: "google.member@example.test",
      emailVerified: true,
      scopes: ["openid", "email", "profile"],
    });
    const tokenBody = providerFetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(tokenBody.get("code_verifier")).toBe("provider-code-verifier");
    expect(tokenBody.get("redirect_uri")).toBe(
      "https://staging.absoluterelativesystems.com/api/auth/providers/google/callback",
    );
  });

  it("rejects a Google token with multiple audiences unless azp names this client", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "google-test-key" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const claims = Buffer.from(
      JSON.stringify({
        iss: "accounts.google.com",
        aud: ["google-client-for-test", "another-client"],
        azp: "another-client",
        sub: "google-stable-subject-002",
        email: "google.member@example.test",
        email_verified: true,
        nonce,
        iat: now,
        exp: now + 300,
      }),
    ).toString("base64url");
    const signature = sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey).toString("base64url");
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id_token: `${header}.${claims}.${signature}` }))
      .mockResolvedValueOnce(
        jsonResponse({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "google-test-key", alg: "RS256" }] }),
      ) as typeof fetch;

    await expect(exchangeGoogle("single-use-code", attempt("GOOGLE"))).rejects.toMatchObject({
      code: "INVALID_CALLBACK",
    });
  });

  it("uses GitHub's immutable numeric ID and a verified provider email without returning the access token", async () => {
    const providerFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "temporary-github-token", scope: "user:email" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: 424242,
          login: "github-member",
          name: "GitHub Member",
          avatar_url: "https://avatars.example.test/github-member.png",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          { email: "unverified@example.test", primary: false, verified: false },
          { email: "github.member@example.test", primary: true, verified: true },
        ]),
      );
    global.fetch = providerFetch as typeof fetch;

    const identity = await exchangeGitHub("single-use-code", attempt("GITHUB"));
    expect(identity).toEqual({
      providerAccountId: "424242",
      displayName: "GitHub Member",
      avatarReference: "https://avatars.example.test/github-member.png",
      email: "github.member@example.test",
      emailVerified: true,
      scopes: ["user:email"],
    });
    expect(JSON.stringify(identity)).not.toContain("temporary-github-token");
    const tokenBody = providerFetch.mock.calls[0][1]?.body as URLSearchParams;
    expect(tokenBody.get("code_verifier")).toBe("provider-code-verifier");
    expect(
      providerFetch.mock.calls.slice(1).every((call) => String(call[1]?.headers).includes("temporary") === false),
    ).toBe(true);
  });
});
