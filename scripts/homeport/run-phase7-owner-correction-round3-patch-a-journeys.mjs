import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const requested = (process.env.HOMEPORT_PHASE7_PATCH_A_JOURNEYS ?? "ABCDEFGHIJKLMN").replaceAll(/[^A-N]/gu, "");
const port = process.env.HOMEPORT_PHASE7_PATCH_A_PORT ?? "3781";
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const distDir = process.env.NEXT_DIST_DIR ?? ".sealed-build-phase7-owner-correction-round3-patch-a";
const isolateFromWalkthrough = process.env.HOMEPORT_PHASE7_PATCH_A_SKIP_WALKTHROUGH_CLONE === "1";
const fixtureVersion = "homeport-phase7-owner-correction-round3-patch-a-v1";
const canonical = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_PATCH_A_TASK_ROOT_REFUSED:${taskRoot}`);
if (!requested) throw new Error("HOMEPORT_PHASE7_PATCH_A_JOURNEYS selected no journeys.");

run("scripts/homeport/phase7-owner-correction-round3-patch-a-database-clone.mjs", ["journeys"], {
  ...process.env,
  HOMEPORT_PHASE7_CORRECTION_JOURNEYS: requested,
});
if (!isolateFromWalkthrough)
  run("scripts/homeport/phase7-owner-correction-round3-patch-a-database-clone.mjs", ["walkthrough"], process.env);

const buildDatabasePath = path.join(taskRoot, "browser-databases", `round3-journey-${requested[0]}.db`);
if (path.resolve(buildDatabasePath) === canonical || !existsSync(buildDatabasePath))
  throw new Error(`HOMEPORT_PHASE7_PATCH_A_BUILD_DATABASE_REFUSED:${buildDatabasePath}`);
const reuseBuild =
  process.env.HOMEPORT_PHASE7_PATCH_A_REUSE_BUILD === "1" && existsSync(path.join(repositoryRoot, distDir, "BUILD_ID"));
if (!reuseBuild)
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], {
    ...process.env,
    DATABASE_URL: sqliteUrl(buildDatabasePath),
    HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(taskRoot, "outbox", "patch-a-build.jsonl"),
    PROFILE_MEDIA_ROOT: path.join(taskRoot, "media"),
    PRIVATE_CONTENT_ROOT: path.join(taskRoot, "media", "private", "build"),
    NEXT_DIST_DIR: distDir,
  });

for (const journeyId of requested) {
  const databasePath =
    journeyId === "N" && !isolateFromWalkthrough
      ? path.join(taskRoot, "owner-rereview-database", "homeport-phase7-owner-correction-round3-rereview.db")
      : path.join(taskRoot, "browser-databases", `round3-journey-${journeyId}.db`);
  if (path.resolve(databasePath) === canonical || !existsSync(databasePath))
    throw new Error(`HOMEPORT_PHASE7_PATCH_A_JOURNEY_DATABASE_REFUSED:${journeyId}:${databasePath}`);
  run(
    path.join("node_modules", "@playwright", "test", "cli.js"),
    [
      "test",
      "-c",
      "playwright.homeport-phase7-owner-correction-round3-patch-a.config.ts",
      "--grep",
      `Journey ${journeyId}:`,
    ],
    {
      ...process.env,
      HOMEPORT_PHASE7_PATCH_A_JOURNEY_ID: journeyId,
      HOMEPORT_PHASE7_PATCH_A_DATABASE_PATH: databasePath,
      HOMEPORT_PHASE7_PATCH_A_PORT: port,
      HOMEPORT_PHASE7_PATCH_A_SOURCE_SHA: sourceSha,
      HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION: fixtureVersion,
      DATABASE_URL: sqliteUrl(databasePath),
      NEXT_DIST_DIR: distDir,
    },
  );
}

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_PATCH_A_JOURNEYS_PASSED", journeys: [...requested], sourceSha, fixtureVersion })}\n`,
);

function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
