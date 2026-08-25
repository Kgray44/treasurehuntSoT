import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const taskRoot = path.resolve(required("ADMIRALTY_PHASE2_TASK_ROOT"));
const databasePath = path.resolve(required("DATABASE_URL").replace(/^file:/u, ""));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const password = required("ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD");
const createdAt = new Date("2026-08-13T16:00:00.000Z");

const isSoundingLineDatabase =
  process.env.ADMIRALTY_PHASE3_ALLOW_SOUNDING_LINE_DATABASE === "1" &&
  /^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(databasePath)) &&
  databasePath.startsWith(`${path.resolve(process.cwd())}${path.sep}`);
if (
  !taskRoot.startsWith(`${allowedRoot}${path.sep}`) ||
  (!databasePath.startsWith(`${taskRoot}${path.sep}`) && !isSoundingLineDatabase)
)
  throw new Error("ADMIRALTY_PHASE3_FIXTURE_SCOPE_REFUSED");

const passwordHash = await bcrypt.hash(password, 10);
const fixtureAccounts = [
  {
    key: "MODERATION_OPERATOR",
    accountId: "adm3-account-moderator",
    profileId: "adm3-profile-moderator",
    role: "MODERATION_OPERATOR",
  },
  {
    key: "SECOND_REVIEWER",
    accountId: "adm3-account-reviewer",
    profileId: "adm3-profile-reviewer",
    role: "MODERATION_OPERATOR",
  },
];
for (const definition of fixtureAccounts) {
  await db.userAccount.upsert({
    where: { id: definition.accountId },
    update: { status: "ACTIVE" },
    create: { id: definition.accountId, status: "ACTIVE", claimedAt: createdAt, createdAt },
  });
  await db.playerProfile.upsert({
    where: { accountId: definition.accountId },
    update: {},
    create: {
      id: definition.profileId,
      accountId: definition.accountId,
      displayName: definition.key.replaceAll("_", " "),
      normalizedDisplayName: definition.key.toLowerCase(),
      handle: `adm3-${definition.key.toLowerCase().replaceAll("_", "-")}`,
      normalizedHandle: `adm3-${definition.key.toLowerCase().replaceAll("_", "-")}`,
      status: "ACTIVE",
      claimedAt: createdAt,
      createdAt,
    },
  });
  await db.accountEmail.upsert({
    where: { normalizedEmail: `${definition.key.toLowerCase()}@admiralty.example.test` },
    update: { isPrimary: true, verificationState: "VERIFIED", verifiedAt: createdAt },
    create: {
      accountId: definition.accountId,
      normalizedEmail: `${definition.key.toLowerCase()}@admiralty.example.test`,
      displayEmail: `${definition.key.toLowerCase()}@admiralty.example.test`,
      isPrimary: true,
      verificationState: "VERIFIED",
      verifiedAt: createdAt,
      createdAt,
    },
  });
  await db.accountCredential.upsert({
    where: { accountId: definition.accountId },
    update: { passwordHash },
    create: { accountId: definition.accountId, passwordHash, changedAt: createdAt, createdAt },
  });
  const roleAssignment = await db.accountRoleAssignment.findFirst({
    where: { accountId: definition.accountId, role: definition.role, scopeType: "GLOBAL", scopeId: null },
  });
  if (roleAssignment) {
    await db.accountRoleAssignment.update({ where: { id: roleAssignment.id }, data: { revokedAt: null } });
  } else {
    await db.accountRoleAssignment.create({
      data: {
        id: `adm3-role-${definition.key.toLowerCase()}-${definition.role.toLowerCase()}`,
        accountId: definition.accountId,
        role: definition.role,
        grantedAt: createdAt,
      },
    });
  }
}

await db.accountSession.upsert({
  where: { id: "adm3-session-support-target" },
  update: {
    accountId: "adm2-account-support-target",
    tokenHash: "adm3-synthetic-support-target-token-hash",
    csrfToken: "adm3-synthetic-csrf",
    deviceLabel: "Phase 3 synthetic support device",
    sessionType: "ORDINARY",
    expiresAt: new Date("2030-08-13T16:00:00.000Z"),
    lastSeenAt: createdAt,
    revokedAt: null,
  },
  create: {
    id: "adm3-session-support-target",
    accountId: "adm2-account-support-target",
    tokenHash: "adm3-synthetic-support-target-token-hash",
    csrfToken: "adm3-synthetic-csrf",
    deviceLabel: "Phase 3 synthetic support device",
    sessionType: "ORDINARY",
    expiresAt: new Date("2030-08-13T16:00:00.000Z"),
    lastSeenAt: createdAt,
    createdAt,
  },
});

const subjectId = "adm2-community-listing-chart-kit";
const moderationCase = await db.communityModerationCase.upsert({
  where: { id: "adm3-moderation-case-listing" },
  update: {},
  create: {
    id: "adm3-moderation-case-listing",
    caseKey: "adm3-case-listing",
    primaryReasonCode: "MISLEADING_LISTING",
    subjectFingerprint: createHash("sha256").update(subjectId).digest("hex"),
    correlationId: "adm3-correlation-moderation",
    priority: "HIGH",
    severity: "HIGH",
    openedAt: createdAt,
  },
});
await db.communityModerationCaseSubject.upsert({
  where: { caseId_subjectType_subjectId: { caseId: moderationCase.id, subjectType: "LISTING", subjectId } },
  update: {},
  create: {
    caseId: moderationCase.id,
    subjectType: "LISTING",
    subjectId,
    tombstone: JSON.stringify({ state: "LIVE", fixture: "ADMIRALTY_PHASE3" }),
    createdAt,
  },
});
const receipt = {
  status: "ADMIRALTY_PHASE3_FIXTURE_SEEDED",
  fixtureVersion: "admiralty-phase3-v1",
  aliases: ["ADMINISTRATOR", "MODERATION_OPERATOR", "ORDINARY_USER", "SECOND_REVIEWER", "SUPPORT_TARGET"],
  caseId: moderationCase.id,
  subjectId,
  correlationId: "adm3-correlation-moderation",
};
await fs.mkdir(path.join(taskRoot, "reports"), { recursive: true });
await fs.writeFile(
  path.join(taskRoot, "reports", "phase3-fixture-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(receipt)}\n`);
await db.$disconnect();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
