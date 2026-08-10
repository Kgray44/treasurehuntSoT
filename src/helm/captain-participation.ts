import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { hasCaptainAuthority, type CanonicalCaptainActor } from "@/chronicle/captain-authorization";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";

export const captainParticipationModes = ["CAPTAIN_ONLY", "CAPTAIN_AND_PLAYER"] as const;
export type CaptainParticipationMode = (typeof captainParticipationModes)[number];

export const captainParticipationModeSchema = z.enum(captainParticipationModes);
export const captainParticipationMutationSchema = z
  .object({
    mode: captainParticipationModeSchema,
    expectedVersion: z.number().int().min(0),
    idempotencyKey: z.string().trim().min(8).max(191),
  })
  .strict();

export const playerMembershipAccessStates = [
  "INVITED",
  "ACCEPTED",
  "READY",
  "ACTIVE_MEMBER",
  "COMPLETED_MEMBER",
] as const;

const mutableSetupStates = new Set(["DRAFT_SETUP", "INVITING", "READY", "SCHEDULED"]);
const mutableLiveStates = new Set(["ACTIVE", "PAUSED"]);

export type CaptainParticipationAccessState = "NO_ACCESS" | "PLAYER_ONLY" | "CAPTAIN_ONLY" | "CAPTAIN_AND_PLAYER";

export type CaptainParticipationProjection = Readonly<{
  voyageId: string;
  accessState: CaptainParticipationAccessState;
  hasCaptainAuthority: boolean;
  hasPlayerMembership: boolean;
  participationMode: CaptainParticipationMode;
  playerMembershipId: string | null;
  canChangeParticipation: boolean;
  changeBlockedReason: string | null;
  voyageLifecycleState: string;
  playerPerspectiveAvailable: boolean;
  playerPerspectiveHref: string | null;
  presence: "UNKNOWN";
  concurrencyVersion: number;
}>;

type ParticipationMembership = Readonly<{
  id: string;
  status: string;
  joinedAt: Date | null;
  removedAt: Date | null;
  playerProfileId: string;
}>;

type ParticipationResource = Readonly<{
  id: string;
  status: string;
  previewMode: boolean;
  launchedAt: Date | null;
  concurrencyVersion: number;
  captainId: string | null;
  captainAccountId: string | null;
}>;

function accessBearing(membership: ParticipationMembership | null | undefined) {
  return Boolean(
    membership &&
      playerMembershipAccessStates.includes(membership.status as (typeof playerMembershipAccessStates)[number]),
  );
}

function playerPerspectiveHref(resource: ParticipationResource, hasMembership: boolean) {
  if (!hasMembership) return null;
  if (["ACTIVE", "PAUSED", "COMPLETED"].includes(resource.status)) return `/player/playthroughs/${resource.id}/journal`;
  return `/player/playthroughs/${resource.id}`;
}

function accessState(hasAuthority: boolean, hasMembership: boolean): CaptainParticipationAccessState {
  if (hasAuthority && hasMembership) return "CAPTAIN_AND_PLAYER";
  if (hasAuthority) return "CAPTAIN_ONLY";
  if (hasMembership) return "PLAYER_ONLY";
  return "NO_ACCESS";
}

type CaptainParticipationBlock = Readonly<{
  reason: string;
  code:
    | "MODE_CHANGE_NOT_ALLOWED"
    | "LATE_JOIN_NOT_ALLOWED"
    | "MEMBERSHIP_CONFLICT"
    | "TERMINAL_VOYAGE"
    | "NOT_AUTHORIZED";
}>;

function participationBlock(
  resource: ParticipationResource,
  hasAuthority: boolean,
  profileStatus: string | null,
  membership: ParticipationMembership | null,
): CaptainParticipationBlock | null {
  if (!hasAuthority)
    return {
      reason: "Captain authority is no longer active for this Voyage.",
      code: "NOT_AUTHORIZED",
    };
  if (resource.previewMode)
    return {
      reason: "Player participation is unavailable for Preview Voyages.",
      code: "MODE_CHANGE_NOT_ALLOWED",
    };
  if (!mutableSetupStates.has(resource.status) && !mutableLiveStates.has(resource.status))
    return {
      reason: `Player participation cannot change after this Voyage becomes ${resource.status.toLocaleLowerCase()}.`,
      code: ["COMPLETED", "CANCELLED", "ARCHIVED"].includes(resource.status)
        ? "TERMINAL_VOYAGE"
        : "MODE_CHANGE_NOT_ALLOWED",
    };
  if (membership?.status === "SUSPENDED")
    return {
      reason: "This Player membership is suspended and must be restored through the ordinary membership policy.",
      code: "MEMBERSHIP_CONFLICT",
    };
  if (["DECLINED", "LEFT"].includes(membership?.status ?? ""))
    return {
      reason: "This Player membership is closed and cannot be reopened through Captain participation.",
      code: "MEMBERSHIP_CONFLICT",
    };
  if (
    mutableLiveStates.has(resource.status) &&
    membership?.status === "REMOVED" &&
    (!membership.removedAt || !resource.launchedAt || membership.removedAt >= resource.launchedAt)
  )
    return {
      reason: "This Player membership ended after launch and cannot rejoin without a canonical multi-interval policy.",
      code: "LATE_JOIN_NOT_ALLOWED",
    };
  if (profileStatus !== "ACTIVE" && !accessBearing(membership))
    return {
      reason: "An active Player Profile is required to join this Voyage.",
      code: "MODE_CHANGE_NOT_ALLOWED",
    };
  return null;
}

export function captainParticipationProjection(input: {
  resource: ParticipationResource;
  actor: CanonicalCaptainActor;
  profileStatus: string | null;
  membership?: ParticipationMembership | null;
}): CaptainParticipationProjection {
  const membership = input.membership ?? null;
  const hasAuthority = hasCaptainAuthority(input.resource, input.actor);
  const hasMembership = accessBearing(membership);
  const state = accessState(hasAuthority, hasMembership);
  const blocked = participationBlock(input.resource, hasAuthority, input.profileStatus, membership);
  return {
    voyageId: input.resource.id,
    accessState: state,
    hasCaptainAuthority: hasAuthority,
    hasPlayerMembership: hasMembership,
    participationMode: hasMembership ? "CAPTAIN_AND_PLAYER" : "CAPTAIN_ONLY",
    playerMembershipId: hasMembership ? (membership?.id ?? null) : null,
    canChangeParticipation: !blocked,
    changeBlockedReason: blocked?.reason ?? null,
    voyageLifecycleState: input.resource.status,
    playerPerspectiveAvailable: hasMembership,
    playerPerspectiveHref: playerPerspectiveHref(input.resource, hasMembership),
    presence: "UNKNOWN",
    concurrencyVersion: input.resource.concurrencyVersion,
  };
}

export class CaptainParticipationError extends Error {
  constructor(
    message: string,
    readonly code: CaptainParticipationErrorCode,
  ) {
    super(message);
  }
}

export type CaptainParticipationErrorCode =
  | "NOT_AUTHORIZED"
  | "VOYAGE_UNAVAILABLE"
  | "MODE_CHANGE_NOT_ALLOWED"
  | "LATE_JOIN_NOT_ALLOWED"
  | "MEMBERSHIP_CONFLICT"
  | "AUTHORITY_CONFLICT"
  | "STALE_STATE"
  | "INVALID_MODE"
  | "TERMINAL_VOYAGE";

async function currentParticipation(voyageId: string, actor: CanonicalCaptainActor) {
  const profile = await db.playerProfile.findUnique({
    where: { accountId: actor.accountId },
    select: { id: true, status: true, displayName: true },
  });
  const resource = await db.taleSession.findUnique({
    where: { id: voyageId },
    select: {
      id: true,
      status: true,
      previewMode: true,
      launchedAt: true,
      concurrencyVersion: true,
      captainId: true,
      captainAccountId: true,
      memberships: profile
        ? {
            where: { playerProfileId: profile.id },
            select: {
              id: true,
              status: true,
              joinedAt: true,
              removedAt: true,
              playerProfileId: true,
            },
            take: 1,
          }
        : false,
    },
  });
  if (!resource) throw new CaptainParticipationError("This Voyage is unavailable.", "VOYAGE_UNAVAILABLE");
  return { resource, profile, membership: resource.memberships?.[0] ?? null };
}

export async function getCaptainParticipation(voyageId: string, actor: CanonicalCaptainActor) {
  const current = await currentParticipation(voyageId, actor);
  return captainParticipationProjection({
    resource: current.resource,
    actor,
    profileStatus: current.profile?.status ?? null,
    membership: current.membership,
  });
}

function auditData(input: {
  actor: CanonicalCaptainActor;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  outcome?: "SUCCEEDED" | "DENIED" | "FAILED";
  metadata?: Record<string, unknown>;
}) {
  return {
    actorType: "CAPTAIN",
    actorId: input.actor.accountId,
    actorAccountId: input.actor.accountId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    outcome: input.outcome ?? "SUCCEEDED",
    correlationId: input.correlationId,
    metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
  } as const;
}

async function rejectParticipationChange(input: {
  voyageId: string;
  actor: CanonicalCaptainActor;
  mode: CaptainParticipationMode;
  idempotencyKey: string;
  reason: string;
  code: CaptainParticipationError["code"];
}): Promise<never> {
  await db.platformAuditEvent.create({
    data: auditData({
      actor: input.actor,
      action: "CAPTAIN_PARTICIPATION_CHANGE_REJECTED",
      resourceType: "PLAYTHROUGH",
      resourceId: input.voyageId,
      correlationId: input.idempotencyKey,
      outcome: "DENIED",
      metadata: { requestedMode: input.mode, reasonCode: input.code },
    }),
  });
  throw new CaptainParticipationError(input.reason, input.code);
}

export async function changeCaptainParticipation(
  voyageId: string,
  actor: CanonicalCaptainActor,
  unchecked: z.infer<typeof captainParticipationMutationSchema>,
) {
  const input = captainParticipationMutationSchema.parse(unchecked);
  const current = await currentParticipation(voyageId, actor);
  const projection = captainParticipationProjection({
    resource: current.resource,
    actor,
    profileStatus: current.profile?.status ?? null,
    membership: current.membership,
  });
  const desiredMembership = input.mode === "CAPTAIN_AND_PLAYER";
  if (!projection.hasCaptainAuthority)
    throw new CaptainParticipationError("This Voyage is unavailable.", "NOT_AUTHORIZED");
  if (projection.hasPlayerMembership === desiredMembership) return { participation: projection, idempotent: true };
  if (!projection.canChangeParticipation) {
    const blocked = participationBlock(
      current.resource,
      projection.hasCaptainAuthority,
      current.profile?.status ?? null,
      current.membership,
    );
    return rejectParticipationChange({
      voyageId,
      actor,
      mode: input.mode,
      idempotencyKey: input.idempotencyKey,
      reason: blocked?.reason ?? "Player participation cannot change for this Voyage.",
      code: blocked?.code ?? "MODE_CHANGE_NOT_ALLOWED",
    });
  }
  if (current.resource.concurrencyVersion !== input.expectedVersion)
    return rejectParticipationChange({
      voyageId,
      actor,
      mode: input.mode,
      idempotencyKey: input.idempotencyKey,
      reason: "Voyage setup changed before this request. Refresh and review the current participation mode.",
      code: "STALE_STATE",
    });
  if (!current.profile)
    return rejectParticipationChange({
      voyageId,
      actor,
      mode: input.mode,
      idempotencyKey: input.idempotencyKey,
      reason: "An active Player Profile is required to join this Voyage.",
      code: "MODE_CHANGE_NOT_ALLOWED",
    });
  const profile = current.profile;

  const now = new Date();
  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.taleSession.updateMany({
        where: {
          id: voyageId,
          concurrencyVersion: input.expectedVersion,
          OR: [
            { captainAccountId: actor.accountId },
            { captainId: actor.accountId },
            ...(actor.legacyGameMasterId ? [{ captainId: actor.legacyGameMasterId }] : []),
          ],
        },
        data: { concurrencyVersion: { increment: 1 } },
      });
      if (!claimed.count)
        throw new CaptainParticipationError(
          "Voyage setup changed before this request. Refresh and review the current participation mode.",
          "STALE_STATE",
        );

      if (desiredMembership) {
        const live = mutableLiveStates.has(current.resource.status);
        const preservePrelaunchJoin = !live;
        const membership = await tx.playthroughMembership.upsert({
          where: {
            playthroughId_playerProfileId: {
              playthroughId: voyageId,
              playerProfileId: profile.id,
            },
          },
          update: {
            status: live ? "ACTIVE_MEMBER" : "READY",
            joinedAt: preservePrelaunchJoin ? (current.membership?.joinedAt ?? now) : now,
            removedAt: null,
          },
          create: {
            playthroughId: voyageId,
            playerProfileId: profile.id,
            status: live ? "ACTIVE_MEMBER" : "READY",
            joinedAt: now,
          },
        });
        await tx.platformAuditEvent.create({
          data: auditData({
            actor,
            action: "PLAYER_MEMBERSHIP_ADDED",
            resourceType: "PLAYTHROUGH_MEMBERSHIP",
            resourceId: membership.id,
            correlationId: input.idempotencyKey,
            metadata: {
              playthroughId: voyageId,
              source: "CAPTAIN_SELF_PARTICIPATION",
              lifecycle: current.resource.status,
            },
          }),
        });
      } else {
        if (!current.membership)
          throw new CaptainParticipationError(
            "This Voyage has no Player participation to remove.",
            "MEMBERSHIP_CONFLICT",
          );
        const membership = await tx.playthroughMembership.update({
          where: { id: current.membership.id },
          data: { status: "REMOVED", removedAt: now },
        });
        await tx.membershipPresenceDevice.updateMany({
          where: { playthroughMembershipId: membership.id, disconnectedAt: null },
          data: { disconnectedAt: now },
        });
        await tx.platformAuditEvent.create({
          data: auditData({
            actor,
            action: "PLAYER_MEMBERSHIP_REMOVED",
            resourceType: "PLAYTHROUGH_MEMBERSHIP",
            resourceId: membership.id,
            correlationId: input.idempotencyKey,
            metadata: {
              playthroughId: voyageId,
              source: "CAPTAIN_SELF_PARTICIPATION",
              lifecycle: current.resource.status,
            },
          }),
        });
      }
    });
  } catch (cause) {
    if (!(cause instanceof CaptainParticipationError)) throw cause;
    return rejectParticipationChange({
      voyageId,
      actor,
      mode: input.mode,
      idempotencyKey: input.idempotencyKey,
      reason: cause.message,
      code: cause.code,
    });
  }
  return { participation: await getCaptainParticipation(voyageId, actor), idempotent: false };
}

/**
 * Internal authority operation for integration owners. Phase 1 exposes no
 * owner-facing reassignment UI; keeping the operation here makes the
 * authority/membership independence executable and testable.
 */
export async function assignCaptainAuthority(input: {
  voyageId: string;
  captain: CanonicalCaptainActor;
  authorizedByAccountId: string;
  correlationId?: string;
}) {
  const current = await db.taleSession.findUnique({ where: { id: input.voyageId } });
  if (!current) throw new CaptainParticipationError("This Voyage is unavailable.", "VOYAGE_UNAVAILABLE");
  if ((current.captainAccountId || current.captainId) && !hasCaptainAuthority(current, input.captain))
    throw new CaptainParticipationError("This Voyage already has another Captain.", "AUTHORITY_CONFLICT");
  if (hasCaptainAuthority(current, input.captain)) return { idempotent: true };
  const correlationId = input.correlationId ?? randomUUID();
  await db.$transaction([
    db.taleSession.update({
      where: { id: input.voyageId },
      data: {
        captainAccountId: input.captain.accountId,
        captainId: input.captain.legacyGameMasterId ?? input.captain.accountId,
        concurrencyVersion: { increment: 1 },
      },
    }),
    db.platformAuditEvent.create({
      data: {
        actorType: "SYSTEM",
        actorId: input.authorizedByAccountId,
        actorAccountId: input.authorizedByAccountId,
        action: "CAPTAIN_AUTHORITY_ASSIGNED",
        resourceType: "PLAYTHROUGH",
        resourceId: input.voyageId,
        correlationId,
        metadata: JSON.stringify({ captainAccountId: input.captain.accountId }),
      },
    }),
  ]);
  return { idempotent: false };
}

export async function revokeCaptainAuthority(input: {
  voyageId: string;
  captain: CanonicalCaptainActor;
  authorizedByAccountId: string;
  correlationId?: string;
}) {
  const current = await db.taleSession.findUnique({ where: { id: input.voyageId } });
  if (!current) throw new CaptainParticipationError("This Voyage is unavailable.", "VOYAGE_UNAVAILABLE");
  if (!hasCaptainAuthority(current, input.captain)) return { idempotent: true };
  const correlationId = input.correlationId ?? randomUUID();
  await db.$transaction([
    db.taleSession.update({
      where: { id: input.voyageId },
      data: { captainAccountId: null, captainId: null, concurrencyVersion: { increment: 1 } },
    }),
    db.platformAuditEvent.create({
      data: {
        actorType: "SYSTEM",
        actorId: input.authorizedByAccountId,
        actorAccountId: input.authorizedByAccountId,
        action: "CAPTAIN_AUTHORITY_REVOKED",
        resourceType: "PLAYTHROUGH",
        resourceId: input.voyageId,
        correlationId,
        metadata: JSON.stringify({ captainAccountId: input.captain.accountId }),
      },
    }),
  ]);
  return { idempotent: false };
}

export async function establishCreatedCaptainParticipation(input: {
  tx: Prisma.TransactionClient;
  voyageId: string;
  captainAccountId: string;
  captainLegacyId: string | null;
  playerProfileId: string | null;
  mode: CaptainParticipationMode;
  joinedAt: Date;
  correlationId: string;
}) {
  await input.tx.platformAuditEvent.create({
    data: {
      actorType: "CAPTAIN",
      actorId: input.captainAccountId,
      actorAccountId: input.captainAccountId,
      action: "CAPTAIN_AUTHORITY_ASSIGNED",
      resourceType: "PLAYTHROUGH",
      resourceId: input.voyageId,
      correlationId: input.correlationId,
      metadata: JSON.stringify({ authoritySource: input.captainLegacyId ? "LEGACY_BRIDGE" : "CANONICAL_ACCOUNT" }),
    },
  });
  if (input.mode === "CAPTAIN_ONLY") return null;
  if (!input.playerProfileId)
    throw new CaptainParticipationError(
      "Captain + Player requires an active Player Profile on this account.",
      "MODE_CHANGE_NOT_ALLOWED",
    );
  const membership = await input.tx.playthroughMembership.upsert({
    where: {
      playthroughId_playerProfileId: {
        playthroughId: input.voyageId,
        playerProfileId: input.playerProfileId,
      },
    },
    update: {},
    create: {
      playthroughId: input.voyageId,
      playerProfileId: input.playerProfileId,
      status: "READY",
      joinedAt: input.joinedAt,
    },
  });
  await input.tx.platformAuditEvent.create({
    data: {
      actorType: "CAPTAIN",
      actorId: input.captainAccountId,
      actorAccountId: input.captainAccountId,
      action: "PLAYER_MEMBERSHIP_ADDED",
      resourceType: "PLAYTHROUGH_MEMBERSHIP",
      resourceId: membership.id,
      correlationId: input.correlationId,
      metadata: JSON.stringify({
        playthroughId: input.voyageId,
        source: "CAPTAIN_SELF_PARTICIPATION",
        lifecycle: "SETUP",
      }),
    },
  });
  return membership;
}
