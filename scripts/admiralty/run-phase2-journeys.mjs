import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.ADMIRALTY_PHASE2_TASK_ROOT ??
    path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "sounding-line-phase2"),
);
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next-admiralty-phase2";
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const baseEnv = { ...process.env, ADMIRALTY_PHASE2_TASK_ROOT: taskRoot };
run("scripts/admiralty/prepare-phase2-fixture.mjs", [], baseEnv);
if (!existsSync(databasePath)) throw new Error(`ADMIRALTY_DATABASE_MISSING:${databasePath}`);
const env = {
  ...baseEnv,
  ADMIRALTY_PHASE2_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE2_DATABASE_PATH: databasePath,
  ADMIRALTY_PHASE2_SOURCE_SHA: sourceSha,
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};
if (!(process.env.ADMIRALTY_PHASE2_REUSE_BUILD === "1" && existsSync(path.join(root, distDir, "BUILD_ID"))))
  run("node_modules/next/dist/bin/next", ["build"], env);
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.admiralty-phase2.config.ts"], env);
process.stdout.write(
  `${JSON.stringify({ status: "ADMIRALTY_PHASE2_BROWSER_JOURNEYS_PASSED", sourceSha, fixtureVersion: "admiralty-phase2-v1", taskRoot })}\n`,
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
