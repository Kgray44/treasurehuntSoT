import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const taskRoot = path.resolve(required("ADMIRALTY_PHASE1_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const password = required("ADMIRALTY_PHASE1_SYNTHETIC_PASSWORD");
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const createdAt = new Date("2026-08-09T12:00:00.000Z");

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`ADMIRALTY_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`ADMIRALTY_FIXTURE_DATABASE_REFUSED:${databasePath}`);
if (password.length < 24) throw new Error("ADMIRALTY_SYNTHETIC_PASSWORD_TOO_SHORT");

const passwordHash = await bcrypt.hash(password, 10);
const definitions = {
  ORDINARY_USER: {
    id: "adm1-account-ordinary",
    email: "ordinary@admiralty.example.test",
    displayName: "Ordinary Mariner",
    roles: ["PLAYER"],
  },
  ADMINISTRATOR: {
    id: "adm1-account-admin",
    email: "administrator@admiralty.example.test",
    displayName: "Admiral Northstar",
    roles: ["ADMINISTRATOR"],
  },
  SUPPORT_TARGET: {
    id: "adm1-account-target",
    email: "target@admiralty.example.test",
    displayName: "Consent Harbor",
    roles: ["PLAYER"],
  },
  DENIAL_TARGET: {
    id: "adm1-account-denial",
    email: "denial@admiralty.example.test",
    displayName: "Denial Harbor",
    roles: ["PLAYER"],
  },
};

for (const [key, definition] of Object.entries(definitions)) await createIdentity(key, definition);
await db.securityEvent.create({
  data: {
    id: "adm1-security-event-target",
    accountId: definitions.SUPPORT_TARGET.id,
    eventType: "SYNTHETIC_SIGN_IN_DIAGNOSTIC",
    correlationId: "adm1-safe-correlation",
    metadata: JSON.stringify({
      provider: "synthetic",
      token: "must-never-appear",
      nested: { passwordHash: "must-never-appear" },
    }),
    createdAt,
  },
});

const aliases = Object.fromEntries(
  Object.entries(definitions).map(([key, value]) => [
    key,
    { accountId: value.id, email: value.email, displayName: value.displayName },
  ]),
);
const credentialPath = path.join(taskRoot, "credentials", "admiralty-phase1-walkthrough.private.json");
await mkdir(path.dirname(credentialPath), { recursive: true });
await writeFile(
  credentialPath,
  `${JSON.stringify({ classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF", fixtureVersion: "admiralty-phase1-v1", password, accounts: aliases }, null, 2)}\n`,
  { encoding: "utf8", mode: 0o600 },
);
const fixtureChecksum = createHash("sha256").update(JSON.stringify(aliases)).digest("hex");
process.stdout.write(
  `${JSON.stringify({ status: "ADMIRALTY_PHASE1_FIXTURE_SEEDED", fixtureVersion: "admiralty-phase1-v1", fixtureChecksum, aliases: Object.keys(aliases), credentialPath: "EXTERNAL_PRIVATE_HANDOFF" })}\n`,
);
await db.$disconnect();

async function createIdentity(key, definition) {
  await db.userAccount.create({ data: { id: definition.id, status: "ACTIVE", claimedAt: createdAt, createdAt } });
  await db.playerProfile.create({
    data: {
      id: `adm1-profile-${key.toLowerCase()}`,
      accountId: definition.id,
      displayName: definition.displayName,
      normalizedDisplayName: definition.displayName.toLocaleLowerCase(),
      handle: `adm1-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      normalizedHandle: `adm1-${key.toLocaleLowerCase().replaceAll("_", "-")}`,
      biography: "Synthetic Project Admiralty Phase 1 identity. No real person is represented.",
      defaultVisibility: "ONLY_ME",
      status: "ACTIVE",
      claimedAt: createdAt,
      createdAt,
    },
  });
  await db.accountEmail.create({
    data: {
      id: `adm1-email-${key.toLowerCase()}`,
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
      id: `adm1-credential-${key.toLowerCase()}`,
      accountId: definition.id,
      passwordHash,
      changedAt: createdAt,
      createdAt,
    },
  });
  for (const role of definition.roles)
    await db.accountRoleAssignment.create({
      data: {
        id: `adm1-role-${key.toLowerCase()}-${role.toLowerCase()}`,
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
