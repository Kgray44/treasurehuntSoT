import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// Caller must first enforce the existing generic task-owned database guard.
// This is a pinned archive read fixture, not proof of publication authority.
export async function prepareParallaxCompatibilityArchive(store: PrismaClient, profileId: string) {
  const prefix = `parallax-compat-${profileId}`;
  const recordId = `${prefix}-record`;
  const existing = await store.playerChronicleRecord.findUnique({ where: { id: recordId } });
  if (existing) {
    const [memoryCount, participantCount] = await Promise.all([
      store.chronicleMemory.count({
        where: { playerChronicleRecordId: recordId, body: "PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY" },
      }),
      store.playerChronicleParticipantSnapshot.count({
        where: { historyRecordId: recordId, participantProfileId: profileId },
      }),
    ]);
    if (
      memoryCount !== 1 ||
      participantCount !== 1 ||
      existing.chronicleTitleSnapshot !== "Synthetic Parallax pinned Voyage"
    )
      throw new Error("PARALLAX_COMPATIBILITY_ARCHIVE_PARTIAL_FIXTURE");
    return recordId;
  }
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: `${prefix}-tale`,
      slug: prefix,
      title: "Synthetic Parallax pinned Voyage",
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: `${prefix}-chapter`,
        title: "The preserved passage",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: `${prefix}-block`,
        completionBlockId: `${prefix}-block`,
        blocks: [
          {
            id: `${prefix}-block`,
            chapterId: `${prefix}-chapter`,
            blockType: "NARRATIVE",
            title: "Historical marker",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 0,
            nextBlockId: null,
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
  const chronicle = await store.chronicle.create({
    data: {
      id: `${prefix}-tale`,
      slug: prefix,
      title: "Synthetic later live title",
      creatorId: profileId,
      visibility: "PRIVATE",
    },
  });
  const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const version = await store.publishedTaleVersion.create({
    data: {
      taleId: chronicle.id,
      versionNumber: 1,
      versionLabel: "Preserved edition",
      publishedBy: profileId,
      checksum,
      contentSnapshot: JSON.stringify(snapshot),
    },
  });
  await store.playerChronicleRecord.create({
    data: {
      id: recordId,
      playerProfileId: profileId,
      sourcePlaythroughId: `${prefix}-playthrough`,
      sourceMembershipId: `${prefix}-membership`,
      publishedVersionId: version.id,
      publishedVersionChecksum: checksum,
      chronicleTitleSnapshot: "Synthetic Parallax pinned Voyage",
      playerNameSnapshot: "Synthetic Parallax Archive Player",
      participationRole: "PLAYER",
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED:internal-ending-id",
      startedAt: new Date("2026-01-01T10:00:00.000Z"),
      joinedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T11:00:00.000Z"),
      wallClockSeconds: 3600,
      wallClockAccuracy: "EXACT",
      completedChapters: JSON.stringify([
        {
          schemaVersion: 1,
          blockId: `${prefix}-block`,
          chapterId: `${prefix}-chapter`,
          title: "The preserved passage",
          completedAt: "2026-01-01T11:00:00.000Z",
          sourceSequence: 1,
          accuracy: "EXACT",
        },
      ]),
      optionalObjectives: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
      choiceSummary: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
      artifactSummary: "[]",
      sourceFingerprint: `${prefix}-fingerprint`,
    },
  });
  await store.playerChronicleParticipantSnapshot.create({
    data: {
      historyRecordId: recordId,
      sourceMembershipId: `${prefix}-membership`,
      participantProfileId: profileId,
      displayNameSnapshot: "Synthetic Parallax Archive Player",
      participationRole: "PLAYER",
      joinedAt: new Date("2026-01-01T10:00:00.000Z"),
      completedAt: new Date("2026-01-01T11:00:00.000Z"),
    },
  });
  await store.chronicleMemory.create({
    data: {
      playerChronicleRecordId: recordId,
      playerProfileId: profileId,
      title: "Synthetic private memory",
      body: "PRIVATE-PARALLAX-COMPATIBILITY-MEMORY-CANARY",
    },
  });
  return recordId;
}
