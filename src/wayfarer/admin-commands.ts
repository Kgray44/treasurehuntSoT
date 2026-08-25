import { db } from "@/lib/db";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import type { AdmiraltyCapabilityId } from "@/admiralty/capabilities";

export type WayfarerAdministratorActor = Readonly<{
  accountId: string;
  accountSessionId: string;
  role: string;
  capability: AdmiraltyCapabilityId;
  authorizationBasis: string;
}>;

export type WayfarerSessionRevocationInput = Readonly<{
  actor: WayfarerAdministratorActor;
  accountId: string;
  sessionId: string;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
}>;

type WayfarerCommandReceipt = Readonly<{
  commandType: string;
  idempotencyKey: string;
  actorAccountId: string;
  targetType: string;
  targetId: string;
  correlationId: string;
  result: string;
}>;

function requireIdempotencyKey(idempotencyKey: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/u.test(idempotencyKey)) throw new Error("WAYFARER_ADMIN_IDEMPOTENCY_INVALID");
}

function receiptResult<T extends Record<string, unknown>>(
  receipt: WayfarerCommandReceipt,
  input: { actor: WayfarerAdministratorActor; idempotencyKey: string; correlationId: string },
  commandType: string,
  targetType: string,
  targetId: string,
) {
  if (
    receipt.commandType !== commandType ||
    receipt.actorAccountId !== input.actor.accountId ||
    receipt.targetType !== targetType ||
    receipt.targetId !== targetId ||
    receipt.correlationId !== input.correlationId
  )
    throw new Error("WAYFARER_ADMIN_IDEMPOTENCY_CONFLICT");
  try {
    const result = JSON.parse(receipt.result) as unknown;
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("invalid");
    return result as T;
  } catch {
    throw new Error("WAYFARER_ADMIN_RECEIPT_INVALID");
  }
}

/**
 * Canonical Wayfarer administrative operation. Admiralty may invoke this
 * operation, but it does not own the session state transition or security
 * event. Audit persistence shares the owner transaction so an audit failure
 * rolls back the revocation.
 */
export async function revokeAccountSessionByAdministrator(input: WayfarerSessionRevocationInput) {
  requireIdempotencyKey(input.idempotencyKey);
  return db.$transaction(async (tx) => {
    const existing = await tx.wayfarerAdminCommandReceipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing)
      return receiptResult<{ id: string; accountId: string; revokedAt: string; alreadyRevoked: boolean }>(
        existing,
        input,
        "SESSION_REVOKE",
        "AccountSession",
        input.sessionId,
      );
    const session = await tx.accountSession.findFirst({
      where: { id: input.sessionId, accountId: input.accountId },
      select: { id: true, accountId: true, deviceLabel: true, sessionType: true, expiresAt: true, revokedAt: true },
    });
    if (!session) throw new Error("WAYFARER_ADMIN_SESSION_NOT_FOUND");

    const alreadyRevoked = Boolean(session.revokedAt);
    const revokedAt = session.revokedAt ?? new Date();
    if (!alreadyRevoked) {
      const updated = await tx.accountSession.updateMany({
        where: { id: session.id, accountId: input.accountId, revokedAt: null },
        data: { revokedAt },
      });
      if (!updated.count) throw new Error("WAYFARER_ADMIN_SESSION_CONFLICT");
      await tx.privilegedAssurance.updateMany({
        where: { accountSessionId: session.id, revokedAt: null },
        data: { revokedAt },
      });
      await tx.securityEvent.create({
        data: {
          accountId: input.accountId,
          eventType: "ADMIN_SESSION_REVOKED",
          correlationId: input.correlationId,
          metadata: JSON.stringify({ sessionId: session.id, actorAccountId: input.actor.accountId }),
        },
      });
    }
    const result = { id: session.id, accountId: session.accountId, revokedAt: revokedAt.toISOString(), alreadyRevoked };
    await writeAdministrativeAudit(
      {
        actorAccountId: input.actor.accountId,
        actorRole: input.actor.role,
        capability: input.actor.capability,
        action: "ADMIRALTY_SESSION_REVOKE",
        targetType: "AccountSession",
        targetId: session.id,
        reason: input.reason,
        authorizationBasis: input.actor.authorizationBasis,
        accountSessionId: input.actor.accountSessionId,
        correlationId: input.correlationId,
        beforeSummary: {
          state: alreadyRevoked ? "REVOKED" : "ACTIVE",
          device: session.deviceLabel ?? "Device not recorded",
          sessionType: session.sessionType,
          expiresAt: session.expiresAt,
        },
        afterSummary: { state: "REVOKED", revokedAt: result.revokedAt },
      },
      tx,
    );
    await tx.wayfarerAdminCommandReceipt.create({
      data: {
        commandType: "SESSION_REVOKE",
        idempotencyKey: input.idempotencyKey,
        actorAccountId: input.actor.accountId,
        targetType: "AccountSession",
        targetId: session.id,
        correlationId: input.correlationId,
        result: JSON.stringify(result),
      },
    });
    return result;
  });
}

export async function inspectAccountLifecycleForAdministrator(accountId: string) {
  return db.userAccount.findUnique({
    where: { id: accountId },
    select: { id: true, status: true, updatedAt: true, suspendedAt: true },
  });
}

export async function suspendAccountByAdministrator(input: {
  actor: WayfarerAdministratorActor;
  accountId: string;
  expectedUpdatedAt: string;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
}) {
  requireIdempotencyKey(input.idempotencyKey);
  return db.$transaction(async (tx) => {
    const existing = await tx.wayfarerAdminCommandReceipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing)
      return receiptResult<{ id: string; status: string; suspendedAt: string | null; alreadySuspended: boolean }>(
        existing,
        input,
        "ACCOUNT_SUSPEND",
        "UserAccount",
        input.accountId,
      );
    const account = await tx.userAccount.findUnique({
      where: { id: input.accountId },
      select: { id: true, status: true, updatedAt: true, suspendedAt: true },
    });
    if (!account) throw new Error("WAYFARER_ADMIN_ACCOUNT_NOT_FOUND");
    if (account.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new Error("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
    const alreadySuspended = account.status === "SUSPENDED";
    if (!alreadySuspended && account.status !== "ACTIVE") throw new Error("WAYFARER_ADMIN_ACCOUNT_TRANSITION_INVALID");
    const suspendedAt = account.suspendedAt ?? new Date();
    if (!alreadySuspended) {
      const changed = await tx.userAccount.updateMany({
        where: { id: account.id, status: "ACTIVE", updatedAt: account.updatedAt },
        data: { status: "SUSPENDED", suspendedAt },
      });
      if (!changed.count) throw new Error("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
      await tx.accountSession.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: suspendedAt },
      });
      await tx.privilegedAssurance.updateMany({
        where: { accountId: account.id, revokedAt: null },
        data: { revokedAt: suspendedAt },
      });
      await tx.securityEvent.create({
        data: {
          accountId: account.id,
          eventType: "ADMIN_ACCOUNT_SUSPENDED",
          correlationId: input.correlationId,
          metadata: JSON.stringify({ actorAccountId: input.actor.accountId }),
        },
      });
    }
    const result = { id: account.id, status: "SUSPENDED", suspendedAt: suspendedAt.toISOString(), alreadySuspended };
    await writeAdministrativeAudit(
      {
        actorAccountId: input.actor.accountId,
        actorRole: input.actor.role,
        capability: input.actor.capability,
        action: "ADMIRALTY_ACCOUNT_SUSPEND",
        targetType: "UserAccount",
        targetId: account.id,
        reason: input.reason,
        authorizationBasis: input.actor.authorizationBasis,
        accountSessionId: input.actor.accountSessionId,
        correlationId: input.correlationId,
        beforeSummary: { status: account.status, updatedAt: account.updatedAt },
        afterSummary: { status: "SUSPENDED", suspendedAt: result.suspendedAt, sessions: "REVOKED" },
      },
      tx,
    );
    await tx.wayfarerAdminCommandReceipt.create({
      data: {
        commandType: "ACCOUNT_SUSPEND",
        idempotencyKey: input.idempotencyKey,
        actorAccountId: input.actor.accountId,
        targetType: "UserAccount",
        targetId: account.id,
        correlationId: input.correlationId,
        result: JSON.stringify(result),
      },
    });
    return result;
  });
}
