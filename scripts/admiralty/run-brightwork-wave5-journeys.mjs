import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.ADMIRALTY_PHASE3_TASK_ROOT ??
    path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "brightwork-stage8-wave5"),
);
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("BRIGHTWORK_WAVE5_TASK_ROOT_REFUSED");
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next-brightwork-wave5";
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const port = process.env.ADMIRALTY_PHASE3_PORT ?? "3796";
const baseEnv = {
  ...process.env,
  ADMIRALTY_PHASE3_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD:
    process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!",
};

run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.sqlite.prisma"], baseEnv);
run("tests/admiralty/phase3/prepare-fixture.mjs", [], baseEnv);
if (!existsSync(databasePath)) throw new Error("BRIGHTWORK_WAVE5_DATABASE_MISSING");
const env = {
  ...baseEnv,
  ADMIRALTY_PHASE3_DATABASE_PATH: databasePath,
  ADMIRALTY_PHASE3_SOURCE_SHA: sourceSha,
  ADMIRALTY_PHASE3_PORT: port,
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};
run("node_modules/next/dist/bin/next", ["build"], env);
run(
  "node_modules/@playwright/test/cli.js",
  ["test", "-c", "tests/admiralty/brightwork-wave5/playwright.config.cjs"],
  env,
);

const manifestPath = path.join(taskRoot, "browser", "evidence", "brightwork-wave5-manifest.json");
if (!existsSync(manifestPath)) throw new Error("BRIGHTWORK_WAVE5_EVIDENCE_MANIFEST_MISSING");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
process.stdout.write(
  `${JSON.stringify({
    status: "BRIGHTWORK_WAVE5_BROWSER_JOURNEYS_PASSED",
    sourceSha,
    taskRoot,
    evidenceRecords: manifest.records?.length ?? 0,
  })}\n`,
);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status ?? 1}.`);
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}
function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
