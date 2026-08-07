import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const databasePath = path.resolve(process.argv[2] ?? required("HOMEPORT_PHASE7_ROUND2_DATABASE"));
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const credentialPath = path.join(
  taskRoot,
  "credentials",
  "owner-correction-round2-walkthrough-credentials.private.json",
);
const receiptPath = path.join(taskRoot, "reports", "owner-correction-round2-sera-validation.json");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (databasePath === canonicalDatabase || !databasePath.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_ROUND2_DATABASE_REFUSED:${databasePath}`);
if ((await stat(databasePath)).size < 1) throw new Error("HOMEPORT_PHASE7_ROUND2_DATABASE_EMPTY");

const credentialHandoff = JSON.parse(await readFile(credentialPath, "utf8"));
const seraAlias = credentialHandoff.accounts?.SERA;
if (!seraAlias?.accountId) throw new Error("HOMEPORT_PHASE7_ROUND2_SERA_ALIAS_MISSING");

const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const account = await db.userAccount.findUnique({
    where: { id: seraAlias.accountId },
    include: {
      emails: { where: { isPrimary: true } },
      profile: { include: { memberships: { where: { status: "ACTIVE_MEMBER" } } } },
      communityProfile: true,
      roles: { where: { revokedAt: null } },
      sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } },
    },
  });
  if (!account) throw new Error("HOMEPORT_PHASE7_ROUND2_SERA_ACCOUNT_MISSING");

  const primaryEmail = account.emails[0];
  const publicProfile = account.profile;
  const internalProjection = account.communityProfile;
  const activeRoles = [...new Set(account.roles.map((assignment) => assignment.role))].sort();
  const requiredRoles = ["CAPTAIN", "CREATOR", "PLAYER"];
  const privilegedRoles = activeRoles.filter((role) => ["ADMIN", "MODERATOR"].includes(role));
  const checks = {
    accountActive: account.status === "ACTIVE",
    accountClaimed: Boolean(account.claimedAt),
    accountUnrestricted: !account.lockedAt && !account.suspendedAt,
    primaryEmailVerified: Boolean(primaryEmail?.verifiedAt) && primaryEmail?.verificationState === "VERIFIED",
    publicProfileActive: publicProfile?.status === "ACTIVE",
    publicProfilePublic: publicProfile?.defaultVisibility === "PUBLIC",
    publicProfileAddressable: Boolean(publicProfile?.handle && publicProfile?.normalizedHandle),
    harborlightProjectionMatches:
      Boolean(internalProjection) &&
      internalProjection?.accountId === account.id &&
      internalProjection?.normalizedHandle === publicProfile?.normalizedHandle &&
      internalProjection?.visibility === "COMMUNITY" &&
      internalProjection?.moderationStatus === "ACTIVE",
    ordinaryWorkspaceRoles: requiredRoles.every((role) => activeRoles.includes(role)),
    noPrivilegedAutoGrant: privilegedRoles.length === 0,
    noActiveChronicleMembership: (publicProfile?.memberships.length ?? 0) === 0,
  };
  const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedChecks.length > 0)
    throw new Error(`HOMEPORT_PHASE7_ROUND2_SERA_VALIDATION_FAILED:${failedChecks.join(",")}`);

  const databaseHash = createHash("sha256")
    .update(await readFile(databasePath))
    .digest("hex");
  const receipt = {
    status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_SERA_VALID",
    fixtureVersion: "homeport-phase7-owner-correction-round2-v1",
    databaseHash,
    accountAlias: "SERA",
    accountId: account.id,
    publicHandle: publicProfile.handle,
    activeRoles,
    activeSessionCount: account.sessions.length,
    checks,
    privateFieldsExcluded: ["email", "password", "session-token", "csrf-token"],
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
