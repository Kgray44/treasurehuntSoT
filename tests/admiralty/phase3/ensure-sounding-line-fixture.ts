import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export const syntheticPassword = "Adm3-synthetic-fixture-password-20260825!";

export const phase2Credentials = {
  fixtureVersion: "admiralty-phase2-v1",
  password: syntheticPassword,
  accounts: {
    ADMINISTRATOR: {
      accountId: "adm2-account-administrator",
      email: "administrator@admiralty.example.test",
      displayName: "Admiral Northstar",
    },
    SUPPORT_OPERATOR: {
      accountId: "adm2-account-support-operator",
      email: "support-operator@admiralty.example.test",
      displayName: "Support Lantern",
    },
    OPERATIONS_OBSERVER: {
      accountId: "adm2-account-operations-observer",
      email: "operations-observer@admiralty.example.test",
      displayName: "Operations Lookout",
    },
    AUDIT_OPERATOR: {
      accountId: "adm2-account-audit-operator",
      email: "audit-operator@admiralty.example.test",
      displayName: "Audit Quartermaster",
    },
    ORDINARY_USER: {
      accountId: "adm2-account-ordinary",
      email: "ordinary@admiralty.example.test",
      displayName: "Ordinary Mariner",
    },
    SUPPORT_TARGET: {
      accountId: "adm2-account-support-target",
      email: "support-target@admiralty.example.test",
      displayName: "Consent Harbor",
    },
  },
};

export async function ensureSoundingLineFixture() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) return;

  const root = process.cwd();
  const databasePath = path.resolve(root, databaseUrl.slice("file:".length));
  const isLegacySoundingLineDatabase = /^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(databasePath));
  const genericIsolationPath = path.relative(path.join(root, "artifacts", "sounding-line"), databasePath);
  const isGenericSoundingLineDatabase =
    process.env.SOUNDING_LINE_SUITE_PROFILE === "generic" &&
    process.env.FOREVER_VALIDATION_ISOLATION === "1" &&
    /^generic-[a-f0-9]{12}[\\/]validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(genericIsolationPath);
  if (!isLegacySoundingLineDatabase && !isGenericSoundingLineDatabase) return;
  if (!databasePath.startsWith(`${root}${path.sep}`)) throw new Error("ADMIRALTY_SOUNDING_LINE_DATABASE_REFUSED");

  const db = new PrismaClient();
  const baseFixtureExists = await db.userAccount.findUnique({ where: { id: "adm2-account-administrator" } });
  await db.$disconnect();

  const taskRoot = path.join(root, "ProjectAdmiralty", "sounding-line-fixture");
  const env = {
    ...process.env,
    LOCALAPPDATA: root,
    ADMIRALTY_PHASE2_TASK_ROOT: taskRoot,
    ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD: syntheticPassword,
    ADMIRALTY_PHASE2_WRITE_CREDENTIAL_HANDOFF: "0",
    ADMIRALTY_PHASE2_ALLOW_SOUNDING_LINE_DATABASE: "1",
    ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD: syntheticPassword,
    ADMIRALTY_PHASE3_ALLOW_SOUNDING_LINE_DATABASE: "1",
  };
  if (!baseFixtureExists) run("scripts/admiralty/seed-phase2-fixture.mjs", env);
  run("tests/admiralty/phase3/seed-fixture.mjs", env);
  await reconcilePhase2Credentials();
}

async function reconcilePhase2Credentials() {
  const accountIds = Object.values(phase2Credentials.accounts).map(({ accountId }) => accountId);
  const db = new PrismaClient();
  try {
    const accounts = await db.userAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true } });
    if (accounts.length !== accountIds.length) throw new Error("ADMIRALTY_SOUNDING_LINE_PHASE2_FIXTURE_INCOMPLETE");

    const passwordHash = await bcrypt.hash(syntheticPassword, 10);
    await db.$transaction(
      accountIds.map((accountId) =>
        db.accountCredential.upsert({
          where: { accountId },
          update: { passwordHash, changedAt: new Date("2026-08-13T16:00:00.000Z") },
          create: { accountId, passwordHash, changedAt: new Date("2026-08-13T16:00:00.000Z") },
        }),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}

function run(script: string, env: NodeJS.ProcessEnv) {
  execFileSync(process.execPath, [script], { cwd: process.cwd(), env, stdio: "inherit" });
}
