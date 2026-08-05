import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFind: vi.fn(),
  attemptUpdate: vi.fn(),
  attemptDelete: vi.fn(),
  identityFindUnique: vi.fn(),
  identityFindFirst: vi.fn(),
  identityFindMany: vi.fn(),
  identityCreate: vi.fn(),
  identityUpdate: vi.fn(),
  userFind: vi.fn(),
  securityCreate: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("@/lib/db", () => {
  const db = {
    providerLinkAttempt: {
      create: mocks.attemptCreate,
      findFirst: mocks.attemptFind,
      update: mocks.attemptUpdate,
      delete: mocks.attemptDelete,
    },
    externalIdentity: {
      findUnique: mocks.identityFindUnique,
      findFirst: mocks.identityFindFirst,
      findMany: mocks.identityFindMany,
      create: mocks.identityCreate,
      update: mocks.identityUpdate,
    },
    userAccount: { findUnique: mocks.userFind },
    securityEvent: { create: mocks.securityCreate },
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(db)),
  };
  return { db };
});

import { beginProviderLink, completeProviderLink, safeLinkedIdentities, unlinkExternalIdentity } from "./providers";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

describe("Project Homeport provider security lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WAYFARER_PROVIDER_SIMULATORS = "1";
    process.env.WAYFARER_PROVIDER_TOKEN_KEY = "synthetic-test-key-not-a-provider-secret";
    mocks.attemptCreate.mockResolvedValue({ id: "attempt-1" });
    mocks.attemptUpdate.mockResolvedValue({ id: "attempt-1" });
    mocks.identityFindUnique.mockResolvedValue(null);
    mocks.identityCreate.mockResolvedValue({
      id: "identity-1",
      provider: "DISCORD_SIMULATOR",
      providerDisplayName: "Synthetic Sailor",
      visibility: "ONLY_ME",
      useForLogin: false,
    });
    mocks.identityUpdate.mockResolvedValue({ id: "identity-1" });
    mocks.securityCreate.mockResolvedValue({ id: "event-1" });
    mocks.compare.mockResolvedValue(true);
  });

  it("homeport.owner-correction.round1.provider-state stores hashed state and nonce with a server-only PKCE verifier", async () => {
    const result = await beginProviderLink("account-1", "DISCORD_SIMULATOR", "/account/linked-identities");
    const data = mocks.attemptCreate.mock.calls[0][0].data as Record<string, string>;
    expect(result.state).toBeTypeOf("string");
    expect(result.nonce).toBeTypeOf("string");
    expect(data.accountId).toBe("account-1");
    expect(data.stateHash).toBe(digest(result.state!));
    expect(data.nonceHash).toBe(digest(result.nonce!));
    expect(data.pkceVerifier).not.toBe(result.codeChallenge);
    expect(JSON.stringify(result)).not.toContain(data.pkceVerifier);
    expect(result.callback).toContain("/api/passport/providers/callback");
  });

  it("homeport.owner-correction.round1.provider-nonce denies a mismatched callback before identity mutation", async () => {
    mocks.attemptFind.mockResolvedValue({
      id: "attempt-1",
      accountId: "account-1",
      provider: "DISCORD_SIMULATOR",
      stateHash: digest("state-1"),
      nonceHash: digest("nonce-1"),
      pkceVerifier: "server-verifier",
    });
    await expect(
      completeProviderLink({
        accountId: "account-1",
        provider: "DISCORD_SIMULATOR",
        state: "state-1",
        nonce: "wrong-nonce",
        code: "sim:provider_1:Synthetic Sailor",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.identityCreate).not.toHaveBeenCalled();
    expect(mocks.attemptUpdate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.provider-collision refuses an identity already owned by another account", async () => {
    mocks.attemptFind.mockResolvedValue({
      id: "attempt-1",
      accountId: "account-1",
      provider: "DISCORD_SIMULATOR",
      stateHash: digest("state-1"),
      nonceHash: digest("nonce-1"),
      pkceVerifier: "server-verifier",
    });
    mocks.identityFindUnique.mockResolvedValue({ id: "identity-foreign", accountId: "account-2" });
    await expect(
      completeProviderLink({
        accountId: "account-1",
        provider: "DISCORD_SIMULATOR",
        state: "state-1",
        nonce: "nonce-1",
        code: "sim:provider_1:Synthetic Sailor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(mocks.identityCreate).not.toHaveBeenCalled();
    expect(mocks.attemptUpdate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.provider-safe-dto never returns encrypted tokens, scopes, or provider account keys", async () => {
    mocks.identityFindMany.mockResolvedValue([
      {
        id: "identity-1",
        provider: "DISCORD",
        providerAccountId: "private-provider-key",
        providerDisplayName: "Safe display",
        avatarReference: null,
        allowedScopes: '["identify"]',
        encryptedToken: "encrypted-private-token",
        useForLogin: true,
        visibility: "ONLY_ME",
        status: "LINKED",
        linkedAt: new Date("2026-08-04T00:00:00.000Z"),
        lastVerifiedAt: null,
        revokedAt: null,
      },
    ]);
    const value = await safeLinkedIdentities("account-1");
    expect(value[0]).toEqual({
      id: "identity-1",
      provider: "DISCORD",
      displayName: "Safe display",
      avatarUrl: null,
      useForLogin: true,
      visibility: "ONLY_ME",
      status: "LINKED",
      linkedAt: "2026-08-04T00:00:00.000Z",
      lastVerifiedAt: null,
      revokedAt: null,
    });
    expect(JSON.stringify(value)).not.toMatch(/encrypted|scope|providerAccountId|private-provider-key/u);
  });

  it("homeport.owner-correction.round1.unlink-last-credential protects a provider-only account before mutation", async () => {
    mocks.identityFindMany.mockResolvedValue([
      { id: "identity-1", provider: "DISCORD", useForLogin: true, status: "LINKED", revokedAt: null },
    ]);
    mocks.userFind.mockResolvedValue({ credential: null, emails: [] });
    await expect(unlinkExternalIdentity("account-1", "identity-1", "password")).rejects.toThrow(
      "Add another login or recovery method",
    );
    expect(mocks.identityUpdate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.unlink-reauth revokes the link, destroys its token, and audits the action", async () => {
    mocks.identityFindMany.mockResolvedValue([
      { id: "identity-1", provider: "DISCORD", useForLogin: true, status: "LINKED", revokedAt: null },
    ]);
    mocks.userFind.mockResolvedValue({ credential: { id: "credential-1", passwordHash: "hash" }, emails: [] });
    await unlinkExternalIdentity("account-1", "identity-1", "correct password");
    expect(mocks.compare).toHaveBeenCalledWith("correct password", "hash");
    expect(mocks.identityUpdate).toHaveBeenCalledWith({
      where: { id: "identity-1" },
      data: {
        status: "REVOKED",
        revokedAt: expect.any(Date),
        encryptedToken: null,
        useForLogin: false,
        visibility: "ONLY_ME",
      },
    });
    expect(mocks.securityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: "account-1", eventType: "EXTERNAL_IDENTITY_UNLINKED" }),
    });
  });
});
