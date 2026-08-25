import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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
  if (!/^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(databasePath))) return;
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
}

function run(script: string, env: NodeJS.ProcessEnv) {
  execFileSync(process.execPath, [script], { cwd: process.cwd(), env, stdio: "inherit" });
}
