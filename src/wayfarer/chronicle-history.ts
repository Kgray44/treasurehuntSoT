import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";

export const TIMING_DEFINITION_VERSION = "WAYFARER_TIMING_V1";
const completedStatuses = new Set(["COMPLETED", "COMPLETED_MEMBER"]);
const terminalStatuses = new Set(["DECLINED", "EXPIRED", "REVOKED", "REMOVED", "ABANDONED", "COMPLETED"]);
const safeEventTypes = new Set([
  "CHAPTER_COMPLETED",
  "BLOCK_COMPLETED",
  "OBJECTIVE_COMPLETED",
  "HINT_USED",
  "ATTEMPT_RECORDED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_COMPLETED",
  "SESSION_ABANDONED",
]);

const memorySchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(4000).optional(),
  referenceType: z.enum(["CHAPTER", "CLUE", "MOMENT", "ARTIFACT"]).optional(),
  referenceId: z.string().trim().min(1).max(191).optional(),
});
const reflectionSchema = z.object({
  favoriteChapterId: z.string().trim().max(191).nullable().optional(),
  favoriteClueReference: z.string().trim().max(191).nullable().optional(),
  favoriteMomentReference: z.string().trim().max(191).nullable().optional(),
  favoriteArtifactReference: z.string().trim().max(191).nullable().optional(),
  privateNote: z.string().trim().max(4000).nullable().optional(),
});

function sha(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function parsedSnapshot(input: string) {
  try {
    const value = JSON.parse(input) as { tale?: { title?: string; coverAssetId?: string; creatorName?: string } };
    return value.tale ?? {};
  } catch {
    return {};
  }
}
function nonNegativeSeconds(start?: Date | null, end?: Date | null) {
  if (!start || !end || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / 1000);
}
function timing(startedAt: Date | null, completedAt: Date | null) {
  const wallClockSeconds = nonNegativeSeconds(startedAt, completedAt);
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
function lifecycle(membershipStatus: string, sessionStatus: string) {
  if (completedStatuses.has(membershipStatus) || sessionStatus === "COMPLETED") return "COMPLETED";
  if (membershipStatus === "REMOVED") return "REMOVED";
  if (membershipStatus === "DECLINED") return "DECLINED";
  if (sessionStatus === "ABANDONED") return "ABANDONED";
  return membershipStatus;
}
function outcome(status: string) {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "ABANDONED") return "ABANDONED";
  return "UNAVAILABLE";
}

function safeSummary(events: Array<{ eventType: string; createdAt: Date }>) {
  const selected = events.filter((event) => safeEventTypes.has(event.eventType));
  const count = (name: string) => selected.filter((event) => event.eventType === name).length;
  return {
    completedChapters: Array.from({ length: count("CHAPTER_COMPLETED") }, (_, index) => ({ ordinal: index + 1 })),
    optionalObjectives: Array.from({ length: count("OBJECTIVE_COMPLETED") }, (_, index) => ({ ordinal: index + 1 })),
    choiceSummary: [
      ...(count("HINT_USED") ? [{ kind: "HINT_USED", count: count("HINT_USED") }] : []),
      ...(count("ATTEMPT_RECORDED") ? [{ kind: "ATTEMPT_RECORDED", count: count("ATTEMPT_RECORDED") }] : []),
    ],
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
          events: { select: { eventType: true, createdAt: true } },
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
    const snapshot = parsedSnapshot(version.contentSnapshot);
    const nextLifecycle = lifecycle(membership.status, membership.playthrough.status);
    const summary = safeSummary(membership.playthrough.events);
    const nextTiming = timing(membership.playthrough.startedAt, membership.playthrough.completedAt);
    const sourceFingerprint = sha({
      membership: {
        id: membership.id,
        status: membership.status,
        joinedAt: membership.joinedAt,
        completedAt: membership.completedAt,
      },
      session: {
        id: membership.playthrough.id,
        status: membership.playthrough.status,
        startedAt: membership.playthrough.startedAt,
        completedAt: membership.playthrough.completedAt,
      },
      version: { id: version.id, checksum: version.checksum },
      events: membership.playthrough.events.map((event) => [event.eventType, event.createdAt.toISOString()]),
    });
    const existing = await db.playerChronicleRecord.findUnique({
      where: {
        playerProfileId_sourcePlaythroughId: { playerProfileId, sourcePlaythroughId: membership.playthroughId },
      },
      select: { id: true },
    });
    const data = {
      sourceMembershipId: membership.id,
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      participationRole: membership.role,
      crewRoleSnapshot: membership.crewRole,
      lifecycleStatus: nextLifecycle,
      outcome: outcome(nextLifecycle),
      startedAt: membership.playthrough.startedAt,
      joinedAt: membership.joinedAt,
      completedAt: membership.completedAt ?? membership.playthrough.completedAt,
      ...nextTiming,
      completedChapters: JSON.stringify(summary.completedChapters),
      optionalObjectives: JSON.stringify(summary.optionalObjectives),
      choiceSummary: JSON.stringify(summary.choiceSummary),
      artifactSummary: "[]",
      sourceFingerprint,
      projectionStatus: "CURRENT",
      projectionReason: null,
      lastDerivedAt: new Date(),
    };
    if (existing) {
      await db.playerChronicleRecord.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.playerChronicleRecord.create({
        data: {
          ...data,
          playerProfileId,
          sourcePlaythroughId: membership.playthroughId,
          chronicleTitleSnapshot: snapshot.title ?? membership.playthrough.tale.title,
          chronicleCoverSnapshot: snapshot.coverAssetId ?? membership.playthrough.tale.coverAssetId,
          creatorAttributionSnapshot: snapshot.creatorName ?? membership.playthrough.tale.creatorId,
          playerNameSnapshot: membership.player.displayName,
          playerAvatarSnapshot: membership.player.avatarMedia?.storageKey ?? null,
        },
      });
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

const recordInclude = {
  reflection: true,
  memories: { where: { deletedAt: null }, orderBy: { createdAt: "desc" as const } },
  keepsake: { include: { consents: { where: { granted: true }, select: { participantId: true } } } },
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
  return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
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
  keepsake: { status: string; generatedAt: Date; consents: unknown[] } | null;
};

function ownerRecordProjection(record: OwnerRecord) {
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
    timing: {
      definitionVersion: record.metricDefinitionVersion,
      wallClock: { seconds: record.wallClockSeconds, accuracy: record.wallClockAccuracy },
      active: { seconds: record.activeSeconds, accuracy: record.activeAccuracy },
      paused: { seconds: record.pausedSeconds, accuracy: record.pausedAccuracy },
      connected: { seconds: record.connectedSeconds, accuracy: record.connectedAccuracy },
      interactive: { seconds: record.interactiveSeconds, accuracy: record.interactiveAccuracy },
      captainWait: { seconds: record.captainWaitSeconds, accuracy: record.captainWaitAccuracy },
    },
    completedChapters: JSON.parse(record.completedChapters),
    optionalObjectives: JSON.parse(record.optionalObjectives),
    choiceSummary: JSON.parse(record.choiceSummary),
    artifactSummary: JSON.parse(record.artifactSummary),
    reflection: record.reflection,
    memories: record.memories,
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
    select: { id: true, sourcePlaythroughId: true },
  });
  if (!record) throw new Error("Chronicle history record not found.");
  return record;
}

export async function saveReflection(playerProfileId: string, recordId: string, input: unknown) {
  await ownedRecord(playerProfileId, recordId);
  const data = reflectionSchema.parse(input);
  return db.chronicleReflection.upsert({
    where: { playerChronicleRecordId: recordId },
    update: data,
    create: { playerChronicleRecordId: recordId, ...data },
  });
}
export async function addMemory(playerProfileId: string, recordId: string, input: unknown) {
  await ownedRecord(playerProfileId, recordId);
  const data = memorySchema.parse(input);
  return db.chronicleMemory.create({
    data: { playerChronicleRecordId: recordId, playerProfileId, ...data, visibility: "ONLY_ME" },
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
  const record = await ownedRecord(playerProfileId, recordId);
  const payload = JSON.stringify({ version: 1, recordId: record.id, crew: [] });
  return db.voyageKeepsake.upsert({
    where: { playerChronicleRecordId: recordId },
    update: { presentationPayload: payload, regeneratedAt: new Date() },
    create: { playerChronicleRecordId: recordId, presentationPayload: payload },
  });
}
export async function recordKeepsakeConsent(participantId: string, recordId: string, granted: boolean) {
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
    where: { keepsakeId_participantId: { keepsakeId: keepsake.id, participantId } },
    update: { granted, grantedAt: granted ? new Date() : null, revokedAt: granted ? null : new Date() },
    create: {
      keepsakeId: keepsake.id,
      participantId,
      granted,
      grantedAt: granted ? new Date() : null,
      revokedAt: granted ? null : new Date(),
    },
  });
}

export function isTerminalHistoryStatus(status: string) {
  return terminalStatuses.has(status);
}
