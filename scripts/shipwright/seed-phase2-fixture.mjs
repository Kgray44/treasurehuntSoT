import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const taskRoot = path.resolve(required("SHIPWRIGHT_PHASE2_TASK_ROOT"));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectShipwright");
const databaseUrl = required("DATABASE_URL");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";
const password = required("SHIPWRIGHT_PHASE2_SYNTHETIC_PASSWORD");
const validationNonceHash = process.env.FOREVER_VALIDATION_NONCE_HASH ?? null;
const creator = {
  id: "shipwright-p2-account-creator",
  profileId: "shipwright-p2-profile-creator",
  email: "shipwright.phase2.creator@example.test",
  displayName: "Shipwright Synthetic Creator",
};
const createdAt = new Date("2026-08-12T15:00:00.000Z");

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`SHIPWRIGHT_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`SHIPWRIGHT_FIXTURE_DATABASE_REFUSED:${databasePath}`);
if (password.length < 24) throw new Error("SHIPWRIGHT_SYNTHETIC_PASSWORD_TOO_SHORT");

const passwordHash = await bcrypt.hash(password, 10);
await db.userAccount.create({
  data: {
    id: creator.id,
    status: "ACTIVE",
    claimedAt: createdAt,
    ordinaryWorkspaceEntryAt: createdAt,
    lastSeenAt: createdAt,
    createdAt,
  },
});
await db.playerProfile.create({
  data: {
    id: creator.profileId,
    accountId: creator.id,
    displayName: creator.displayName,
    normalizedDisplayName: creator.displayName.toLocaleLowerCase(),
    handle: "shipwright-phase2-creator",
    normalizedHandle: "shipwright-phase2-creator",
    biography: "Synthetic Project Shipwright Phase 2 Creator. No real person is represented.",
    defaultVisibility: "ONLY_ME",
    status: "ACTIVE",
    claimedAt: createdAt,
    createdAt,
  },
});
await db.accountEmail.create({
  data: {
    id: "shipwright-p2-email-creator",
    accountId: creator.id,
    normalizedEmail: creator.email,
    displayEmail: creator.email,
    isPrimary: true,
    verificationState: "VERIFIED",
    verifiedAt: createdAt,
    createdAt,
  },
});
await db.accountCredential.create({
  data: {
    id: "shipwright-p2-credential-creator",
    accountId: creator.id,
    passwordHash,
    changedAt: createdAt,
    createdAt,
  },
});
await db.accountRoleAssignment.create({
  data: {
    id: "shipwright-p2-role-creator",
    accountId: creator.id,
    role: "CREATOR",
    grantedAt: createdAt,
  },
});
if (validationNonceHash) {
  await db.platformAuditEvent.create({
    data: {
      actorType: "VALIDATION_HARNESS",
      action: "VALIDATION_DATABASE_IDENTITY",
      resourceType: "VALIDATION_DATABASE",
      resourceId: validationNonceHash,
      outcome: "SUCCEEDED",
      correlationId: validationNonceHash,
      metadata: JSON.stringify({ marker: "shipwright-phase2-task-fixture", nonceHash: validationNonceHash }),
    },
  });
}

const credentialPath = path.join(taskRoot, "credentials", "shipwright-phase2-browser.private.json");
await mkdir(path.dirname(credentialPath), { recursive: true });
await writeFile(
  credentialPath,
  `${JSON.stringify(
    {
      classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF",
      fixtureVersion: "shipwright-phase2-v1",
      password,
      creator: { email: creator.email, displayName: creator.displayName },
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);
const aliases = { CREATOR: { accountId: creator.id, email: creator.email, displayName: creator.displayName } };
const fixtureChecksum = createHash("sha256").update(JSON.stringify(aliases)).digest("hex");
process.stdout.write(
  `${JSON.stringify({ status: "SHIPWRIGHT_PHASE2_FIXTURE_SEEDED", fixtureVersion: "shipwright-phase2-v1", fixtureChecksum, aliases, credentialPath: "EXTERNAL_PRIVATE_HANDOFF" })}\n`,
);
await db.$disconnect();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
