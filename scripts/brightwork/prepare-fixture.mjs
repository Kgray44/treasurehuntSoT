import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const repositoryRoot = path.resolve(process.cwd());
const localAppData = required("LOCALAPPDATA");
const allowedRoot = path.resolve(localAppData, "VoyagewrightBrightwork");
const taskRoot = path.resolve(process.env.BRIGHTWORK_TASK_ROOT ?? path.join(allowedRoot, "stage1"));
const homeportRoot = path.resolve(
  process.env.BRIGHTWORK_HOMEPORT_ROOT ?? path.join(localAppData, "ProjectHomeport", "brightwork-stage1"),
);
const admiraltyRoot = path.resolve(
  process.env.BRIGHTWORK_ADMIRALTY_ROOT ?? path.join(localAppData, "ProjectAdmiralty", "brightwork-stage1"),
);
const combinedDatabase = path.join(taskRoot, "database", "brightwork-combined-synthetic.db");
const admiraltyDatabase = path.join(admiraltyRoot, "database", "admiralty-phase2.db");
const homeportDatabase = path.join(
  homeportRoot,
  "owner-rereview-database",
  "homeport-phase7-owner-correction-round3-rereview.db",
);
const stageOneCensus = JSON.parse(
  git(["show", "HEAD:Development_Docs/Projects/Voyagewright_Brightwork/Current_Route_Census.json"]),
);
const sourceSha = stageOneCensus.sourceSha;
const auditOnlySourcePaths = new Set([
  "src/instrumentation.ts",
  "src/proxy.ts",
  "src/homeport/public-app-origin.ts",
  "src/wayfarer/http.ts",
]);
const ordinarySourceChanges = git(["diff", "--name-only", sourceSha, "HEAD", "--", "src"])
  .split(/\r?\n/u)
  .filter(Boolean)
  .filter(
    (file) =>
      !file.startsWith("src/audit/") &&
      !file.startsWith("src/app/__audit/") &&
      !file.startsWith("src/app/audit-internal/") &&
      !auditOnlySourcePaths.has(file),
  );
if (ordinarySourceChanges.length) {
  throw new Error(`BRIGHTWORK_PRODUCT_SOURCE_BASELINE_MOVED:${sourceSha}`);
}
const currentMainBootstrapDatabase = path.join(homeportRoot, "bootstrap", `current-main-${sourceSha.slice(0, 12)}.db`);

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("BRIGHTWORK_TASK_ROOT_REFUSED");
if (!homeportRoot.startsWith(`${path.resolve(localAppData, "ProjectHomeport")}${path.sep}`))
  throw new Error("BRIGHTWORK_HOMEPORT_ROOT_REFUSED");
if (!admiraltyRoot.startsWith(`${path.resolve(localAppData, "ProjectAdmiralty")}${path.sep}`))
  throw new Error("BRIGHTWORK_ADMIRALTY_ROOT_REFUSED");
for (const directory of [taskRoot, homeportRoot, admiraltyRoot]) await mkdir(directory, { recursive: true });

await mkdir(path.dirname(currentMainBootstrapDatabase), { recursive: true });
await rm(currentMainBootstrapDatabase, { force: true });
run("scripts/sounding-line/sqlite-bootstrap.mjs", {}, ["--database-url", sqliteUrl(currentMainBootstrapDatabase)]);

run("scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs", {
  HOMEPORT_PHASE7_TASK_ROOT: homeportRoot,
  HOMEPORT_PHASE7_SOURCE_DATABASE: currentMainBootstrapDatabase,
  HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT: "3868",
  HOMEPORT_PHASE7_OWNER_ALIAS: "FULL_CAPABILITY",
});
run(
  "scripts/homeport/phase7-owner-correction-round3-database-clone.mjs",
  {
    HOMEPORT_PHASE7_TASK_ROOT: homeportRoot,
    HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT: "3868",
  },
  ["walkthrough"],
);

if (!(await stat(homeportDatabase)).size) throw new Error("BRIGHTWORK_HOMEPORT_CLONE_EMPTY");
await mkdir(path.dirname(combinedDatabase), { recursive: true });
await mkdir(path.dirname(admiraltyDatabase), { recursive: true });
await copyFile(homeportDatabase, combinedDatabase);
await copyFile(combinedDatabase, admiraltyDatabase);

run("scripts/admiralty/seed-phase2-fixture.mjs", {
  ADMIRALTY_PHASE2_TASK_ROOT: admiraltyRoot,
  DATABASE_URL: sqliteUrl(admiraltyDatabase),
  ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD:
    process.env.BRIGHTWORK_ADMIRALTY_SYNTHETIC_PASSWORD ?? `BrwAdm-${randomBytes(24).toString("base64url")}!`,
  ADMIRALTY_PHASE2_WRITE_CREDENTIAL_HANDOFF: "1",
});
await copyFile(admiraltyDatabase, combinedDatabase);

const homeportCredentials = path.join(
  homeportRoot,
  "credentials",
  "owner-correction-round3-walkthrough-credentials.private.json",
);
const admiraltyCredentials = path.join(admiraltyRoot, "credentials", "admiralty-phase2-walkthrough.private.json");
const creatorCredentials = path.join(taskRoot, "credentials", "brightwork-creator.private.json");
await ensureBrightworkRouteRepresentatives(
  combinedDatabase,
  homeportCredentials,
  creatorCredentials,
  required("BRIGHTWORK_CREATOR_SYNTHETIC_PASSWORD"),
);
const [databaseHash, homeportAliasCount, admiraltyAliasCount] = await Promise.all([
  sha256(combinedDatabase),
  aliasCount(homeportCredentials),
  aliasCount(admiraltyCredentials),
]);
const receipt = {
  schemaVersion: "1.0.0",
  status: "BRIGHTWORK_COMBINED_SYNTHETIC_FIXTURE_READY",
  sourceSha,
  fixtureVersion: "brightwork-combined-homeport-round3-admiralty-phase2-v4-creator-continuation",
  databasePath: combinedDatabase,
  databaseHash,
  credentials: {
    homeport: homeportCredentials,
    admiralty: admiraltyCredentials,
    creator: creatorCredentials,
    homeportAliasCount,
    admiraltyAliasCount,
  },
  privacyBasis:
    "Task-owned database assembled only from governed synthetic Homeport and Admiralty fixture seeds; private credentials remain outside the repository.",
  generatedAt: new Date().toISOString(),
};
await mkdir(path.join(taskRoot, "reports"), { recursive: true });
await writeFile(
  path.join(taskRoot, "reports", "fixture-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify({ ...receipt, credentials: "EXTERNAL_PRIVATE_HANDOFFS_CREATED" })}\n`);

function run(script, variables, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, ...variables },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function aliasCount(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return Object.keys(parsed.accounts ?? parsed.aliases ?? {}).length;
}

async function ensureBrightworkRouteRepresentatives(databasePath, credentialsPath, creatorCredentialsPath, creatorPassword) {
  const credentialHandoff = JSON.parse(await readFile(credentialsPath, "utf8"));
  const aliases = credentialHandoff.accounts ?? credentialHandoff.aliases ?? {};
  const fullCapability = aliases.FULL_CAPABILITY ?? aliases.VERIFIED_FULL_CAPABILITY;
  if (!fullCapability?.accountId) throw new Error("BRIGHTWORK_FULL_CAPABILITY_ALIAS_REQUIRED");
  const db = new PrismaClient({ datasources: { db: { url: sqliteUrl(databasePath) } } });
  try {
    const creatorAccountId = "brightwork-stage6-creator-account";
    const creatorEmail = "brightwork-stage6-creator@audit.example.test";
    const player = await db.playerProfile.findFirst({
      where: { accountId: fullCapability.accountId, status: "ACTIVE" },
      select: { id: true, displayName: true },
    });
    const session = await db.taleSession.findFirst({
      where: { status: "COMPLETED", publishedVersionId: { not: null } },
      orderBy: { id: "asc" },
      include: { version: { select: { id: true, checksum: true } } },
    });
    if (!player || !session?.publishedVersionId || !session.version?.checksum)
      throw new Error("BRIGHTWORK_COMPLETED_SYNTHETIC_ROUTE_SESSION_REQUIRED");
    const completedAt = session.completedAt ?? new Date("2026-01-01T00:00:00.000Z");
    await db.userAccount.upsert({
      where: { id: creatorAccountId },
      update: {
        status: "ACTIVE",
        claimedAt: completedAt,
        ordinaryWorkspaceEntryAt: completedAt,
        lockedAt: null,
        suspendedAt: null,
      },
      create: {
        id: creatorAccountId,
        status: "ACTIVE",
        claimedAt: completedAt,
        ordinaryWorkspaceEntryAt: completedAt,
      },
    });
    await db.accountEmail.upsert({
      where: { normalizedEmail: creatorEmail },
      update: {
        accountId: creatorAccountId,
        displayEmail: creatorEmail,
        isPrimary: true,
        verificationState: "VERIFIED",
        verifiedAt: completedAt,
      },
      create: {
        id: "brightwork-stage6-creator-email",
        accountId: creatorAccountId,
        normalizedEmail: creatorEmail,
        displayEmail: creatorEmail,
        isPrimary: true,
        verificationState: "VERIFIED",
        verifiedAt: completedAt,
      },
    });
    const creator = await db.playerProfile.upsert({
      where: { accountId: creatorAccountId },
      update: {
        displayName: "Brightwork Creator",
        normalizedDisplayName: "brightwork creator",
        status: "ACTIVE",
        claimedAt: completedAt,
      },
      create: {
        id: "brightwork-stage6-creator-profile",
        accountId: creatorAccountId,
        displayName: "Brightwork Creator",
        normalizedDisplayName: "brightwork creator",
        status: "ACTIVE",
        claimedAt: completedAt,
      },
      select: { id: true },
    });
    await db.accountRoleAssignment.deleteMany({
      where: {
        OR: [
          { id: "brightwork-stage6-creator-role" },
          { accountId: creatorAccountId, role: "CREATOR", scopeType: "GLOBAL", scopeId: null },
        ],
      },
    });
    await db.accountRoleAssignment.create({
      data: {
        id: "brightwork-stage6-creator-role",
        accountId: creatorAccountId,
        role: "CREATOR",
        scopeType: "GLOBAL",
        grantedBy: "brightwork-stage6-synthetic-fixture",
        grantedAt: completedAt,
      },
    });
    await db.accountCredential.upsert({
      where: { accountId: creatorAccountId },
      update: { passwordHash: await bcrypt.hash(creatorPassword, 10), changedAt: completedAt },
      create: {
        id: "brightwork-stage6-creator-credential",
        accountId: creatorAccountId,
        passwordHash: await bcrypt.hash(creatorPassword, 10),
        changedAt: completedAt,
        createdAt: completedAt,
      },
    });
    await db.userAccount.update({
      where: { id: fullCapability.accountId },
      data: { ordinaryWorkspaceEntryAt: completedAt },
    });
    // The owner editor is a contextual screen: select a disposable log for
    // the authenticated ordinary fixture owner rather than treating another
    // synthetic account's private record as a product-ready destination.
    const voyageLog = await db.communityVoyageLog.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (!voyageLog) throw new Error("BRIGHTWORK_OWNER_VOYAGE_LOG_REPRESENTATIVE_REQUIRED");
    await db.communityVoyageLog.update({
      where: { id: voyageLog.id },
      data: { ownerAccountId: fullCapability.accountId },
    });
    const membership = await db.playthroughMembership.upsert({
      where: {
        playthroughId_playerProfileId: { playthroughId: session.id, playerProfileId: player.id },
      },
      update: { status: "COMPLETED_MEMBER", joinedAt: completedAt, completedAt, removedAt: null },
      create: {
        id: "brightwork-stage1-membership-full-capability",
        playthroughId: session.id,
        playerProfileId: player.id,
        role: "PLAYER",
        status: "COMPLETED_MEMBER",
        participationAlias: "Brightwork Observer",
        joinedAt: completedAt,
        completedAt,
        createdAt: completedAt,
      },
    });
    await db.playerChronicleRecord.upsert({
      where: {
        playerProfileId_sourcePlaythroughId: { playerProfileId: player.id, sourcePlaythroughId: session.id },
      },
      update: {
        sourceMembershipId: membership.id,
        publishedVersionId: session.publishedVersionId,
        publishedVersionChecksum: session.version.checksum,
        lifecycleStatus: "COMPLETED",
        outcome: "COMPLETED:brightwork-synthetic",
        completedAt,
        sourceFingerprint: "brightwork-stage1-completed-history-v1",
      },
      create: {
        id: "brightwork-stage1-history-full-capability",
        playerProfileId: player.id,
        sourcePlaythroughId: session.id,
        sourceMembershipId: membership.id,
        publishedVersionId: session.publishedVersionId,
        publishedVersionChecksum: session.version.checksum,
        chronicleTitleSnapshot: "Synthetic completed Brightwork voyage",
        playerNameSnapshot: player.displayName,
        lifecycleStatus: "COMPLETED",
        outcome: "COMPLETED:brightwork-synthetic",
        startedAt: session.startedAt,
        joinedAt: completedAt,
        completedAt,
        sourceFingerprint: "brightwork-stage1-completed-history-v1",
        createdAt: completedAt,
        lastDerivedAt: completedAt,
      },
    });
    await db.playerArtifactRecord.upsert({
      where: {
        playerProfileId_sourceGrantEventId: {
          playerProfileId: player.id,
          sourceGrantEventId: "brightwork-stage1-artifact-grant",
        },
      },
      update: {
        publishedVersionId: session.publishedVersionId,
        publishedVersionChecksum: session.version.checksum,
        ownershipState: "OWNED",
        recordStatus: "ACTIVE",
      },
      create: {
        id: "brightwork-stage1-artifact-full-capability",
        playerProfileId: player.id,
        sourcePlaythroughId: session.id,
        sourceGrantEventId: "brightwork-stage1-artifact-grant",
        sourceGrantSequence: 1,
        publishedVersionId: session.publishedVersionId,
        publishedVersionChecksum: session.version.checksum,
        chronicleTitleSnapshot: "Synthetic completed Brightwork voyage",
        artifactDefinitionId: "brightwork-stage1-synthetic-compass",
        artifactNameSnapshot: "Synthetic Brightwork Compass",
        artifactTypeSnapshot: "RELIC",
        recipientPolicy: "SELECTED_PLAYER",
        recipientEvidence: '{"synthetic":true}',
        ownershipState: "OWNED",
        custody: "PERSONAL",
        recordStatus: "ACTIVE",
        grantedAt: completedAt,
        sourceFingerprint: "brightwork-stage1-artifact-v1",
        createdAt: completedAt,
        lastDerivedAt: completedAt,
      },
    });

    // These records are task-owned route representatives. Stage 1 selected a
    // generic completed session and a published Chronicle, neither of which
    // was owned by the authenticated Captain/Creator capture persona.
    await db.taleSession.upsert({
      where: { id: "brightwork-stage4b-captain-voyage" },
      update: {
        captainId: player.id,
        captainAccountId: fullCapability.accountId,
        status: "ACTIVE",
        publishedVersionId: session.publishedVersionId,
      },
      create: {
        id: "brightwork-stage4b-captain-voyage",
        taleId: session.taleId,
        publishedVersionId: session.publishedVersionId,
        ownerLabel: "Brightwork synthetic Captain",
        voyageName: "Brightwork Captain Passage",
        captainId: player.id,
        captainAccountId: fullCapability.accountId,
        accessTokenHash: "brightwork-stage4b-captain-token-never-rendered",
        status: "ACTIVE",
        captainMode: "CAPTAIN_CONTROLLED",
        configuration: "{}",
        launchedAt: completedAt,
        lastHeartbeatAt: completedAt,
        currentSequence: 1,
        startedAt: completedAt,
      },
    });
    await db.playthroughMembership.upsert({
      where: {
        playthroughId_playerProfileId: {
          playthroughId: "brightwork-stage4b-captain-voyage",
          playerProfileId: player.id,
        },
      },
      update: { status: "ACTIVE_MEMBER", role: "CAPTAIN", joinedAt: completedAt, completedAt: null, removedAt: null },
      create: {
        id: "brightwork-stage4b-captain-membership",
        playthroughId: "brightwork-stage4b-captain-voyage",
        playerProfileId: player.id,
        role: "CAPTAIN",
        status: "ACTIVE_MEMBER",
        participationAlias: "Brightwork Captain",
        joinedAt: completedAt,
        createdAt: completedAt,
      },
    });
    await db.chronicle.upsert({
      where: { id: "brightwork-stage4b-creator-chronicle" },
      update: {
        creatorId: creator.id,
        creatorAccountId,
        status: "DRAFT",
        visibility: "PRIVATE",
      },
      create: {
        id: "brightwork-stage4b-creator-chronicle",
        slug: "brightwork-stage4b-creator-chronicle",
        title: "Brightwork Creator Chronicle",
        subtitle: "Synthetic creator-owned evidence record",
        shortDescription: "Task-owned Chronicle used only for Brightwork route evidence.",
        status: "DRAFT",
        visibility: "PRIVATE",
        creatorId: creator.id,
        creatorAccountId,
        playerCountMin: 1,
        playerCountMax: 4,
        estimatedDuration: 60,
        createdAt: completedAt,
      },
    });
    await mkdir(path.dirname(creatorCredentialsPath), { recursive: true });
    await writeFile(
      creatorCredentialsPath,
      `${JSON.stringify(
        {
          classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF",
          fixtureVersion: "brightwork-creator-continuation-v1",
          password: creatorPassword,
          account: { accountId: creatorAccountId, email: creatorEmail, displayName: "Brightwork Creator" },
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } finally {
    await db.$disconnect();
  }
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function sqliteUrl(file) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
