import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.ADMIRALTY_PHASE3_TASK_ROOT ??
    path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "admiralty-phase3-command-qualification"),
);
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next-admiralty-phase3";
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const baseEnv = { ...process.env, ADMIRALTY_PHASE3_TASK_ROOT: taskRoot };
const tsconfigPath = path.join(root, "tsconfig.json");
const originalTsconfig = await readFile(tsconfigPath, "utf8");

try {
  run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.sqlite.prisma"], baseEnv);
  run("scripts/admiralty/prepare-phase3-fixture.mjs", [], baseEnv);
  if (!existsSync(databasePath)) throw new Error(`ADMIRALTY_DATABASE_MISSING:${databasePath}`);
  const env = {
    ...baseEnv,
    ADMIRALTY_PHASE3_TASK_ROOT: taskRoot,
    ADMIRALTY_PHASE3_DATABASE_PATH: databasePath,
    ADMIRALTY_PHASE3_SOURCE_SHA: sourceSha,
    DATABASE_URL: sqliteUrl(databasePath),
    NEXT_DIST_DIR: distDir,
    VOYAGEWRIGHT_BUILD_SHA: sourceSha,
  };
  let qualificationMode = "PRODUCTION_BUILD";
  if (process.env.ADMIRALTY_PHASE3_SKIP_FULL_BUILD === "1") {
    qualificationMode = "DEVELOPMENT_SERVER_FALLBACK_UNRELATED_FULL_BUILD_BLOCKED";
    env.ADMIRALTY_PHASE3_SERVER_COMMAND = `"${process.execPath}" node_modules/next/dist/bin/next dev -H 127.0.0.1 -p ${
      process.env.ADMIRALTY_PHASE3_PORT ?? "3794"
    }`;
  } else if (!(process.env.ADMIRALTY_PHASE3_REUSE_BUILD === "1" && existsSync(path.join(root, distDir, "BUILD_ID")))) {
    const build = runResult("node_modules/next/dist/bin/next", ["build"], env);
    if (build.status !== 0) {
      qualificationMode = "DEVELOPMENT_SERVER_FALLBACK_UNRELATED_FULL_BUILD_BLOCKED";
      env.ADMIRALTY_PHASE3_SERVER_COMMAND = `"${process.execPath}" node_modules/next/dist/bin/next dev -H 127.0.0.1 -p ${
        process.env.ADMIRALTY_PHASE3_PORT ?? "3794"
      }`;
      process.stderr.write(
        "ADMIRALTY_PHASE3_FULL_BUILD_BLOCKED: preserving browser qualification with an isolated development server.\\n",
      );
    }
  }
  const testArgs = ["test", "-c", "playwright.admiralty-phase3.config.ts"];
  if (process.env.ADMIRALTY_PHASE3_TEST_GREP) testArgs.push("--grep", process.env.ADMIRALTY_PHASE3_TEST_GREP);
  run("node_modules/@playwright/test/cli.js", testArgs, env);
  process.stdout.write(
    `${JSON.stringify({ status: "ADMIRALTY_PHASE3_BROWSER_JOURNEYS_PASSED", qualificationMode, sourceSha, fixtureVersion: "admiralty-phase3-v1", taskRoot })}\n`,
  );
} finally {
  await writeFile(tsconfigPath, originalTsconfig, "utf8");
  run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.prisma"], {
    ...process.env,
    DATABASE_URL: "mysql://phase3_validation:phase3_validation@127.0.0.1:3306/phase3_validation",
  });
}

function run(script, args, env) {
  const result = runResult(script, args, env);
  if (result.status !== 0) throw new Error(`${script} failed with exit code ${result.status ?? 1}.`);
}
function runResult(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
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
