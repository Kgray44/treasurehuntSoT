import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(required("TIDEGLASS_PHASE3_TASK_ROOT"));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectTideglass");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const databasePath = path.join(taskRoot, "database", "tideglass-phase3.db");

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`TIDEGLASS_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`TIDEGLASS_FIXTURE_DATABASE_REFUSED:${databasePath}`);

await mkdir(path.dirname(databasePath), { recursive: true });
await mkdir(path.join(taskRoot, "reports"), { recursive: true });
for (const target of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await rm(target, { force: true });
// Prisma on Windows requires an extant SQLite target before migration deployment.
await writeFile(databasePath, "", "utf8");
const password = `Tg3-${randomBytes(24).toString("base64url")}!`;
const env = {
  ...process.env,
  TIDEGLASS_PHASE3_TASK_ROOT: taskRoot,
  TIDEGLASS_PHASE3_SYNTHETIC_PASSWORD: password,
  DATABASE_URL: sqliteUrl(databasePath),
};
run("node_modules/prisma/build/index.js", ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], env);
const fixture = runJson("scripts/tideglass/seed-phase3-fixture.mjs", env);
const receipt = {
  status: "TIDEGLASS_PHASE3_FIXTURE_READY",
  fixtureVersion: fixture.fixtureVersion,
  fixtureChecksum: fixture.fixtureChecksum,
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

function run(command, args, environment) {
  const result = spawnSync(process.execPath, [command, ...args], { cwd: root, env: environment, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
}
function runJson(script, environment) {
  const result = spawnSync(process.execPath, [script], { cwd: root, env: environment, encoding: "utf8" });
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
