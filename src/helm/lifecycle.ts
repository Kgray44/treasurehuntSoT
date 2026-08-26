import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { captainAuthorityClauses, type CanonicalCaptainActor } from "@/chronicle/captain-authorization";

export class HelmLifecycleError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_AUTHORIZED"
      | "STALE_STATE"
      | "VOYAGE_UNAVAILABLE"
      | "CAPTAIN_MEMBERSHIP"
      | "MEMBERSHIP_UNAVAILABLE",
  ) {
    super(message);
  }
}

const terminalVoyageStates = new Set(["CANCELLED", "COMPLETED", "ABANDONED"]);
const activeMembershipStates = new Set(["READY", "ACTIVE_MEMBER", "ACCEPTED", "INVITED"]);

function assertExpectedVersion(actual: number, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== actual)
    throw new HelmLifecycleError(
      "This Voyage changed before the request could be committed. Refresh its current crew state.",
      "STALE_STATE",
    );
}

function auditData(input: {
  actorType: "PLAYER" | "CAPTAIN";
  actorId: string;
  actorAccountId?: string;
  action: string;
  resourceType: "PLAYTHROUGH" | "PLAYTHROUGH_MEMBERSHIP";
  resourceId: string;
  correlationId: string;
  metadata: Record<string, string>;
}) {
  return {
    actorType: input.actorType,
    actorId: input.actorId,
    ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    correlationId: input.correlationId,
    metadata: JSON.stringify(input.metadata),
  };
}

export async function leaveVoyage(input: { voyageId: string; playerProfileId: string; expectedVersion?: number }) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const membership = await tx.playthroughMembership.findFirst({
      where: { playthroughId: input.voyageId, playerProfileId: input.playerProfileId },
      include: {
        player: { select: { accountId: true } },
        playthrough: {
          select: { id: true, status: true, voyageName: true, concurrencyVersion: true, captainAccountId: true },
        },
      },
    });
    if (!membership) throw new HelmLifecycleError("This Voyage membership is unavailable.", "MEMBERSHIP_UNAVAILABLE");
    if (terminalVoyageStates.has(membership.playthrough.status))
      throw new HelmLifecycleError("This Voyage is already historical and cannot be left again.", "VOYAGE_UNAVAILABLE");
    if (membership.player.accountId && membership.playthrough.captainAccountId === membership.player.accountId)
      throw new HelmLifecycleError(
        "A participating Captain cannot leave through Crew exit. Captain authority must be handled by the later governed relinquishment flow.",
        "CAPTAIN_MEMBERSHIP",
      );
    if (["LEFT", "REMOVED", "CANCELLED"].includes(membership.status))
      return { voyageId: input.voyageId, membershipId: membership.id, status: membership.status, idempotent: true };
    assertExpectedVersion(membership.playthrough.concurrencyVersion, input.expectedVersion);
    if (!activeMembershipStates.has(membership.status))
      throw new HelmLifecycleError("This membership is not currently eligible to leave.", "MEMBERSHIP_UNAVAILABLE");
    const now = new Date();
    await tx.playthroughMembership.update({ where: { id: membership.id }, data: { status: "LEFT", removedAt: now } });
    await tx.membershipPresenceDevice.updateMany({
      where: { playthroughMembershipId: membership.id, disconnectedAt: null },
      data: { disconnectedAt: now },
    });
    await tx.taleSession.update({ where: { id: input.voyageId }, data: { concurrencyVersion: { increment: 1 } } });
    await tx.platformAuditEvent.create({
      data: auditData({
        actorType: "PLAYER",
        actorId: input.playerProfileId,
        action: "VOYAGE_MEMBERSHIP_LEFT",
        resourceType: "PLAYTHROUGH_MEMBERSHIP",
        resourceId: membership.id,
        correlationId,
        metadata: { voyageId: input.voyageId, outcome: "LEFT" },
      }),
    });
    return { voyageId: input.voyageId, membershipId: membership.id, status: "LEFT", idempotent: false };
  });
}

export async function removeCrewMember(input: {
  voyageId: string;
  membershipId: string;
  actor: CanonicalCaptainActor;
  expectedVersion?: number;
}) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findFirst({
      where: { id: input.voyageId, OR: captainAuthorityClauses(input.actor) },
      select: { id: true, status: true, concurrencyVersion: true },
    });
    if (!session) throw new HelmLifecycleError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    if (terminalVoyageStates.has(session.status))
      throw new HelmLifecycleError("This Voyage is already historical.", "VOYAGE_UNAVAILABLE");
    const membership = await tx.playthroughMembership.findFirst({
      where: { id: input.membershipId, playthroughId: input.voyageId },
      include: { player: { select: { accountId: true } } },
    });
    if (!membership) throw new HelmLifecycleError("That Crew membership is unavailable.", "MEMBERSHIP_UNAVAILABLE");
    if (membership.player.accountId === input.actor.accountId)
      throw new HelmLifecycleError(
        "A Captain cannot remove their own Player membership through Crew removal.",
        "CAPTAIN_MEMBERSHIP",
      );
    if (["REMOVED", "LEFT", "CANCELLED"].includes(membership.status))
      return { voyageId: input.voyageId, membershipId: membership.id, status: membership.status, idempotent: true };
    assertExpectedVersion(session.concurrencyVersion, input.expectedVersion);
    const now = new Date();
    await tx.playthroughMembership.update({
      where: { id: membership.id },
      data: { status: "REMOVED", removedAt: now },
    });
    await tx.membershipPresenceDevice.updateMany({
      where: { playthroughMembershipId: membership.id, disconnectedAt: null },
      data: { disconnectedAt: now },
    });
    await tx.taleSession.update({ where: { id: input.voyageId }, data: { concurrencyVersion: { increment: 1 } } });
    await tx.platformAuditEvent.create({
      data: auditData({
        actorType: "CAPTAIN",
        actorId: input.actor.legacyGameMasterId ?? input.actor.accountId,
        actorAccountId: input.actor.accountId,
        action: "VOYAGE_CREW_MEMBER_REMOVED",
        resourceType: "PLAYTHROUGH_MEMBERSHIP",
        resourceId: membership.id,
        correlationId,
        metadata: { voyageId: input.voyageId, outcome: "REMOVED" },
      }),
    });
    return { voyageId: input.voyageId, membershipId: membership.id, status: "REMOVED", idempotent: false };
  });
}

export async function cancelVoyage(input: {
  voyageId: string;
  actor: CanonicalCaptainActor;
  expectedVersion?: number;
}) {
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findFirst({
      where: { id: input.voyageId, OR: captainAuthorityClauses(input.actor) },
      include: { memberships: { select: { id: true, status: true } } },
    });
    if (!session) throw new HelmLifecycleError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    if (session.status === "CANCELLED") return { voyageId: input.voyageId, status: "CANCELLED", idempotent: true };
    if (terminalVoyageStates.has(session.status))
      throw new HelmLifecycleError("This historical Voyage cannot be cancelled.", "VOYAGE_UNAVAILABLE");
    assertExpectedVersion(session.concurrencyVersion, input.expectedVersion);
    const now = new Date();
    await tx.taleSession.update({
      where: { id: input.voyageId },
      data: { status: "CANCELLED", cancelledAt: now, concurrencyVersion: { increment: 1 } },
    });
    const activeIds = session.memberships
      .filter((membership) => activeMembershipStates.has(membership.status))
      .map((membership) => membership.id);
    if (activeIds.length)
      await tx.playthroughMembership.updateMany({
        where: { id: { in: activeIds } },
        data: { status: "CANCELLED", removedAt: now },
      });
    if (activeIds.length)
      await tx.membershipPresenceDevice.updateMany({
        where: { playthroughMembershipId: { in: activeIds }, disconnectedAt: null },
        data: { disconnectedAt: now },
      });
    await tx.invitation.updateMany({
      where: { playthroughId: input.voyageId, status: { in: ["CREATED", "SENT", "COPIED", "VIEWED"] } },
      data: { status: "REVOKED", revokedAt: now },
    });
    await tx.platformAuditEvent.create({
      data: auditData({
        actorType: "CAPTAIN",
        actorId: input.actor.legacyGameMasterId ?? input.actor.accountId,
        actorAccountId: input.actor.accountId,
        action: "VOYAGE_CANCELLED_FOR_EVERYONE",
        resourceType: "PLAYTHROUGH",
        resourceId: input.voyageId,
        correlationId,
        metadata: { outcome: "CANCELLED", affectedMembershipCount: String(activeIds.length) },
      }),
    });
    return { voyageId: input.voyageId, status: "CANCELLED", idempotent: false };
  });
}
