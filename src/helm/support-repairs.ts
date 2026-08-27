import { db } from "@/lib/db";
import { AdmiraltyError } from "@/admiralty/errors";

export async function previewMembershipReconcile(targetAccountId: string, targetId: string) {
  const membership = await db.playthroughMembership.findFirst({
    where: { id: targetId, player: { accountId: targetAccountId } },
    select: {
      id: true,
      status: true,
      removedAt: true,
      updatedAt: true,
      presenceDevices: { where: { disconnectedAt: null }, select: { id: true } },
    },
  });
  if (!membership)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "The consented Voyage membership is no longer available.",
      409,
    );
  if (!membership.removedAt || membership.status === "REMOVED")
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "Only an internally inconsistent removed membership can be reconciled.",
      409,
    );
  if (membership.presenceDevices.length > 1)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_PRECONDITION_FAILED",
      "The membership repair would exceed its two-record safety limit.",
      409,
    );
  return {
    targetId: membership.id,
    targetRevision: membership.updatedAt.toISOString(),
    affectedRecords: 1 + membership.presenceDevices.length,
    currentState: { membership: membership.status, connectedPresenceRecords: membership.presenceDevices.length },
    resultingState: { membership: "REMOVED", connectedPresenceRecords: 0 },
  };
}

export async function executeMembershipReconcile(input: {
  targetAccountId: string;
  targetId: string;
  targetRevision: string;
  actorAccountId: string;
  correlationId: string;
}) {
  const preview = await previewMembershipReconcile(input.targetAccountId, input.targetId);
  if (preview.targetRevision !== input.targetRevision)
    throw new AdmiraltyError(
      "SUPPORT_REPAIR_STALE",
      "The membership changed after the repair proposal was created.",
      409,
    );
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const changed = await tx.playthroughMembership.updateMany({
      where: {
        id: input.targetId,
        updatedAt: new Date(input.targetRevision),
        removedAt: { not: null },
        status: { not: "REMOVED" },
      },
      data: { status: "REMOVED" },
    });
    if (!changed.count)
      throw new AdmiraltyError(
        "SUPPORT_REPAIR_STALE",
        "The membership changed before reconciliation could commit.",
        409,
      );
    const presence = await tx.membershipPresenceDevice.updateMany({
      where: { playthroughMembershipId: input.targetId, disconnectedAt: null },
      data: { disconnectedAt: now },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "SYSTEM",
        actorId: input.actorAccountId,
        actorAccountId: input.actorAccountId,
        action: "SUPPORT_MEMBERSHIP_RECONCILED",
        resourceType: "PLAYTHROUGH_MEMBERSHIP",
        resourceId: input.targetId,
        correlationId: input.correlationId,
        metadata: JSON.stringify({
          registeredRepair: "one-voyage.membership.reconcile",
          presenceDisconnected: presence.count,
        }),
      },
    });
    return { membershipChanged: changed.count, presenceDisconnected: presence.count };
  });
  return { ...preview, result };
}

export async function verifyMembershipReconcile(targetAccountId: string, targetId: string) {
  const membership = await db.playthroughMembership.findFirst({
    where: { id: targetId, player: { accountId: targetAccountId } },
    select: { status: true, presenceDevices: { where: { disconnectedAt: null }, select: { id: true } } },
  });
  return membership?.status === "REMOVED" && membership.presenceDevices.length === 0;
}
