import { beforeEach, describe, expect, it, vi } from "vitest";
import { newAdmiraltyCommandRequest } from "../commands";

const owner = vi.hoisted(() => ({
  inspectAccountLifecycleForAdministrator: vi.fn(),
  revokeAccountSessionByAdministrator: vi.fn(),
  suspendAccountByAdministrator: vi.fn(),
}));

vi.mock("@/wayfarer/admin-commands", () => owner);

import { wayfarerAccountSuspendPort, wayfarerSessionRevokePort } from "./wayfarer-admin-command";

const actor = {
  accountId: "operator_1234567890",
  accountSessionId: "operator_session_1234567890",
  roles: ["SECURITY_OPERATOR"],
  authorizationBasis: "ROLE_CAPABILITY",
};

describe("Wayfarer Admiralty command ports", () => {
  beforeEach(() => vi.resetAllMocks());

  it("turns stale account lifecycle state into a fail-closed conflict", async () => {
    owner.inspectAccountLifecycleForAdministrator.mockResolvedValue({
      id: "account_1234567890",
      status: "ACTIVE",
      updatedAt: new Date("2026-08-13T12:00:00.000Z"),
      suspendedAt: null,
    });
    const command = newAdmiraltyCommandRequest({
      commandType: "ACCOUNT_SUSPEND",
      actorAccountId: actor.accountId,
      targetType: "UserAccount",
      targetId: "account_1234567890",
      expectedRevision: "2026-08-13T11:59:00.000Z",
      reason: "Verified account-security incident requires suspension.",
      idempotencyKey: "account_1234567890_1234567890",
      input: { expectedUpdatedAt: "2026-08-13T11:59:00.000Z" },
    });

    await expect(wayfarerAccountSuspendPort(actor).preview(command)).rejects.toMatchObject({
      code: "ADMIN_CONFLICT",
      status: 409,
    });
  });

  it("normalizes missing account and session owner errors without exposing owner internals", async () => {
    owner.inspectAccountLifecycleForAdministrator.mockResolvedValue(null);
    const lifecycle = newAdmiraltyCommandRequest({
      commandType: "ACCOUNT_SUSPEND",
      actorAccountId: actor.accountId,
      targetType: "UserAccount",
      targetId: "account_1234567890",
      expectedRevision: "2026-08-13T12:00:00.000Z",
      reason: "Verified account-security incident requires suspension.",
      idempotencyKey: "account_1234567890_1234567890",
      input: { expectedUpdatedAt: "2026-08-13T12:00:00.000Z" },
    });
    await expect(wayfarerAccountSuspendPort(actor).preview(lifecycle)).rejects.toMatchObject({
      code: "ADMIN_TARGET_NOT_FOUND",
      status: 404,
    });

    owner.revokeAccountSessionByAdministrator.mockRejectedValue(new Error("WAYFARER_ADMIN_SESSION_NOT_FOUND"));
    const session = newAdmiraltyCommandRequest({
      commandType: "SESSION_REVOKE",
      actorAccountId: actor.accountId,
      targetType: "UserAccount",
      targetId: "account_1234567890",
      reason: "Verified account-security incident requires revocation.",
      idempotencyKey: "session_12345678901234567890",
      input: { sessionId: "session_1234567890" },
    });
    await expect(
      wayfarerSessionRevokePort(actor).execute(session, await wayfarerSessionRevokePort(actor).preview(session)),
    ).rejects.toMatchObject({
      code: "ADMIN_TARGET_NOT_FOUND",
      status: 404,
    });
  });

  it("uses the stable idempotency key for both owner receipt and correlation", async () => {
    owner.revokeAccountSessionByAdministrator.mockResolvedValue({
      id: "session_1234567890",
      revokedAt: "2026-08-13T12:00:00.000Z",
      alreadyRevoked: false,
    });
    const session = newAdmiraltyCommandRequest({
      commandType: "SESSION_REVOKE",
      actorAccountId: actor.accountId,
      targetType: "UserAccount",
      targetId: "account_1234567890",
      reason: "Verified account-security incident requires revocation.",
      idempotencyKey: "session_12345678901234567890",
      input: { sessionId: "session_1234567890" },
    });
    await wayfarerSessionRevokePort(actor).execute(session, await wayfarerSessionRevokePort(actor).preview(session));
    expect(owner.revokeAccountSessionByAdministrator).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: "session_12345678901234567890",
        idempotencyKey: "session_12345678901234567890",
      }),
    );
  });
});
