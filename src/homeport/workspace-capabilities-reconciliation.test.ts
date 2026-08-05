import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  transaction: vi.fn(),
  profileCreate: vi.fn(),
  roleFind: vi.fn(),
  roleCreate: vi.fn(),
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
      accountRoleAssignment: { findFirst: mocks.roleFind, create: mocks.roleCreate },
      securityEvent: { create: mocks.eventCreate },
    }),
  );
  mocks.roleFind.mockResolvedValue(null);
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
        profile: { id: "profile-1" },
        roles: [{ role: "PLAYER" }, { role: "MODERATOR" }],
      },
    ]);
    await expect(reconcileClaimedAccountCapabilities({ accountId: "account-1" })).resolves.toEqual({
      mode: "DRY_RUN",
      accounts: [
        {
          accountId: "account-1",
          status: "READY",
          missingRoles: ["CAPTAIN", "CREATOR"],
          playerProfile: "PRESENT",
          changed: true,
        },
      ],
    });
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
        profile: { id: "profile-1" },
        roles: [{ role: "PLAYER" }, { role: "ADMINISTRATOR" }],
      },
    ]);
    await reconcileClaimedAccountCapabilities({ accountId: "account-1", commit: true });
    expect(mocks.roleCreate.mock.calls.map(([input]) => input.data.role)).toEqual(["CAPTAIN", "CREATOR"]);
    expect(mocks.roleCreate.mock.calls.flatMap(([input]) => Object.values(input.data))).not.toContain("ADMINISTRATOR");
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "WORKSPACE_CAPABILITIES_RECONCILED" }) }),
    );
  });

  it("skips unclaimed and restricted accounts without escalating them", async () => {
    mocks.accounts.mockResolvedValue([
      { id: "guest", status: "ACTIVE", claimedAt: null, lockedAt: null, suspendedAt: null, profile: null, roles: [] },
      {
        id: "restricted",
        status: "ACTIVE",
        claimedAt: new Date(),
        lockedAt: new Date(),
        suspendedAt: null,
        profile: null,
        roles: [],
      },
    ]);
    const result = await reconcileClaimedAccountCapabilities({ commit: true });
    expect(result.accounts.map((account) => account.status)).toEqual(["SKIPPED_NOT_CLAIMED", "SKIPPED_RESTRICTED"]);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
