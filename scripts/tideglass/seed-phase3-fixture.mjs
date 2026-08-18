import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const taskRoot = path.resolve(required("TIDEGLASS_PHASE3_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const password = required("TIDEGLASS_PHASE3_SYNTHETIC_PASSWORD");
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectTideglass");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const validationNonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH ?? null;
const createdAt = new Date("2026-08-12T12:00:00.000Z");
const fixtureVersion = "tideglass-phase3-v2";

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`TIDEGLASS_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`TIDEGLASS_FIXTURE_DATABASE_REFUSED:${databasePath}`);
if (password.length < 24) throw new Error("TIDEGLASS_SYNTHETIC_PASSWORD_TOO_SHORT");
if (
  validationNonceHash !== null &&
  (process.env.FOREVER_VALIDATION_ISOLATION !== "1" || !/^[a-f0-9]{64}$/u.test(validationNonceHash))
)
  throw new Error("TIDEGLASS_VALIDATION_NONCE_REFUSED");

const passwordHash = await bcrypt.hash(password, 10);
const accounts = {
  PLAYER_A: identity("player-a", "player.a@tideglass.example.test", "Player A", ["PLAYER"]),
  PLAYER_AB: identity("player-ab", "player.ab@tideglass.example.test", "Player AB", ["PLAYER"]),
  PLAYER_C: identity("player-c", "player.c@tideglass.example.test", "Player C", ["PLAYER"]),
  CREATOR: identity("creator", "creator@tideglass.example.test", "Tideglass Fixture Creator", ["PLAYER", "CREATOR"]),
  FOREIGN: identity("foreign", "foreign@tideglass.example.test", "Foreign Player", ["PLAYER"]),
};
for (const [key, account] of Object.entries(accounts)) await createIdentity(key, account);

const chronicleId = "tg3-chronicle-passage";
const versions = [
  {
    id: "tg3-edition-a",
    label: "1.0",
    snapshot: snapshot(1),
    current: false,
    releaseNotes: "The original synthetic harbor route.",
  },
  {
    id: "tg3-edition-b",
    label: "1.1",
    snapshot: snapshot(2),
    current: false,
    releaseNotes: "A safe accessibility and route refinement.",
  },
  {
    id: "tg3-edition-c",
    label: "2.0",
    snapshot: snapshot(3),
    current: true,
    releaseNotes: "The current synthetic recommended edition.",
  },
];
await db.chronicle.create({
  data: {
    id: chronicleId,
    slug: "tideglass-passage-fixture",
    title: "The Tideglass Passage Fixture",
    shortDescription: "A synthetic Chronicle that exists only for Project Tideglass Phase 3 qualification.",
    longDescription: "No real player, Chronicle, location, media, or account data is represented.",
    creatorId: accounts.CREATOR.id,
    creatorAccountId: accounts.CREATOR.id,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    latestPublishedVersionId: versions.at(-1).id,
    playerCountMin: 2,
    playerCountMax: 4,
    estimatedDuration: 60,
    createdAt,
  },
});
for (const [index, version] of versions.entries()) {
  const contentSnapshot = JSON.stringify(version.snapshot);
  await db.publishedTaleVersion.create({
    data: {
      id: version.id,
      taleId: chronicleId,
      versionNumber: index + 1,
      versionLabel: version.label,
      publishedAt: new Date(createdAt.getTime() + index * 86_400_000),
      publishedBy: "Tideglass Fixture Creator",
      publishedByAccountId: accounts.CREATOR.id,
      releaseNotes: version.releaseNotes,
      contentSnapshot,
      schemaVersion: 1,
      checksum: sha256(contentSnapshot),
      isCurrent: version.current,
    },
  });
}
await db.taleDraft.create({
  data: {
    id: "tg3-draft-current",
    taleId: chronicleId,
    revisionNumber: 4,
    basedOnPublishedVersionId: versions.at(-1).id,
    createdBy: accounts.CREATOR.id,
    createdByAccountId: accounts.CREATOR.id,
    createdAt,
  },
});
await db.chronicle.update({ where: { id: chronicleId }, data: { currentDraftRevisionId: "tg3-draft-current" } });

await db.tideglassCreatorAnnotation.create({
  data: {
    id: "tg3-annotation-b-to-c",
    annotationKey: "tg3-creator-passage-note",
    revision: 1,
    chronicleId,
    sourceEditionId: versions[1].id,
    sourceEditionChecksum: sha256(JSON.stringify(versions[1].snapshot)),
    targetEditionId: versions[2].id,
    targetEditionChecksum: sha256(JSON.stringify(versions[2].snapshot)),
    comparisonPolicyVersion: "tideglass.policy.v1",
    scopeType: "PAIR",
    annotationKind: "COMPATIBILITY",
    headline: "Synthetic Creator implementation note",
    body: "The synthetic alternate passage changes the recorded setup requirements.",
    spoilerLevel: "CREATOR_ONLY",
    highlighted: true,
    replayGuidance: "NO_RECOMMENDATION",
    createdByAccountId: accounts.CREATOR.id,
    createdAt,
    state: "ACTIVE",
    idempotencyKey: "tg3-fixture-annotation-b-to-c",
  },
});

await createRecord(accounts.PLAYER_A, "tg3-record-a", versions[0], "synthetic-a", "COMPLETED", "SUCCESS");
await createRecord(accounts.PLAYER_AB, "tg3-record-ab-a", versions[0], "synthetic-ab-a", "COMPLETED", "SUCCESS");
await createRecord(accounts.PLAYER_AB, "tg3-record-ab-b", versions[1], "synthetic-ab-b", "COMPLETED", "SUCCESS");
await createRecord(accounts.PLAYER_C, "tg3-record-c", versions[2], "synthetic-c", "COMPLETED", "SUCCESS");
await createRecord(accounts.FOREIGN, "tg3-record-foreign", versions[0], "synthetic-foreign", "COMPLETED", "SUCCESS");
if (validationNonceHash) {
  await db.platformAuditEvent.create({
    data: {
      actorType: "VALIDATION_HARNESS",
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceType: "VALIDATION_DATABASE",
      resourceId: validationNonceHash,
      outcome: "SUCCEEDED",
      correlationId: validationNonceHash,
      metadata: JSON.stringify({ marker: "tideglass-phase3-task-fixture", nonceHash: validationNonceHash }),
    },
  });
}

const aliases = Object.fromEntries(
  Object.entries(accounts).map(([key, account]) => [
    key,
    { accountId: account.id, email: account.email, displayName: account.displayName },
  ]),
);
const privateCredentials = path.join(taskRoot, "credentials", "tideglass-phase3-walkthrough.private.json");
await mkdir(path.dirname(privateCredentials), { recursive: true });
await writeFile(
  privateCredentials,
  `${JSON.stringify({ classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF", fixtureVersion, password, accounts: aliases, chronicle: { id: chronicleId, slug: "tideglass-passage-fixture", versions: versions.map(({ id, label }) => ({ id, label })) } }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
const fixtureChecksum = sha256(
  JSON.stringify({
    fixtureVersion,
    aliases,
    chronicleId,
    versions: versions.map((version) => ({
      id: version.id,
      snapshotChecksum: sha256(JSON.stringify(version.snapshot)),
    })),
  }),
);
process.stdout.write(
  `${JSON.stringify({ status: "TIDEGLASS_PHASE3_FIXTURE_SEEDED", fixtureVersion, fixtureChecksum, aliases: Object.keys(aliases), credentialPath: "EXTERNAL_PRIVATE_HANDOFF" })}\n`,
);
await db.$disconnect();

function identity(key, email, displayName, roles) {
  return {
    id: `tg3-account-${key}`,
    profileId: `tg3-profile-${key}`,
    email,
    displayName,
    roles,
  };
}

async function createIdentity(key, account) {
  await db.userAccount.create({
    data: {
      id: account.id,
      status: "ACTIVE",
      claimedAt: createdAt,
      ordinaryWorkspaceEntryAt: createdAt,
      createdAt,
    },
  });
  await db.playerProfile.create({
    data: {
      id: account.profileId,
      accountId: account.id,
      displayName: account.displayName,
      normalizedDisplayName: account.displayName.toLocaleLowerCase(),
      handle: `tg3-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      normalizedHandle: `tg3-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      biography: "Synthetic Project Tideglass Phase 3 account. No real person is represented.",
      defaultVisibility: "ONLY_ME",
      status: "ACTIVE",
      claimedAt: createdAt,
      createdAt,
    },
  });
  await db.accountEmail.create({
    data: {
      id: `tg3-email-${key.toLocaleLowerCase()}`,
      accountId: account.id,
      normalizedEmail: account.email,
      displayEmail: account.email,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: createdAt,
      createdAt,
    },
  });
  await db.accountCredential.create({
    data: {
      id: `tg3-credential-${key.toLocaleLowerCase()}`,
      accountId: account.id,
      passwordHash,
      changedAt: createdAt,
      createdAt,
    },
  });
  for (const role of account.roles)
    await db.accountRoleAssignment.create({
      data: {
        id: `tg3-role-${key.toLocaleLowerCase()}-${role.toLocaleLowerCase()}`,
        accountId: account.id,
        role,
        grantedAt: createdAt,
      },
    });
}

async function createRecord(account, id, version, sourcePlaythroughId, lifecycleStatus, outcome) {
  const editionSnapshot = JSON.stringify(version.snapshot);
  await db.playerChronicleRecord.create({
    data: {
      id,
      playerProfileId: account.profileId,
      sourcePlaythroughId,
      publishedVersionId: version.id,
      publishedVersionChecksum: sha256(editionSnapshot),
      chronicleTitleSnapshot: "The Tideglass Passage Fixture",
      creatorAttributionSnapshot: "Tideglass Fixture Creator",
      playerNameSnapshot: account.displayName,
      participationRole: "PLAYER",
      lifecycleStatus,
      outcome,
      startedAt: createdAt,
      completedAt: new Date(createdAt.getTime() + 3_600_000),
      wallClockSeconds: 3_600,
      activeSeconds: 3_000,
      sourceFingerprint: `tg3-fingerprint-${id}`,
      createdAt,
    },
  });
}

function snapshot(version) {
  const accessibilityCaption =
    version >= 2 ? (version === 3 ? "Synthetic caption summary revised" : "Synthetic caption summary") : undefined;
  const hasExpandedPassage = version >= 2;
  const alternateEnding = version === 3;
  const branchTarget = alternateEnding ? "tg3-block-alternate-ending" : "tg3-block-finish";
  return {
    schemaVersion: 1,
    tale: {
      id: "tg3-chronicle-passage",
      slug: "tideglass-passage-fixture",
      title: "The Tideglass Passage Fixture",
      shortDescription: "A synthetic Chronicle for governed Tideglass qualification.",
      longDescription: "Synthetic source reserved for local qualification.",
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PUBLIC",
      playerCountMin: 2,
      playerCountMax: version === 3 ? 4 : 3,
      estimatedDuration: 60,
      captainRequired: !alternateEnding,
      minimumPlatformVersion: version === 3 ? "2.0.0" : "1.0.0",
      providerRequirements: version === 3 ? ["syntheticCompass"] : [],
    },
    chapters: [
      {
        id: "tg3-chapter-opening",
        title: version >= 2 ? "The Revised Mark" : "The First Mark",
        description: "Synthetic and safe for the fixture.",
        orderIndex: 0,
        entryBlockId: "tg3-block-opening",
        completionBlockId: alternateEnding ? "tg3-block-alternate-ending" : "tg3-block-finish",
        blocks: [
          {
            id: "tg3-block-opening",
            chapterId: "tg3-chapter-opening",
            blockType: "narrative",
            title: version === 3 ? "Synthetic arrival revised" : "Synthetic arrival",
            configuration: {
              heading: "A synthetic tideglass route",
              body: "This content exists only to generate semantic comparison records.",
              completionMode: "playerConfirmation",
              ...(version === 2 ? { fixtureUnknownSemantic: "intentional partial-fixture state" } : {}),
            },
            presentation: {
              spreadMode: "single-page",
              ...(accessibilityCaption ? { caption: accessibilityCaption } : {}),
              ...(version === 3 ? { reducedMotionAssetId: "tg3-safe-static" } : {}),
            },
            completion: {},
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: 0,
            nextBlockId: hasExpandedPassage ? "tg3-block-choice" : "tg3-block-finish",
            connections: [
              {
                targetBlockId: hasExpandedPassage ? "tg3-block-choice" : "tg3-block-finish",
                connectionType: "DEFAULT",
                orderIndex: 0,
              },
            ],
          },
          ...(hasExpandedPassage
            ? [
                {
                  id: "tg3-block-choice",
                  chapterId: "tg3-chapter-opening",
                  blockType: "choice",
                  title: alternateEnding ? "Choose the revised passage" : "Choose the passage",
                  configuration: {
                    prompt: "Choose a synthetic route.",
                    choices: [{ id: "tg3-choice-passage", label: "Continue", targetBlockId: branchTarget }],
                    reversible: false,
                    completionMode: "playerConfirmation",
                  },
                  presentation: {},
                  completion: {},
                  isEnabled: true,
                  schemaVersion: 1,
                  orderIndex: 1,
                  nextBlockId: branchTarget,
                  connections: [{ targetBlockId: branchTarget, connectionType: "DEFAULT", orderIndex: 0 }],
                },
              ]
            : []),
          {
            id: "tg3-block-finish",
            chapterId: "tg3-chapter-opening",
            blockType: "taleComplete",
            title: "Synthetic completion",
            configuration: {
              finaleHeading: "The synthetic mark is set",
              finaleContent: "The baseline synthetic voyage ends.",
              completionMessage: "Complete.",
              credits: "",
              completionMode: "playerConfirmation",
              replayAvailable: version !== 1,
            },
            presentation: {},
            completion: {},
            isEnabled: true,
            schemaVersion: 1,
            orderIndex: hasExpandedPassage ? 2 : 1,
            nextBlockId: null,
            connections: [],
          },
          ...(alternateEnding
            ? [
                {
                  id: "tg3-block-alternate-ending",
                  chapterId: "tg3-chapter-opening",
                  blockType: "taleComplete",
                  title: "Synthetic alternate ending",
                  configuration: {
                    finaleHeading: "The alternate synthetic mark",
                    finaleContent: "A distinct synthetic outcome is available in this fixture.",
                    completionMessage: "Complete.",
                    credits: "",
                    completionMode: "playerConfirmation",
                    replayAvailable: true,
                  },
                  presentation: {},
                  completion: {},
                  isEnabled: true,
                  schemaVersion: 1,
                  orderIndex: 3,
                  nextBlockId: null,
                  connections: [],
                },
              ]
            : []),
        ],
      },
    ],
    assets: [],
    locations: hasExpandedPassage
      ? [
          {
            id: "tg3-location-passage",
            name: "Synthetic passage marker",
            locationType: "STORY",
            exactness: "APPROXIMATE",
            verificationProfile: { provider: "captainManual" },
            orderIndex: 0,
          },
        ]
      : [],
    artifacts: hasExpandedPassage
      ? [
          {
            id: "tg3-artifact-passage-token",
            taleId: "tg3-chronicle-passage",
            name: "Synthetic passage token",
            shortDescription: "A synthetic fixture artifact.",
            loreDescription: "No real Chronicle content is represented.",
            ordinaryGameObjectLabel: "token",
            inventoryCategory: "RELIC",
            collectionGroup: "tideglass-fixture",
            safeName: "Passage token",
            silhouetteLabel: "Round marker",
            sourceChapterOrdinal: 0,
            sortOrder: 0,
            persistentAfterUnlock: true,
          },
        ]
      : [],
    publishedAt: new Date(createdAt.getTime() + (version - 1) * 86_400_000).toISOString(),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
