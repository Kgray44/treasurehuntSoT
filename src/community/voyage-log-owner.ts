import { createHash } from "node:crypto";
import { CommunityError, stableJson } from "./domain";
import { assertVoyageLogTransition, type VoyageLogLifecycleState } from "./voyage-log-lifecycle";
import { voyageLogVisibilities, type VoyageLogVisibility } from "./keepsakes";
import { assertVoyageLogPublishable } from "./voyage-log-lifecycle";
import type { HarborlightKeepsakeSource } from "./wayfarer-keepsake-source";
import { db } from "@/lib/db";

function safeText(value: string, field: string, max: number) {
  const text = value.normalize("NFKC").trim();
  if (!text || text.length > max || /[\u0000-\u001f\u007f-\u009f]/u.test(text))
    throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", `${field} is invalid.`);
  return text;
}

function draftTitle(snapshot: string) {
  try {
    const value = JSON.parse(snapshot) as { title?: unknown };
    if (typeof value.title === "string") return safeText(value.title, "Voyage Log title", 140);
  } catch {}
  return "Untitled Voyage Log";
}

/** Creates only Harborlight's editable publication record from already verified preparation provenance. */
export async function ensureVoyageLogDraft(input: { ownerAccountId: string; keepsakeId: string }) {
  const keepsake = await db.communityVoyageKeepsake.findFirst({
    where: { id: input.keepsakeId, ownerAccountId: input.ownerAccountId, preparationState: "DRAFT_CREATED" },
    select: { id: true, safeSnapshot: true },
  });
  if (!keepsake) throw new CommunityError("COMMUNITY_KEEPSAKE_NOT_AVAILABLE", "Voyage Log preparation was not found.");
  const existing = await db.communityVoyageLog.findUnique({ where: { keepsakeId: keepsake.id } });
  if (existing) return existing;
  return db.communityVoyageLog.create({
    data: {
      keepsakeId: keepsake.id,
      ownerAccountId: input.ownerAccountId,
      slug: `voyage-${keepsake.id.slice(-18).toLowerCase()}`,
      title: draftTitle(keepsake.safeSnapshot),
      visibility: "PRIVATE",
      lifecycleState: "DRAFT",
    },
  });
}

export async function editVoyageLogDraft(input: {
  ownerAccountId: string;
  voyageLogId: string;
  expectedUpdatedAt: Date;
  title: string;
  safeSummary?: string | null;
  visibility: VoyageLogVisibility;
  spoilerLevel: "NONE" | "PREVIEW_SAFE" | "MINOR" | "CHAPTER" | "FINALE";
  approximateLocation?: string | null;
}) {
  if (!voyageLogVisibilities.includes(input.visibility))
    throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", "Visibility is invalid.");
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
  });
  if (!log || log.lifecycleState === "REMOVED")
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const changingPublished = log.lifecycleState === "PUBLISHED";
  const lifecycleState = changingPublished ? "CONSENT_REVIEW_REQUIRED" : log.lifecycleState;
  return db.$transaction(async (tx) => {
    const update = {
      title: safeText(input.title, "Voyage Log title", 140),
      safeSummary: input.safeSummary ? safeText(input.safeSummary, "Voyage Log summary", 280) : null,
      visibility: input.visibility,
      spoilerLevel: input.spoilerLevel,
      approximateLocation: input.approximateLocation
        ? safeText(input.approximateLocation, "Approximate location", 140)
        : null,
      lifecycleState,
      ...(changingPublished
        ? {
            publishedAt: null,
            searchIndexedAt: null,
            openGraphInvalidatedAt: new Date(),
            consentRevision: { increment: 1 },
          }
        : {}),
    };
    // Never overwrite a newer editor's correction. `updatedAt` is returned only
    // on the owner's private endpoint and acts as the edit revision token.
    const result = await tx.communityVoyageLog.updateMany({
      where: { id: log.id, ownerAccountId: input.ownerAccountId, updatedAt: input.expectedUpdatedAt },
      data: update,
    });
    if (result.count !== 1)
      throw new CommunityError("COMMUNITY_VOYAGE_LOG_CONFLICT", "This Voyage Log changed. Reload it before saving.");
    const updated = await tx.communityVoyageLog.findUnique({ where: { id: log.id } });
    if (!updated) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
    return updated;
  });
}

/** Private editor projection; it intentionally excludes the upstream opaque source and media references. */
export async function readOwnedVoyageLog(input: { ownerAccountId: string; voyageLogId: string }) {
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
    select: {
      id: true,
      slug: true,
      title: true,
      safeSummary: true,
      visibility: true,
      spoilerLevel: true,
      approximateLocation: true,
      lifecycleState: true,
      verifiedCompletion: true,
      consentRevision: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  if (!log) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const [participants, restrictions] = await Promise.all([
    db.communityVoyageLogParticipant.findMany({
      where: { voyageLogId: log.id },
      select: { id: true, displayNameSnapshot: true, isChild: true },
      orderBy: { id: "asc" },
    }),
    db.communityVoyageLogShareRestriction.findMany({
      where: { voyageLogId: log.id },
      select: { restrictionType: true },
      orderBy: { restrictionType: "asc" },
    }),
  ]);
  return { ...log, participants, restrictions: restrictions.map((restriction) => restriction.restrictionType) };
}

export async function addOwnedVoyageLogParticipant(input: {
  ownerAccountId: string;
  voyageLogId: string;
  accountId?: string | null;
  displayName: string;
}) {
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
    select: { id: true, lifecycleState: true },
  });
  if (!log || log.lifecycleState === "REMOVED")
    throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const displayNameSnapshot = safeText(input.displayName, "Participant display name", 140);
  const accountId = input.accountId ? safeText(input.accountId, "Participant account ID", 128) : null;
  if (accountId === input.ownerAccountId)
    throw new CommunityError("COMMUNITY_INVALID_VOYAGE_LOG", "The owner is already represented by the Voyage Log.");
  return db.$transaction(async (tx) => {
    const participant = await tx.communityVoyageLogParticipant.create({
      data: { voyageLogId: log.id, accountId, displayNameSnapshot },
      select: { id: true, displayNameSnapshot: true, isChild: true },
    });
    await tx.communityVoyageLog.update({
      where: { id: log.id },
      data: {
        lifecycleState: "CONSENT_PENDING",
        verifiedCompletion: false,
        publishedAt: null,
        searchIndexedAt: null,
        openGraphInvalidatedAt: new Date(),
        consentRevision: { increment: 1 },
      },
    });
    return participant;
  });
}

export async function removeOwnedVoyageLogParticipant(input: {
  ownerAccountId: string;
  voyageLogId: string;
  participantId: string;
}) {
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
    select: { id: true },
  });
  if (!log) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const participant = await db.communityVoyageLogParticipant.findFirst({
    where: { id: input.participantId, voyageLogId: log.id },
    select: { id: true },
  });
  if (!participant) throw new CommunityError("COMMUNITY_PARTICIPANT_NOT_FOUND", "Participant not found.");
  await db.$transaction(async (tx) => {
    await tx.communityVoyageLogParticipantConsent.deleteMany({
      where: { voyageLogId: log.id, participantId: participant.id },
    });
    await tx.communityVoyageLogParticipant.delete({ where: { id: participant.id } });
    await tx.communityVoyageLog.update({
      where: { id: log.id },
      data: {
        lifecycleState: "CONSENT_REVIEW_REQUIRED",
        verifiedCompletion: false,
        publishedAt: null,
        searchIndexedAt: null,
        openGraphInvalidatedAt: new Date(),
        consentRevision: { increment: 1 },
      },
    });
  });
}

export async function transitionOwnedVoyageLog(input: {
  ownerAccountId: string;
  voyageLogId: string;
  to: VoyageLogLifecycleState;
}) {
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
  });
  if (!log) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  assertVoyageLogTransition(log.lifecycleState as VoyageLogLifecycleState, input.to);
  return db.communityVoyageLog.update({
    where: { id: log.id },
    data: {
      lifecycleState: input.to,
      ...(input.to === "ARCHIVED" || input.to === "REMOVED"
        ? { publishedAt: null, searchIndexedAt: null, openGraphInvalidatedAt: new Date() }
        : {}),
    },
  });
}

export function voyageLogProjectionChecksum(input: {
  slug: string;
  title: string;
  safeSummary?: string | null;
  visibility: string;
  spoilerLevel: string;
  approximateLocation?: string | null;
}) {
  return createHash("sha256").update(stableJson(input)).digest("hex");
}

/** Revalidates the upstream watermark before a single atomic public-state transition. */
export async function publishVoyageLog(input: {
  ownerAccountId: string;
  voyageLogId: string;
  source: HarborlightKeepsakeSource;
}) {
  const log = await db.communityVoyageLog.findFirst({
    where: { id: input.voyageLogId, ownerAccountId: input.ownerAccountId },
  });
  if (!log) throw new CommunityError("COMMUNITY_VOYAGE_LOG_NOT_FOUND", "Voyage Log not found.");
  const keepsake = await db.communityVoyageKeepsake.findFirst({
    where: { id: log.keepsakeId, ownerAccountId: input.ownerAccountId },
    select: {
      wayfarerKeepsakeId: true,
      sourceWatermark: true,
      sourceProjectionChecksum: true,
      publishedVersionId: true,
    },
  });
  if (!keepsake?.wayfarerKeepsakeId || !keepsake.sourceWatermark || !keepsake.sourceProjectionChecksum)
    throw new CommunityError("COMMUNITY_KEEPSAKE_SOURCE_STALE", "Voyage Log provenance is incomplete.");
  const verified = await input.source.verifySourceWatermark({
    ownerAccountId: input.ownerAccountId,
    sourceKeepsakeId: keepsake.wayfarerKeepsakeId,
    sourceWatermark: keepsake.sourceWatermark,
    sourceProjectionChecksum: keepsake.sourceProjectionChecksum,
  });
  const [restrictions, participants, participantConsents, media] = await Promise.all([
    db.communityVoyageLogShareRestriction.findMany({
      where: { voyageLogId: log.id },
      select: { restrictionType: true },
    }),
    db.communityVoyageLogParticipant.findMany({
      where: { voyageLogId: log.id },
      select: { id: true, displayNameSnapshot: true, isChild: true },
    }),
    db.communityVoyageLogParticipantConsent.findMany({
      where: { voyageLogId: log.id },
      select: { participantId: true, purpose: true, state: true, grantedAt: true, revokedAt: true },
    }),
    db.communityVoyageLogMedia.findMany({
      where: { voyageLogId: log.id },
      select: { id: true, derivativeChecksum: true, processingStatus: true, scanStatus: true, exifGpsRemoved: true },
    }),
  ]);
  const mediaConsents = media.length
    ? await db.communityVoyageLogMediaConsent.findMany({
        where: { voyageLogMediaId: { in: media.map((item) => item.id) } },
        select: { voyageLogMediaId: true, purpose: true, grantedAt: true, revokedAt: true },
      })
    : [];
  const participantInput = participants.map((participant) => ({
    id: participant.id,
    displayNameSnapshot: participant.displayNameSnapshot,
    isChild: participant.isChild,
    consents: participantConsents
      .filter((consent) => consent.participantId === participant.id)
      .map((consent) => ({
        purpose:
          consent.purpose.endsWith(":DISPLAY_NAME") && consent.state === "APPROVED"
            ? "DISPLAY_IN_LOG"
            : consent.purpose,
        grantedAt: consent.grantedAt,
        revokedAt: consent.revokedAt,
      })),
  }));
  const mediaInput = media.map((item) => ({
    ...item,
    consents: mediaConsents
      .filter((consent) => consent.voyageLogMediaId === item.id)
      .map((consent) => ({ purpose: consent.purpose, grantedAt: consent.grantedAt, revokedAt: consent.revokedAt })),
  }));
  const checksum = voyageLogProjectionChecksum(log);
  assertVoyageLogPublishable({
    visibility: log.visibility as VoyageLogVisibility,
    restrictions: restrictions.map((item) => item.restrictionType) as never,
    participants: participantInput,
    media: mediaInput,
    sourceProvenanceVerified: verified.valid,
    sourceWatermarkUnchanged: verified.sourceWatermark === keepsake.sourceWatermark,
    sourceChecksumUnchanged: verified.sourceProjectionChecksum === keepsake.sourceProjectionChecksum,
    publishedTaleVersionId: keepsake.publishedVersionId,
    projectionChecksum: checksum,
    searchEligible: log.visibility === "COMMUNITY",
    openGraphEligible: log.visibility === "COMMUNITY",
  });
  return db.$transaction((tx) =>
    tx.communityVoyageLog.update({
      where: { id: log.id },
      data: {
        lifecycleState: "PUBLISHED",
        verifiedCompletion: true,
        projectionChecksum: checksum,
        publishedAt: new Date(),
        searchIndexedAt: log.visibility === "COMMUNITY" ? new Date() : null,
        openGraphInvalidatedAt: null,
      },
    }),
  );
}
