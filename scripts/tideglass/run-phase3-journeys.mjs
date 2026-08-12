import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.TIDEGLASS_PHASE3_TASK_ROOT ??
    path.join(required("LOCALAPPDATA"), "ProjectTideglass", "phase3-qualification"),
);
const databasePath = path.join(taskRoot, "database", "tideglass-phase3.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next";
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const baseEnv = { ...process.env, TIDEGLASS_PHASE3_TASK_ROOT: taskRoot };
run("scripts/tideglass/prepare-phase3-fixture.mjs", [], baseEnv);
if (!existsSync(databasePath)) throw new Error(`TIDEGLASS_DATABASE_MISSING:${databasePath}`);
const fixtureReceipt = JSON.parse(readFileSync(path.join(taskRoot, "reports", "fixture-receipt.json"), "utf8"));
const env = {
  ...baseEnv,
  TIDEGLASS_PHASE3_TASK_ROOT: taskRoot,
  TIDEGLASS_PHASE3_DATABASE_PATH: databasePath,
  TIDEGLASS_PHASE3_SOURCE_SHA: sourceSha,
  TIDEGLASS_PHASE3_FIXTURE_CHECKSUM: fixtureReceipt.fixtureChecksum,
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};
if (!(process.env.TIDEGLASS_PHASE3_REUSE_BUILD === "1" && existsSync(path.join(root, distDir, "BUILD_ID"))))
  run("node_modules/next/dist/bin/next", ["build"], env);
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.tideglass-phase3.config.ts"], env);
process.stdout.write(
  `${JSON.stringify({ status: "TIDEGLASS_PHASE3_BROWSER_JOURNEYS_PASSED", sourceSha, fixtureVersion: fixtureReceipt.fixtureVersion, fixtureChecksum: fixtureReceipt.fixtureChecksum, taskRoot })}\n`,
);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
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
