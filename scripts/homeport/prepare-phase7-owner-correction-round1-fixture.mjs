import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const requestedSource = path.resolve(process.env.HOMEPORT_PHASE7_SOURCE_DATABASE ?? canonicalDatabase);
const sourceCopy = path.join(taskRoot, "immutable-fixture-seed", "owner-correction-canonical-source-copy.db");
const seedDatabase = path.join(taskRoot, "immutable-fixture-seed", "homeport-phase7-owner-correction-round1-v1.db");
const credentialPath = path.join(taskRoot, "credentials", "owner-correction-walkthrough-credentials.private.json");
const outboxPath = path.join(taskRoot, "synthetic-outbox", "owner-correction-email.jsonl");
const receiptPath = path.join(taskRoot, "reports", "owner-correction-fixture-prepare-receipt.json");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (requestedSource !== canonicalDatabase && !requestedSource.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_SOURCE_DATABASE_REFUSED:${requestedSource}`);
if ((await stat(requestedSource)).size < 1) throw new Error("HOMEPORT_PHASE7_CORRECTION_SOURCE_DATABASE_EMPTY");

await mkdir(path.dirname(sourceCopy), { recursive: true });
await mkdir(path.dirname(credentialPath), { recursive: true });
await mkdir(path.dirname(outboxPath), { recursive: true });
await mkdir(path.dirname(receiptPath), { recursive: true });
for (const target of [sourceCopy, seedDatabase, `${seedDatabase}-wal`, `${seedDatabase}-shm`, outboxPath])
  await rm(target, { force: true });
await copyFile(requestedSource, sourceCopy);
await copyFile(sourceCopy, seedDatabase);

const syntheticPassword = `Hp7c-${randomBytes(24).toString("base64url")}!`;
const childEnv = {
  ...process.env,
  DATABASE_URL: sqliteUrl(seedDatabase),
  HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE5_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE7_SYNTHETIC_PASSWORD: syntheticPassword,
  HOMEPORT_PHASE7_TOKEN_PATH: path.join(taskRoot, "tokens", "owner-correction-phase7-base-tokens.private.json"),
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
};
run("node_modules/prisma/build/index.js", ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], childEnv);
const phase4 = runJson("scripts/homeport/seed-phase4-fixture.mjs", childEnv);
const phase5 = runJson("scripts/homeport/seed-phase5-fixture.mjs", childEnv);
const phase7 = runJson("scripts/homeport/seed-phase7-fixture.mjs", childEnv);
const correction = runJson("scripts/homeport/seed-phase7-owner-correction-round1-fixture.mjs", childEnv);

const privateAliases = JSON.parse(
  await readFile(path.join(taskRoot, "credentials", "account-aliases.private.json"), "utf8"),
);
await writeFile(
  credentialPath,
  `${JSON.stringify(
    {
      classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF",
      fixtureVersion: correction.fixtureVersion,
      liveUrl: "http://127.0.0.1:3735",
      password: syntheticPassword,
      accounts: privateAliases.aliases,
      correctionTokenMaterial: path.join(taskRoot, "tokens", "owner-correction-tokens.private.json"),
      syntheticOutboxPath: outboxPath,
      statusCommand: "npm run homeport:phase7:correction:walkthrough:status",
      resetCommand: "npm run homeport:phase7:correction:walkthrough:reset",
      stopCommand: "npm run homeport:phase7:correction:walkthrough:stop",
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);

await chmod(seedDatabase, 0o444);
const schemaBytes = await readFile(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"));
const databaseHash = await sha256(seedDatabase);
const sourceHash = await sha256(requestedSource);
const receipt = {
  status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND1_IMMUTABLE_SEED_READY",
  fixtureVersion: correction.fixtureVersion,
  fixtureChecksum: correction.fixtureChecksum,
  schemaHash: createHash("sha256").update(schemaBytes).digest("hex"),
  migrationCount: await countMigrationDirectories(path.join(repositoryRoot, "prisma", "migrations")),
  requestedSource,
  sourceHash,
  sourceCopy,
  immutableSeed: seedDatabase,
  databaseHash,
  contentCounts: correction.counts,
  stateVariants: correction.stateVariants,
  accountAliases: Object.keys(correction.aliases),
  inheritedFixtureChecksums: {
    phase4: phase4.fixtureChecksum,
    phase5: phase5.fixtureChecksum,
    phase7: phase7.fixtureChecksum,
  },
  credentialPath,
  outboxPath,
  privacyScan: "SYNTHETIC_RESERVED_DATA_ONLY",
  immutableMode: "READ_ONLY_SEED",
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...receipt, credentialPath: "EXTERNAL_HANDOFF_CREATED" }, null, 2)}\n`);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: repositoryRoot, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
}

function runJson(script, env) {
  const result = spawnSync(process.execPath, [script], { cwd: repositoryRoot, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout.trim());
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

async function countMigrationDirectories(root) {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
