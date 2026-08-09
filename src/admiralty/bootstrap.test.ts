import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  emails: vi.fn(),
  roles: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    userAccount: { findMany: mocks.accounts },
    accountEmail: { findMany: mocks.emails },
    accountRoleAssignment: { findMany: mocks.roles },
  },
}));

import { bootstrapInputFromEnvironment, reconcileAdmiraltyBootstrap, resolveBootstrapAccounts } from "./bootstrap";

describe("Admiralty bootstrap reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.accounts.mockResolvedValue([{ id: "account-a" }]);
    mocks.emails.mockResolvedValue([{ normalizedEmail: "captain@example.test", accountId: "account-a" }]);
    mocks.roles.mockResolvedValue([]);
  });

  it("normalizes and deduplicates explicit allowlist lookup inputs", () => {
    expect(
      bootstrapInputFromEnvironment({
        ADMIRALTY_BOOTSTRAP_ACCOUNT_IDS: "account-a, account-a",
        ADMIRALTY_BOOTSTRAP_EMAILS: "Captain@Example.Test; captain@example.test",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ accountIds: ["account-a"], emails: ["captain@example.test"] });
  });

  it("resolves only existing canonical accounts and deduplicates ID/email references", async () => {
    await expect(
      resolveBootstrapAccounts({ accountIds: ["account-a"], emails: ["captain@example.test"] }),
    ).resolves.toEqual(["account-a"]);
  });

  it("fails closed when an account or email cannot be resolved", async () => {
    mocks.accounts.mockResolvedValue([]);
    mocks.emails.mockResolvedValue([]);
    await expect(
      resolveBootstrapAccounts({ accountIds: ["missing-account"], emails: ["missing@example.test"] }),
    ).rejects.toMatchObject({ code: "ADMIN_TARGET_NOT_FOUND" });
  });

  it("is idempotent for an active role and plans explicit reactivation only when invoked", async () => {
    mocks.roles.mockResolvedValueOnce([{ id: "role-a", accountId: "account-a", revokedAt: null }]);
    await expect(
      reconcileAdmiraltyBootstrap({ accountIds: ["account-a"], emails: [] }, { commit: false }),
    ).resolves.toMatchObject({ mode: "DRY_RUN", plan: [{ accountId: "account-a", action: "UNCHANGED" }] });
    mocks.roles.mockResolvedValueOnce([{ id: "role-a", accountId: "account-a", revokedAt: new Date() }]);
    await expect(
      reconcileAdmiraltyBootstrap({ accountIds: ["account-a"], emails: [] }, { commit: false }),
    ).resolves.toMatchObject({ mode: "DRY_RUN", plan: [{ accountId: "account-a", action: "REACTIVATE" }] });
  });

  it("denies duplicate active administrator assignments", async () => {
    mocks.roles.mockResolvedValue([
      { id: "role-a", accountId: "account-a", revokedAt: null },
      { id: "role-b", accountId: "account-a", revokedAt: null },
    ]);
    await expect(
      reconcileAdmiraltyBootstrap({ accountIds: ["account-a"], emails: [] }, { commit: false }),
    ).rejects.toMatchObject({ code: "ADMIN_CONFLICT" });
  });
});
