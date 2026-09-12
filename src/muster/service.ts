import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hasCaptainAuthority, type CanonicalCaptainActor } from "@/chronicle/captain-authorization";
import { workspaceCapabilityOverview } from "@/homeport/workspace-capabilities";
import { aggregateMembershipPresence } from "@/platform/membership-presence";
import { parsePublishedSnapshot } from "@/chronicle/publishing";
import { MUSTER_COVER_FALLBACK, type MusterProjection } from "./contracts";

export const joinedMembershipStates = ["ACCEPTED", "READY", "ACTIVE_MEMBER"];
const terminalStates = ["CANCELLED", "COMPLETED", "ABANDONED"];
export class MusterError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}
export async function loadMusterAccess(
  voyageId: string,
  actor: CanonicalCaptainActor,
  client: Prisma.TransactionClient = db,
  roomOnlyAccess = false,
) {
  const voyage = await client.taleSession.findUnique({
    where: { id: voyageId },
    include: {
      tale: true,
      version: true,
      captainAccount: { include: { profile: { include: { avatarMedia: true } } } },
      memberships: {
        include: { player: { include: { avatarMedia: true } }, presenceDevices: true },
        orderBy: { createdAt: "asc" },
      },
      invitations: { include: { replacement: { select: { id: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!voyage || voyage.previewMode) throw new MusterError("This Voyage is unavailable.");
  const isCaptain = voyage.captainAuthorityState === "ASSIGNED" && hasCaptainAuthority(voyage, actor);
  const membership = voyage.memberships.find(
    (m) =>
      m.player.accountId === actor.accountId &&
      (joinedMembershipStates.includes(m.status) ||
        (roomOnlyAccess && ["INVITED", "COMPLETED_MEMBER"].includes(m.status))),
  );
  if (!isCaptain && !membership) throw new MusterError("Current Crew membership or Captain authority is required.");
  return { voyage, isCaptain, membership };
}
type Media = { id: string; removedAt: Date | null; processingState: string; scanState: string };
export function avatarUrl(media: Media | null | undefined) {
  return media && !media.removedAt && media.processingState === "READY" && media.scanState === "LOCAL_VALIDATED"
    ? `/api/profile-media/${media.id}`
    : null;
}
export async function getMusterProjection(
  voyageId: string,
  actor: CanonicalCaptainActor,
): Promise<Omit<MusterProjection, "csrfToken">> {
  const { voyage, isCaptain, membership } = await loadMusterAccess(voyageId, actor, db, true);
  const participating = Boolean(membership && joinedMembershipStates.includes(membership.status));
  const captainWorkspace =
    isCaptain &&
    (await workspaceCapabilityOverview(actor.accountId)).workspaces.some(
      (w) => w.id === "CAPTAIN" && w.state === "ACTIVE",
    );
  const snapshot = voyage.version ? parsePublishedSnapshot(voyage.version.contentSnapshot) : null;
  const participants = voyage.memberships.filter((m) => ["INVITED", ...joinedMembershipStates].includes(m.status));
  const ready = participants.filter((m) => ["READY", "ACTIVE_MEMBER"].includes(m.status)).length;
  const captainMember = voyage.memberships.find(
    (m) =>
      m.player.accountId && hasCaptainAuthority(voyage, { accountId: m.player.accountId, legacyGameMasterId: null }),
  );
  const captainProfile = voyage.captainAccount?.profile ?? captainMember?.player;
  const legacyCaptain =
    !captainProfile && voyage.captainId
      ? await db.gameMasterUser.findUnique({ where: { id: voyage.captainId }, select: { username: true } })
      : null;
  const captainName =
    voyage.captainAuthorityState === "VACANT"
      ? "Captaincy vacant"
      : (captainProfile?.displayName ?? legacyCaptain?.username ?? "Captain");
  const crew: MusterProjection["crew"] = voyage.memberships.map((m) => {
    const invitation = voyage.invitations.find((i) => i.intendedPlayerId === m.playerProfileId && !i.replacement);
    const participates = joinedMembershipStates.includes(m.status);
    const captain =
      voyage.captainAuthorityState === "ASSIGNED" &&
      Boolean(m.player.accountId) &&
      hasCaptainAuthority(voyage, { accountId: m.player.accountId!, legacyGameMasterId: null });
    return {
      id: m.id,
      displayName: m.participationAlias ?? m.player.displayName,
      avatarUrl: avatarUrl(m.player.avatarMedia),
      isCaptain: captain,
      isCurrentPlayer: m.id === membership?.id,
      participates,
      status: m.status,
      ready: ["READY", "ACTIVE_MEMBER"].includes(m.status),
      presence: participates ? aggregateMembershipPresence(m.presenceDevices, voyage.currentSequence).state : "UNKNOWN",
      canReceiveCaptaincy: Boolean(captainWorkspace && membership && participates && !captain && m.player.accountId),
      invitation: invitation
        ? {
            id: invitation.id,
            canManage: Boolean(captainWorkspace && ["CREATED", "SENT", "COPIED", "VIEWED"].includes(invitation.status)),
          }
        : null,
    };
  });
  if (voyage.captainAuthorityState === "ASSIGNED" && !crew.some((m) => m.isCaptain))
    crew.unshift({
      id: "captain",
      displayName: captainName,
      avatarUrl: avatarUrl(captainProfile?.avatarMedia),
      isCaptain: true,
      isCurrentPlayer: false,
      participates: false,
      status: "CAPTAIN_ONLY",
      ready: false,
      presence: "UNKNOWN",
      canReceiveCaptaincy: false,
      invitation: null,
    });
  const active = !terminalStates.includes(voyage.status);
  return {
    voyage: {
      id: voyage.id,
      title: snapshot?.tale.title ?? voyage.tale.title,
      subtitle: snapshot?.tale.subtitle ?? voyage.tale.subtitle,
      description: snapshot?.tale.shortDescription ?? voyage.tale.shortDescription,
      voyageName: voyage.voyageName ?? voyage.ownerLabel ?? "Voyage",
      edition: voyage.version?.versionLabel ?? "Unpublished",
      status: voyage.status,
      authorityState: voyage.captainAuthorityState,
      captainName,
      duration: snapshot?.tale.estimatedDuration ?? voyage.tale.estimatedDuration,
      coverUrl:
        voyage.tale.coverAssetId || snapshot?.tale.coverAssetId
          ? `/api/voyages/${voyage.id}/muster/cover`
          : MUSTER_COVER_FALLBACK,
      concurrencyVersion: voyage.concurrencyVersion,
      currentSequence: voyage.currentSequence,
      plannedStartAt: voyage.plannedStartAt?.toISOString() ?? null,
    },
    viewer: {
      isCaptain,
      participates: participating,
      membershipId: participating ? membership!.id : null,
      ready: membership?.status === "READY" || membership?.status === "ACTIVE_MEMBER",
      // Match One Voyage's existing launch gate; unanimous readiness is informational.
      canLaunch: Boolean(
        captainWorkspace &&
          voyage.version &&
          ["READY", "SCHEDULED"].includes(voyage.status) &&
          (voyage.memberships.length === 0 || voyage.memberships.some((m) => m.status === "READY")),
      ),
      canRelinquish: Boolean(captainWorkspace && active),
      canLeave: Boolean(
        participating &&
          active &&
          !(isCaptain && participants.filter((m) => joinedMembershipStates.includes(m.status)).length === 1),
      ),
      canTakeCaptaincy: Boolean(participating && active && voyage.captainAuthorityState === "VACANT"),
      canContinueSolo: Boolean(
        participating &&
          active &&
          !(isCaptain && participants.filter((m) => joinedMembershipStates.includes(m.status)).length === 1),
      ),
      runtimeHref:
        (participating && ["ACTIVE", "PAUSED"].includes(voyage.status) && voyage.captainAuthorityState !== "VACANT") ||
        (membership?.status === "COMPLETED_MEMBER" && voyage.status === "COMPLETED")
          ? `/player/playthroughs/${voyage.id}/journal`
          : null,
    },
    readiness: { ready, total: participants.length, allReady: ready === participants.length },
    crew,
  };
}
