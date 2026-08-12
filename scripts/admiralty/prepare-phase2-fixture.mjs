import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(required("ADMIRALTY_PHASE2_TASK_ROOT"));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`ADMIRALTY_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`ADMIRALTY_FIXTURE_DATABASE_REFUSED:${databasePath}`);

await mkdir(path.dirname(databasePath), { recursive: true });
await mkdir(path.join(taskRoot, "reports"), { recursive: true });
for (const target of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await rm(target, { force: true });
await writeFile(databasePath, "", "utf8");
const password = `Adm2-${randomBytes(24).toString("base64url")}!`;
const env = {
  ...process.env,
  ADMIRALTY_PHASE2_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD: password,
  DATABASE_URL: sqliteUrl(databasePath),
};
run("node_modules/prisma/build/index.js", ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], env);
const fixture = runJson("scripts/admiralty/seed-phase2-fixture.mjs", env);
const receipt = {
  status: "ADMIRALTY_PHASE2_FIXTURE_READY",
  fixtureVersion: fixture.fixtureVersion,
  fixtureChecksum: fixture.fixtureChecksum,
  correlationId: fixture.correlationId,
  databasePath,
  privacy: "SYNTHETIC_RESERVED_DATA_ONLY",
  canonicalDatabaseUntouched: canonicalDatabase,
  accountAliases: fixture.aliases,
};
await writeFile(
  path.join(taskRoot, "reports", "fixture-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);

function run(command, args, env) {
  const result = spawnSync(process.execPath, [command, ...args], { cwd: root, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
}
function runJson(script, env) {
  const result = spawnSync(process.execPath, [script], { cwd: root, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim());
}
function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
