import { CommunityError } from "@/community/domain";
import { db } from "@/lib/db";

export const harborlightVoyageLogPublicationPurpose = "HARBORLIGHT_VOYAGE_LOG_PUBLICATION" as const;
export const voyageLogConsentStates = [
  "NOT_REQUIRED",
  "PENDING",
  "APPROVED",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
] as const;
export const voyageLogConsentScopes = [
  "DISPLAY_NAME",
  "ALIAS",
  "AVATAR",
  "QUOTE",
  "PHOTO",
  "AUDIO",
  "OTHER_MEDIA",
] as const;
export type VoyageLogConsentState = (typeof voyageLogConsentStates)[number];
export type VoyageLogConsentScope = (typeof voyageLogConsentScopes)[number];

export function publicationConsentKey(scope: VoyageLogConsentScope) {
  return `${harborlightVoyageLogPublicationPurpose}:${scope}`;
}

export function activePublicationConsent(
  input: {
    purpose: string;
    state?: string | null;
    grantedAt?: Date | null;
    revokedAt?: Date | null;
    expiresAt?: Date | null;
  },
  now = new Date(),
) {
  return (
    input.purpose.startsWith(`${harborlightVoyageLogPublicationPurpose}:`) &&
    input.state === "APPROVED" &&
    !!input.grantedAt &&
    !input.revokedAt &&
    (!input.expiresAt || input.expiresAt > now)
  );
}

function missing(): never {
  throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
}

async function ownedLog(ownerAccountId: string, voyageLogId: string) {
  const log = await db.communityVoyageLog.findUnique({
    where: { id: voyageLogId },
    select: { id: true, ownerAccountId: true, lifecycleState: true },
  });
  if (!log || log.ownerAccountId !== ownerAccountId) return missing();
  return log;
}

async function participantForActor(voyageLogId: string, accountId: string) {
  const participant = await db.communityVoyageLogParticipant.findFirst({
    where: { voyageLogId, accountId },
    select: { id: true, voyageLogId: true, accountId: true },
  });
  if (!participant) return missing();
  return participant;
}

export async function requestVoyageLogPublicationConsent(input: {
  ownerAccountId: string;
  voyageLogId: string;
  participantId: string;
  scopes: readonly VoyageLogConsentScope[];
  expiresAt?: Date;
}) {
  const log = await ownedLog(input.ownerAccountId, input.voyageLogId);
  const participant = await db.communityVoyageLogParticipant.findFirst({
    where: { id: input.participantId, voyageLogId: log.id },
    select: { id: true, accountId: true },
  });
  if (!participant?.accountId) return missing();
  const scopes = [...new Set(input.scopes)];
  if (!scopes.length || scopes.some((scope) => !voyageLogConsentScopes.includes(scope)))
    throw new CommunityError("COMMUNITY_INVALID_CONSENT", "At least one valid publication scope is required.");
  if (input.expiresAt && input.expiresAt <= new Date())
    throw new CommunityError("COMMUNITY_INVALID_CONSENT", "Consent expiry must be in the future.");

  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const scope of scopes) {
      const purpose = publicationConsentKey(scope);
      await tx.communityVoyageLogParticipantConsent.upsert({
        where: { voyageLogId_participantId_purpose: { voyageLogId: log.id, participantId: participant.id, purpose } },
        update: {
          state: "PENDING",
          requestedAt: now,
          expiresAt: input.expiresAt ?? null,
          grantedAt: null,
          revokedAt: null,
        },
        create: {
          voyageLogId: log.id,
          participantId: participant.id,
          purpose,
          state: "PENDING",
          requestedAt: now,
          expiresAt: input.expiresAt ?? null,
        },
      });
      await tx.communityVoyageLogConsentAudit.create({
        data: {
          voyageLogId: log.id,
          participantId: participant.id,
          actorAccountId: input.ownerAccountId,
          purpose,
          action: "REQUESTED",
          state: "PENDING",
        },
      });
    }
    await tx.communityVoyageLog.update({
      where: { id: log.id },
      data: {
        lifecycleState: "CONSENT_PENDING",
        consentRevision: { increment: 1 },
        searchIndexedAt: null,
        openGraphInvalidatedAt: now,
      },
    });
  });
  return { voyageLogId: log.id, participantId: participant.id, state: "PENDING" as const, scopes };
}

export async function respondToVoyageLogPublicationConsent(input: {
  accountId: string;
  voyageLogId: string;
  scope: VoyageLogConsentScope;
  decision: "APPROVED" | "DECLINED";
}) {
  const participant = await participantForActor(input.voyageLogId, input.accountId);
  const purpose = publicationConsentKey(input.scope);
  const existing = await db.communityVoyageLogParticipantConsent.findUnique({
    where: {
      voyageLogId_participantId_purpose: { voyageLogId: input.voyageLogId, participantId: participant.id, purpose },
    },
    select: { state: true, expiresAt: true },
  });
  if (!existing || existing.state !== "PENDING" || (existing.expiresAt && existing.expiresAt <= new Date()))
    throw new CommunityError("COMMUNITY_CONSENT_NOT_PENDING", "This publication consent is not available to answer.");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.communityVoyageLogParticipantConsent.update({
      where: {
        voyageLogId_participantId_purpose: { voyageLogId: input.voyageLogId, participantId: participant.id, purpose },
      },
      data: { state: input.decision, grantedAt: input.decision === "APPROVED" ? now : null, revokedAt: null },
    });
    await tx.communityVoyageLogConsentAudit.create({
      data: {
        voyageLogId: input.voyageLogId,
        participantId: participant.id,
        actorAccountId: input.accountId,
        purpose,
        action: "RESPONDED",
        state: input.decision,
      },
    });
    if (input.decision === "DECLINED") {
      await tx.communityVoyageLog.update({
        where: { id: input.voyageLogId },
        data: {
          lifecycleState: "CONSENT_REVIEW_REQUIRED",
          consentRevision: { increment: 1 },
          publishedAt: null,
          searchIndexedAt: null,
          openGraphInvalidatedAt: now,
        },
      });
    }
  });
  return { voyageLogId: input.voyageLogId, scope: input.scope, state: input.decision };
}

/** Revocation is subject-controlled and deliberately tears down every public projection. */
export async function revokeVoyageLogPublicationConsent(input: {
  accountId: string;
  voyageLogId: string;
  scope: VoyageLogConsentScope;
}) {
  const participant = await participantForActor(input.voyageLogId, input.accountId);
  const purpose = publicationConsentKey(input.scope);
  const existing = await db.communityVoyageLogParticipantConsent.findUnique({
    where: {
      voyageLogId_participantId_purpose: { voyageLogId: input.voyageLogId, participantId: participant.id, purpose },
    },
    select: { state: true },
  });
  if (!existing) return missing();
  if (existing.state === "REVOKED")
    return { voyageLogId: input.voyageLogId, scope: input.scope, state: "REVOKED" as const, idempotent: true };
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.communityVoyageLogParticipantConsent.update({
      where: {
        voyageLogId_participantId_purpose: { voyageLogId: input.voyageLogId, participantId: participant.id, purpose },
      },
      data: { state: "REVOKED", revokedAt: now },
    });
    await tx.communityVoyageLogConsentAudit.create({
      data: {
        voyageLogId: input.voyageLogId,
        participantId: participant.id,
        actorAccountId: input.accountId,
        purpose,
        action: "REVOKED",
        state: "REVOKED",
      },
    });
    await tx.communityVoyageLog.update({
      where: { id: input.voyageLogId },
      data: {
        lifecycleState: "CONSENT_REVIEW_REQUIRED",
        consentRevision: { increment: 1 },
        publishedAt: null,
        searchIndexedAt: null,
        openGraphInvalidatedAt: now,
      },
    });
  });
  return { voyageLogId: input.voyageLogId, scope: input.scope, state: "REVOKED" as const, idempotent: false };
}

export async function readOwnerVoyageLogConsentDashboard(ownerAccountId: string, voyageLogId: string) {
  const log = await ownedLog(ownerAccountId, voyageLogId);
  const [participants, consents] = await Promise.all([
    db.communityVoyageLogParticipant.findMany({
      where: { voyageLogId: log.id },
      select: { id: true, displayNameSnapshot: true, isChild: true },
      orderBy: { id: "asc" },
    }),
    db.communityVoyageLogParticipantConsent.findMany({
      where: { voyageLogId: log.id, purpose: { startsWith: `${harborlightVoyageLogPublicationPurpose}:` } },
      select: {
        participantId: true,
        purpose: true,
        state: true,
        requestedAt: true,
        expiresAt: true,
        grantedAt: true,
        revokedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return {
    voyageLogId: log.id,
    lifecycleState: log.lifecycleState,
    participants: participants.map((participant) => ({
      id: participant.id,
      displayName: participant.isChild ? "Protected participant" : participant.displayNameSnapshot,
      protected: participant.isChild,
      consents: consents
        .filter((consent) => consent.participantId === participant.id)
        .map((consent) => ({
          scope: consent.purpose.slice(`${harborlightVoyageLogPublicationPurpose}:`.length),
          state: consent.state,
          requestedAt: consent.requestedAt,
          expiresAt: consent.expiresAt,
          grantedAt: consent.grantedAt,
          revokedAt: consent.revokedAt,
        })),
    })),
  };
}

export async function readParticipantVoyageLogConsentInbox(accountId: string) {
  const participants = await db.communityVoyageLogParticipant.findMany({
    where: { accountId },
    select: { id: true, voyageLogId: true },
  });
  if (!participants.length) return [];
  const consents = await db.communityVoyageLogParticipantConsent.findMany({
    where: {
      participantId: { in: participants.map((participant) => participant.id) },
      purpose: { startsWith: `${harborlightVoyageLogPublicationPurpose}:` },
    },
    select: { voyageLogId: true, participantId: true, purpose: true, state: true, expiresAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return consents.map((consent) => ({
    voyageLogId: consent.voyageLogId,
    scope: consent.purpose.slice(`${harborlightVoyageLogPublicationPurpose}:`.length),
    state: consent.state,
    expiresAt: consent.expiresAt,
  }));
}
