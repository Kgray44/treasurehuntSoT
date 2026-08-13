import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const prefix = "wakebook-p1-owner";
const taskRoot = path.resolve(required("WAKEBOOK_PHASE1_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");

const retainedRuntimeRoot = path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport");
if (!taskRoot.startsWith(retainedRuntimeRoot + path.sep) || !path.basename(taskRoot).startsWith("wakebook-phase1-"))
  throw new Error(`WAKEBOOK_PHASE1_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath || databasePath === canonicalDatabase || !databasePath.startsWith(taskRoot + path.sep))
  throw new Error(`WAKEBOOK_PHASE1_DATABASE_REFUSED:${databasePath}`);

const profiles = {
  owner: "hp4-player-player",
  crew: "hp7-player-captain-only",
  foreign: "hp7-player-creator-only",
  firstUse: "hp7-player-empty-new",
};
for (const [alias, id] of Object.entries(profiles)) {
  if (!(await db.playerProfile.findUnique({ where: { id }, select: { id: true } })))
    throw new Error(`WAKEBOOK_PHASE1_PROFILE_MISSING:${alias}:${id}`);
}

const chronicleId = `${prefix}-chronicle`;
const versionId = `${prefix}-version`;
const detailRecordId = `${prefix}-record-detail`;
const partialRecordId = `${prefix}-record-partial`;
const sessionId = `${prefix}-invitation-session`;
const invitationId = `${prefix}-invitation`;
const snapshot = {
  schemaVersion: 1,
  tale: {
    id: `${prefix}-tale`,
    slug: "wakebook-phase1-owner-review",
    title: "The Lantern Below",
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
      title: "The Safe Descent",
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
          title: "Safe marker",
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
  publishedAt: "2024-01-01T00:00:00.000Z",
};
const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");

await clearPreviousFixture();
await db.chronicle.create({
  data: {
    id: chronicleId,
    slug: "wakebook-phase1-owner-review",
    title: "The Lantern Below",
    creatorId: profiles.owner,
  },
});
await db.publishedTaleVersion.create({
  data: {
    id: versionId,
    taleId: chronicleId,
    versionNumber: 1,
    versionLabel: "First Tide",
    publishedBy: profiles.owner,
    checksum,
    contentSnapshot: JSON.stringify(snapshot),
  },
});

await db.playerChronicleRecord.create({
  data: {
    id: detailRecordId,
    playerProfileId: profiles.owner,
    sourcePlaythroughId: `${prefix}-playthrough-detail`,
    sourceMembershipId: `${prefix}-membership-owner`,
    publishedVersionId: versionId,
    publishedVersionChecksum: checksum,
    chronicleTitleSnapshot: "The Lantern Below",
    playerNameSnapshot: "Mara Testwake",
    participationRole: "CAPTAIN",
    crewRoleSnapshot: "Navigator",
    lifecycleStatus: "COMPLETED",
    outcome: "COMPLETED:internal-ending-id",
    startedAt: new Date("2026-12-31T10:00:00.000Z"),
    joinedAt: new Date("2026-12-31T10:00:00.000Z"),
    completedAt: new Date("2026-12-31T11:02:00.000Z"),
    wallClockSeconds: 3720,
    wallClockAccuracy: "EXACT",
    completedChapters: JSON.stringify([
      {
        schemaVersion: 1,
        blockId: `${prefix}-block`,
        chapterId: `${prefix}-chapter`,
        title: "The Safe Descent",
        completedAt: "2026-12-31T11:00:00.000Z",
        sourceSequence: 1,
        accuracy: "EXACT",
      },
    ]),
    optionalObjectives: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
    choiceSummary: JSON.stringify([{ schemaVersion: 1, reason: "UNAVAILABLE: not preserved." }]),
    artifactSummary: JSON.stringify([
      {
        schemaVersion: 1,
        artifactId: `${prefix}-artifact`,
        name: "Shared Lantern",
        sourceBlockId: `${prefix}-block`,
        eventType: "artifactGranted",
        revealedAt: "2026-12-31T10:30:00.000Z",
        sourceSequence: 2,
        classification: "SHARED_VOYAGE_ARTIFACT",
      },
    ]),
    sourceFingerprint: `${prefix}-fingerprint-detail`,
  },
});
await db.playerChronicleParticipantSnapshot.createMany({
  data: [
    {
      id: `${prefix}-participant-owner`,
      historyRecordId: detailRecordId,
      sourceMembershipId: `${prefix}-membership-owner`,
      participantProfileId: profiles.owner,
      displayNameSnapshot: "Mara Testwake",
      participationRole: "CAPTAIN",
      crewRoleSnapshot: "Navigator",
      joinedAt: new Date("2026-12-31T10:00:00.000Z"),
      completedAt: new Date("2026-12-31T11:02:00.000Z"),
    },
    {
      id: `${prefix}-participant-crew`,
      historyRecordId: detailRecordId,
      sourceMembershipId: `${prefix}-membership-crew`,
      participantProfileId: profiles.crew,
      displayNameSnapshot: "Captain Northstar",
      participationRole: "PLAYER",
      crewRoleSnapshot: "Lookout",
      joinedAt: new Date("2026-12-31T10:02:00.000Z"),
      completedAt: new Date("2026-12-31T11:02:00.000Z"),
    },
  ],
});
await db.chronicleReflection.create({
  data: { id: `${prefix}-reflection`, playerChronicleRecordId: detailRecordId, privateNote: "Private reflection" },
});
await db.chronicleMemory.create({
  data: {
    id: `${prefix}-memory`,
    playerChronicleRecordId: detailRecordId,
    playerProfileId: profiles.owner,
    title: "A private memory",
    body: "A synthetic owner-only Wakebook memory.",
  },
});
await db.playerArtifactRecord.create({
  data: {
    id: `${prefix}-artifact-record`,
    playerProfileId: profiles.owner,
    sourcePlaythroughId: `${prefix}-playthrough-detail`,
    sourceGrantEventId: `${prefix}-grant`,
    sourceGrantSequence: 2,
    sourceBlockId: `${prefix}-block`,
    publishedVersionId: versionId,
    publishedVersionChecksum: checksum,
    chronicleTitleSnapshot: "The Lantern Below",
    artifactDefinitionId: `${prefix}-artifact`,
    artifactNameSnapshot: "Personal Lantern",
    recipientPolicy: "DIRECT_RECIPIENT",
    ownershipState: "OWNED",
    grantedAt: new Date("2026-12-31T10:30:00.000Z"),
    sourceFingerprint: `${prefix}-artifact-fingerprint`,
  },
});
await db.playerChronicleRecord.create({
  data: {
    id: partialRecordId,
    playerProfileId: profiles.owner,
    sourcePlaythroughId: `${prefix}-playthrough-partial`,
    publishedVersionId: versionId,
    publishedVersionChecksum: checksum,
    chronicleTitleSnapshot: "The Quiet Crossing",
    playerNameSnapshot: "Mara Testwake",
    lifecycleStatus: "ACCEPTED",
    outcome: "UNAVAILABLE",
    startedAt: new Date("2026-01-03T08:00:00.000Z"),
    joinedAt: new Date("2026-01-03T08:00:00.000Z"),
    completedAt: null,
    wallClockSeconds: null,
    wallClockAccuracy: "UNAVAILABLE",
    sourceFingerprint: `${prefix}-fingerprint-partial`,
  },
});

const bulk = Array.from({ length: 1_003 }, (_, index) => {
  const year = index < 500 ? 2026 : 2025;
  const day = (index % 27) + 1;
  return {
    id: `${prefix}-record-${String(index).padStart(4, "0")}`,
    playerProfileId: profiles.owner,
    sourcePlaythroughId: `${prefix}-playthrough-${index}`,
    publishedVersionId: versionId,
    publishedVersionChecksum: checksum,
    chronicleTitleSnapshot: `Wakebook Voyage ${String(index).padStart(4, "0")}`,
    playerNameSnapshot: "Mara Testwake",
    lifecycleStatus: index % 7 === 0 ? "PAUSED" : "COMPLETED",
    outcome: index % 7 === 0 ? "UNAVAILABLE" : "COMPLETED",
    startedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T10:00:00.000Z`),
    joinedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T10:00:00.000Z`),
    completedAt: new Date(`${year}-06-${String(day).padStart(2, "0")}T11:00:00.000Z`),
    wallClockSeconds: 3600,
    wallClockAccuracy: "EXACT",
    sourceFingerprint: `${prefix}-fingerprint-${index}`,
  };
});
for (let offset = 0; offset < bulk.length; offset += 100)
  await db.playerChronicleRecord.createMany({ data: bulk.slice(offset, offset + 100) });

await db.taleSession.create({
  data: {
    id: sessionId,
    taleId: chronicleId,
    publishedVersionId: versionId,
    accessTokenHash: createHash("sha256").update(`${prefix}-invite`).digest("hex"),
  },
});
await db.invitation.create({
  data: {
    id: invitationId,
    playthroughId: sessionId,
    intendedPlayerId: profiles.owner,
    tokenHash: createHash("sha256").update(`${prefix}-token`).digest("hex"),
    tokenPrefix: "synthetic",
    shortCodeHash: createHash("sha256").update(`${prefix}-code`).digest("hex"),
    shortCodePrefix: "synthetic",
    recipientName: "Mara Testwake",
    createdBy: profiles.owner,
    expiresAt: new Date("2026-12-01T00:00:00.000Z"),
    status: "DECLINED",
    declinedAt: new Date("2026-11-01T00:00:00.000Z"),
  },
});

const counts = {
  playedVoyages: await db.playerChronicleRecord.count({ where: { playerProfileId: profiles.owner } }),
  invitations: await db.invitation.count({ where: { intendedPlayerId: profiles.owner } }),
  firstUsePlayedVoyages: await db.playerChronicleRecord.count({ where: { playerProfileId: profiles.firstUse } }),
};
process.stdout.write(
  `${JSON.stringify(
    {
      status: "WAKEBOOK_PHASE1_OWNER_FIXTURE_READY",
      fixtureVersion: "wakebook-phase1-owner-review-v1",
      databasePath,
      accounts: {
        owner: "player-only@phase7.example.test",
        foreign: "creator-only@phase7.example.test",
        firstUse: "empty-new@phase7.example.test",
      },
      detailRecordId,
      partialRecordId,
      counts,
    },
    null,
    2,
  )}\n`,
);
await db.$disconnect();

async function clearPreviousFixture() {
  await db.invitation.deleteMany({ where: { id: invitationId } });
  await db.taleSession.deleteMany({ where: { id: sessionId } });
  await db.playerArtifactRecord.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.chronicleMemory.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.chronicleReflection.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.playerChronicleParticipantSnapshot.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.playerChronicleRecord.deleteMany({ where: { id: { startsWith: prefix } } });
  await db.publishedTaleVersion.deleteMany({ where: { id: versionId } });
  await db.chronicle.deleteMany({ where: { id: chronicleId } });
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
