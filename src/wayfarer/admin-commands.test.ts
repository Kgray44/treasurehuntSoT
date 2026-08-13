import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    accountSession: { findFirst: vi.fn(), updateMany: vi.fn() },
    privilegedAssurance: { updateMany: vi.fn() },
    securityEvent: { create: vi.fn() },
    userAccount: { findUnique: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    db: { $transaction: vi.fn(async (operation: (store: typeof tx) => unknown) => operation(tx)) },
    writeAdministrativeAudit: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/admiralty/audit", () => ({ writeAdministrativeAudit: mocks.writeAdministrativeAudit }));

import { revokeAccountSessionByAdministrator, suspendAccountByAdministrator } from "./admin-commands";

const actor = {
  accountId: "operator_1234567890",
  accountSessionId: "operator_session_1234567890",
  role: "SECURITY_OPERATOR",
  capability: "SECURITY_OPERATE" as const,
  authorizationBasis: "ROLE_CAPABILITY",
};

describe("Wayfarer administrative owner commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.accountSession.findFirst.mockResolvedValue(null);
    mocks.tx.accountSession.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.privilegedAssurance.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.securityEvent.create.mockResolvedValue({ id: "event_1234567890" });
    mocks.tx.userAccount.findUnique.mockResolvedValue(null);
    mocks.tx.userAccount.updateMany.mockResolvedValue({ count: 1 });
    mocks.writeAdministrativeAudit.mockResolvedValue("command_1234567890");
  });

  it("revokes the canonical session, related assurance, security event, and audit in one owner transaction", async () => {
    mocks.tx.accountSession.findFirst.mockResolvedValue({
      id: "session_1234567890",
      accountId: "account_1234567890",
      deviceLabel: "Safe device label",
      sessionType: "ORDINARY",
      expiresAt: new Date("2026-08-14T12:00:00.000Z"),
      revokedAt: null,
    });

    const result = await revokeAccountSessionByAdministrator({
      actor,
      accountId: "account_1234567890",
      sessionId: "session_1234567890",
      reason: "Verified account-security incident requires revocation.",
      correlationId: "command_1234567890",
    });

    expect(result).toMatchObject({ id: "session_1234567890", alreadyRevoked: false });
    expect(mocks.tx.privilegedAssurance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountSessionId: "session_1234567890", revokedAt: null } }),
    );
    expect(mocks.tx.securityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "ADMIN_SESSION_REVOKED" }) }),
    );
    expect(mocks.writeAdministrativeAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ADMIRALTY_SESSION_REVOKE", correlationId: "command_1234567890" }),
      mocks.tx,
    );
  });

  it("fails closed when the transaction-bound audit write fails", async () => {
    mocks.tx.accountSession.findFirst.mockResolvedValue({
      id: "session_1234567890",
      accountId: "account_1234567890",
      deviceLabel: null,
      sessionType: "ORDINARY",
      expiresAt: new Date("2026-08-14T12:00:00.000Z"),
      revokedAt: null,
    });
    mocks.writeAdministrativeAudit.mockRejectedValue(new Error("audit write failed"));

    await expect(
      revokeAccountSessionByAdministrator({
        actor,
        accountId: "account_1234567890",
        sessionId: "session_1234567890",
        reason: "Verified account-security incident requires revocation.",
        correlationId: "command_1234567890",
      }),
    ).rejects.toThrow("audit write failed");
  });

  it("fails closed before suspension when the account revision is stale", async () => {
    mocks.tx.userAccount.findUnique.mockResolvedValue({
      id: "account_1234567890",
      status: "ACTIVE",
      updatedAt: new Date("2026-08-13T12:00:00.000Z"),
      suspendedAt: null,
    });

    await expect(
      suspendAccountByAdministrator({
        actor: { ...actor, capability: "ACCOUNT_OPERATE" },
        accountId: "account_1234567890",
        expectedUpdatedAt: "2026-08-13T11:59:00.000Z",
        reason: "Verified account-security incident requires suspension.",
        correlationId: "command_1234567890",
      }),
    ).rejects.toThrow("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
    expect(mocks.tx.userAccount.updateMany).not.toHaveBeenCalled();
    expect(mocks.writeAdministrativeAudit).not.toHaveBeenCalled();
  });
});
