import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const databaseUrl = process.env.DATABASE_URL ?? "";
const taskRoot = path.resolve(process.env.HOMEPORT_PHASE5_TASK_ROOT ?? "");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const fixtureVersion = "homeport-phase5-route-reachability-v1";
const createdAt = new Date("2026-08-03T18:00:00.000Z");
const hashToken = (value) => createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(36).toString("base64url");

if (!databasePath || !taskRoot || databasePath === canonicalDatabase || !databasePath.startsWith(taskRoot + path.sep))
  throw new Error(`HOMEPORT_PHASE5_FIXTURE_REFUSES_UNOWNED_DATABASE:${databasePath}`);

async function upsertRole(accountId, role) {
  const existing = await db.accountRoleAssignment.findFirst({ where: { accountId, role, scopeType: "GLOBAL" } });
  if (existing) return db.accountRoleAssignment.update({ where: { id: existing.id }, data: { revokedAt: null } });
  return db.accountRoleAssignment.create({ data: { id: `hp5-role-${role.toLowerCase()}`, accountId, role } });
}

async function upsertSession({ id, taleId, versionId, captainId, captainAccountId, status, chapterId, blockId }) {
  return db.taleSession.upsert({
    where: { id },
    update: {
      taleId,
      publishedVersionId: versionId,
      captainId,
      captainAccountId,
      status,
      currentChapterId: chapterId,
      currentBlockId: blockId,
      launchedAt: status === "ACTIVE" ? createdAt : null,
      previewMode: false,
    },
    create: {
      id,
      taleId,
      publishedVersionId: versionId,
      ownerLabel: "Synthetic Route Crew",
      voyageName: status === "ACTIVE" ? "Active Route Voyage" : "Ready Route Voyage",
      captainId,
      captainAccountId,
      accessTokenHash: hashToken(`hp5-access-${id}`),
      status,
      currentChapterId: chapterId,
      currentBlockId: blockId,
      launchedAt: status === "ACTIVE" ? createdAt : null,
      previewMode: false,
      startedAt: createdAt,
    },
  });
}

async function upsertMembership(id, playthroughId, playerProfileId, status) {
  return db.playthroughMembership.upsert({
    where: { id },
    update: { playthroughId, playerProfileId, status, joinedAt: createdAt, removedAt: null, hiddenAt: null },
    create: { id, playthroughId, playerProfileId, status, joinedAt: createdAt },
  });
}

async function upsertInvitation({
  id,
  playthroughId,
  creatorId,
  creatorAccountId,
  recipientId,
  raw,
  status,
  expiresAt,
}) {
  const tokenHash = hashToken(raw);
  return db.invitation.upsert({
    where: { id },
    update: {
      playthroughId,
      intendedPlayerId: recipientId,
      tokenHash,
      shortCodeHash: hashToken(`${raw}:short`),
      status,
      expiresAt,
      revokedAt: status === "REVOKED" ? createdAt : null,
    },
    create: {
      id,
      playthroughId,
      intendedPlayerId: recipientId,
      tokenHash,
      tokenPrefix: raw.slice(0, 6),
      shortCodeHash: hashToken(`${raw}:short`),
      shortCodePrefix: "HP5",
      recipientName: "Synthetic Route Mariner",
      status,
      expiresAt,
      maxRedemptions: 1,
      redemptionCount: status === "ACCEPTED" ? 1 : 0,
      acceptedAt: status === "ACCEPTED" ? createdAt : null,
      revokedAt: status === "REVOKED" ? createdAt : null,
      createdBy: creatorId,
      creatorAccountId,
      createdAt,
    },
  });
}

async function seed() {
  const creatorGm = await db.gameMasterUser.findUniqueOrThrow({ where: { username: "hp4-creator" } });
  const creatorAccount = await db.userAccount.findFirstOrThrow({
    where: { legacyGameMasterId: creatorGm.id },
    include: { profile: true },
  });
  const playerAccount = await db.userAccount.findFirstOrThrow({
    where: { legacyGameMaster: { username: "hp4-player" } },
    include: { profile: true },
  });
  const moderatorAccount = await db.userAccount.findFirstOrThrow({
    where: { legacyGameMaster: { username: "hp4-moderator" } },
  });
  if (!creatorAccount.profile || !playerAccount.profile) throw new Error("HOMEPORT_PHASE5_FIXTURE_PROFILE_MISSING");
  await Promise.all([
    upsertRole(creatorAccount.id, "PLAYER"),
    upsertRole(creatorAccount.id, "CAPTAIN"),
    upsertRole(creatorAccount.id, "CREATOR"),
  ]);

  const tale = await db.chronicle.findUniqueOrThrow({ where: { id: "hp4-tale-lantern-coast" } });
  const draft = await db.taleDraft.upsert({
    where: { id: "hp5-draft-route-chronicle" },
    update: { taleId: tale.id, createdBy: creatorGm.id, createdByAccountId: creatorAccount.id },
    create: {
      id: "hp5-draft-route-chronicle",
      taleId: tale.id,
      createdBy: creatorGm.id,
      createdByAccountId: creatorAccount.id,
      validationState: "VALID",
      validationSummary: '{"valid":true,"errors":[],"warnings":[]}',
    },
  });
  const chapter = await db.taleChapter.upsert({
    where: { id: "hp5-chapter-route-chronicle" },
    update: { draftRevisionId: draft.id, title: "The Synthetic Bearing", orderIndex: 0 },
    create: {
      id: "hp5-chapter-route-chronicle",
      draftRevisionId: draft.id,
      title: "The Synthetic Bearing",
      orderIndex: 0,
      entryBlockId: "hp5-block-route-chronicle",
      completionBlockId: "hp5-block-route-chronicle",
    },
  });
  const block = await db.storyBlock.upsert({
    where: { id: "hp5-block-route-chronicle" },
    update: { chapterId: chapter.id, title: "Confirm the synthetic bearing", orderIndex: 0 },
    create: {
      id: "hp5-block-route-chronicle",
      chapterId: chapter.id,
      blockType: "taleComplete",
      title: "Confirm the synthetic bearing",
      orderIndex: 0,
      configuration: '{"completionMessage":"Synthetic route complete","completionMode":"playerConfirmation"}',
    },
  });
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: tale.subtitle,
      shortDescription: tale.shortDescription,
      longDescription: tale.longDescription,
      coverAssetId: null,
      theme: tale.theme,
      visibility: "PUBLIC",
      playerCountMin: tale.playerCountMin,
      playerCountMax: tale.playerCountMax,
      estimatedDuration: tale.estimatedDuration,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapter.id,
        title: chapter.title,
        subtitle: null,
        description: "A harmless synthetic route fixture.",
        coverAssetId: null,
        estimatedDuration: 1,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: block.id,
        completionBlockId: block.id,
        blocks: [
          {
            id: block.id,
            chapterId: chapter.id,
            blockType: block.blockType,
            title: block.title,
            internalLabel: null,
            configuration: { completionMessage: "Synthetic route complete", completionMode: "playerConfirmation" },
            presentation: {},
            completion: {},
            creatorNotes: null,
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets: [],
    locations: [],
    artifacts: [],
    sideQuests: [],
    publishedAt: createdAt.toISOString(),
  };
  const version = await db.publishedTaleVersion.upsert({
    where: { id: "hp4-version-lantern-coast" },
    update: {
      taleId: tale.id,
      contentSnapshot: JSON.stringify(snapshot),
      checksum: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      isCurrent: true,
    },
    create: {
      id: "hp4-version-lantern-coast",
      taleId: tale.id,
      versionNumber: 1,
      versionLabel: "1.0.0",
      publishedBy: creatorGm.id,
      publishedByAccountId: creatorAccount.id,
      contentSnapshot: JSON.stringify(snapshot),
      checksum: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
      isCurrent: true,
      publishedAt: createdAt,
    },
  });
  await db.chronicle.update({
    where: { id: tale.id },
    data: {
      currentDraftRevisionId: draft.id,
      latestPublishedVersionId: version.id,
      creatorAccountId: creatorAccount.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });

  const ready = await upsertSession({
    id: "hp5-session-ready",
    taleId: tale.id,
    versionId: version.id,
    captainId: creatorGm.id,
    captainAccountId: creatorAccount.id,
    status: "READY",
    chapterId: chapter.id,
    blockId: block.id,
  });
  const active = await upsertSession({
    id: "hp5-session-active",
    taleId: tale.id,
    versionId: version.id,
    captainId: creatorGm.id,
    captainAccountId: creatorAccount.id,
    status: "ACTIVE",
    chapterId: chapter.id,
    blockId: block.id,
  });
  await Promise.all([
    upsertMembership("hp5-membership-ready", ready.id, creatorAccount.profile.id, "ACCEPTED"),
    upsertMembership("hp5-membership-active", active.id, creatorAccount.profile.id, "ACTIVE_MEMBER"),
  ]);

  await db.playerChronicleRecord.upsert({
    where: { id: "hp5-history-route" },
    update: { playerProfileId: creatorAccount.profile.id, publishedVersionId: version.id },
    create: {
      id: "hp5-history-route",
      playerProfileId: creatorAccount.profile.id,
      sourcePlaythroughId: "hp5-history-source",
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      chronicleTitleSnapshot: "Synthetic Route Chronicle",
      playerNameSnapshot: creatorAccount.profile.displayName,
      lifecycleStatus: "COMPLETED",
      outcome: "COMPLETED:synthetic-route",
      startedAt: createdAt,
      completedAt: createdAt,
      sourceFingerprint: hashToken("hp5-history-route"),
    },
  });
  await db.playerArtifactRecord.upsert({
    where: { id: "hp5-artifact-route" },
    update: { playerProfileId: creatorAccount.profile.id, publishedVersionId: version.id },
    create: {
      id: "hp5-artifact-route",
      playerProfileId: creatorAccount.profile.id,
      sourcePlaythroughId: "hp5-artifact-source",
      sourceGrantEventId: "hp5-artifact-grant",
      sourceGrantSequence: 1,
      publishedVersionId: version.id,
      publishedVersionChecksum: version.checksum,
      chronicleTitleSnapshot: "Synthetic Route Chronicle",
      artifactDefinitionId: "hp5-synthetic-compass",
      artifactNameSnapshot: "Synthetic Route Compass",
      artifactTypeSnapshot: "RELIC",
      representationSnapshot: "FALLBACK",
      recipientPolicy: "SELECTED_PLAYER",
      recipientEvidence: '{"synthetic":true}',
      ownershipState: "OWNED",
      custody: "PERSONAL",
      recordStatus: "ACTIVE",
      grantedAt: createdAt,
      sourceFingerprint: hashToken("hp5-artifact-route"),
    },
  });

  await db.communityModerationCase.upsert({
    where: { id: "hp5-moderation-case" },
    update: { conflictAccountId: playerAccount.id, status: "OPEN", revision: 1 },
    create: {
      id: "hp5-moderation-case",
      caseKey: "HP5-SYNTHETIC-CASE",
      status: "OPEN",
      severity: "LOW",
      priority: "LOW",
      primaryReasonCode: "SYNTHETIC_ROUTE_REVIEW",
      subjectFingerprint: hashToken("hp5-moderation-subject"),
      conflictAccountId: playerAccount.id,
      correlationId: "hp5-route-correlation",
      openedAt: createdAt,
    },
  });

  const secrets = {
    resetValid: secret(),
    resetExpired: secret(),
    resetConsumed: secret(),
    verifyValid: secret(),
    verifyExpired: secret(),
    invitationValid: secret(),
    invitationExpired: secret(),
    invitationRevoked: secret(),
  };
  await db.accountToken.deleteMany({ where: { id: { startsWith: "hp5-token-" } } });
  await db.accountToken.createMany({
    data: [
      {
        id: "hp5-token-reset-valid",
        accountId: playerAccount.id,
        purpose: "PASSWORD_RESET",
        tokenHash: hashToken(secrets.resetValid),
        expiresAt: new Date("2026-08-04T18:00:00.000Z"),
      },
      {
        id: "hp5-token-reset-expired",
        accountId: playerAccount.id,
        purpose: "PASSWORD_RESET",
        tokenHash: hashToken(secrets.resetExpired),
        expiresAt: new Date("2026-08-02T18:00:00.000Z"),
      },
      {
        id: "hp5-token-reset-consumed",
        accountId: playerAccount.id,
        purpose: "PASSWORD_RESET",
        tokenHash: hashToken(secrets.resetConsumed),
        expiresAt: new Date("2026-08-04T18:00:00.000Z"),
        consumedAt: createdAt,
      },
      {
        id: "hp5-token-verify-valid",
        accountId: playerAccount.id,
        purpose: "VERIFY_EMAIL",
        tokenHash: hashToken(secrets.verifyValid),
        expiresAt: new Date("2026-08-04T18:00:00.000Z"),
      },
      {
        id: "hp5-token-verify-expired",
        accountId: playerAccount.id,
        purpose: "VERIFY_EMAIL",
        tokenHash: hashToken(secrets.verifyExpired),
        expiresAt: new Date("2026-08-02T18:00:00.000Z"),
      },
    ],
  });
  await Promise.all([
    upsertInvitation({
      id: "hp5-invitation-valid",
      playthroughId: ready.id,
      creatorId: creatorGm.id,
      creatorAccountId: creatorAccount.id,
      recipientId: null,
      raw: secrets.invitationValid,
      status: "CREATED",
      expiresAt: new Date("2026-08-04T18:00:00.000Z"),
    }),
    upsertInvitation({
      id: "hp5-invitation-expired",
      playthroughId: ready.id,
      creatorId: creatorGm.id,
      creatorAccountId: creatorAccount.id,
      recipientId: null,
      raw: secrets.invitationExpired,
      status: "EXPIRED",
      expiresAt: new Date("2026-08-02T18:00:00.000Z"),
    }),
    upsertInvitation({
      id: "hp5-invitation-revoked",
      playthroughId: ready.id,
      creatorId: creatorGm.id,
      creatorAccountId: creatorAccount.id,
      recipientId: null,
      raw: secrets.invitationRevoked,
      status: "REVOKED",
      expiresAt: new Date("2026-08-04T18:00:00.000Z"),
    }),
  ]);

  const secretsPath = path.join(taskRoot, "browser-state", "phase5-secrets.json");
  await mkdir(path.dirname(secretsPath), { recursive: true });
  await writeFile(secretsPath, `${JSON.stringify(secrets)}\n`, { encoding: "utf8", mode: 0o600 });
  const receipt = {
    status: "HOMEPORT_PHASE5_FIXTURE_READY",
    fixtureVersion,
    databasePath,
    safeFixtureIds: {
      readySession: ready.id,
      activeSession: active.id,
      studioTale: tale.id,
      history: "hp5-history-route",
      artifact: "hp5-artifact-route",
      moderationCase: "hp5-moderation-case",
    },
    accountStates: ["PLAYER", "CAPTAIN_CREATOR_PLAYER", "MODERATOR", "RESTRICTED"],
    secretKinds: Object.keys(secrets),
  };
  const fixtureChecksum = createHash("sha256").update(JSON.stringify(receipt)).digest("hex");
  process.stdout.write(`${JSON.stringify({ ...receipt, fixtureChecksum })}\n`);
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
