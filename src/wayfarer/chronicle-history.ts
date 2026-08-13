import { createHash } from "node:crypto";
import { z } from "zod";
import { parsePublishedSnapshot, type PublishedTaleSnapshot } from "@/chronicle/types";
import { db } from "@/lib/db";

export const TIMING_DEFINITION_VERSION = "WAYFARER_TIMING_V1";
const completedStatuses = new Set(["COMPLETED", "COMPLETED_MEMBER"]);
const terminalStatuses = new Set(["DECLINED", "EXPIRED", "REVOKED", "REMOVED", "ABANDONED", "COMPLETED"]);
const safeEventTypes = new Set(["chapterCompleted", "blockCompleted", "artifactGranted", "sessionCompleted"]);
const chapterSummarySchema = z.array(
  z
    .object({
      schemaVersion: z.literal(1),
      blockId: z.string(),
      chapterId: z.string(),
      title: z.string(),
      completedAt: z.string().datetime(),
      sourceSequence: z.number().int().nonnegative(),
      accuracy: z.enum(["EXACT", "UNAVAILABLE"]),
    })
    .strict(),
);
const unavailableSummarySchema = z.array(z.object({ schemaVersion: z.literal(1), reason: z.string() }).strict());
const artifactSummarySchema = z.array(
  z
    .object({
      schemaVersion: z.literal(1),
      artifactId: z.string(),
      name: z.string(),
      sourceBlockId: z.string(),
      eventType: z.literal("artifactGranted"),
      revealedAt: z.string().datetime(),
      sourceSequence: z.number().int().nonnegative(),
      classification: z.literal("SHARED_VOYAGE_ARTIFACT"),
    })
    .strict(),
);
const keepsakePayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    generationVersion: z.literal("WAYFARER_KEEPSAKE_V1"),
    chronicle: z.object({ title: z.string(), cover: z.string().nullable(), versionChecksum: z.string() }).strict(),
    outcome: z.string(),
    completedAt: z.string().datetime().nullable(),
    chapters: chapterSummarySchema,
    artifacts: artifactSummarySchema,
    reflection: z.object({ privateNote: z.string().nullable() }).strict().nullable(),
    crew: z.array(z.object({ name: z.string(), role: z.string(), crewRole: z.string().nullable() }).strict()),
    generatedAt: z.string().datetime(),
  })
  .strict();

const memorySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(4000).optional(),
    referenceType: z.enum(["CHAPTER", "CLUE", "MOMENT", "ARTIFACT"]).optional(),
    referenceId: z.string().trim().min(1).max(191).optional(),
  })
  .refine(
    (value) => Boolean(value.referenceType) === Boolean(value.referenceId),
    "A Memory reference needs both a type and a historical target.",
  )
  .strict();
const reflectionSchema = z
  .object({
    favoriteChapterId: z.string().trim().max(191).nullable().optional(),
    favoriteClueReference: z.string().trim().max(191).nullable().optional(),
    favoriteMomentReference: z.string().trim().max(191).nullable().optional(),
    favoriteArtifactReference: z.string().trim().max(191).nullable().optional(),
    privateNote: z.string().trim().max(4000).nullable().optional(),
  })
  .strict();

function sha(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function nonNegativeSeconds(start?: Date | null, end?: Date | null) {
  if (!start || !end || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}
export function derivePersonalTiming(
  sessionStartedAt: Date | null,
  membershipJoinedAt: Date | null,
  personalCompletedAt: Date | null,
) {
  const personalStart =
    sessionStartedAt && membershipJoinedAt
      ? new Date(Math.max(+sessionStartedAt, +membershipJoinedAt))
      : (sessionStartedAt ?? membershipJoinedAt);
  const wallClockSeconds = nonNegativeSeconds(personalStart, personalCompletedAt);
  return {
    wallClockSeconds,
    wallClockAccuracy: wallClockSeconds === null ? "UNAVAILABLE" : "EXACT",
    activeSeconds: null,
    pausedSeconds: null,
    connectedSeconds: null,
    interactiveSeconds: null,
    captainWaitSeconds: null,
    activeAccuracy: "UNAVAILABLE",
    pausedAccuracy: "UNAVAILABLE",
    connectedAccuracy: "UNAVAILABLE",
    interactiveAccuracy: "UNAVAILABLE",
    captainWaitAccuracy: "UNAVAILABLE",
  };
}
export function deriveHistoryLifecycle(membershipStatus: string, sessionStatus: string) {
  if (["REMOVED", "LEFT"].includes(membershipStatus)) return "REMOVED";
  if (membershipStatus === "DECLINED") return "DECLINED";
  if (membershipStatus === "SUSPENDED") return "SUSPENDED";
  if (
    completedStatuses.has(membershipStatus) ||
    (sessionStatus === "COMPLETED" && ["READY", "ACTIVE_MEMBER"].includes(membershipStatus))
  )
    return "COMPLETED";
  if (sessionStatus === "ABANDONED") return "ABANDONED";
  return membershipStatus;
}

export function derivePersonalCompletionAt(
  membershipStatus: string,
  membershipCompletedAt: Date | null,
  sessionStatus: string,
  sessionCompletedAt: Date | null,
) {
  if (membershipCompletedAt) return membershipCompletedAt;
  return deriveHistoryLifecycle(membershipStatus, sessionStatus) === "COMPLETED" ? sessionCompletedAt : null;
}

export function eventsWithinMembership<T extends { createdAt: Date }>(
  events: T[],
  membership: { joinedAt: Date | null; removedAt: Date | null },
) {
  return events.filter(
    (event) =>
      (!membership.joinedAt || event.createdAt >= membership.joinedAt) &&
      (!membership.removedAt || event.createdAt < membership.removedAt),
  );
}
function outcome(status: string, snapshot: PublishedTaleSnapshot, finalBlockId: string | null) {
  if (status === "COMPLETED") {
    const finalBlock = snapshot.chapters
      .flatMap((chapter) => chapter.blocks)
      .find((block) => block.id === finalBlockId);
    return finalBlock ? `COMPLETED:${finalBlock.id}` : "COMPLETED";
  }
  if (status === "ABANDONED") return "ABANDONED";
  if (["REMOVED", "DECLINED", "EXPIRED", "REVOKED", "CANCELLED"].includes(status)) return status;
  return "UNAVAILABLE";
}

export function summarizeHistoricalEvents(
  snapshot: PublishedTaleSnapshot,
  events: Array<{ id: string; eventType: string; blockId: string | null; sequence: number; createdAt: Date }>,
) {
  const selected = events.filter((event) => safeEventTypes.has(event.eventType));
  const blocks = new Map(
    snapshot.chapters.flatMap((chapter) => chapter.blocks.map((block) => [block.id, { block, chapter }] as const)),
  );
  const chapters = selected.flatMap((event) => {
    if (event.eventType !== "chapterCompleted" || !event.blockId) return [];
    const reference = blocks.get(event.blockId);
    return reference
      ? [
          {
            schemaVersion: 1 as const,
            blockId: event.blockId,
            chapterId: reference.chapter.id,
            title: reference.chapter.title,
            completedAt: event.createdAt.toISOString(),
            sourceSequence: event.sequence,
            accuracy: "EXACT" as const,
          },
        ]
      : [];
  });
  const artifacts = selected.flatMap((event) => {
    if (event.eventType !== "artifactGranted" || !event.blockId) return [];
    const reference = blocks.get(event.blockId);
    const artifactId =
      reference && typeof reference.block.configuration.artifactId === "string"
        ? reference.block.configuration.artifactId
        : null;
    const artifact = artifactId ? snapshot.artifacts.find((item) => item.id === artifactId) : null;
    const name = artifact && typeof artifact.displayName === "string" ? artifact.displayName : null;
    return artifactId && name
      ? [
          {
            schemaVersion: 1 as const,
            artifactId,
            name,
            sourceBlockId: event.blockId,
            eventType: "artifactGranted" as const,
            revealedAt: event.createdAt.toISOString(),
            sourceSequence: event.sequence,
            classification: "SHARED_VOYAGE_ARTIFACT" as const,
          },
        ]
      : [];
  });
  return {
    completedChapters: chapters,
    optionalObjectives: [],
    choiceSummary: [
      {
        schemaVersion: 1 as const,
        reason: "UNAVAILABLE: canonical completion events do not retain selected choice identity.",
      },
    ],
    artifactSummary: artifacts,
  };
}

export async function materializeChronicleHistory(playerProfileId: string) {
  const memberships = await db.playthroughMembership.findMany({
    where: { playerProfileId },
    include: {
      player: { include: { avatarMedia: { select: { storageKey: true } } } },
      playthrough: {
        include: {
          tale: { select: { title: true, coverAssetId: true, creatorId: true } },
          version: true,
          events: { select: { id: true, eventType: true, blockId: true, sequence: true, createdAt: true } },
          memberships: { include: { player: { include: { avatarMedia: { select: { altText: true } } } } } },
        },
      },
    },
  });
  let created = 0;
  let updated = 0;
  let failures = 0;
  for (const membership of memberships) {
    const version = membership.playthrough.version;
    if (!version) {
      failures++;
      continue;
    }
    let snapshot: PublishedTaleSnapshot;
    try {
      snapshot = parsePublishedSnapshot(version.contentSnapshot);
    } catch {
      failures++;
      continue;
    }
    const nextLifecycle = deriveHistoryLifecycle(membership.status, membership.playthrough.status);
    const personalEvents = eventsWithinMembership(membership.playthrough.events, membership);
    const summary = summarizeHistoricalEvents(snapshot, personalEvents);
    const personalCompletedAt = derivePersonalCompletionAt(
      membership.status,
      membership.completedAt,
      membership.playthrough.status,
      membership.playthrough.completedAt,
    );
    const nextTiming = derivePersonalTiming(membership.playthrough.startedAt, membership.joinedAt, personalCompletedAt);
    const finalBlockId = personalEvents.findLast((event) => event.eventType === "sessionCompleted")?.blockId ?? null;
    const sourceFingerprint = sha({
      membership: {
        id: membership.id,
        status: membership.status,
        joinedAt: membership.joinedAt,
        completedAt: membership.completedAt,
        removedAt: membership.removedAt,
      },
      session: {
        id: membership.playthrough.id,
        status: membership.playthrough.status,
        startedAt: membership.playthrough.startedAt,
        completedAt: membership.playthrough.completedAt,
      },
      version: { id: version.id, checksum: version.checksum },
      events: personalEvents.map((event) => [
        event.id,
        event.eventType,
        event.blockId,
        event.sequence,
        event.createdAt.toISOString(),
      ]),
      participants: membership.playthrough.memberships.map((participant) => [
        participant.id,
        participant.playerProfileId,
        participant.status,
        participant.role,
        participant.crewRole,
        participant.joinedAt?.toISOString() ?? null,
        participant.completedAt?.toISOString() ?? null,
        participant.removedAt?.toISOString() ?? null,
      ]),
    });
    const existing = await db.playerChronicleRecord.findUnique({
      where: {
        playerProfileId_sourcePlaythroughId: { playerProfileId, sourcePlaythroughId: membership.playthroughId },
      },
      select: { id: true, sourceFingerprint: true },
    });
    if (existing?.sourceFingerprint === sourceFingerprint) continue;
    const data = {
      sourceMembershipId: membership.id,
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      participationRole: membership.role,
      crewRoleSnapshot: membership.crewRole,
      lifecycleStatus: nextLifecycle,
      outcome: outcome(nextLifecycle, snapshot, finalBlockId),
      startedAt:
        membership.playthrough.startedAt && membership.joinedAt
          ? new Date(Math.max(+membership.playthrough.startedAt, +membership.joinedAt))
          : (membership.playthrough.startedAt ?? membership.joinedAt),
      joinedAt: membership.joinedAt,
      completedAt: personalCompletedAt,
      ...nextTiming,
      completedChapters: JSON.stringify(chapterSummarySchema.parse(summary.completedChapters)),
      optionalObjectives: JSON.stringify(unavailableSummarySchema.parse(summary.optionalObjectives)),
      choiceSummary: JSON.stringify(unavailableSummarySchema.parse(summary.choiceSummary)),
      artifactSummary: JSON.stringify(artifactSummarySchema.parse(summary.artifactSummary)),
      sourceFingerprint,
      projectionStatus: "CURRENT",
      projectionReason: null,
      lastDerivedAt: new Date(),
    };
    const record = await db.playerChronicleRecord.upsert({
      where: {
        playerProfileId_sourcePlaythroughId: { playerProfileId, sourcePlaythroughId: membership.playthroughId },
      },
      update: data,
      create: {
        ...data,
        playerProfileId,
        sourcePlaythroughId: membership.playthroughId,
        chronicleTitleSnapshot: snapshot.tale.title,
        chronicleCoverSnapshot: snapshot.tale.coverAssetId ?? membership.playthrough.tale.coverAssetId,
        creatorAttributionSnapshot: membership.playthrough.tale.creatorId,
        playerNameSnapshot: membership.player.displayName,
        playerAvatarSnapshot: membership.player.avatarMedia?.storageKey ?? null,
      },
    });
    await Promise.all(
      membership.playthrough.memberships.map((participant) =>
        db.playerChronicleParticipantSnapshot.upsert({
          where: {
            historyRecordId_sourceMembershipId: { historyRecordId: record.id, sourceMembershipId: participant.id },
          },
          update: {
            joinedAt: participant.joinedAt,
            completedAt: participant.completedAt,
            removedAt: participant.removedAt,
          },
          create: {
            historyRecordId: record.id,
            sourceMembershipId: participant.id,
            participantProfileId: participant.playerProfileId,
            displayNameSnapshot: participant.player.displayName,
            avatarAltSnapshot: participant.player.avatarMedia?.altText ?? null,
            participationRole: participant.role,
            crewRoleSnapshot: participant.crewRole,
            joinedAt: participant.joinedAt,
            completedAt: participant.completedAt,
            removedAt: participant.removedAt,
          },
        }),
      ),
    );
    if (existing) {
      updated++;
    } else {
      created++;
    }
  }
  return {
    membershipsExamined: memberships.length,
    recordsCreated: created,
    recordsUpdated: updated,
    projectionFailures: failures,
  };
}

export type KeepsakeCrewMember = {
  participantId: string | null;
  name: string;
  role: string;
  crewRole: string | null;
};

export type KeepsakeConsentState = {
  participantId: string;
  scope: string;
  state: string;
};

/**
 * Keepsakes never infer a participant's sharing permission. A solo voyage
 * contains no crew section; a multi-person voyage lists only participants
 * who explicitly granted a name-capable scope on this Keepsake.
 */
export function filterKeepsakeCrew(
  crew: KeepsakeCrewMember[],
  consents: KeepsakeConsentState[],
): Array<{ name: string; role: string; crewRole: string | null }> {
  if (crew.length < 2) return [];
  const granted = new Set(
    consents
      .filter((consent) => consent.state === "GRANTED" && ["DISPLAY_NAME", "GENERAL_MEDIA"].includes(consent.scope))
      .map((consent) => consent.participantId),
  );
  return crew
    .filter((participant) => participant.participantId !== null && granted.has(participant.participantId))
    .map(({ name, role, crewRole }) => ({ name, role, crewRole }));
}

const recordInclude = {
  reflection: true,
  memories: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
  participantSnapshots: { orderBy: { createdAt: "asc" as const } },
  keepsake: { include: { consents: { where: { state: "GRANTED" }, select: { participantId: true, scope: true } } } },
  publishedVersion: {
    select: {
      communityReleases: {
        where: { moderationStatus: "ACTIVE", deprecatedAt: null },
        select: {
          id: true,
          listing: {
            select: {
              slug: true,
              currentReleaseId: true,
              publicationStatus: true,
              moderationStatus: true,
              visibility: true,
            },
          },
        },
      },
    },
  },
};

export async function listChronicleHistory(
  playerProfileId: string,
  input: { cursor?: string; limit?: number; status?: string; search?: string },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const where = {
    playerProfileId,
    ...(input.status ? { lifecycleStatus: input.status } : {}),
    ...(input.search ? { chronicleTitleSnapshot: { contains: input.search.slice(0, 80) } } : {}),
  };
  const records = await db.playerChronicleRecord.findMany({
    where,
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    include: recordInclude,
  });
  const hasMore = records.length > limit;
  const items = records.slice(0, limit).map(ownerRecordProjection);
  const membershipPlaythroughIds = new Set(records.map((record) => record.sourcePlaythroughId));
  const invitations = await db.invitation.findMany({
    where: { intendedPlayerId: playerProfileId, ...(input.status ? { status: input.status } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      playthroughId: true,
      status: true,
      recipientName: true,
      createdAt: true,
      viewedAt: true,
      acceptedAt: true,
      declinedAt: true,
      revokedAt: true,
      expiresAt: true,
      replacesInvitationId: true,
      playthrough: { select: { version: { select: { versionLabel: true, checksum: true, contentSnapshot: true } } } },
    },
  });
  const invitationItems = invitations
    .filter((invitation) => !membershipPlaythroughIds.has(invitation.playthroughId))
    .map((invitation) => {
      let title = "Historical Chronicle";
      try {
        title = invitation.playthrough.version
          ? parsePublishedSnapshot(invitation.playthrough.version.contentSnapshot).tale.title
          : title;
      } catch {
        /* unavailable snapshot is intentionally neutral */
      }
      return {
        id: invitation.id,
        kind: "INVITATION" as const,
        chronicleTitle: title,
        lifecycleStatus: invitation.status,
        timestamps: {
          createdAt: invitation.createdAt,
          viewedAt: invitation.viewedAt,
          acceptedAt: invitation.acceptedAt,
          declinedAt: invitation.declinedAt,
          revokedAt: invitation.revokedAt,
          expiresAt: invitation.expiresAt,
        },
        version: invitation.playthrough.version
          ? { label: invitation.playthrough.version.versionLabel, checksum: invitation.playthrough.version.checksum }
          : null,
        replaced: Boolean(invitation.replacesInvitationId),
      };
    });
  return { items, invitations: invitationItems, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
}

export async function ownerChronicleRecord(playerProfileId: string, recordId: string) {
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    include: recordInclude,
  });
  if (!record) return null;
  return ownerRecordProjection(record);
}

type OwnerRecord = {
  id: string;
  chronicleTitleSnapshot: string;
  chronicleCoverSnapshot: string | null;
  publishedVersionChecksum: string;
  playerNameSnapshot: string;
  playerAvatarSnapshot: string | null;
  participationRole: string;
  crewRoleSnapshot: string | null;
  lifecycleStatus: string;
  outcome: string;
  startedAt: Date | null;
  joinedAt: Date | null;
  completedAt: Date | null;
  metricDefinitionVersion: string;
  wallClockSeconds: number | null;
  wallClockAccuracy: string;
  activeSeconds: number | null;
  activeAccuracy: string;
  pausedSeconds: number | null;
  pausedAccuracy: string;
  connectedSeconds: number | null;
  connectedAccuracy: string;
  interactiveSeconds: number | null;
  interactiveAccuracy: string;
  captainWaitSeconds: number | null;
  captainWaitAccuracy: string;
  completedChapters: string;
  optionalObjectives: string;
  choiceSummary: string;
  artifactSummary: string;
  reflection: unknown;
  memories: unknown[];
  participantSnapshots: Array<{
    displayNameSnapshot: string;
    avatarAltSnapshot: string | null;
    participationRole: string;
    crewRoleSnapshot: string | null;
    joinedAt: Date | null;
    completedAt: Date | null;
    removedAt: Date | null;
    projectionEligibility: string;
    tombstoneState: string;
  }>;
  keepsake: { status: string; generatedAt: Date; consents: unknown[] } | null;
  publishedVersion: {
    communityReleases: Array<{
      id: string;
      listing: {
        slug: string;
        currentReleaseId: string | null;
        publicationStatus: string;
        moderationStatus: string;
        visibility: string;
      };
    }>;
  };
};

function parseStored<T>(schema: z.ZodType<T>, value: string, field: string): T {
  try {
    return schema.parse(JSON.parse(value));
  } catch {
    throw new Error(`Chronicle history ${field} is unavailable until reconciliation repairs this record.`);
  }
}

function ownerRecordProjection(record: OwnerRecord) {
  const reviewListing = record.publishedVersion.communityReleases.find(
    (release) =>
      release.listing.currentReleaseId === release.id &&
      release.listing.publicationStatus === "PUBLISHED" &&
      release.listing.moderationStatus === "ACTIVE" &&
      ["COMMUNITY", "FEATURED"].includes(release.listing.visibility),
  )?.listing;
  return {
    id: record.id,
    chronicle: {
      title: record.chronicleTitleSnapshot,
      cover: record.chronicleCoverSnapshot,
      versionChecksum: record.publishedVersionChecksum,
    },
    participant: {
      name: record.playerNameSnapshot,
      avatar: record.playerAvatarSnapshot,
      role: record.participationRole,
      crewRole: record.crewRoleSnapshot,
    },
    lifecycleStatus: record.lifecycleStatus,
    outcome: record.outcome,
    timestamps: { startedAt: record.startedAt, joinedAt: record.joinedAt, completedAt: record.completedAt },
    ...(record.completedAt && reviewListing
      ? {
          review: {
            href: `/community/${encodeURIComponent(reviewListing.slug)}#community-review-composer`,
            state: "AVAILABLE_AFTER_VERIFIED_COMPLETION" as const,
          },
        }
      : {}),
    timing: {
      definitionVersion: record.metricDefinitionVersion,
      wallClock: { seconds: record.wallClockSeconds, accuracy: record.wallClockAccuracy },
      active: { seconds: record.activeSeconds, accuracy: record.activeAccuracy },
      paused: { seconds: record.pausedSeconds, accuracy: record.pausedAccuracy },
      connected: { seconds: record.connectedSeconds, accuracy: record.connectedAccuracy },
      interactive: { seconds: record.interactiveSeconds, accuracy: record.interactiveAccuracy },
      captainWait: { seconds: record.captainWaitSeconds, accuracy: record.captainWaitAccuracy },
    },
    completedChapters: parseStored(chapterSummarySchema, record.completedChapters, "chapter summary"),
    optionalObjectives: parseStored(unavailableSummarySchema, record.optionalObjectives, "objective summary"),
    choiceSummary: parseStored(unavailableSummarySchema, record.choiceSummary, "choice summary"),
    artifactSummary: parseStored(artifactSummarySchema, record.artifactSummary, "artifact summary"),
    reflection: record.reflection
      ? {
          favoriteChapterId: (record.reflection as { favoriteChapterId?: string | null }).favoriteChapterId ?? null,
          favoriteClueReference:
            (record.reflection as { favoriteClueReference?: string | null }).favoriteClueReference ?? null,
          favoriteMomentReference:
            (record.reflection as { favoriteMomentReference?: string | null }).favoriteMomentReference ?? null,
          favoriteArtifactReference:
            (record.reflection as { favoriteArtifactReference?: string | null }).favoriteArtifactReference ?? null,
          privateNote: (record.reflection as { privateNote?: string | null }).privateNote ?? null,
        }
      : null,
    memories: record.memories.map((memory) => {
      const value = memory as {
        id: string;
        title: string;
        body?: string | null;
        referenceType?: string | null;
        referenceId?: string | null;
        createdAt: Date;
      };
      return {
        id: value.id,
        title: value.title,
        body: value.body ?? null,
        referenceType: value.referenceType ?? null,
        referenceId: value.referenceId ?? null,
        createdAt: value.createdAt,
      };
    }),
    crew: record.participantSnapshots.map((participant) => ({
      name: participant.tombstoneState === "ACTIVE" ? participant.displayNameSnapshot : "Former crew member",
      avatarAlt: participant.tombstoneState === "ACTIVE" ? participant.avatarAltSnapshot : null,
      role: participant.participationRole,
      crewRole: participant.crewRoleSnapshot,
      joinedAt: participant.joinedAt,
      completedAt: participant.completedAt,
      removedAt: participant.removedAt,
      visibility: participant.projectionEligibility,
    })),
    keepsake: record.keepsake
      ? {
          status: record.keepsake.status,
          generatedAt: record.keepsake.generatedAt,
          participantCount: record.keepsake.consents.length,
        }
      : null,
  };
}

async function ownedRecord(playerProfileId: string, recordId: string) {
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    select: { id: true, sourcePlaythroughId: true, completedChapters: true },
  });
  if (!record) throw new Error("Chronicle history record not found.");
  return record;
}

async function validateOwnedHistoricalReferences(
  playerProfileId: string,
  record: { sourcePlaythroughId: string; completedChapters: string },
  input: {
    favoriteChapterId?: string | null;
    favoriteClueReference?: string | null;
    favoriteMomentReference?: string | null;
    favoriteArtifactReference?: string | null;
    referenceType?: "CHAPTER" | "CLUE" | "MOMENT" | "ARTIFACT";
    referenceId?: string;
  },
) {
  if (
    input.favoriteClueReference ||
    input.favoriteMomentReference ||
    input.referenceType === "CLUE" ||
    input.referenceType === "MOMENT"
  )
    throw new Error("This Voyage did not preserve a safe historical clue or moment reference.");
  const chapters = parseStored(chapterSummarySchema, record.completedChapters, "completed chapters");
  const chapterReferences = [
    input.favoriteChapterId,
    input.referenceType === "CHAPTER" ? input.referenceId : undefined,
  ].filter((value): value is string => Boolean(value));
  if (chapterReferences.some((reference) => !chapters.some((chapter) => chapter.blockId === reference)))
    throw new Error("The selected chapter does not belong to this historical Voyage.");
  const artifactReferences = [
    input.favoriteArtifactReference,
    input.referenceType === "ARTIFACT" ? input.referenceId : undefined,
  ].filter((value): value is string => Boolean(value));
  if (artifactReferences.length) {
    const count = await db.playerArtifactRecord.count({
      where: {
        id: { in: artifactReferences },
        playerProfileId,
        sourcePlaythroughId: record.sourcePlaythroughId,
        recordStatus: "ACTIVE",
      },
    });
    if (count !== new Set(artifactReferences).size)
      throw new Error("The selected artifact does not belong to this historical Voyage.");
  }
}

export async function saveReflection(playerProfileId: string, recordId: string, input: unknown) {
  const record = await ownedRecord(playerProfileId, recordId);
  const data = reflectionSchema.parse(input);
  await validateOwnedHistoricalReferences(playerProfileId, record, data);
  return db.chronicleReflection.upsert({
    where: { playerChronicleRecordId: recordId },
    update: data,
    create: { playerChronicleRecordId: recordId, ...data },
  });
}
export async function addMemory(playerProfileId: string, recordId: string, input: unknown) {
  const record = await ownedRecord(playerProfileId, recordId);
  const data = memorySchema.parse(input);
  await validateOwnedHistoricalReferences(playerProfileId, record, data);
  return db.chronicleMemory.create({
    data: { playerChronicleRecordId: recordId, playerProfileId, ...data, visibility: "ONLY_ME" },
  });
}
export async function updateMemory(playerProfileId: string, recordId: string, memoryId: string, input: unknown) {
  const record = await ownedRecord(playerProfileId, recordId);
  const data = memorySchema.parse(input);
  await validateOwnedHistoricalReferences(playerProfileId, record, data);
  const result = await db.chronicleMemory.updateMany({
    where: { id: memoryId, playerChronicleRecordId: recordId, playerProfileId, deletedAt: null },
    data,
  });
  if (!result.count) throw new Error("Chronicle Memory not found.");
  return db.chronicleMemory.findFirst({
    where: { id: memoryId, playerChronicleRecordId: recordId, playerProfileId, deletedAt: null },
  });
}
export async function removeMemory(playerProfileId: string, recordId: string, memoryId: string) {
  await ownedRecord(playerProfileId, recordId);
  const result = await db.chronicleMemory.updateMany({
    where: { id: memoryId, playerChronicleRecordId: recordId, playerProfileId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (!result.count) throw new Error("Chronicle Memory not found.");
}
export async function generateKeepsake(playerProfileId: string, recordId: string) {
  await ownedRecord(playerProfileId, recordId);
  const detail = await ownerChronicleRecord(playerProfileId, recordId);
  if (!detail) throw new Error("Chronicle history record not found.");
  const existingKeepsake = await db.voyageKeepsake.findUnique({
    where: { playerChronicleRecordId: recordId },
    include: { consents: { select: { participantId: true, scope: true, state: true } } },
  });
  const crewSnapshots = await db.playerChronicleParticipantSnapshot.findMany({
    where: { historyRecordId: recordId },
    select: {
      participantProfileId: true,
      displayNameSnapshot: true,
      participationRole: true,
      crewRoleSnapshot: true,
    },
  });
  const payload = JSON.stringify(
    keepsakePayloadSchema.parse({
      schemaVersion: 1,
      generationVersion: "WAYFARER_KEEPSAKE_V1",
      chronicle: detail.chronicle,
      outcome: detail.outcome,
      completedAt: detail.timestamps.completedAt?.toISOString() ?? null,
      chapters: detail.completedChapters,
      artifacts: detail.artifactSummary,
      reflection: detail.reflection ? { privateNote: detail.reflection.privateNote } : null,
      crew: filterKeepsakeCrew(
        crewSnapshots.map((participant) => ({
          participantId: participant.participantProfileId,
          name: participant.displayNameSnapshot,
          role: participant.participationRole,
          crewRole: participant.crewRoleSnapshot,
        })),
        existingKeepsake?.consents ?? [],
      ),
      generatedAt: new Date().toISOString(),
    }),
  );
  return db.voyageKeepsake.upsert({
    where: { playerChronicleRecordId: recordId },
    update: { presentationPayload: payload, regeneratedAt: new Date() },
    create: { playerChronicleRecordId: recordId, presentationPayload: payload },
  });
}
export async function recordKeepsakeConsent(
  participantId: string,
  recordId: string,
  scope: "DISPLAY_NAME" | "AVATAR" | "QUOTE" | "PHOTO" | "AUDIO" | "GENERAL_MEDIA",
  state: "GRANTED" | "DENIED" | "REVOKED",
) {
  const record = await db.playerChronicleRecord.findUnique({
    where: { id: recordId },
    select: { sourcePlaythroughId: true },
  });
  if (!record) throw new Error("Chronicle history record not found.");
  const membership = await db.playthroughMembership.findUnique({
    where: {
      playthroughId_playerProfileId: { playthroughId: record.sourcePlaythroughId, playerProfileId: participantId },
    },
  });
  if (!membership) throw new Error("Only a Voyage participant can set their Keepsake consent.");
  const keepsake = await db.voyageKeepsake.findUnique({ where: { playerChronicleRecordId: recordId } });
  if (!keepsake) throw new Error("Generate the private Keepsake before recording consent.");
  return db.voyageKeepsakeConsent.upsert({
    where: { keepsakeId_participantId_scope: { keepsakeId: keepsake.id, participantId, scope } },
    update: {
      state,
      decidedAt: new Date(),
      grantedAt: state === "GRANTED" ? new Date() : null,
      revokedAt: state === "REVOKED" ? new Date() : null,
    },
    create: {
      keepsakeId: keepsake.id,
      participantId,
      scope,
      state,
      decidedAt: new Date(),
      grantedAt: state === "GRANTED" ? new Date() : null,
      revokedAt: state === "REVOKED" ? new Date() : null,
    },
  });
}

export function isTerminalHistoryStatus(status: string) {
  return terminalStatuses.has(status);
}
