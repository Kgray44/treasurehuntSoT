import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { parsePublishedSnapshot } from "@/chronicle/types";
import { db } from "@/lib/db";
import { loadTideglassHistoryComparisonEntry, type TideglassHistoryComparisonEntry } from "@/tideglass/passage-service";
import type {
  ArchiveQuery,
  ArchiveYearGroup,
  InvitationArchiveItem,
  JourneyArchiveItem,
  JourneyArchiveResponse,
  VoyageDetail,
} from "@/wakebook/contracts";
import {
  archiveChronology,
  compareArchiveIdentity,
  decodeArchiveCursor,
  encodeArchiveCursor,
  invitationArchiveDate,
  isAfterArchiveCursor,
  presentArtifactState,
  presentKeepsakeStatus,
  presentLifecycle,
  presentOutcome,
  presentRole,
  presentTiming,
} from "@/wakebook/presentation";

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
const objectiveSummarySchema = z.array(
  z.discriminatedUnion("state", [
    z
      .object({
        schemaVersion: z.literal(1),
        state: z.literal("AVAILABLE"),
        label: z.string().min(1).max(240),
        completed: z.boolean(),
      })
      .strict(),
    z
      .object({ schemaVersion: z.literal(1), state: z.literal("UNAVAILABLE"), reason: z.string().min(1).max(480) })
      .strict(),
  ]),
);
const safeChoiceSummarySchema = z.array(
  z.discriminatedUnion("state", [
    z
      .object({
        schemaVersion: z.literal(1),
        state: z.literal("AVAILABLE"),
        label: z.string().min(1).max(240),
        chapterTitle: z.string().min(1).max(240).nullable().optional(),
        kind: z.enum(["CHOICE", "HINT", "REJOIN", "CHECKPOINT", "ATTEMPT"]),
        detail: z.string().min(1).max(480).nullable().optional(),
      })
      .strict(),
    z
      .object({ schemaVersion: z.literal(1), state: z.literal("UNAVAILABLE"), reason: z.string().min(1).max(480) })
      .strict(),
  ]),
);
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

const reviewSelect = {
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
} satisfies Prisma.PublishedTaleVersionSelect;

const summarySelect = {
  id: true,
  sourcePlaythroughId: true,
  sourceMembershipId: true,
  publishedVersionId: true,
  publishedVersionChecksum: true,
  chronicleTitleSnapshot: true,
  chronicleCoverSnapshot: true,
  participationRole: true,
  crewRoleSnapshot: true,
  lifecycleStatus: true,
  outcome: true,
  startedAt: true,
  joinedAt: true,
  completedAt: true,
  wallClockSeconds: true,
  wallClockAccuracy: true,
  completedChapters: true,
  artifactSummary: true,
  projectionStatus: true,
  projectionReason: true,
  reflection: { select: { id: true } },
  memories: { where: { deletedAt: null }, select: { id: true } },
  keepsake: { select: { id: true } },
  participantSnapshots: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    take: 4,
    select: {
      sourceMembershipId: true,
      displayNameSnapshot: true,
      avatarAltSnapshot: true,
      participationRole: true,
      crewRoleSnapshot: true,
      projectionEligibility: true,
      tombstoneState: true,
    },
  },
  publishedVersion: { select: { versionLabel: true, tale: { select: { slug: true } }, ...reviewSelect } },
} satisfies Prisma.PlayerChronicleRecordSelect;

type SummaryRecord = Prisma.PlayerChronicleRecordGetPayload<{ select: typeof summarySelect }>;

const detailSelect = {
  ...summarySelect,
  playerNameSnapshot: true,
  creatorAttributionSnapshot: true,
  lastDerivedAt: true,
  metricDefinitionVersion: true,
  activeSeconds: true,
  activeAccuracy: true,
  pausedSeconds: true,
  pausedAccuracy: true,
  connectedSeconds: true,
  connectedAccuracy: true,
  interactiveSeconds: true,
  interactiveAccuracy: true,
  captainWaitSeconds: true,
  captainWaitAccuracy: true,
  optionalObjectives: true,
  choiceSummary: true,
  reflection: {
    select: {
      favoriteChapterId: true,
      favoriteClueReference: true,
      favoriteMomentReference: true,
      favoriteArtifactReference: true,
      privateNote: true,
      updatedAt: true,
    },
  },
  memories: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    select: {
      id: true,
      title: true,
      body: true,
      referenceType: true,
      referenceId: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  keepsake: {
    select: {
      status: true,
      generatedAt: true,
      regeneratedAt: true,
      consents: {
        select: { scope: true, state: true, historicalLabel: true, decidedAt: true },
        orderBy: [{ participantId: "asc" }, { scope: "asc" }],
      },
    },
  },
  participantSnapshots: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    select: {
      sourceMembershipId: true,
      displayNameSnapshot: true,
      avatarAltSnapshot: true,
      participationRole: true,
      crewRoleSnapshot: true,
      joinedAt: true,
      completedAt: true,
      removedAt: true,
      projectionEligibility: true,
      tombstoneState: true,
    },
  },
  player: { select: { accountId: true } },
} satisfies Prisma.PlayerChronicleRecordSelect;

type DetailRecord = Prisma.PlayerChronicleRecordGetPayload<{ select: typeof detailSelect }>;

type StoredParse<T> = { value: T; warning: string | null };

function parseStored<T>(schema: z.ZodType<T>, raw: string, label: string, fallback: T): StoredParse<T> {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { value: parsed.data, warning: null }
      : { value: fallback, warning: `${label} needs history reconciliation.` };
  } catch {
    return { value: fallback, warning: `${label} needs history reconciliation.` };
  }
}

function reviewOf(record: Pick<SummaryRecord, "completedAt" | "publishedVersion">) {
  if (!record.completedAt) return undefined;
  const listing = record.publishedVersion.communityReleases.find(
    (release) =>
      release.listing.currentReleaseId === release.id &&
      release.listing.publicationStatus === "PUBLISHED" &&
      release.listing.moderationStatus === "ACTIVE" &&
      ["COMMUNITY", "FEATURED"].includes(release.listing.visibility),
  )?.listing;
  return listing
    ? {
        href: `/community/${encodeURIComponent(listing.slug)}#community-review-composer`,
        state: "AVAILABLE_AFTER_VERIFIED_COMPLETION" as const,
      }
    : undefined;
}

function coverOf(record: Pick<SummaryRecord, "id" | "chronicleCoverSnapshot" | "chronicleTitleSnapshot">) {
  return record.chronicleCoverSnapshot
    ? {
        href: `/api/passport/voyages/${encodeURIComponent(record.id)}/cover`,
        alt: `Historical cover for ${record.chronicleTitleSnapshot}`,
      }
    : null;
}

function commonWhere(playerProfileId: string, input: ArchiveQuery): Prisma.PlayerChronicleRecordWhereInput {
  const conditions: Prisma.PlayerChronicleRecordWhereInput[] = [{ playerProfileId }];
  if (input.status) conditions.push({ lifecycleStatus: input.status });
  if (input.role) conditions.push({ participationRole: input.role });
  if (input.search) {
    conditions.push({
      OR: [
        { chronicleTitleSnapshot: { contains: input.search } },
        {
          participantSnapshots: {
            some: { displayNameSnapshot: { contains: input.search }, tombstoneState: "ACTIVE" },
          },
        },
      ],
    });
  }
  if (input.hasMemories !== undefined)
    conditions.push({ memories: input.hasMemories ? { some: { deletedAt: null } } : { none: { deletedAt: null } } });
  if (input.hasKeepsake !== undefined)
    conditions.push({ keepsake: input.hasKeepsake ? { isNot: null } : { is: null } });
  if (input.hasArtifacts !== undefined)
    conditions.push(input.hasArtifacts ? { artifactSummary: { not: "[]" } } : { artifactSummary: "[]" });
  if (input.year !== undefined) conditions.push(archiveYearWhere(input.year));
  return { AND: conditions };
}

function archiveYearWhere(year: number): Prisma.PlayerChronicleRecordWhereInput {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return {
    OR: [
      { completedAt: { gte: start, lt: end } },
      { completedAt: null, startedAt: { gte: start, lt: end } },
      { completedAt: null, startedAt: null, joinedAt: { gte: start, lt: end } },
    ],
  };
}

function archiveUnknownWhere(): Prisma.PlayerChronicleRecordWhereInput {
  return { completedAt: null, startedAt: null, joinedAt: null };
}

function afterDateCursor(
  field: "completedAt" | "startedAt" | "joinedAt",
  date: Date,
  id: string,
  sort: ArchiveQuery["sort"],
): Prisma.PlayerChronicleRecordWhereInput {
  const comparison = sort === "NEWEST" ? { lt: date } : { gt: date };
  const idComparison = sort === "NEWEST" ? { lt: id } : { gt: id };
  return { OR: [{ [field]: comparison }, { [field]: date, id: idComparison }] };
}

async function readPartition(
  base: Prisma.PlayerChronicleRecordWhereInput,
  partition: "completedAt" | "startedAt" | "joinedAt" | "unknown",
  input: ArchiveQuery,
  cursor: ReturnType<typeof decodeArchiveCursor> | null,
) {
  const direction = input.sort === "NEWEST" ? "desc" : "asc";
  const partitionWhere: Prisma.PlayerChronicleRecordWhereInput =
    partition === "completedAt"
      ? { completedAt: { not: null } }
      : partition === "startedAt"
        ? { completedAt: null, startedAt: { not: null } }
        : partition === "joinedAt"
          ? { completedAt: null, startedAt: null, joinedAt: { not: null } }
          : archiveUnknownWhere();
  const cursorWhere: Prisma.PlayerChronicleRecordWhereInput | undefined = cursor
    ? partition === "unknown"
      ? cursor.date === null
        ? { id: input.sort === "NEWEST" ? { lt: cursor.id } : { gt: cursor.id } }
        : undefined
      : cursor.date
        ? afterDateCursor(partition, new Date(cursor.date), cursor.id, input.sort)
        : { id: "__wakebook_after_unknown_cursor_has_no_dated_records__" }
    : undefined;
  return db.playerChronicleRecord.findMany({
    where: { AND: [base, partitionWhere, ...(cursorWhere ? [cursorWhere] : [])] },
    orderBy:
      partition === "unknown"
        ? [{ id: direction }]
        : [{ [partition]: { sort: direction, nulls: "last" } }, { id: direction }],
    take: input.limit + 1,
    select: summarySelect,
  });
}

async function personalArtifactCounts(playerProfileId: string, playthroughIds: string[]) {
  if (!playthroughIds.length) return new Map<string, number>();
  const rows = await db.playerArtifactRecord.groupBy({
    by: ["sourcePlaythroughId"],
    where: { playerProfileId, sourcePlaythroughId: { in: playthroughIds }, recordStatus: "ACTIVE" },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.sourcePlaythroughId, row._count._all]));
}

function summaryProjection(record: SummaryRecord, personalArtifactCount: number): JourneyArchiveItem {
  const chapters = parseStored(chapterSummarySchema, record.completedChapters, "Chapter history", []);
  const artifacts = parseStored(artifactSummarySchema, record.artifactSummary, "Artifact history", []);
  const warnings = [chapters.warning, artifacts.warning].filter((warning): warning is string => Boolean(warning));
  if (record.projectionStatus !== "CURRENT") warnings.push("Some supplementary history could not be refreshed.");
  const ownerMembershipId = record.sourceMembershipId;
  const crewPreview = record.participantSnapshots
    .filter((participant) => participant.sourceMembershipId !== ownerMembershipId)
    .slice(0, 3)
    .map((participant) => ({
      historicalDisplayName:
        participant.tombstoneState === "ACTIVE" ? participant.displayNameSnapshot : "Former crew member",
      avatarAlt: participant.tombstoneState === "ACTIVE" ? participant.avatarAltSnapshot : null,
      role: participant.participationRole,
      humanRole: presentRole(participant.participationRole),
      crewRole: participant.crewRoleSnapshot,
    }));
  return {
    id: record.id,
    chronology: archiveChronology(record.completedAt, record.startedAt, record.joinedAt),
    chronicle: {
      historicalTitle: record.chronicleTitleSnapshot,
      historicalCover: coverOf(record),
      publishedVersionId: record.publishedVersionId,
      publishedVersionLabel: record.publishedVersion.versionLabel,
      publishedVersionChecksum: record.publishedVersionChecksum,
    },
    lifecycle: presentLifecycle(record.lifecycleStatus),
    participation: {
      role: record.participationRole,
      humanRole: presentRole(record.participationRole),
      crewRole: record.crewRoleSnapshot,
    },
    crewPreview,
    timing: { primary: presentTiming(record.wallClockSeconds, record.wallClockAccuracy) },
    outcome: presentOutcome(record.outcome),
    progress: { completedChapterCount: chapters.value.length, chapterEvidenceAvailable: !chapters.warning },
    context: {
      memoryCount: record.memories.length,
      sharedArtifactCount: artifacts.value.length,
      personalArtifactCount,
      hasKeepsake: Boolean(record.keepsake),
      hasReflection: Boolean(record.reflection),
    },
    dataQuality: warnings.length ? "PARTIAL" : "COMPLETE",
    warnings,
    ...(() => {
      const review = reviewOf(record);
      return review ? { review } : {};
    })(),
  };
}

async function yearSummary(
  base: Prisma.PlayerChronicleRecordWhereInput,
  year: number | null,
  items: JourneyArchiveItem[],
): Promise<ArchiveYearGroup> {
  const dateWhere = year === null ? archiveUnknownWhere() : archiveYearWhere(year);
  const where = { AND: [base, dateWhere] };
  const [totalCount, completedCount, exact] = await Promise.all([
    db.playerChronicleRecord.count({ where }),
    db.playerChronicleRecord.count({ where: { AND: [where, { lifecycleStatus: "COMPLETED" }] } }),
    db.playerChronicleRecord.aggregate({
      where: { AND: [where, { wallClockAccuracy: "EXACT", wallClockSeconds: { not: null } }] },
      _count: { _all: true },
      _sum: { wallClockSeconds: true },
    }),
  ]);
  return {
    key: year === null ? "date-unavailable" : String(year),
    year,
    label: year === null ? "Date unavailable" : String(year),
    totalCount,
    completedCount,
    displayedCount: items.length,
    exactRecordedSeconds:
      totalCount > 0 && exact._count._all === totalCount ? (exact._sum.wallClockSeconds ?? 0) : null,
    items,
  };
}

async function invitationHistory(playerProfileId: string, input: ArchiveQuery): Promise<InvitationArchiveItem[]> {
  if (
    input.role ||
    input.hasMemories !== undefined ||
    input.hasKeepsake !== undefined ||
    input.hasArtifacts !== undefined
  )
    return [];
  const invitationStatuses = new Set(["INVITED", "ACCEPTED", "DECLINED", "EXPIRED", "REVOKED"]);
  if (input.status && !invitationStatuses.has(input.status)) return [];
  const invitations = await db.invitation.findMany({
    where: {
      intendedPlayerId: playerProfileId,
      ...(input.status ? { status: input.status } : {}),
      playthrough: { memberships: { none: { playerProfileId } } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      viewedAt: true,
      acceptedAt: true,
      declinedAt: true,
      revokedAt: true,
      expiresAt: true,
      replacesInvitationId: true,
      playthrough: { select: { version: { select: { versionLabel: true, contentSnapshot: true } } } },
    },
  });
  return invitations
    .flatMap((invitation) => {
      let chronicleTitle = "Historical Chronicle";
      try {
        if (invitation.playthrough.version)
          chronicleTitle = parsePublishedSnapshot(invitation.playthrough.version.contentSnapshot).tale.title;
      } catch {
        // The neutral title is the privacy-safe invalid-snapshot fallback.
      }
      const chronology = invitationArchiveDate(invitation);
      if (input.year !== undefined && chronology.year !== input.year) return [];
      if (input.search && !chronicleTitle.toLocaleLowerCase().includes(input.search.toLocaleLowerCase())) return [];
      return [
        {
          id: invitation.id,
          chronicleTitle,
          lifecycle: presentLifecycle(invitation.status),
          chronology,
          editionLabel: invitation.playthrough.version?.versionLabel ?? null,
          replaced: Boolean(invitation.replacesInvitationId),
        },
      ];
    })
    .slice(0, 8);
}

export async function queryJourneyArchive(
  playerProfileId: string,
  input: ArchiveQuery,
  projection: {
    membershipsExamined: number;
    recordsCreated: number;
    recordsUpdated: number;
    projectionFailures: number;
  },
): Promise<JourneyArchiveResponse> {
  const base = commonWhere(playerProfileId, input);
  let cursor: ReturnType<typeof decodeArchiveCursor> | null = null;
  if (input.cursor) cursor = decodeArchiveCursor(input.cursor, input.sort);
  const [completed, started, joined, unknown, resultCount, invitations] = await Promise.all([
    readPartition(base, "completedAt", input, cursor),
    readPartition(base, "startedAt", input, cursor),
    readPartition(base, "joinedAt", input, cursor),
    readPartition(base, "unknown", input, cursor),
    db.playerChronicleRecord.count({ where: base }),
    invitationHistory(playerProfileId, input),
  ]);
  const candidates = [...completed, ...started, ...joined, ...unknown]
    .map((record) => ({ record, chronology: archiveChronology(record.completedAt, record.startedAt, record.joinedAt) }))
    .filter((item) => isAfterArchiveCursor({ id: item.record.id, chronology: item.chronology }, cursor, input.sort))
    .sort((left, right) =>
      compareArchiveIdentity(
        { id: left.record.id, chronology: left.chronology },
        { id: right.record.id, chronology: right.chronology },
        input.sort,
      ),
    );
  const hasMore = candidates.length > input.limit;
  const pageRecords = candidates.slice(0, input.limit).map((item) => item.record);
  const artifactCounts = await personalArtifactCounts(
    playerProfileId,
    pageRecords.map((record) => record.sourcePlaythroughId),
  );
  const items = pageRecords.map((record) =>
    summaryProjection(record, artifactCounts.get(record.sourcePlaythroughId) ?? 0),
  );
  const buckets = new Map<number | null, JourneyArchiveItem[]>();
  for (const item of items) buckets.set(item.chronology.year, [...(buckets.get(item.chronology.year) ?? []), item]);
  const groups = await Promise.all([...buckets].map(([year, groupItems]) => yearSummary(base, year, groupItems)));
  const last = items.at(-1);
  const warnings = projection.projectionFailures
    ? ["Some Voyage history could not be refreshed. Available version-pinned records are still shown."]
    : [];
  return {
    groups,
    invitations,
    nextCursor:
      hasMore && last
        ? encodeArchiveCursor({ v: 1, sort: input.sort, date: last.chronology.archiveDate, id: last.id })
        : null,
    resultCount,
    pageCount: items.length,
    filtersApplied: Boolean(
      input.search ||
        input.status ||
        input.year ||
        input.role ||
        input.hasMemories !== undefined ||
        input.hasKeepsake !== undefined ||
        input.hasArtifacts !== undefined ||
        input.sort !== "NEWEST",
    ),
    projection: {
      examined: projection.membershipsExamined,
      created: projection.recordsCreated,
      updated: projection.recordsUpdated,
      failures: projection.projectionFailures,
    },
    warnings,
  };
}

export async function queryVoyageDetail(playerProfileId: string, recordId: string): Promise<VoyageDetail | null> {
  const record = await db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId },
    select: detailSelect,
  });
  if (!record) return null;
  const [personalArtifacts, assemblies, achievements, comparison] = await Promise.all([
    db.playerArtifactRecord.findMany({
      where: { playerProfileId, sourcePlaythroughId: record.sourcePlaythroughId, recordStatus: "ACTIVE" },
      orderBy: [{ grantedAt: "asc" }, { id: "asc" }],
      take: 48,
      select: {
        id: true,
        artifactNameSnapshot: true,
        ownershipState: true,
        grantedAt: true,
        witnessedAt: true,
        sourceBlockId: true,
        collectionKeySnapshot: true,
        assemblyKeySnapshot: true,
        componentRoleSnapshot: true,
      },
    }),
    db.playerArtifactAssembly.findMany({
      where: { playerProfileId, sourcePlaythroughId: record.sourcePlaythroughId },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
      take: 24,
      select: { id: true, assemblyKeySnapshot: true, assembledArtifactName: true, status: true, completedAt: true },
    }),
    db.playerAchievement.findMany({
      where: { playerProfileId, state: "EARNED" },
      orderBy: [{ earnedAt: "asc" }, { id: "asc" }],
      take: 96,
      select: {
        id: true,
        state: true,
        earnedAt: true,
        definitionVersion: true,
        evidenceSnapshot: true,
        definition: { select: { titleSnapshot: true, descriptionSnapshot: true } },
      },
    }),
    loadTideglassHistoryComparisonEntry({
      taleSlug: record.publishedVersion.tale.slug,
      playerProfileId,
      historyRecordId: record.id,
      returnTo: `/passport/history/${encodeURIComponent(record.id)}`,
    }),
  ]);
  return detailProjection(
    record,
    personalArtifacts,
    assemblies,
    achievements.filter((achievement) =>
      achievementIsForVoyage(achievement.evidenceSnapshot, record.sourcePlaythroughId),
    ),
    comparison,
  );
}

function achievementIsForVoyage(evidenceSnapshot: string, sourcePlaythroughId: string) {
  try {
    const evidence = JSON.parse(evidenceSnapshot) as Record<string, unknown>;
    return evidence.sourcePlaythroughId === sourcePlaythroughId || evidence.playthroughId === sourcePlaythroughId;
  } catch {
    return false;
  }
}

function detailProjection(
  record: DetailRecord,
  personalArtifacts: Array<{
    id: string;
    artifactNameSnapshot: string;
    ownershipState: string;
    grantedAt: Date | null;
    witnessedAt: Date | null;
    sourceBlockId: string | null;
    collectionKeySnapshot: string | null;
    assemblyKeySnapshot: string | null;
    componentRoleSnapshot: string | null;
  }>,
  assemblies: Array<{
    id: string;
    assemblyKeySnapshot: string;
    assembledArtifactName: string;
    status: string;
    completedAt: Date | null;
  }>,
  achievements: Array<{
    id: string;
    state: string;
    earnedAt: Date | null;
    definitionVersion: number;
    definition: { titleSnapshot: string; descriptionSnapshot: string };
  }>,
  comparison: TideglassHistoryComparisonEntry | null,
): VoyageDetail {
  const chapters = parseStored(chapterSummarySchema, record.completedChapters, "Chapter history", []);
  const objectives = parseStored(objectiveSummarySchema, record.optionalObjectives, "Optional-objective history", []);
  const choices = parseStored(safeChoiceSummarySchema, record.choiceSummary, "Choice history", []);
  const artifacts = parseStored(artifactSummarySchema, record.artifactSummary, "Artifact history", []);
  const warnings = [chapters.warning, objectives.warning, choices.warning, artifacts.warning].filter(
    (warning): warning is string => Boolean(warning),
  );
  if (record.projectionStatus !== "CURRENT") warnings.push("Some supplementary history could not be refreshed.");
  const chronology = archiveChronology(record.completedAt, record.startedAt, record.joinedAt);
  return {
    id: record.id,
    chronology: {
      ...chronology,
      startedAt: record.startedAt?.toISOString() ?? null,
      joinedAt: record.joinedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
    },
    chronicle: {
      historicalTitle: record.chronicleTitleSnapshot,
      historicalCover: coverOf(record),
      publishedVersionId: record.publishedVersionId,
      publishedVersionLabel: record.publishedVersion.versionLabel,
      publishedVersionChecksum: record.publishedVersionChecksum,
    },
    lifecycle: presentLifecycle(record.lifecycleStatus),
    participation: {
      historicalDisplayName: record.playerNameSnapshot,
      role: record.participationRole,
      humanRole: presentRole(record.participationRole),
      crewRole: record.crewRoleSnapshot,
    },
    outcome: presentOutcome(record.outcome),
    timing: {
      definitionVersion: record.metricDefinitionVersion,
      wallClock: presentTiming(record.wallClockSeconds, record.wallClockAccuracy),
      active: presentTiming(record.activeSeconds, record.activeAccuracy),
      paused: presentTiming(record.pausedSeconds, record.pausedAccuracy),
      connected: presentTiming(record.connectedSeconds, record.connectedAccuracy),
      interactive: presentTiming(record.interactiveSeconds, record.interactiveAccuracy),
      captainWait: presentTiming(record.captainWaitSeconds, record.captainWaitAccuracy),
    },
    attribution: {
      creator: record.creatorAttributionSnapshot
        ? {
            historicalLabel: record.creatorAttributionSnapshot,
            roleLabel: "Creator",
            quality: "EXACT",
            source: "PUBLISHED_VERSION",
            explanation: null,
          }
        : {
            historicalLabel: null,
            roleLabel: "Creator",
            quality: "UNAVAILABLE",
            source: "UNAVAILABLE",
            explanation: "Historical Creator attribution was not preserved for this edition.",
          },
      captain: captainAttribution(record),
    },
    chapters: chapters.value.map((chapter) => ({
      id: chapter.blockId,
      title: chapter.title,
      completedAt: chapter.completedAt,
      sequence: chapter.sourceSequence,
      quality: chapter.accuracy,
      source: "SESSION_FACT",
    })),
    optionalObjectives: {
      available: objectives.value.some((objective) => objective.state === "AVAILABLE"),
      completedCount:
        objectives.value.filter((objective) => objective.state === "AVAILABLE" && objective.completed).length || null,
      totalCount: objectives.value.filter((objective) => objective.state === "AVAILABLE").length || null,
      objectives: objectives.value
        .filter((objective) => objective.state === "AVAILABLE")
        .map((objective) => ({ label: objective.label, completed: objective.completed, quality: "EXACT" })),
      explanation: objectiveExplanation(objectives.value, objectives.warning),
      quality: objectives.value.some((objective) => objective.state === "AVAILABLE") ? "EXACT" : "UNAVAILABLE",
      source: "WAYFARER_RECORD",
    },
    choices: {
      available: choices.value.some((choice) => choice.state === "AVAILABLE"),
      items: choices.value
        .filter((choice) => choice.state === "AVAILABLE")
        .map((choice) => ({
          label: choice.label,
          chapterTitle: choice.chapterTitle ?? null,
          kind: choice.kind,
          detail: choice.detail ?? null,
          quality: "EXACT",
        })),
      explanation: choiceExplanation(choices.value, choices.warning),
      quality: choices.value.some((choice) => choice.state === "AVAILABLE") ? "EXACT" : "UNAVAILABLE",
      source: "WAYFARER_RECORD",
    },
    crew: record.participantSnapshots.map((participant) => ({
      historicalDisplayName:
        participant.tombstoneState === "ACTIVE" ? participant.displayNameSnapshot : "Former crew member",
      avatarAlt: participant.tombstoneState === "ACTIVE" ? participant.avatarAltSnapshot : null,
      role: participant.participationRole,
      humanRole: presentRole(participant.participationRole),
      crewRole: participant.crewRoleSnapshot,
      joinedAt: participant.joinedAt?.toISOString() ?? null,
      completedAt: participant.completedAt?.toISOString() ?? null,
      removedAt: participant.removedAt?.toISOString() ?? null,
      isHistoricalCaptain: participant.participationRole === "CAPTAIN",
      quality: participant.tombstoneState === "ACTIVE" ? "EXACT" : "UNAVAILABLE",
    })),
    artifacts: {
      sharedVoyageContext: artifacts.value.map((artifact) => ({
        name: artifact.name,
        revealedAt: artifact.revealedAt,
        source: "SESSION_FACT",
      })),
      personalRecords: personalArtifacts.map((artifact) => ({
        id: artifact.id,
        name: artifact.artifactNameSnapshot,
        state: artifact.ownershipState,
        humanState: presentArtifactState(artifact.ownershipState),
        grantedAt: artifact.grantedAt?.toISOString() ?? null,
        witnessedAt: artifact.witnessedAt?.toISOString() ?? null,
        sourceBlockId: artifact.sourceBlockId,
        collectionKey: artifact.collectionKeySnapshot,
        assemblyKey: artifact.assemblyKeySnapshot,
        componentRole: artifact.componentRoleSnapshot,
        source: "PERSONAL_ARTIFACT_RECORD",
      })),
      assemblies: assemblies.map((assembly) => ({
        id: assembly.id,
        key: assembly.assemblyKeySnapshot,
        name: assembly.assembledArtifactName,
        status: assembly.status,
        completedAt: assembly.completedAt?.toISOString() ?? null,
        source: "PERSONAL_ARTIFACT_RECORD",
      })),
    },
    achievements: achievements.map((achievement) => ({
      id: achievement.id,
      title: achievement.definition.titleSnapshot,
      description: achievement.definition.descriptionSnapshot,
      state: achievement.state,
      earnedAt: achievement.earnedAt?.toISOString() ?? null,
      definitionVersion: achievement.definitionVersion,
      source: "ACHIEVEMENT_EVIDENCE",
    })),
    reflection: record.reflection,
    memories: record.memories.map((memory) => ({
      ...memory,
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
      media: [],
    })),
    keepsake: record.keepsake
      ? {
          status: record.keepsake.status,
          humanStatus: presentKeepsakeStatus(record.keepsake.status),
          generatedAt: record.keepsake.generatedAt.toISOString(),
          regeneratedAt: record.keepsake.regeneratedAt?.toISOString() ?? null,
          participantCount: new Set(record.keepsake.consents.map((consent) => consent.historicalLabel ?? consent.scope))
            .size,
          consent: record.keepsake.consents.map((consent) => ({
            scope: consent.scope,
            state: consent.state,
            historicalLabel: consent.historicalLabel,
            decidedAt: consent.decidedAt?.toISOString() ?? null,
          })),
          state: keepsakeState(
            record.keepsake.status,
            record.keepsake.consents.map((consent) => consent.state),
          ),
          explanation: keepsakeExplanation(record.keepsake.consents.map((consent) => consent.state)),
        }
      : null,
    provenance: {
      historyRecordId: record.id,
      sourcePlaythroughId: record.sourcePlaythroughId,
      sourceMembershipId: record.sourceMembershipId,
      publishedVersionId: record.publishedVersionId,
      publishedVersionChecksum: record.publishedVersionChecksum,
      metricDefinitionVersion: record.metricDefinitionVersion,
      projectionStatus: record.projectionStatus,
      projectionReason: record.projectionReason,
      lastDerivedAt: record.lastDerivedAt.toISOString(),
      fields: [
        { label: "Played edition", quality: "EXACT", source: "PUBLISHED_VERSION" },
        {
          label: "Journey timing",
          quality: record.wallClockAccuracy as VoyageDetail["timing"]["wallClock"]["quality"],
          source: "DERIVED_VERSIONED_METRIC",
        },
        { label: "Historical crew", quality: "EXACT", source: "MEMBERSHIP_FACT" },
        { label: "Owner remembrance", quality: "NOT_APPLICABLE", source: "OWNER_ANNOTATION" },
      ],
    },
    dataQuality: warnings.length ? "PARTIAL" : "COMPLETE",
    warnings,
    ...(comparison ? { comparison } : {}),
    ...(() => {
      const review = reviewOf(record);
      return review ? { review } : {};
    })(),
  };
}

function captainAttribution(record: DetailRecord): VoyageDetail["attribution"]["captain"] {
  const captain = record.participantSnapshots.find((participant) => participant.participationRole === "CAPTAIN");
  if (!captain)
    return {
      historicalLabel: null,
      roleLabel: "Captain",
      quality: "UNAVAILABLE",
      source: "UNAVAILABLE",
      explanation: "Historical Captain attribution was not preserved for this Voyage.",
    };
  return {
    historicalLabel: captain.tombstoneState === "ACTIVE" ? captain.displayNameSnapshot : "Former crew member",
    roleLabel: "Captain",
    quality: captain.tombstoneState === "ACTIVE" ? "EXACT" : "UNAVAILABLE",
    source: "MEMBERSHIP_FACT",
    explanation: captain.tombstoneState === "ACTIVE" ? null : "The historical Captain profile is no longer available.",
  };
}

function objectiveExplanation(
  objectives: Array<z.infer<typeof objectiveSummarySchema>[number]>,
  warning: string | null,
) {
  if (warning) return "Optional-objective history needs reconciliation.";
  return (
    objectives.find((objective) => objective.state === "UNAVAILABLE")?.reason.replace(/^UNAVAILABLE:\s*/u, "") ??
    (objectives.some((objective) => objective.state === "AVAILABLE")
      ? null
      : "Optional objective detail was not preserved for this edition.")
  );
}

function choiceExplanation(choices: Array<z.infer<typeof safeChoiceSummarySchema>[number]>, warning: string | null) {
  if (warning) return "Choice history needs reconciliation.";
  return (
    choices.find((choice) => choice.state === "UNAVAILABLE")?.reason.replace(/^UNAVAILABLE:\s*/u, "") ??
    (choices.some((choice) => choice.state === "AVAILABLE")
      ? null
      : "Detailed choice history was not preserved for this edition.")
  );
}

function keepsakeState(
  status: string,
  consentStates: string[],
): "READY" | "INCOMPLETE_CONSENT" | "DEGRADED" | "UNAVAILABLE" {
  if (status !== "READY") return "UNAVAILABLE";
  if (consentStates.includes("REVOKED")) return "DEGRADED";
  if (consentStates.some((state) => state === "PENDING" || state === "DENIED")) return "INCOMPLETE_CONSENT";
  return "READY";
}

function keepsakeExplanation(consentStates: string[]) {
  if (consentStates.includes("REVOKED"))
    return "A participant revoked consent, so their affected Keepsake representation is redacted.";
  if (consentStates.includes("DENIED"))
    return "A participant did not permit one or more requested Keepsake representations.";
  if (consentStates.includes("PENDING")) return "Some participant representation remains pending consent.";
  return null;
}

export async function ownedHistoricalCover(playerProfileId: string, recordId: string) {
  return db.playerChronicleRecord.findFirst({
    where: { id: recordId, playerProfileId, chronicleCoverSnapshot: { not: null } },
    select: { chronicleCoverSnapshot: true, publishedVersionId: true },
  });
}
