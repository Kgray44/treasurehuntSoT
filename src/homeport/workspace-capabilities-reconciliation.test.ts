import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  transaction: vi.fn(),
  profileCreate: vi.fn(),
  accountUpdate: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    userAccount: { findMany: mocks.accounts },
    $transaction: mocks.transaction,
  },
}));

import { reconcileClaimedAccountCapabilities } from "./workspace-capabilities";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((run) =>
    run({
      playerProfile: { create: mocks.profileCreate },
      userAccount: { update: mocks.accountUpdate },
      securityEvent: { create: mocks.eventCreate },
    }),
  );
});

describe("claimed-account workspace capability reconciliation", () => {
  it("dry-runs without writes and identifies the exact ordinary capability gap", async () => {
    mocks.accounts.mockResolvedValue([
      {
        id: "account-1",
        status: "ACTIVE",
        claimedAt: new Date(),
        lockedAt: null,
        suspendedAt: null,
        ordinaryWorkspaceEntryAt: null,
        emails: [{ verificationState: "VERIFIED" }],
        profile: { id: "profile-1" },
      },
    ]);
    await expect(reconcileClaimedAccountCapabilities({ accountId: "account-1" })).resolves.toEqual({
      mode: "DRY_RUN",
      verified: false,
      accounts: [
        {
          accountId: "account-1",
          status: "READY",
          ordinaryEntry: "CREATE_REQUIRED",
          playerProfile: "PRESENT",
          changed: true,
        },
      ],
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("provides an explicit VERIFY mode that fails its result while an eligible account still has a gap", async () => {
    mocks.accounts.mockResolvedValue([
      {
        id: "account-1",
        status: "ACTIVE",
        claimedAt: new Date(),
        lockedAt: null,
        suspendedAt: null,
        ordinaryWorkspaceEntryAt: null,
        emails: [{ verificationState: "VERIFIED" }],
        profile: { id: "profile-1" },
      },
    ]);
    await expect(
      reconcileClaimedAccountCapabilities({ accountId: "account-1", mode: "VERIFY" }),
    ).resolves.toMatchObject({ mode: "VERIFY", verified: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("commits missing ordinary roles, preserves privileged roles, and emits a private-safe audit event", async () => {
    mocks.accounts.mockResolvedValue([
      {
        id: "account-1",
        status: "ACTIVE",
        claimedAt: new Date(),
        lockedAt: null,
        suspendedAt: null,
        ordinaryWorkspaceEntryAt: null,
        emails: [{ verificationState: "VERIFIED" }],
        profile: { id: "profile-1" },
      },
    ]);
    await reconcileClaimedAccountCapabilities({ accountId: "account-1", commit: true });
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { ordinaryWorkspaceEntryAt: expect.any(Date) },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "WORKSPACE_CAPABILITIES_RECONCILED" }) }),
    );
  });

  it("skips unclaimed and restricted accounts without escalating them", async () => {
    mocks.accounts.mockResolvedValue([
      {
        id: "guest",
        status: "ACTIVE",
        claimedAt: null,
        lockedAt: null,
        suspendedAt: null,
        ordinaryWorkspaceEntryAt: null,
        emails: [{ verificationState: "VERIFIED" }],
        profile: null,
      },
      {
        id: "restricted",
        status: "ACTIVE",
        claimedAt: new Date(),
        lockedAt: new Date(),
        suspendedAt: null,
        ordinaryWorkspaceEntryAt: null,
        emails: [{ verificationState: "VERIFIED" }],
        profile: null,
      },
    ]);
    const result = await reconcileClaimedAccountCapabilities({ commit: true });
    expect(result.accounts.map((account) => account.status)).toEqual(["SKIPPED_NOT_CLAIMED", "SKIPPED_RESTRICTED"]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
