import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const databasePath = path.resolve(process.argv[2] ?? required("HOMEPORT_PHASE7_ROUND3_DATABASE"));
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const credentialPath = path.join(
  taskRoot,
  "credentials",
  "owner-correction-round3-walkthrough-credentials.private.json",
);
const fixtureReceiptPath = path.join(taskRoot, "reports", "owner-correction-round3-fixture-prepare-receipt.json");
const receiptPath = path.join(taskRoot, "reports", "owner-correction-round3-fixture-validation.json");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (databasePath === canonicalDatabase || !databasePath.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_ROUND3_DATABASE_REFUSED:${databasePath}`);
if ((await stat(databasePath)).size < 1) throw new Error("HOMEPORT_PHASE7_ROUND3_DATABASE_EMPTY");

const credentialHandoff = JSON.parse(await readFile(credentialPath, "utf8"));
const fixtureReceipt = JSON.parse(await readFile(fixtureReceiptPath, "utf8"));
const requiredAliases = [
  "KGTESTING_NEW",
  "SERA_OWNER",
  "PENDING_VERIFICATION",
  "VERIFIED_FULL_CAPABILITY",
  "ACTIVE_PLAYER_LOCKED",
  "RESTRICTED_ACCOUNT",
  "NO_PROFILE_MEDIA",
  "PROFILE_MEDIA_COMPLETE",
];
for (const alias of requiredAliases)
  if (!credentialHandoff.accounts?.[alias]?.accountId) throw new Error(`HOMEPORT_PHASE7_ROUND3_ALIAS_MISSING:${alias}`);

const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const accountIds = Object.fromEntries(
    requiredAliases.map((alias) => [alias, credentialHandoff.accounts[alias].accountId]),
  );
  const accounts = await db.userAccount.findMany({
    where: { id: { in: [...new Set(Object.values(accountIds))] } },
    include: {
      emails: { where: { isPrimary: true }, take: 1 },
      roles: { where: { revokedAt: null } },
      profile: {
        include: {
          avatarMedia: true,
          bannerMedia: true,
          memberships: {
            where: {
              status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER"] },
              playthrough: { status: "ACTIVE", previewMode: false },
            },
          },
        },
      },
      sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
    },
  });
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const account = (alias) => {
    const value = byId.get(accountIds[alias]);
    if (!value) throw new Error(`HOMEPORT_PHASE7_ROUND3_ACCOUNT_MISSING:${alias}`);
    return value;
  };
  const ordinaryChecks = (value) => {
    const email = value.emails[0];
    return (
      value.status === "ACTIVE" &&
      Boolean(value.claimedAt) &&
      Boolean(value.ordinaryWorkspaceEntryAt) &&
      email?.verificationState === "VERIFIED" &&
      Boolean(email.verifiedAt) &&
      value.profile?.status === "ACTIVE"
    );
  };
  const kg = account("KGTESTING_NEW");
  const sera = account("SERA_OWNER");
  const pending = account("PENDING_VERIFICATION");
  const locked = account("ACTIVE_PLAYER_LOCKED");
  const restricted = account("RESTRICTED_ACCOUNT");
  const noMedia = account("NO_PROFILE_MEDIA");
  const completeMedia = account("PROFILE_MEDIA_COMPLETE");
  const kgRoles = kg.roles.map((role) => role.role).sort();
  const seraRoles = sera.roles.map((role) => role.role).sort();
  const pendingChallenge = await db.accountToken.findFirst({
    where: { accountId: pending.id, purpose: "VERIFY_EMAIL", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const captainRows = await db.taleSession.count({ where: { captainAccountId: kg.id, previewMode: false } });
  const creatorRows = await db.chronicle.count({ where: { creatorAccountId: kg.id, archivedAt: null } });
  const providerRows = await db.transactionalEmailDelivery.findMany({
    where: { id: { startsWith: "hp-owcr3-postmark-" } },
    select: { id: true, provider: true, status: true, providerMessageId: true },
    orderBy: { id: "asc" },
  });
  const mediaRows = [completeMedia.profile?.avatarMedia, completeMedia.profile?.bannerMedia].filter(Boolean);
  const checks = {
    fixtureVersion:
      fixtureReceipt.fixtureVersion ===
      (process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION ?? "homeport-phase7-owner-correction-round3-v1"),
    requiredAliasCount: requiredAliases.length === 8,
    kgCreatedAndVerifiedThroughOrdinaryBoundary: ordinaryChecks(kg),
    kgOnlyNonPrivilegedPlayerRole: JSON.stringify(kgRoles) === JSON.stringify(["PLAYER"]),
    kgOrdinarySession: kg.sessions.some((session) => session.sessionType === "ORDINARY"),
    kgNoActiveChronicle: (kg.profile?.memberships.length ?? 0) === 0,
    kgCaptainEmpty: captainRows === 0,
    kgCreatorEmpty: creatorRows === 0,
    seraOrdinaryEntry: ordinaryChecks(sera),
    seraUsesInherentEntryWithoutRedundantRoles: !seraRoles.includes("CAPTAIN") && !seraRoles.includes("CREATOR"),
    pendingVerificationBounded:
      pending.status === "PENDING_VERIFICATION" &&
      !pending.ordinaryWorkspaceEntryAt &&
      pending.sessions.some((session) => session.sessionType === "VERIFICATION") &&
      Boolean(pendingChallenge),
    pendingChallengePolicy:
      pendingChallenge?.maxAttempts === 5 &&
      (pendingChallenge?.attemptCount ?? -1) >= 0 &&
      pendingChallenge?.expiresAt.getTime() > pendingChallenge?.createdAt.getTime() &&
      pendingChallenge.expiresAt.getTime() - pendingChallenge.createdAt.getTime() <= 15 * 60_000,
    activeChronicleLockAuthoritative: (locked.profile?.memberships.length ?? 0) > 0,
    restrictedPreserved: Boolean(restricted.lockedAt || restricted.suspendedAt),
    noProfileMediaFallback: !noMedia.profile?.avatarMediaId && !noMedia.profile?.bannerMediaId,
    profileMediaComplete:
      mediaRows.length === 2 &&
      mediaRows.every(
        (media) =>
          media.processingState === "READY" &&
          media.scanState === "LOCAL_VALIDATED" &&
          media.originalStorageKey &&
          media.storageKey,
      ),
    postmarkConfiguredSimulation:
      providerRows.some((row) => row.provider === "POSTMARK" && row.status === "SUBMITTED") &&
      providerRows.some((row) => row.provider === "POSTMARK" && row.status === "BOUNCED"),
    providerMessageIdsSafe: providerRows.every((row) => Boolean(row.providerMessageId)),
    darkPreference:
      JSON.parse(completeMedia.profile?.preferences ?? "{}").experience?.theme === "DARK" &&
      JSON.parse(kg.profile?.preferences ?? "{}").experience?.theme === "DARK",
    mediaFixtureFiles:
      Object.values(fixtureReceipt.media?.fixtureFiles ?? {}).length === 6 &&
      (
        await Promise.all(
          Object.values(fixtureReceipt.media?.fixtureFiles ?? {}).map(async (file) => (await stat(file)).size > 0),
        )
      ).every(Boolean),
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedChecks.length)
    throw new Error(`HOMEPORT_PHASE7_ROUND3_FIXTURE_VALIDATION_FAILED:${failedChecks.join(",")}`);

  const databaseHash = createHash("sha256")
    .update(await readFile(databasePath))
    .digest("hex");
  const receipt = {
    status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_FIXTURE_VALID",
    fixtureVersion: fixtureReceipt.fixtureVersion,
    databaseHash,
    accountAliases: requiredAliases,
    checks,
    providerStatus: "POSTMARK_BLOCKED_EXTERNAL_CONFIGURATION",
    privateFieldsExcluded: ["email", "password", "verification-code", "session-token", "csrf-token"],
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} finally {
  await db.$disconnect();
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
