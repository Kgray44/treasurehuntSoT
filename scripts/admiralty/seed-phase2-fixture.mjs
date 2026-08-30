import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const root = path.resolve(process.cwd());
const db = new PrismaClient();
const taskRoot = path.resolve(required("ADMIRALTY_PHASE2_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const password = required("ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD");
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const createdAt = new Date("2026-08-09T14:00:00.000Z");
const correlationId = "adm2-correlation-northstar";

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`ADMIRALTY_TASK_ROOT_REFUSED:${taskRoot}`);
const genericIsolationPath = path.relative(path.join(root, "artifacts", "sounding-line"), databasePath);
const isGenericSoundingLineDatabase =
  process.env.SOUNDING_LINE_SUITE_PROFILE === "generic" &&
  process.env.FOREVER_VALIDATION_ISOLATION === "1" &&
  /^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(genericIsolationPath);
const isSoundingLineDatabase =
  process.env.ADMIRALTY_PHASE2_ALLOW_SOUNDING_LINE_DATABASE === "1" &&
  (isGenericSoundingLineDatabase ||
    (/^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(databasePath)) &&
      databasePath.startsWith(`${root}${path.sep}`)));
if (
  (!databasePath.startsWith(`${taskRoot}${path.sep}`) && !isSoundingLineDatabase) ||
  databasePath === canonicalDatabase
)
  throw new Error(`ADMIRALTY_FIXTURE_DATABASE_REFUSED:${databasePath}`);
if (password.length < 24) throw new Error("ADMIRALTY_SYNTHETIC_PASSWORD_TOO_SHORT");

const passwordHash = await bcrypt.hash(password, 10);
const definitions = {
  ORDINARY_USER: identity("ordinary", "Ordinary Mariner", ["PLAYER"]),
  ADMINISTRATOR: identity("administrator", "Admiral Northstar", ["ADMINISTRATOR"]),
  SUPPORT_OPERATOR: identity("support-operator", "Support Lantern", ["SUPPORT_OPERATOR"]),
  OPERATIONS_OBSERVER: identity("operations-observer", "Operations Lookout", ["OPERATIONS_OPERATOR"]),
  AUDIT_OPERATOR: identity("audit-operator", "Audit Quartermaster", ["AUDIT_OPERATOR"]),
  SUPPORT_TARGET: identity("support-target", "Consent Harbor", ["PLAYER"]),
};

for (const [key, definition] of Object.entries(definitions)) await createIdentity(key, definition);

await db.securityEvent.create({
  data: {
    id: "adm2-security-event-target",
    accountId: definitions.SUPPORT_TARGET.id,
    eventType: "SYNTHETIC_SIGN_IN_DIAGNOSTIC",
    correlationId,
    metadata: JSON.stringify({
      safeCode: "SIGN_IN_REVIEW_REQUESTED",
      token: "must-never-appear",
      nested: { passwordHash: "must-never-appear", csrfToken: "must-never-appear" },
    }),
    createdAt,
  },
});

await db.chronicle.create({
  data: {
    id: "adm2-chronicle-lantern-chart",
    slug: "lantern-chart",
    title: "The Lantern Chart",
    subtitle: "A synthetic operational Chronicle",
    shortDescription: "Reserved example data for the Project Admiralty Phase 2 walkthrough.",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    creatorId: definitions.ADMINISTRATOR.profileId,
    creatorAccountId: definitions.ADMINISTRATOR.id,
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: 90,
    createdAt,
  },
});
await db.publishedTaleVersion.create({
  data: {
    id: "adm2-edition-lantern-chart-v1",
    taleId: "adm2-chronicle-lantern-chart",
    versionNumber: 1,
    versionLabel: "Chartroom Edition",
    publishedAt: createdAt,
    publishedBy: definitions.ADMINISTRATOR.profileId,
    publishedByAccountId: definitions.ADMINISTRATOR.id,
    releaseNotes: "Synthetic immutable edition for read-only inspection.",
    contentSnapshot: JSON.stringify({ privateNarrative: "must-never-appear" }),
    checksum: "adm2-edition-checksum-safe",
    isCurrent: true,
  },
});
await db.chronicle.update({
  where: { id: "adm2-chronicle-lantern-chart" },
  data: { latestPublishedVersionId: "adm2-edition-lantern-chart-v1" },
});

await db.taleSession.create({
  data: {
    id: "adm2-voyage-northstar",
    taleId: "adm2-chronicle-lantern-chart",
    publishedVersionId: "adm2-edition-lantern-chart-v1",
    ownerLabel: "Synthetic Admiralty crew",
    voyageName: "Northstar Passage",
    captainId: definitions.ADMINISTRATOR.profileId,
    captainAccountId: definitions.ADMINISTRATOR.id,
    accessTokenHash: "adm2-access-token-hash-must-never-appear",
    status: "ACTIVE",
    captainMode: "CAPTAIN_CONTROLLED",
    configuration: JSON.stringify({ privateControl: "must-never-appear" }),
    launchedAt: createdAt,
    lastHeartbeatAt: createdAt,
    currentSequence: 1,
    startedAt: createdAt,
  },
});
await db.playthroughMembership.create({
  data: {
    id: "adm2-membership-support-target",
    playthroughId: "adm2-voyage-northstar",
    playerProfileId: definitions.SUPPORT_TARGET.profileId,
    role: "PLAYER",
    status: "ACTIVE",
    crewRole: "Navigator",
    joinedAt: createdAt,
    createdAt,
  },
});
await db.taleSessionEvent.create({
  data: {
    id: "adm2-voyage-event-safe",
    sessionId: "adm2-voyage-northstar",
    publishedVersionId: "adm2-edition-lantern-chart-v1",
    eventType: "VOYAGE_STARTED",
    sourceType: "SYNTHETIC_WALKTHROUGH",
    sourceId: definitions.ADMINISTRATOR.id,
    idempotencyKey: "adm2-voyage-event-safe",
    payload: JSON.stringify({ privateAnswer: "must-never-appear" }),
    sequence: 1,
    correlationId,
    createdAt,
  },
});

await db.communityProfile.create({
  data: {
    id: "adm2-community-profile",
    accountId: definitions.SUPPORT_TARGET.id,
    normalizedHandle: "consent-harbor-community",
    handle: "consent-harbor-community",
    displayName: "Consent Harbor Workshop",
    biography: "Synthetic Community creator profile.",
    verificationStatus: "VERIFIED",
    lastPublishedAt: createdAt,
    createdAt,
  },
});
await db.communityListing.create({
  data: {
    id: "adm2-community-listing-chart-kit",
    slug: "chartroom-kit",
    itemType: "CHRONICLE",
    ownerProfileId: "adm2-community-profile",
    title: "Chartroom Navigator Kit",
    shortDescription: "Synthetic listing for read-only moderation and release visibility.",
    visibility: "PUBLIC",
    publicationStatus: "PUBLISHED",
    moderationStatus: "ACTIVE",
    tags: JSON.stringify(["synthetic", "navigation"]),
    contentWarnings: "[]",
    publishedAt: createdAt,
    createdAt,
  },
});
await db.communityRelease.create({
  data: {
    id: "adm2-community-release-v1",
    listingId: "adm2-community-listing-chart-kit",
    semanticVersion: "1.0.0",
    sourcePublishedTaleVersionId: "adm2-edition-lantern-chart-v1",
    manifest: JSON.stringify({ privatePackageReference: "must-never-appear" }),
    manifestChecksum: "adm2-manifest-checksum-safe",
    packageChecksum: "adm2-package-checksum-safe",
    releaseNotes: "Synthetic release for Admiralty inspection.",
    licenseSnapshot: JSON.stringify({ license: "RESERVED_SYNTHETIC" }),
    publishedByProfileId: "adm2-community-profile",
    publishedAt: createdAt,
    createdAt,
  },
});
await db.communityListing.update({
  where: { id: "adm2-community-listing-chart-kit" },
  data: { currentReleaseId: "adm2-community-release-v1" },
});

await db.privateContentOperation.create({
  data: {
    id: "adm2-private-operation",
    ownerAccountId: definitions.ADMINISTRATOR.id,
    kind: "SYNTHETIC_SCAN",
    state: "PROCESSING",
    idempotencyKey: "adm2-private-operation",
    correlationId,
    progress: JSON.stringify({ percent: 25 }),
    createdAt,
  },
});
await db.privateContentJob.create({
  data: {
    id: "adm2-private-job",
    operationId: "adm2-private-operation",
    type: "SCAN_PRIVATE_CONTENT",
    payload: JSON.stringify({ privateObjectKey: "must-never-appear" }),
    idempotencyKey: "adm2-private-job",
    state: "PENDING",
    availableAt: createdAt,
    correlationId,
    createdAt,
  },
});
await db.privateProviderHealthSnapshot.create({
  data: {
    id: "adm2-provider-health",
    kind: "SCANNER",
    provider: "synthetic-disabled",
    state: "NOT_CONFIGURED",
    safeCode: "LOCAL_PROVIDER_NOT_CONFIGURED",
    evidence: JSON.stringify({ secretReference: "must-never-appear" }),
    checkedAt: createdAt,
  },
});
await db.privateBackupRun.create({
  data: {
    id: "adm2-backup-run",
    backupId: "adm2-backup-synthetic",
    state: "VERIFIED",
    manifestDigest: "adm2-manifest-digest",
    snapshotIdentity: "adm2-snapshot",
    objectSetDigest: "adm2-object-digest",
    keyVersions: '["synthetic-v1"]',
    verifiedAt: createdAt,
    createdAt,
  },
});
await db.privateRestoreDrill.create({
  data: {
    id: "adm2-restore-drill",
    backupRunId: "adm2-backup-run",
    targetIdentity: "task-owned-synthetic-target",
    state: "PASSED",
    resultCode: "SYNTHETIC_RESTORE_VERIFIED",
    cleanupCompletedAt: createdAt,
    createdAt,
  },
});
await db.privateScheduledOperation.create({
  data: {
    id: "adm2-scheduled-operation",
    kind: "BACKUP_VERIFICATION",
    scheduleKey: "adm2-backup-daily",
    state: "SCHEDULED",
    runAfter: new Date("2026-08-10T14:00:00.000Z"),
    createdAt,
  },
});

await db.platformAuditEvent.create({
  data: {
    id: "adm2-audit-seed",
    actorType: "ADMINISTRATOR",
    actorId: definitions.ADMINISTRATOR.id,
    actorAccountId: definitions.ADMINISTRATOR.id,
    action: "ADMIRALTY_SYNTHETIC_FIXTURE_OBSERVED",
    resourceType: "ProjectAdmiraltyPhase2Fixture",
    resourceId: "adm2-fixture",
    outcome: "SUCCEEDED",
    correlationId,
    metadata: JSON.stringify({ safeCode: "FIXTURE_READY", token: "must-never-appear" }),
    createdAt,
  },
});

const aliases = Object.fromEntries(
  Object.entries(definitions).map(([key, value]) => [
    key,
    { accountId: value.id, email: value.email, displayName: value.displayName },
  ]),
);
if (process.env.ADMIRALTY_PHASE2_WRITE_CREDENTIAL_HANDOFF !== "0") {
  const credentialPath = path.join(taskRoot, "credentials", "admiralty-phase2-walkthrough.private.json");
  await mkdir(path.dirname(credentialPath), { recursive: true });
  await writeFile(
    credentialPath,
    `${JSON.stringify({ classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF", fixtureVersion: "admiralty-phase2-v1", password, accounts: aliases }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}
const fixtureChecksum = createHash("sha256").update(JSON.stringify(aliases)).digest("hex");
process.stdout.write(
  `${JSON.stringify({ status: "ADMIRALTY_PHASE2_FIXTURE_SEEDED", fixtureVersion: "admiralty-phase2-v1", fixtureChecksum, aliases: Object.keys(aliases), correlationId, credentialPath: "EXTERNAL_PRIVATE_HANDOFF" })}\n`,
);
await db.$disconnect();

function identity(key, displayName, roles) {
  return {
    id: `adm2-account-${key}`,
    profileId: `adm2-profile-${key}`,
    email: `${key}@admiralty.example.test`,
    displayName,
    roles,
  };
}

async function createIdentity(key, definition) {
  await db.userAccount.create({
    data: { id: definition.id, status: "ACTIVE", claimedAt: createdAt, lastSeenAt: createdAt, createdAt },
  });
  await db.playerProfile.create({
    data: {
      id: definition.profileId,
      accountId: definition.id,
      displayName: definition.displayName,
      normalizedDisplayName: definition.displayName.toLocaleLowerCase(),
      handle: `adm2-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      normalizedHandle: `adm2-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      biography: "Synthetic Project Admiralty Phase 2 identity. No real person is represented.",
      defaultVisibility: "ONLY_ME",
      status: "ACTIVE",
      claimedAt: createdAt,
      createdAt,
    },
  });
  await db.accountEmail.create({
    data: {
      id: `adm2-email-${key.toLowerCase()}`,
      accountId: definition.id,
      normalizedEmail: definition.email,
      displayEmail: definition.email,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: createdAt,
      createdAt,
    },
  });
  await db.accountCredential.create({
    data: {
      id: `adm2-credential-${key.toLowerCase()}`,
      accountId: definition.id,
      passwordHash,
      changedAt: createdAt,
      createdAt,
    },
  });
  for (const role of definition.roles)
    await db.accountRoleAssignment.create({
      data: {
        id: `adm2-role-${key.toLowerCase()}-${role.toLowerCase()}`,
        accountId: definition.id,
        role,
        grantedAt: createdAt,
      },
    });
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
