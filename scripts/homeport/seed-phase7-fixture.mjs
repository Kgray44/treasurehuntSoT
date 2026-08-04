import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const fixtureVersion = "homeport-phase7-integrated-v1";
const databaseUrl = process.env.DATABASE_URL ?? "";
const taskRoot = path.resolve(process.env.HOMEPORT_PHASE7_TASK_ROOT ?? "");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const syntheticPassword = process.env.HOMEPORT_PHASE7_SYNTHETIC_PASSWORD ?? "";
const createdAt = new Date("2026-08-04T12:00:00.000Z");

if (!databasePath || !taskRoot || !databasePath.startsWith(taskRoot + path.sep) || databasePath === canonicalDatabase)
  throw new Error(`HOMEPORT_PHASE7_FIXTURE_REFUSES_UNOWNED_DATABASE:${databasePath}`);
if (syntheticPassword.length < 24) throw new Error("HOMEPORT_PHASE7_SYNTHETIC_PASSWORD_REQUIRED");

const passwordHash = await bcrypt.hash(syntheticPassword, 10);

async function identity({ key, username, displayName, roles, status = "ACTIVE" }) {
  const gm = await db.gameMasterUser.upsert({
    where: { username },
    update: { passwordHash, role: "CAPTAIN_CREATOR", capabilities: "[]" },
    create: {
      id: `hp7-gm-${key}`,
      username,
      passwordHash,
      role: "CAPTAIN_CREATOR",
      capabilities: "[]",
      createdAt,
    },
  });
  const account = await db.userAccount.upsert({
    where: { id: `hp7-account-${key}` },
    update: { status, legacyGameMasterId: gm.id, claimedAt: createdAt },
    create: {
      id: `hp7-account-${key}`,
      status,
      legacyGameMasterId: gm.id,
      claimedAt: createdAt,
      createdAt,
    },
  });
  await db.playerProfile.upsert({
    where: { accountId: account.id },
    update: {
      displayName,
      handle: `hp7-${key}`,
      normalizedHandle: `hp7-${key}`,
      biography: "Synthetic Phase 7 walkthrough identity. No real person is represented.",
      defaultVisibility: "PUBLIC",
      status: status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      claimedAt: createdAt,
    },
    create: {
      id: `hp7-player-${key}`,
      accountId: account.id,
      displayName,
      handle: `hp7-${key}`,
      normalizedHandle: `hp7-${key}`,
      biography: "Synthetic Phase 7 walkthrough identity. No real person is represented.",
      defaultVisibility: "PUBLIC",
      status: status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      claimedAt: createdAt,
      createdAt,
    },
  });
  for (const role of roles) {
    const id = `hp7-role-${key}-${role.toLowerCase()}`;
    await db.accountRoleAssignment.upsert({
      where: { id },
      update: { accountId: account.id, role, revokedAt: null },
      create: { id, accountId: account.id, role, grantedAt: createdAt },
    });
  }
  const email = `${key}@phase7.example.test`;
  await upsertCanonicalCredential(account.id, email);
  return { accountId: account.id, username, email, displayName };
}

async function upsertCanonicalCredential(accountId, email) {
  await db.accountEmail.upsert({
    where: { normalizedEmail: email },
    update: { accountId, displayEmail: email, isPrimary: true, verificationState: "VERIFIED", verifiedAt: createdAt },
    create: {
      id: `hp7-email-${accountId}`,
      accountId,
      normalizedEmail: email,
      displayEmail: email,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: createdAt,
      createdAt,
    },
  });
  await db.accountCredential.upsert({
    where: { accountId },
    update: { passwordHash, changedAt: createdAt },
    create: { id: `hp7-credential-${accountId}`, accountId, passwordHash, changedAt: createdAt, createdAt },
  });
}

async function seed() {
  const extra = {
    CAPTAIN_ONLY: await identity({
      key: "captain-only",
      username: "hp7-captain-only",
      displayName: "Captain Northstar",
      roles: ["CAPTAIN"],
    }),
    CREATOR_ONLY: await identity({
      key: "creator-only",
      username: "hp7-creator-only",
      displayName: "Creator Chartwell",
      roles: ["CREATOR"],
    }),
    EXPIRED_SESSION_ACCOUNT: await identity({
      key: "expired-session",
      username: "hp7-expired-session",
      displayName: "Expired Session Mariner",
      roles: ["PLAYER"],
    }),
    RECOVERY_ACCOUNT: await identity({
      key: "recovery",
      username: "hp7-recovery",
      displayName: "Recovery Beacon",
      roles: ["PLAYER"],
    }),
    EMPTY_NEW_ACCOUNT: await identity({
      key: "empty-new",
      username: "hp7-empty-new",
      displayName: "New Harbor Arrival",
      roles: ["PLAYER"],
    }),
  };

  const inherited = {
    RETURNING_FULL_CAPABILITY: {
      accountId: "hp4-account-creator",
      username: "hp4-creator",
      email: "full-capability@phase7.example.test",
      displayName: "Captain Almanac",
    },
    PLAYER_ONLY: {
      accountId: "hp4-account-player",
      username: "hp4-player",
      email: "player-only@phase7.example.test",
      displayName: "Mara Testwake",
    },
    MODERATOR: {
      accountId: "hp4-account-moderator",
      username: "hp4-moderator",
      email: "moderator@phase7.example.test",
      displayName: "Harbor Moderator Test",
    },
    RESTRICTED_ACCOUNT: {
      accountId: "hp4-account-restricted",
      username: "hp4-restricted",
      email: "restricted@phase7.example.test",
      displayName: "Restricted Mariner Test",
    },
  };
  for (const value of Object.values(inherited)) {
    await db.gameMasterUser.update({ where: { username: value.username }, data: { passwordHash } });
    await upsertCanonicalCredential(value.accountId, value.email);
  }

  const aliases = {
    ANONYMOUS: { accountId: null, username: null, email: null, displayName: "Anonymous visitor" },
    REGISTRATION_CANDIDATE: {
      accountId: null,
      username: null,
      email: null,
      displayName: "Phase 7 Registration Candidate",
    },
    ...inherited,
    ...extra,
  };
  const recoveryTokens = {
    resetValid: randomBytes(36).toString("base64url"),
    resetExpired: randomBytes(36).toString("base64url"),
    verifyValid: randomBytes(36).toString("base64url"),
  };
  await db.accountToken.deleteMany({ where: { id: { startsWith: "hp7-token-" } } });
  await db.accountToken.createMany({
    data: [
      {
        id: "hp7-token-reset-valid",
        accountId: extra.RECOVERY_ACCOUNT.accountId,
        purpose: "PASSWORD_RESET",
        tokenHash: createHash("sha256").update(recoveryTokens.resetValid).digest("hex"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        id: "hp7-token-reset-expired",
        accountId: extra.RECOVERY_ACCOUNT.accountId,
        purpose: "PASSWORD_RESET",
        tokenHash: createHash("sha256").update(recoveryTokens.resetExpired).digest("hex"),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: "hp7-token-verify-valid",
        accountId: extra.RECOVERY_ACCOUNT.accountId,
        purpose: "VERIFY_EMAIL",
        tokenHash: createHash("sha256").update(recoveryTokens.verifyValid).digest("hex"),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    ],
  });
  const counts = {
    accounts: await db.userAccount.count(),
    profiles: await db.playerProfile.count(),
    roles: await db.accountRoleAssignment.count(),
    tales: await db.chronicle.count(),
    sessions: await db.taleSession.count(),
    communityListings: await db.communityListing.count(),
    communityProfiles: await db.communityProfile.count(),
    historyRecords: await db.playerChronicleRecord.count(),
    artifacts: await db.playerArtifactRecord.count(),
  };
  const safeAliasSummary = Object.fromEntries(
    Object.entries(aliases).map(([alias, value]) => [
      alias,
      { accountId: value.accountId, displayName: value.displayName },
    ]),
  );
  const fixtureIdentity = {
    schemaVersion: "1.0.0",
    fixtureVersion,
    classification: "SYNTHETIC_TEST_DATA",
    aliases: safeAliasSummary,
    counts,
    stateVariants: [
      "ANONYMOUS",
      "AUTHENTICATED",
      "EMPTY",
      "RESTRICTED",
      "EXPIRED_SESSION",
      "RECOVERY",
      "PERMISSION_DENIED",
      "DEPENDENCY_UNAVAILABLE",
    ],
  };
  const fixtureChecksum = createHash("sha256").update(JSON.stringify(fixtureIdentity)).digest("hex");
  const externalRoot = path.join(taskRoot, "credentials");
  await mkdir(externalRoot, { recursive: true });
  await mkdir(path.join(taskRoot, "tokens"), { recursive: true });
  await writeFile(
    path.join(externalRoot, "account-aliases.private.json"),
    `${JSON.stringify({ fixtureVersion, aliases }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  await writeFile(path.join(taskRoot, "tokens", "phase7-tokens.private.json"), `${JSON.stringify(recoveryTokens)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(
    `${JSON.stringify({ status: "HOMEPORT_PHASE7_FIXTURE_READY", databasePath, ...fixtureIdentity, fixtureChecksum })}\n`,
  );
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
