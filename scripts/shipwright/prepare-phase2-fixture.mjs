import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectShipwright");
const taskRoot = path.resolve(process.env.SHIPWRIGHT_PHASE2_TASK_ROOT ?? path.join(allowedRoot, "phase2-browser"));
const databasePath = path.join(taskRoot, "database", "shipwright-phase2.db");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`SHIPWRIGHT_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`SHIPWRIGHT_FIXTURE_DATABASE_REFUSED:${databasePath}`);

await mkdir(path.dirname(databasePath), { recursive: true });
await mkdir(path.join(taskRoot, "reports"), { recursive: true });
for (const target of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await rm(target, { force: true });
// Prisma on Windows needs the SQLite target to exist before migrate deploy can open it.
await writeFile(databasePath, "", "utf8");

const password = `ShipwrightP2-${randomBytes(24).toString("base64url")}!`;
const env = {
  ...process.env,
  SHIPWRIGHT_PHASE2_TASK_ROOT: taskRoot,
  SHIPWRIGHT_PHASE2_SYNTHETIC_PASSWORD: password,
  DATABASE_URL: sqliteUrl(databasePath),
};
run("node_modules/prisma/build/index.js", ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], env);
const fixture = runJson("scripts/shipwright/seed-phase2-fixture.mjs", env);
const receipt = {
  status: "SHIPWRIGHT_PHASE2_FIXTURE_READY",
  fixtureVersion: fixture.fixtureVersion,
  fixtureChecksum: fixture.fixtureChecksum,
  databasePath,
  privacy: "SYNTHETIC_RESERVED_DATA_ONLY",
  canonicalDatabaseUntouched: canonicalDatabase,
  credentialHandoffPath: "EXTERNAL_PRIVATE_HANDOFF",
  accountAliases: fixture.aliases,
};
await writeFile(
  path.join(taskRoot, "reports", "fixture-receipt.json"),
  `${JSON.stringify(receipt, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);

function run(command, args, env) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
}

function runJson(script, env) {
  const result = spawnSync(process.execPath, [script], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
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
