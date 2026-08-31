import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const localAppData = required("LOCALAPPDATA");
const allowedRoot = path.resolve(localAppData, "VoyagewrightBrightwork");
const taskRoot = path.resolve(process.env.BRIGHTWORK_TASK_ROOT ?? path.join(allowedRoot, "stage1"));
const homeportRoot = path.resolve(localAppData, "ProjectHomeport", "brightwork-stage1");
const admiraltyRoot = path.resolve(localAppData, "ProjectAdmiralty", "brightwork-stage1");
const combinedDatabase = path.join(taskRoot, "database", "brightwork-combined-synthetic.db");
const admiraltyDatabase = path.join(admiraltyRoot, "database", "admiralty-phase2.db");
const homeportDatabase = path.join(
  homeportRoot,
  "owner-rereview-database",
  "homeport-phase7-owner-correction-round3-rereview.db",
);
const sourceSha = git(["rev-parse", "HEAD"]);
const currentMainBootstrapDatabase = path.join(homeportRoot, "bootstrap", `current-main-${sourceSha.slice(0, 12)}.db`);

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("BRIGHTWORK_TASK_ROOT_REFUSED");
for (const directory of [taskRoot, homeportRoot, admiraltyRoot]) await mkdir(directory, { recursive: true });

await mkdir(path.dirname(currentMainBootstrapDatabase), { recursive: true });
await rm(currentMainBootstrapDatabase, { force: true });
run("scripts/sounding-line/sqlite-bootstrap.mjs", {}, ["--database-url", sqliteUrl(currentMainBootstrapDatabase)]);

run("scripts/homeport/prepare-phase7-owner-correction-round3-fixture.mjs", {
  HOMEPORT_PHASE7_TASK_ROOT: homeportRoot,
  HOMEPORT_PHASE7_SOURCE_DATABASE: currentMainBootstrapDatabase,
  HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT: "3868",
  HOMEPORT_PHASE7_OWNER_ALIAS: "FULL_CAPABILITY",
});
run("scripts/homeport/phase7-owner-correction-round3-database-clone.mjs", {
  HOMEPORT_PHASE7_TASK_ROOT: homeportRoot,
  HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT: "3868",
}, ["walkthrough"]);

if (!(await stat(homeportDatabase)).size) throw new Error("BRIGHTWORK_HOMEPORT_CLONE_EMPTY");
await mkdir(path.dirname(combinedDatabase), { recursive: true });
await mkdir(path.dirname(admiraltyDatabase), { recursive: true });
await copyFile(homeportDatabase, combinedDatabase);
await copyFile(combinedDatabase, admiraltyDatabase);

run("scripts/admiralty/seed-phase2-fixture.mjs", {
  ADMIRALTY_PHASE2_TASK_ROOT: admiraltyRoot,
  DATABASE_URL: sqliteUrl(admiraltyDatabase),
  ADMIRALTY_PHASE2_SYNTHETIC_PASSWORD: `BrwAdm-${randomBytes(24).toString("base64url")}!`,
  ADMIRALTY_PHASE2_WRITE_CREDENTIAL_HANDOFF: "1",
});
await copyFile(admiraltyDatabase, combinedDatabase);

const homeportCredentials = path.join(homeportRoot, "credentials", "owner-correction-round3-walkthrough-credentials.private.json");
const admiraltyCredentials = path.join(admiraltyRoot, "credentials", "admiralty-phase2-walkthrough.private.json");
const [databaseHash, homeportAliasCount, admiraltyAliasCount] = await Promise.all([
  sha256(combinedDatabase),
  aliasCount(homeportCredentials),
  aliasCount(admiraltyCredentials),
]);
const receipt = {
  schemaVersion: "1.0.0",
  status: "BRIGHTWORK_COMBINED_SYNTHETIC_FIXTURE_READY",
  sourceSha,
  fixtureVersion: "brightwork-combined-homeport-round3-admiralty-phase2-v1",
  databasePath: combinedDatabase,
  databaseHash,
  credentials: {
    homeport: homeportCredentials,
    admiralty: admiraltyCredentials,
    homeportAliasCount,
    admiraltyAliasCount,
  },
  privacyBasis: "Task-owned database assembled only from governed synthetic Homeport and Admiralty fixture seeds; private credentials remain outside the repository.",
  generatedAt: new Date().toISOString(),
};
await mkdir(path.join(taskRoot, "reports"), { recursive: true });
await writeFile(path.join(taskRoot, "reports", "fixture-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ ...receipt, credentials: "EXTERNAL_PRIVATE_HANDOFFS_CREATED" })}\n`);

function run(script, variables, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: { ...process.env, ...variables },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function aliasCount(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  return Object.keys(parsed.accounts ?? parsed.aliases ?? {}).length;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function sqliteUrl(file) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
