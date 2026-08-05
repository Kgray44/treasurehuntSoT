import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  hashPassword: vi.fn(),
  tokenFind: vi.fn(),
  tokenUpdateMany: vi.fn(),
  tokenCreate: vi.fn(),
  tokenUpdate: vi.fn(),
  emailFindUnique: vi.fn(),
  emailFindFirst: vi.fn(),
  emailUpdate: vi.fn(),
  emailUpdateMany: vi.fn(),
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  sessionUpdate: vi.fn(),
  credentialUpsert: vi.fn(),
  securityCreate: vi.fn(),
  sessionCreate: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.compare, hash: mocks.hashPassword }));
vi.mock("@/lib/security", () => ({
  hashToken: (value: string) => `hashed:${value}`,
  makeToken: (bytes: number) => `raw-${bytes}-byte-secret-token`,
}));
vi.mock("@/lib/db", () => {
  const db = {
    accountToken: {
      findFirst: mocks.tokenFind,
      updateMany: mocks.tokenUpdateMany,
      create: mocks.tokenCreate,
      update: mocks.tokenUpdate,
    },
    accountEmail: {
      findUnique: mocks.emailFindUnique,
      findFirst: mocks.emailFindFirst,
      update: mocks.emailUpdate,
      updateMany: mocks.emailUpdateMany,
    },
    userAccount: { findUnique: mocks.userFind, update: mocks.userUpdate },
    accountSession: { create: mocks.sessionCreate, updateMany: mocks.sessionUpdate },
    accountCredential: { upsert: mocks.credentialUpsert },
    securityEvent: { create: mocks.securityCreate },
    $transaction: vi.fn(async (value: unknown) => {
      if (Array.isArray(value)) return Promise.all(value);
      return (value as (transaction: unknown) => unknown)(db);
    }),
  };
  return { db };
});

import {
  confirmEmailChange,
  requestEmailChange,
  requestPasswordReset,
  resetPassword,
  takeDevelopmentDelivery,
  verifyAccountEmail,
} from "./accounts";

describe("Project Homeport email identity security", () => {
  const temporaryRoots: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compare.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("new-password-hash");
    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.tokenCreate.mockResolvedValue({ id: "token-1" });
    mocks.tokenUpdate.mockResolvedValue({ id: "token-1" });
    mocks.emailUpdate.mockResolvedValue({ id: "email-1" });
    mocks.emailUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userUpdate.mockResolvedValue({ id: "account-1" });
    mocks.sessionUpdate.mockResolvedValue({ count: 2 });
    mocks.credentialUpsert.mockResolvedValue({ id: "credential-1" });
    mocks.securityCreate.mockResolvedValue({ id: "event-1" });
    mocks.sessionCreate.mockResolvedValue({ id: "session-new" });
    delete process.env.HOMEPORT_PHASE7_TASK_ROOT;
    delete process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
    delete process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER;
  });

  afterEach(() => {
    delete process.env.HOMEPORT_PHASE7_TASK_ROOT;
    delete process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
    delete process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER;
    for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  it("homeport.owner-correction.round1.email-enumeration creates no token for an unknown address and returns no identity fact", async () => {
    mocks.emailFindUnique.mockResolvedValue(null);
    await expect(requestPasswordReset("Unknown@Example.test")).resolves.toBeUndefined();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
    expect(mocks.securityCreate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.verification-token-hashing persists only a digest while the synthetic outbox owns the raw token", async () => {
    mocks.emailFindUnique.mockResolvedValue({
      accountId: "account-1",
      verificationState: "VERIFIED",
      account: { status: "ACTIVE" },
    });
    await requestPasswordReset("Owner@Example.test");
    expect(mocks.tokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: "account-1",
        purpose: "PASSWORD_RESET",
        tokenHash: "hashed:raw-32-byte-secret-token",
      }),
    });
    expect(JSON.stringify(mocks.tokenCreate.mock.calls)).not.toContain('"token":"raw-32-byte-secret-token"');
    expect(takeDevelopmentDelivery("PASSWORD_RESET", "owner@example.test")).toMatchObject({
      purpose: "PASSWORD_RESET",
      token: "raw-32-byte-secret-token",
      accountId: "account-1",
    });
  });

  it("homeport.owner-correction.round1.synthetic-outbox writes raw delivery only inside the configured task root", async () => {
    const taskRoot = mkdtempSync(join(tmpdir(), "homeport-outbox-"));
    temporaryRoots.push(taskRoot);
    const outboxPath = join(taskRoot, "synthetic-outbox", "email.jsonl");
    process.env.HOMEPORT_PHASE7_TASK_ROOT = taskRoot;
    process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH = outboxPath;
    process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER = "TASK_OWNED_TEST";
    mocks.emailFindUnique.mockResolvedValue({
      accountId: "account-1",
      verificationState: "VERIFIED",
      account: { status: "ACTIVE" },
    });

    await requestPasswordReset("Owner@Example.test");

    const rows = readFileSync(outboxPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(rows).toEqual([
      expect.objectContaining({
        purpose: "PASSWORD_RESET",
        email: "owner@example.test",
        token: "raw-32-byte-secret-token",
        accountId: "account-1",
      }),
    ]);

    process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH = join(taskRoot, "..", "escaped-email.jsonl");
    await expect(requestPasswordReset("Owner@Example.test")).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("homeport.owner-correction.round1.token-expiry-and-consumption constrains verification lookup and consumes the accepted challenge", async () => {
    mocks.tokenFind.mockResolvedValue({ id: "token-1", accountId: "account-1", account: { emails: [] } });
    await verifyAccountEmail("presented-verification-token");
    expect(mocks.tokenFind).toHaveBeenCalledWith({
      where: {
        purpose: "VERIFY_EMAIL",
        tokenHash: "hashed:presented-verification-token",
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      include: { account: { include: { emails: true } } },
    });
    expect(mocks.tokenUpdate).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.securityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: "account-1", eventType: "EMAIL_VERIFIED" }),
    });
  });

  it("homeport.owner-correction.round1.email-change requires reauthentication and normalized uniqueness", async () => {
    mocks.userFind.mockResolvedValue({
      id: "account-1",
      status: "ACTIVE",
      credential: { passwordHash: "current-password-hash" },
      emails: [
        {
          id: "email-1",
          normalizedEmail: "old@example.test",
          displayEmail: "old@example.test",
          verificationState: "VERIFIED",
        },
      ],
    });
    mocks.compare.mockResolvedValue(false);
    await expect(requestEmailChange("account-1", "wrong", "Next@Example.test")).rejects.toThrow(
      "Reauthentication failed",
    );
    expect(mocks.tokenCreate).not.toHaveBeenCalled();

    mocks.compare.mockResolvedValue(true);
    mocks.emailFindUnique.mockResolvedValue({ id: "other-email" });
    await expect(requestEmailChange("account-1", "correct", " NEXT@example.test ")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("homeport.owner-correction.round1.email-change-confirmation atomically replaces the address, consumes tokens, revokes sessions, and notifies the old address", async () => {
    mocks.tokenFind.mockResolvedValue({
      id: "change-1",
      accountId: "account-1",
      pendingNormalizedEmail: "next@example.test",
      pendingDisplayEmail: "Next@Example.test",
      account: {
        emails: [
          {
            id: "email-1",
            normalizedEmail: "old@example.test",
            displayEmail: "old@example.test",
          },
        ],
      },
    });
    mocks.emailFindUnique.mockResolvedValue(null);
    await expect(confirmEmailChange("presented-change-token")).resolves.toEqual({
      displayEmail: "Next@Example.test",
    });
    expect(mocks.emailUpdate).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: expect.objectContaining({
        normalizedEmail: "next@example.test",
        displayEmail: "Next@Example.test",
        verificationState: "VERIFIED",
      }),
    });
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { accountId: "account-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(takeDevelopmentDelivery("EMAIL_CHANGE_NOTICE", "old@example.test")).toMatchObject({
      accountId: "account-1",
      detail: expect.stringContaining("account recovery"),
    });
  });

  it("homeport.owner-correction.round1.reset-token-hashing consumes the challenge and revokes prior sessions", async () => {
    mocks.tokenFind.mockResolvedValue({ id: "reset-1", accountId: "account-1" });
    await resetPassword("presented-reset-token", "a sufficiently long password");
    expect(mocks.tokenFind).toHaveBeenCalledWith({
      where: {
        purpose: "PASSWORD_RESET",
        tokenHash: "hashed:presented-reset-token",
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
    });
    expect(mocks.credentialUpsert).toHaveBeenCalledWith({
      where: { accountId: "account-1" },
      update: { passwordHash: "new-password-hash", changedAt: expect.any(Date) },
      create: { accountId: "account-1", passwordHash: "new-password-hash" },
    });
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { accountId: "account-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
