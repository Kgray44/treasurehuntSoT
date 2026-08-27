import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmod, copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const correctionRound = process.env.HOMEPORT_PHASE7_CORRECTION_ROUND ?? "1";
const fixtureVersion =
  process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION ??
  `homeport-phase7-owner-correction-round${correctionRound}-v1`;
const port =
  process.env.HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT ??
  (correctionRound === "3" ? "3768" : correctionRound === "2" ? "3756" : "3735");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const requestedSource = path.resolve(process.env.HOMEPORT_PHASE7_SOURCE_DATABASE ?? canonicalDatabase);
const soundingLineOwned = process.env.HOMEPORT_SOUNDING_LINE_TASK_ROOT === "1";
const approvedTaskRoot = soundingLineOwned
  ? path.join(repositoryRoot, "artifacts", "sounding-line")
  : path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport");
const approvedSoundingLineSource =
  soundingLineOwned &&
  requestedSource.startsWith(repositoryRoot + path.sep) &&
  /^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(requestedSource));
const seedDirectory = path.join(taskRoot, correctionRound === "1" ? "immutable-fixture-seed" : "immutable-seed");
const sourceCopy = path.join(seedDirectory, `owner-correction-round${correctionRound}-source-copy.db`);
const seedDatabase = path.join(seedDirectory, `${fixtureVersion}.db`);
const credentialPath = path.join(
  taskRoot,
  "credentials",
  `owner-correction-round${correctionRound}-walkthrough-credentials.private.json`,
);
const compatibilityCredentialPath =
  correctionRound === "1"
    ? path.join(taskRoot, "credentials", "owner-correction-walkthrough-credentials.private.json")
    : null;
const outboxPath = path.join(taskRoot, "synthetic-outbox", `owner-correction-round${correctionRound}-email.jsonl`);
const receiptPath = path.join(
  taskRoot,
  "reports",
  `owner-correction-round${correctionRound}-fixture-prepare-receipt.json`,
);

if (!taskRoot.startsWith(`${approvedTaskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (
  requestedSource !== canonicalDatabase &&
  !requestedSource.startsWith(`${taskRoot}${path.sep}`) &&
  !approvedSoundingLineSource
)
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
  HOMEPORT_PHASE7_CORRECTION_ROUND: correctionRound,
  HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION: fixtureVersion,
  HOMEPORT_PHASE7_OWNER_ALIAS: process.env.HOMEPORT_PHASE7_OWNER_ALIAS ?? "FULL_CAPABILITY",
  HOMEPORT_PHASE7_OWNER_DISPLAY_NAME: process.env.HOMEPORT_PHASE7_OWNER_DISPLAY_NAME ?? "Admiral Correction Test",
  HOMEPORT_PHASE7_TOKEN_PATH: path.join(taskRoot, "tokens", "owner-correction-phase7-base-tokens.private.json"),
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
  HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "media"),
};
const migrationSchema = runJson("scripts/homeport/verify-phase7-sqlite-schema.mjs", childEnv);
const phase4 = runJson("scripts/homeport/seed-phase4-fixture.mjs", childEnv);
const phase5 = runJson("scripts/homeport/seed-phase5-fixture.mjs", childEnv);
const phase7 = runJson("scripts/homeport/seed-phase7-fixture.mjs", childEnv);
const inheritedCorrection = runJson("scripts/homeport/seed-phase7-owner-correction-round1-fixture.mjs", childEnv);
const correction =
  correctionRound === "3"
    ? runJsonWith(
        "node_modules/tsx/dist/cli.mjs",
        ["scripts/homeport/seed-phase7-owner-correction-round3-fixture.ts"],
        childEnv,
      )
    : inheritedCorrection;
if (correctionRound === "2" || correctionRound === "3") {
  const owner = correction.aliases[correctionRound === "3" ? "SERA_OWNER" : "SERA"];
  if (!owner?.accountId) throw new Error("HOMEPORT_PHASE7_CORRECTION_ROUND2_SERA_ALIAS_REQUIRED");
  run(
    "node_modules/tsx/dist/cli.mjs",
    ["scripts/homeport/reconcile-claimed-account-capabilities.ts", "--commit", `--account-id=${owner.accountId}`],
    childEnv,
  );
}

const privateAliases = JSON.parse(
  await readFile(path.join(taskRoot, "credentials", "account-aliases.private.json"), "utf8"),
);
const credentialHandoff = `${JSON.stringify(
  {
    classification: "LOCAL_SYNTHETIC_CREDENTIAL_HANDOFF",
    fixtureVersion: correction.fixtureVersion,
    liveUrl: `http://127.0.0.1:${port}`,
    password: syntheticPassword,
    accounts: privateAliases.aliases,
    correctionTokenMaterial: path.join(taskRoot, "tokens", "owner-correction-tokens.private.json"),
    syntheticOutboxPath: outboxPath,
    statusCommand:
      correctionRound === "3"
        ? "npm run homeport:phase7:correction:round3:walkthrough:status"
        : correctionRound === "2"
          ? "npm run homeport:phase7:correction:round2:walkthrough:status"
          : "npm run homeport:phase7:correction:walkthrough:status",
    resetCommand:
      correctionRound === "3"
        ? "npm run homeport:phase7:correction:round3:walkthrough:reset"
        : correctionRound === "2"
          ? "npm run homeport:phase7:correction:round2:walkthrough:reset"
          : "npm run homeport:phase7:correction:walkthrough:reset",
    stopCommand:
      correctionRound === "3"
        ? "npm run homeport:phase7:correction:round3:walkthrough:stop"
        : correctionRound === "2"
          ? "npm run homeport:phase7:correction:round2:walkthrough:stop"
          : "npm run homeport:phase7:correction:walkthrough:stop",
  },
  null,
  2,
)}\n`;
await writeFile(credentialPath, credentialHandoff, { encoding: "utf8", mode: 0o600 });
if (compatibilityCredentialPath)
  await writeFile(compatibilityCredentialPath, credentialHandoff, { encoding: "utf8", mode: 0o600 });

await chmod(seedDatabase, 0o444);
const schemaBytes = await readFile(path.join(repositoryRoot, "prisma", "schema.sqlite.prisma"));
const databaseHash = await sha256(seedDatabase);
const sourceHash = await sha256(requestedSource);
const receipt = {
  status: `HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND${correctionRound}_IMMUTABLE_SEED_READY`,
  fixtureVersion: correction.fixtureVersion,
  fixtureChecksum: correction.fixtureChecksum,
  schemaHash: createHash("sha256").update(schemaBytes).digest("hex"),
  migrationCount: await countMigrationDirectories(path.join(repositoryRoot, "prisma", "migrations")),
  migrationSchema,
  requestedSource,
  sourceHash,
  sourceCopy,
  immutableSeed: seedDatabase,
  databaseHash,
  contentCounts: correction.counts,
  stateVariants: correction.stateVariants,
  ...(correction.media ? { media: correction.media } : {}),
  ...(correction.email ? { email: correction.email } : {}),
  accountAliases: Object.keys(correction.aliases),
  inheritedFixtureChecksums: {
    phase4: phase4.fixtureChecksum,
    phase5: phase5.fixtureChecksum,
    phase7: phase7.fixtureChecksum,
  },
  credentialPath,
  ...(compatibilityCredentialPath ? { compatibilityCredentialPath } : {}),
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

function runJsonWith(command, args, env) {
  const result = spawnSync(process.execPath, [command, ...args], { cwd: repositoryRoot, env, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${args.at(-1)} failed:\n${result.stderr || result.stdout}`);
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
