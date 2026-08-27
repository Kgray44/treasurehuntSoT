import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.ADMIRALTY_S1_TASK_ROOT ?? path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "support-pilot-s1"),
);
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next-admiralty-support-pilot-s1";
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error("ADMIRALTY_S1_TASK_ROOT_REFUSED");

const sourceSha = output("git", ["rev-parse", "HEAD"]);
const env = {
  ...process.env,
  ADMIRALTY_S1_TASK_ROOT: taskRoot,
  ADMIRALTY_S1_SOURCE_SHA: sourceSha,
  ADMIRALTY_PHASE3_TASK_ROOT: taskRoot,
  ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD:
    process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ?? "Adm3-synthetic-fixture-password-20260825!",
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};

run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.sqlite.prisma"], env);
run("node_modules/next/dist/bin/next", ["build"], env);
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.admiralty-support-pilot-s1.config.ts"], env);
process.stdout.write(
  `${JSON.stringify({ status: "ADMIRALTY_SUPPORT_PILOT_S1_BROWSER_PROOF_COMPLETE", sourceSha, taskRoot })}\n`,
);

function run(script, args, childEnv) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: childEnv,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function output(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`Unable to determine ${command} output.`);
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
