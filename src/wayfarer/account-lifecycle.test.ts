import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  passwordMatches: vi.fn(),
  createAccountSession: vi.fn(),
  userFind: vi.fn(),
  userUpdate: vi.fn(),
  profileFind: vi.fn(),
  profileUpdate: vi.fn(),
  membershipUpdate: vi.fn(),
  sessionUpdate: vi.fn(),
  lifecycleFindFirst: vi.fn(),
  lifecycleFindMany: vi.fn(),
  lifecycleFindUnique: vi.fn(),
  lifecycleCreate: vi.fn(),
  lifecycleUpdate: vi.fn(),
  exportFindFirst: vi.fn(),
  exportUpdate: vi.fn(),
  tokenDelete: vi.fn(),
  attemptDelete: vi.fn(),
  identityFind: vi.fn(),
  identityUpdate: vi.fn(),
  mediaUpdate: vi.fn(),
  privacyUpdate: vi.fn(),
  preferenceUpdate: vi.fn(),
  communityUpdate: vi.fn(),
  emailDelete: vi.fn(),
  emailFindFirst: vi.fn(),
  credentialDelete: vi.fn(),
  securityCreate: vi.fn(),
}));

vi.mock("bcryptjs", () => ({ compare: mocks.passwordMatches }));
vi.mock("@/wayfarer/accounts", () => ({
  createAccountSession: mocks.createAccountSession,
  normalizeEmail: (value: string) => value.trim().toLowerCase(),
}));
vi.mock("@/lib/db", () => {
  const db = {
    userAccount: { findUnique: mocks.userFind, update: mocks.userUpdate },
    playerProfile: { findUnique: mocks.profileFind, update: mocks.profileUpdate },
    playthroughMembership: { updateMany: mocks.membershipUpdate },
    accountSession: { updateMany: mocks.sessionUpdate },
    accountLifecycleRequest: {
      findFirst: mocks.lifecycleFindFirst,
      findMany: mocks.lifecycleFindMany,
      findUnique: mocks.lifecycleFindUnique,
      create: mocks.lifecycleCreate,
      update: mocks.lifecycleUpdate,
    },
    accountDataExport: { findFirst: mocks.exportFindFirst, update: mocks.exportUpdate, updateMany: vi.fn() },
    accountToken: { deleteMany: mocks.tokenDelete },
    providerLinkAttempt: { deleteMany: mocks.attemptDelete },
    externalIdentity: { findMany: mocks.identityFind, update: mocks.identityUpdate },
    profileMedia: { updateMany: mocks.mediaUpdate },
    profilePrivacyRule: { updateMany: mocks.privacyUpdate },
    profilePreferenceSet: { updateMany: mocks.preferenceUpdate },
    communityProfile: { updateMany: mocks.communityUpdate },
    accountEmail: { deleteMany: mocks.emailDelete, findUnique: vi.fn(), findFirst: mocks.emailFindFirst },
    accountCredential: { deleteMany: mocks.credentialDelete },
    securityEvent: { create: mocks.securityCreate },
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(db)),
  };
  return { db };
});

import {
  AccountLifecycleError,
  deactivateAccount,
  downloadAccountExport,
  humanAccountState,
  processDueAccountDeletions,
  scheduleAccountDeletion,
} from "./account-lifecycle";

describe("Project Homeport account data and lifecycle authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.passwordMatches.mockResolvedValue(true);
    mocks.userFind.mockResolvedValue({
      id: "account-1",
      status: "ACTIVE",
      credential: { passwordHash: "password-hash" },
    });
    mocks.profileFind.mockResolvedValue({ id: "profile-1" });
    mocks.membershipUpdate.mockResolvedValue({ count: 1 });
    mocks.sessionUpdate.mockResolvedValue({ count: 2 });
    mocks.lifecycleFindFirst.mockResolvedValue(null);
    mocks.lifecycleFindMany.mockResolvedValue([]);
    mocks.lifecycleCreate.mockImplementation(async ({ data }) => ({ id: "lifecycle-1", ...data }));
    mocks.identityFind.mockResolvedValue([]);
    mocks.securityCreate.mockResolvedValue({ id: "security-event-1" });
    mocks.emailFindFirst.mockResolvedValue(null);
  });

  it("homeport.owner-correction.round1.human-account-state never renders raw internal claim enums", () => {
    expect(humanAccountState("GUEST_UNCLAIMED", false)).toBe("Account setup required");
    expect(humanAccountState("PENDING_VERIFICATION", false)).toBe("Verification required");
    expect(humanAccountState("ACTIVE", true)).toBe("Active account");
    expect(humanAccountState("DELETION_SCHEDULED", true)).toBe("Deletion scheduled");
    expect(humanAccountState("unknown-internal-value", true)).toBe("Restricted account");
  });

  it("homeport.owner-correction.round1.export-idor refuses a foreign or nonexistent export identifier", async () => {
    mocks.exportFindFirst.mockResolvedValue(null);
    await expect(downloadAccountExport("account-1", "foreign-export")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.exportFindFirst).toHaveBeenCalledWith({
      where: { id: "foreign-export", accountId: "account-1" },
    });
  });

  it("homeport.owner-correction.round1.export-expiration destroys an expired payload before refusing download", async () => {
    mocks.exportFindFirst.mockResolvedValue({
      id: "export-1",
      accountId: "account-1",
      state: "READY",
      payload: '{"safe":true}',
      checksum: "sha256",
      expiresAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    await expect(downloadAccountExport("account-1", "export-1")).rejects.toMatchObject({ code: "EXPIRED" });
    expect(mocks.exportUpdate).toHaveBeenCalledWith({
      where: { id: "export-1" },
      data: { state: "EXPIRED", payload: null },
    });
  });

  it("homeport.owner-correction.round1.deactivation-authorization requires reauthentication and revokes every session", async () => {
    mocks.passwordMatches.mockResolvedValue(false);
    await expect(deactivateAccount("account-1", "wrong", "DEACTIVATE")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();

    mocks.passwordMatches.mockResolvedValue(true);
    await expect(deactivateAccount("account-1", "correct", "DEACTIVATE")).resolves.toMatchObject({
      id: "lifecycle-1",
      state: "COMPLETED",
    });
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({
      where: { accountId: "account-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { status: "DEACTIVATED" },
    });
    expect(mocks.securityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: "account-1", eventType: "ACCOUNT_DEACTIVATED" }),
    });
  });

  it("homeport.owner-correction.round1.deletion-confirmation is exact and schedules without deleting retained history", async () => {
    await expect(scheduleAccountDeletion("account-1", "correct", "DELETE" as never)).rejects.toBeInstanceOf(
      AccountLifecycleError,
    );
    expect(mocks.userFind).not.toHaveBeenCalled();

    await expect(scheduleAccountDeletion("account-1", "correct", "DELETE ACCOUNT")).resolves.toMatchObject({
      id: "lifecycle-1",
      state: "SCHEDULED",
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { status: "DELETION_SCHEDULED", suspendedAt: expect.any(Date) },
    });
    expect(mocks.membershipUpdate).toHaveBeenCalledWith({
      where: expect.objectContaining({ playerProfileId: "profile-1" }),
      data: { status: "LEFT", removedAt: expect.any(Date) },
    });
  });

  it("homeport.owner-correction.round1.deletion-processing anonymizes due accounts, removes credentials, and preserves referential roots", async () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const due = {
      id: "deletion-1",
      accountId: "account-1",
      kind: "DELETION",
      state: "SCHEDULED",
      scheduledFor: new Date("2026-08-04T11:00:00.000Z"),
    };
    mocks.lifecycleFindMany.mockResolvedValue([due]);
    mocks.lifecycleFindUnique.mockResolvedValue(due);
    mocks.profileFind.mockResolvedValue({ id: "profile-1" });
    mocks.identityFind.mockResolvedValue([{ id: "identity-1" }]);

    await expect(processDueAccountDeletions(now)).resolves.toEqual({ processed: 1 });
    expect(mocks.tokenDelete).toHaveBeenCalledWith({ where: { accountId: "account-1" } });
    expect(mocks.credentialDelete).toHaveBeenCalledWith({ where: { accountId: "account-1" } });
    expect(mocks.emailDelete).toHaveBeenCalledWith({ where: { accountId: "account-1" } });
    expect(mocks.identityUpdate).toHaveBeenCalledWith({
      where: { id: "identity-1" },
      data: expect.objectContaining({ encryptedToken: null, status: "REVOKED", useForLogin: false }),
    });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: expect.objectContaining({ displayName: "Deleted Voyagewright", status: "DELETED" }),
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { status: "DELETED", lockedAt: null, suspendedAt: null },
    });
    expect(mocks.lifecycleUpdate).toHaveBeenCalledWith({
      where: { id: "deletion-1" },
      data: { state: "COMPLETED", completedAt: now },
    });
    expect(mocks.securityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: "account-1", eventType: "ACCOUNT_DELETION_COMPLETED" }),
    });
  });

  it("homeport.owner-correction.round1.deletion-race does not process a request canceled after the due census", async () => {
    mocks.lifecycleFindMany.mockResolvedValue([
      {
        id: "deletion-1",
        accountId: "account-1",
        state: "SCHEDULED",
        scheduledFor: new Date("2026-08-04T11:00:00.000Z"),
      },
    ]);
    mocks.lifecycleFindUnique.mockResolvedValue({
      id: "deletion-1",
      state: "CANCELED",
      scheduledFor: new Date("2026-08-04T11:00:00.000Z"),
    });
    await expect(processDueAccountDeletions(new Date("2026-08-04T12:00:00.000Z"))).resolves.toEqual({
      processed: 0,
    });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
