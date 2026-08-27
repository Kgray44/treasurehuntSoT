import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  captainAuthorityClauses,
  hasCaptainAuthority,
  type CanonicalCaptainActor,
} from "@/chronicle/captain-authorization";
import { db } from "@/lib/db";
import { hashToken, makeToken } from "@/lib/security";
import { safeAuditMetadata } from "@/platform/audit";

const activeMembershipStates = new Set(["ACCEPTED", "READY", "ACTIVE_MEMBER"]);
const terminalVoyageStates = new Set(["CANCELLED", "COMPLETED", "ABANDONED"]);
const forkableVoyageStates = new Set(["INVITING", "READY", "SCHEDULED", "ACTIVE", "PAUSED"]);
const safeForkEventTypes = new Set([
  "sessionStarted",
  "blockEntered",
  "blockCompleted",
  "chapterCompleted",
  "hintReleased",
  "verificationSatisfied",
  "sessionPaused",
  "sessionResumed",
]);

export const helmAuthorityMutationSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().trim().min(8).max(191),
  })
  .strict();

export const helmCaptainTransferSchema = helmAuthorityMutationSchema
  .extend({ recipientMembershipId: z.string().trim().min(1).max(191) })
  .strict();

export class HelmAuthorityError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_AUTHORIZED"
      | "STALE_STATE"
      | "VOYAGE_UNAVAILABLE"
      | "MEMBERSHIP_UNAVAILABLE"
      | "SUCCESSION_UNAVAILABLE"
      | "FORK_UNAVAILABLE",
  ) {
    super(message);
  }
}

type AuthorityReceipt = {
  voyageId: string;
  action: string;
  previousCaptainAccountId: string | null;
  nextCaptainAccountId: string | null;
  authorityState: string;
  sourceConcurrencyVersion: number;
  sourceSequence: number;
  idempotencyKey: string;
  correlationId: string;
  safeReason: string | null;
  committedAt: Date;
};

function receiptResult(receipt: AuthorityReceipt, idempotent: boolean) {
  return {
    voyageId: receipt.voyageId,
    action: receipt.action,
    previousCaptainAccountId: receipt.previousCaptainAccountId,
    nextCaptainAccountId: receipt.nextCaptainAccountId,
    authorityState: receipt.authorityState,
    sourceConcurrencyVersion: receipt.sourceConcurrencyVersion,
    sourceSequence: receipt.sourceSequence,
    correlationId: receipt.correlationId,
    committedAt: receipt.committedAt.toISOString(),
    idempotent,
  };
}

function assertExpectedVersion(actual: number, expected: number) {
  if (actual !== expected)
    throw new HelmAuthorityError(
      "This Voyage changed before the request could be committed. Refresh the authoritative Voyage state.",
      "STALE_STATE",
    );
}

function assertActiveVoyage(status: string) {
  if (terminalVoyageStates.has(status))
    throw new HelmAuthorityError(
      "This Voyage is historical and cannot change Captain authority.",
      "VOYAGE_UNAVAILABLE",
    );
}

function authorityAudit(input: {
  actorType: "CAPTAIN" | "PLAYER";
  actorId: string;
  actorAccountId: string | null;
  action: string;
  voyageId: string;
  correlationId: string;
  metadata: Record<string, unknown>;
}) {
  return {
    actorType: input.actorType,
    actorId: input.actorId,
    ...(input.actorAccountId ? { actorAccountId: input.actorAccountId } : {}),
    action: input.action,
    resourceType: "PLAYTHROUGH",
    resourceId: input.voyageId,
    correlationId: input.correlationId,
    metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
  };
}

function receiptForRequest(receipt: AuthorityReceipt | null, input: { voyageId: string; action: string }) {
  if (!receipt) return null;
  if (receipt.voyageId !== input.voyageId || receipt.action !== input.action)
    throw new HelmAuthorityError("This idempotency key belongs to a different completed request.", "STALE_STATE");
  return receipt;
}

export async function transferCaptainAuthority(
  voyageId: string,
  actor: CanonicalCaptainActor,
  unchecked: z.infer<typeof helmCaptainTransferSchema>,
) {
  const input = helmCaptainTransferSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findUnique({
      where: { id: voyageId },
      include: {
        memberships: {
          include: { player: { select: { accountId: true, displayName: true } } },
        },
      },
    });
    if (!session || !hasCaptainAuthority(session, actor))
      throw new HelmAuthorityError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    const prior = receiptForRequest(
      await tx.voyageCaptainAuthorityReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
      {
        voyageId,
        action: "CAPTAIN_TRANSFERRED",
      },
    );
    if (prior) return receiptResult(prior, true);
    assertActiveVoyage(session.status);
    assertExpectedVersion(session.concurrencyVersion, input.expectedVersion);
    if (session.captainAuthorityState !== "ASSIGNED")
      throw new HelmAuthorityError(
        "Captaincy is currently vacant. A joined Player must take Captaincy first.",
        "SUCCESSION_UNAVAILABLE",
      );
    const formerCaptainMembership = session.memberships.find(
      (membership) => membership.player.accountId === actor.accountId,
    );
    if (!formerCaptainMembership || !activeMembershipStates.has(formerCaptainMembership.status))
      throw new HelmAuthorityError(
        "Direct transfer retains the former Captain's current Player membership. Join this Voyage as a Player first, or relinquish Captaincy into Succession Hold.",
        "MEMBERSHIP_UNAVAILABLE",
      );
    const recipient = session.memberships.find((membership) => membership.id === input.recipientMembershipId);
    if (!recipient || !activeMembershipStates.has(recipient.status) || !recipient.player.accountId)
      throw new HelmAuthorityError("Choose a currently joined Player to receive Captaincy.", "MEMBERSHIP_UNAVAILABLE");
    if (recipient.player.accountId === actor.accountId)
      throw new HelmAuthorityError("Choose another joined Player to receive Captaincy.", "MEMBERSHIP_UNAVAILABLE");
    const correlationId = randomUUID();
    const claim = await tx.taleSession.updateMany({
      where: {
        id: voyageId,
        concurrencyVersion: input.expectedVersion,
        captainAuthorityState: "ASSIGNED",
        OR: captainAuthorityClauses(actor),
      },
      data: {
        captainId: null,
        captainAccountId: recipient.player.accountId,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (!claim.count)
      throw new HelmAuthorityError(
        "Captain authority changed before this transfer could commit. Refresh the Voyage state.",
        "STALE_STATE",
      );
    const receipt = await tx.voyageCaptainAuthorityReceipt.create({
      data: {
        voyageId,
        action: "CAPTAIN_TRANSFERRED",
        previousCaptainAccountId: actor.accountId,
        nextCaptainAccountId: recipient.player.accountId,
        authorityState: "ASSIGNED",
        sourceConcurrencyVersion: input.expectedVersion,
        sourceSequence: session.currentSequence,
        idempotencyKey: input.idempotencyKey,
        correlationId,
      },
    });
    await tx.platformAuditEvent.create({
      data: authorityAudit({
        actorType: "CAPTAIN",
        actorId: actor.legacyGameMasterId ?? actor.accountId,
        actorAccountId: actor.accountId,
        action: "VOYAGE_CAPTAIN_TRANSFERRED",
        voyageId,
        correlationId,
        metadata: {
          previousCaptainAccountId: actor.accountId,
          nextCaptainAccountId: recipient.player.accountId,
          recipientMembershipId: recipient.id,
          sourceConcurrencyVersion: input.expectedVersion,
          sourceSequence: session.currentSequence,
        },
      }),
    });
    return { ...receiptResult(receipt, false), recipientDisplayName: recipient.player.displayName };
  });
}

export async function relinquishCaptaincy(
  voyageId: string,
  actor: CanonicalCaptainActor,
  unchecked: z.infer<typeof helmAuthorityMutationSchema>,
) {
  const input = helmAuthorityMutationSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findUnique({ where: { id: voyageId } });
    if (!session || !hasCaptainAuthority(session, actor))
      throw new HelmAuthorityError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    const prior = receiptForRequest(
      await tx.voyageCaptainAuthorityReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } }),
      {
        voyageId,
        action: "CAPTAIN_RELINQUISHED",
      },
    );
    if (prior) return receiptResult(prior, true);
    assertActiveVoyage(session.status);
    assertExpectedVersion(session.concurrencyVersion, input.expectedVersion);
    const correlationId = randomUUID();
    const claim = await tx.taleSession.updateMany({
      where: {
        id: voyageId,
        concurrencyVersion: input.expectedVersion,
        captainAuthorityState: "ASSIGNED",
        OR: captainAuthorityClauses(actor),
      },
      data: {
        captainId: null,
        captainAccountId: null,
        captainAuthorityState: "VACANT",
        concurrencyVersion: { increment: 1 },
      },
    });
    if (!claim.count)
      throw new HelmAuthorityError(
        "Captain authority changed before relinquishment could commit. Refresh the Voyage state.",
        "STALE_STATE",
      );
    const receipt = await tx.voyageCaptainAuthorityReceipt.create({
      data: {
        voyageId,
        action: "CAPTAIN_RELINQUISHED",
        previousCaptainAccountId: actor.accountId,
        nextCaptainAccountId: null,
        authorityState: "VACANT",
        sourceConcurrencyVersion: input.expectedVersion,
        sourceSequence: session.currentSequence,
        idempotencyKey: input.idempotencyKey,
        correlationId,
        safeReason: "NO_SUCCESSOR_SELECTED",
      },
    });
    await tx.platformAuditEvent.create({
      data: authorityAudit({
        actorType: "CAPTAIN",
        actorId: actor.legacyGameMasterId ?? actor.accountId,
        actorAccountId: actor.accountId,
        action: "VOYAGE_CAPTAIN_RELINQUISHED",
        voyageId,
        correlationId,
        metadata: {
          outcome: "SUCCESSION_HOLD",
          sourceConcurrencyVersion: input.expectedVersion,
          sourceSequence: session.currentSequence,
        },
      }),
    });
    return receiptResult(receipt, false);
  });
}

export async function takeCaptaincy(
  voyageId: string,
  input: z.infer<typeof helmAuthorityMutationSchema> & { playerProfileId: string },
) {
  const parsed = helmAuthorityMutationSchema.parse({
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
  });
  return db.$transaction(async (tx) => {
    const membership = await tx.playthroughMembership.findFirst({
      where: { playthroughId: voyageId, playerProfileId: input.playerProfileId },
      include: {
        player: { select: { accountId: true } },
        playthrough: true,
      },
    });
    if (!membership || !membership.player.accountId)
      throw new HelmAuthorityError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    const prior = receiptForRequest(
      await tx.voyageCaptainAuthorityReceipt.findUnique({ where: { idempotencyKey: parsed.idempotencyKey } }),
      {
        voyageId,
        action: "CAPTAIN_TAKEN",
      },
    );
    if (prior) return receiptResult(prior, true);
    if (!activeMembershipStates.has(membership.status))
      throw new HelmAuthorityError("Only a currently joined Player can take Captaincy.", "MEMBERSHIP_UNAVAILABLE");
    const session = membership.playthrough;
    assertActiveVoyage(session.status);
    assertExpectedVersion(session.concurrencyVersion, parsed.expectedVersion);
    if (session.captainAuthorityState !== "VACANT" || session.captainAccountId)
      throw new HelmAuthorityError(
        "Captaincy is no longer vacant. Refresh the Voyage state.",
        "SUCCESSION_UNAVAILABLE",
      );
    const correlationId = randomUUID();
    const claim = await tx.taleSession.updateMany({
      where: {
        id: voyageId,
        concurrencyVersion: parsed.expectedVersion,
        captainAuthorityState: "VACANT",
        captainAccountId: null,
      },
      data: {
        captainId: null,
        captainAccountId: membership.player.accountId,
        captainAuthorityState: "ASSIGNED",
        concurrencyVersion: { increment: 1 },
      },
    });
    if (!claim.count)
      throw new HelmAuthorityError(
        "Another Player accepted Captaincy first. Refresh to see the authoritative Captain.",
        "STALE_STATE",
      );
    const receipt = await tx.voyageCaptainAuthorityReceipt.create({
      data: {
        voyageId,
        action: "CAPTAIN_TAKEN",
        previousCaptainAccountId: null,
        nextCaptainAccountId: membership.player.accountId,
        authorityState: "ASSIGNED",
        sourceConcurrencyVersion: parsed.expectedVersion,
        sourceSequence: session.currentSequence,
        idempotencyKey: parsed.idempotencyKey,
        correlationId,
      },
    });
    await tx.platformAuditEvent.create({
      data: authorityAudit({
        actorType: "PLAYER",
        actorId: input.playerProfileId,
        actorAccountId: membership.player.accountId,
        action: "VOYAGE_CAPTAIN_TAKEN",
        voyageId,
        correlationId,
        metadata: {
          sourceConcurrencyVersion: parsed.expectedVersion,
          sourceSequence: session.currentSequence,
        },
      }),
    });
    return receiptResult(receipt, false);
  });
}

export async function continueSolo(
  voyageId: string,
  input: z.infer<typeof helmAuthorityMutationSchema> & { playerProfileId: string },
) {
  const parsed = helmAuthorityMutationSchema.parse({
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
  });
  return db.$transaction(async (tx) => {
    const membership = await tx.playthroughMembership.findFirst({
      where: { playthroughId: voyageId, playerProfileId: input.playerProfileId },
      include: {
        player: { select: { accountId: true, displayName: true } },
        playthrough: { include: { events: true } },
      },
    });
    if (!membership || !membership.player.accountId)
      throw new HelmAuthorityError("This Voyage is unavailable.", "NOT_AUTHORIZED");
    const prior = await tx.voyageForkLineage.findUnique({ where: { idempotencyKey: parsed.idempotencyKey } });
    if (prior) {
      if (prior.parentVoyageId !== voyageId || prior.requesterPlayerProfileId !== input.playerProfileId)
        throw new HelmAuthorityError("This idempotency key belongs to a different completed request.", "STALE_STATE");
      return {
        voyageId: prior.childVoyageId,
        parentVoyageId: prior.parentVoyageId,
        sourceConcurrencyVersion: prior.sourceConcurrencyVersion,
        sourceSequence: prior.sourceSequence,
        correlationId: prior.correlationId,
        idempotent: true,
      };
    }
    if (!activeMembershipStates.has(membership.status))
      throw new HelmAuthorityError(
        "Your current Player membership cannot create a solo continuation.",
        "MEMBERSHIP_UNAVAILABLE",
      );
    const source = membership.playthrough;
    if (
      !forkableVoyageStates.has(source.status) ||
      terminalVoyageStates.has(source.status) ||
      !source.publishedVersionId
    )
      throw new HelmAuthorityError(
        "This Voyage cannot create a solo continuation in its current state.",
        "FORK_UNAVAILABLE",
      );
    assertExpectedVersion(source.concurrencyVersion, parsed.expectedVersion);
    const correlationId = randomUUID();
    // A personal continuation is not a shared-Voyage command. It records the
    // source version/sequence below, but never claims, advances, or otherwise
    // changes the parent. Separate Players can therefore fork one committed
    // shared state without a first-wins side effect.
    const child = await tx.taleSession.create({
      data: {
        taleId: source.taleId,
        publishedVersionId: source.publishedVersionId,
        ownerLabel: source.ownerLabel,
        voyageName: `${source.voyageName ?? source.ownerLabel ?? "Voyage"} — solo`,
        captainId: null,
        captainAccountId: membership.player.accountId,
        captainAuthorityState: "ASSIGNED",
        accessTokenHash: hashToken(makeToken()),
        status: source.status === "PAUSED" ? "PAUSED" : "ACTIVE",
        captainMode: "CAPTAIN_AND_PLAYER",
        configuration: source.configuration,
        scheduleTimezone: source.scheduleTimezone,
        launchedAt: new Date(),
        concurrencyVersion: 0,
        currentChapterId: source.currentChapterId,
        currentBlockId: source.currentBlockId,
        currentSequence: source.currentSequence,
        variables: source.variables,
        inventory: source.inventory,
        startedAt: new Date(),
      },
    });
    await tx.playthroughMembership.create({
      data: {
        playthroughId: child.id,
        playerProfileId: input.playerProfileId,
        role: "PLAYER",
        status: "ACTIVE_MEMBER",
        crewRole: membership.crewRole,
        participationAlias: membership.participationAlias,
        participationAliasEditedAt: membership.participationAliasEditedAt,
        joinedAt: new Date(),
      },
    });
    const safeEvents = source.events.filter((event) => safeForkEventTypes.has(event.eventType));
    if (safeEvents.length)
      await tx.taleSessionEvent.createMany({
        data: safeEvents.map((event) => ({
          sessionId: child.id,
          publishedVersionId: source.publishedVersionId!,
          blockId: event.blockId,
          eventType: event.eventType,
          sourceType: "forked-canonical-state",
          sourceId: null,
          idempotencyKey: `fork:${child.id}:source:${event.id}`,
          payload: event.payload,
          sequence: event.sequence,
          correlationId,
          verificationRequestId: null,
          createdAt: event.createdAt,
        })),
      });
    const lineage = await tx.voyageForkLineage.create({
      data: {
        parentVoyageId: voyageId,
        childVoyageId: child.id,
        sourceConcurrencyVersion: parsed.expectedVersion,
        sourceSequence: source.currentSequence,
        requesterPlayerProfileId: input.playerProfileId,
        requesterAccountId: membership.player.accountId,
        idempotencyKey: parsed.idempotencyKey,
        correlationId,
      },
    });
    await tx.platformAuditEvent.create({
      data: authorityAudit({
        actorType: "PLAYER",
        actorId: input.playerProfileId,
        actorAccountId: membership.player.accountId,
        action: "VOYAGE_SOLO_CONTINUATION_CREATED",
        voyageId,
        correlationId,
        metadata: {
          childVoyageId: child.id,
          sourceConcurrencyVersion: parsed.expectedVersion,
          sourceSequence: source.currentSequence,
          copiedCanonicalEventCount: safeEvents.length,
          copiedPrivatePlayerState: false,
        },
      }),
    });
    return {
      voyageId: child.id,
      parentVoyageId: lineage.parentVoyageId,
      sourceConcurrencyVersion: lineage.sourceConcurrencyVersion,
      sourceSequence: lineage.sourceSequence,
      correlationId,
      idempotent: false,
      voyageName: child.voyageName,
    };
  });
}
