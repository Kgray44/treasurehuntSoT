import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const requestedSource = path.resolve(process.env.HOMEPORT_PHASE7_SOURCE_DATABASE ?? canonicalDatabase);
const sourceCopy = path.join(taskRoot, "immutable-fixture-seed", "canonical-source-copy.db");
const seedDatabase = path.join(taskRoot, "immutable-fixture-seed", "homeport-phase7-integrated-v1.db");
const credentialPath = path.join(taskRoot, "credentials", "walkthrough-credentials.private.json");
const receiptPath = path.join(taskRoot, "reports", "phase7-fixture-prepare-receipt.json");

if (!taskRoot.startsWith(path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport") + path.sep))
  throw new Error(`HOMEPORT_PHASE7_TASK_ROOT_REFUSED:${taskRoot}`);
if (requestedSource !== canonicalDatabase && !requestedSource.startsWith(taskRoot + path.sep))
  throw new Error(`HOMEPORT_PHASE7_SOURCE_DATABASE_REFUSED:${requestedSource}`);
if ((await stat(requestedSource)).size < 1) throw new Error("HOMEPORT_PHASE7_SOURCE_DATABASE_EMPTY");

await mkdir(path.dirname(sourceCopy), { recursive: true });
await mkdir(path.dirname(credentialPath), { recursive: true });
await mkdir(path.dirname(receiptPath), { recursive: true });
for (const target of [sourceCopy, seedDatabase, `${seedDatabase}-wal`, `${seedDatabase}-shm`])
  await rm(target, { force: true });
await copyFile(requestedSource, sourceCopy);
await copyFile(sourceCopy, seedDatabase);

const syntheticPassword = `Hp7-${randomBytes(24).toString("base64url")}!`;
const childEnv = {
  ...process.env,
  DATABASE_URL: sqliteUrl(seedDatabase),
  HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE5_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE7_SYNTHETIC_PASSWORD: syntheticPassword,
};
const phase4 = runJson("scripts/homeport/seed-phase4-fixture.mjs", childEnv);
const phase5 = runJson("scripts/homeport/seed-phase5-fixture.mjs", childEnv);
const phase7 = runJson("scripts/homeport/seed-phase7-fixture.mjs", childEnv);

const privateAliases = JSON.parse(
  await readFile(path.join(taskRoot, "credentials", "account-aliases.private.json"), "utf8"),
);
await writeFile(
  credentialPath,
  `${JSON.stringify(
    {
      classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF",
      fixtureVersion: phase7.fixtureVersion,
      liveUrl: "http://127.0.0.1:3717",
      password: syntheticPassword,
      accounts: privateAliases.aliases,
      tokenMaterial: path.join(taskRoot, "browser-state", "phase5-secrets.json"),
      resetCommand: "npm run homeport:phase7:walkthrough:reset",
      stopCommand: "npm run homeport:phase7:walkthrough:stop",
    },
    null,
    2,
  )}\n`,
  { encoding: "utf8", mode: 0o600 },
);

const schemaBytes = await readFile(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"));
const migrationsRoot = path.join(repositoryRoot, "prisma", "migrations");
const databaseHash = await sha256(seedDatabase);
const sourceHash = await sha256(requestedSource);
const receipt = {
  status: "HOMEPORT_PHASE7_IMMUTABLE_SEED_READY",
  fixtureVersion: phase7.fixtureVersion,
  fixtureChecksum: phase7.fixtureChecksum,
  schemaHash: createHash("sha256").update(schemaBytes).digest("hex"),
  migrationCount: await countMigrationDirectories(migrationsRoot),
  requestedSource,
  sourceHash,
  sourceCopy,
  immutableSeed: seedDatabase,
  databaseHash,
  contentCounts: phase7.counts,
  stateVariants: phase7.stateVariants,
  accountAliases: Object.keys(phase7.aliases),
  inheritedFixtureChecksums: { phase4: phase4.fixtureChecksum, phase5: phase5.fixtureChecksum },
  credentialPath,
  privacyScan: "SYNTHETIC_RESERVED_DATA_ONLY",
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...receipt, credentialPath: "EXTERNAL_HANDOFF_CREATED" }, null, 2)}\n`);

function runJson(script, env) {
  const result = spawnSync(process.execPath, [script], { cwd: repositoryRoot, env, encoding: "utf8" });
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
