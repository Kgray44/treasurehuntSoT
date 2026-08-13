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
}>;

/**
 * Canonical Wayfarer administrative operation. Admiralty may invoke this
 * operation, but it does not own the session state transition or security
 * event. Audit persistence shares the owner transaction so an audit failure
 * rolls back the revocation.
 */
export async function revokeAccountSessionByAdministrator(input: WayfarerSessionRevocationInput) {
  return db.$transaction(async (tx) => {
    const session = await tx.accountSession.findFirst({
      where: { id: input.sessionId, accountId: input.accountId },
      select: { id: true, accountId: true, deviceLabel: true, sessionType: true, expiresAt: true, revokedAt: true },
    });
    if (!session) throw new Error("WAYFARER_ADMIN_SESSION_NOT_FOUND");

    // Session revocation is naturally idempotent: no repeated business
    // transition or security event is created after the session is revoked.
    if (session.revokedAt)
      return {
        id: session.id,
        accountId: session.accountId,
        revokedAt: session.revokedAt,
        alreadyRevoked: true,
      };

    const revokedAt = new Date();
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
          state: "ACTIVE",
          device: session.deviceLabel ?? "Device not recorded",
          sessionType: session.sessionType,
          expiresAt: session.expiresAt,
        },
        afterSummary: { state: "REVOKED", revokedAt },
      },
      tx,
    );
    return { id: session.id, accountId: session.accountId, revokedAt, alreadyRevoked: false };
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
}) {
  return db.$transaction(async (tx) => {
    const account = await tx.userAccount.findUnique({
      where: { id: input.accountId },
      select: { id: true, status: true, updatedAt: true, suspendedAt: true },
    });
    if (!account) throw new Error("WAYFARER_ADMIN_ACCOUNT_NOT_FOUND");
    if (account.updatedAt.toISOString() !== input.expectedUpdatedAt)
      throw new Error("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
    if (account.status === "SUSPENDED") return { ...account, alreadySuspended: true };
    if (account.status !== "ACTIVE") throw new Error("WAYFARER_ADMIN_ACCOUNT_TRANSITION_INVALID");
    const suspendedAt = new Date();
    const changed = await tx.userAccount.updateMany({
      where: { id: account.id, status: "ACTIVE", updatedAt: account.updatedAt },
      data: { status: "SUSPENDED", suspendedAt },
    });
    if (!changed.count) throw new Error("WAYFARER_ADMIN_ACCOUNT_CONFLICT");
    await tx.accountSession.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: suspendedAt } });
    await tx.privilegedAssurance.updateMany({ where: { accountId: account.id, revokedAt: null }, data: { revokedAt: suspendedAt } });
    await tx.securityEvent.create({ data: { accountId: account.id, eventType: "ADMIN_ACCOUNT_SUSPENDED", correlationId: input.correlationId, metadata: JSON.stringify({ actorAccountId: input.actor.accountId }) } });
    await writeAdministrativeAudit({
      actorAccountId: input.actor.accountId, actorRole: input.actor.role, capability: input.actor.capability,
      action: "ADMIRALTY_ACCOUNT_SUSPEND", targetType: "UserAccount", targetId: account.id, reason: input.reason,
      authorizationBasis: input.actor.authorizationBasis, accountSessionId: input.actor.accountSessionId, correlationId: input.correlationId,
      beforeSummary: { status: account.status, updatedAt: account.updatedAt }, afterSummary: { status: "SUSPENDED", suspendedAt, sessions: "REVOKED" },
    }, tx);
    return { id: account.id, status: "SUSPENDED", suspendedAt, alreadySuspended: false };
  });
}
