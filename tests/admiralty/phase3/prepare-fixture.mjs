import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.ADMIRALTY_PHASE3_TASK_ROOT ??
    path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "admiralty-phase3-command-qualification"),
);
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const password = process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? `Adm3-${randomBytes(24).toString("base64url")}!`;

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`))
  throw new Error(`ADMIRALTY_PHASE3_TASK_ROOT_REFUSED:${taskRoot}`);
run("scripts/admiralty/prepare-phase2-fixture.mjs", {
  ...process.env,
  ADMIRALTY_PHASE2_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD: password,
  ADMIRALTY_PHASE2_WRITE_CREDENTIAL_HANDOFF: "0",
});
if (!existsSync(databasePath)) throw new Error("ADMIRALTY_PHASE3_BASE_FIXTURE_MISSING");
run("tests/admiralty/phase3/seed-fixture.mjs", {
  ...process.env,
  ADMIRALTY_PHASE2_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD: password,
  DATABASE_URL: sqliteUrl(databasePath),
});

const phase3Receipt = JSON.parse(await readFile(path.join(taskRoot, "reports", "phase3-fixture-receipt.json"), "utf8"));
const receipt = {
  status: "ADMIRALTY_PHASE3_FIXTURE_READY",
  fixtureVersion: phase3Receipt.fixtureVersion,
  databasePath,
  privacy: "SYNTHETIC_RESERVED_DATA_ONLY",
  canonicalDatabaseUntouched: path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db"),
  accountAliases: phase3Receipt.aliases,
  caseId: phase3Receipt.caseId,
  subjectId: phase3Receipt.subjectId,
  correlationId: phase3Receipt.correlationId,
};
await writeFile(path.join(taskRoot, "reports", "phase3-ready-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(receipt)}\n`);

function run(script, env) {
  const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
}
function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
