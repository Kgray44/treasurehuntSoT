import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const seed = path.join(taskRoot, "immutable-seed", "homeport-phase7-owner-correction-round2-v1.db");
const requested = (process.env.HOMEPORT_PHASE7_CORRECTION_JOURNEYS ?? "ABCDEFGHIJKLMNOPQRSTUVW").replaceAll(
  /[^A-W]/gu,
  "",
);
const port = process.env.HOMEPORT_PHASE7_CORRECTION_PORT ?? "3752";
const canonical = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const round1TaskRoot = path.resolve(
  process.env.HOMEPORT_PHASE7_ROUND1_TASK_ROOT ??
    "C:/Users/kkids/AppData/Local/ProjectHomeport/phase7-owner-correction-round1-019fcf4f-7cc1-79a0-a8ae-e378bba35cc4",
);
const originalTaskRoot = path.resolve(
  process.env.HOMEPORT_PHASE7_ORIGINAL_TASK_ROOT ??
    "C:/Users/kkids/AppData/Local/ProjectHomeport/phase7-019fcdf5-8104-7593-a660-9992d08737be",
);

if (!taskRoot.startsWith(`${path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport")}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (!existsSync(seed) || seed === canonical)
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_IMMUTABLE_SEED_MISSING:${seed}`);
if (!existsSync(path.join(repositoryRoot, ".next", "BUILD_ID")))
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], process.env);

run("scripts/homeport/phase7-owner-correction-round2-database-clone.mjs", ["journeys"], {
  ...process.env,
  HOMEPORT_PHASE7_CORRECTION_JOURNEYS: requested,
});
for (const journeyId of requested) {
  if (journeyId === "W") {
    run("scripts/homeport/run-phase7-owner-correction-round1-journeys.mjs", [], {
      ...process.env,
      HOMEPORT_PHASE7_TASK_ROOT: round1TaskRoot,
      HOMEPORT_PHASE7_CORRECTION_JOURNEYS: "O",
      HOMEPORT_PHASE7_CORRECTION_PORT: "3753",
      HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA: sourceSha,
    });
    run("scripts/homeport/run-phase7-owner-correction-round1-journeys.mjs", [], {
      ...process.env,
      HOMEPORT_PHASE7_TASK_ROOT: round1TaskRoot,
      HOMEPORT_PHASE7_CORRECTION_JOURNEYS: "ABCDEFGHIJKLMNPQRSTU",
      HOMEPORT_PHASE7_CORRECTION_PORT: "3753",
      HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA: sourceSha,
    });
    run("scripts/homeport/run-phase7-journeys.mjs", [], {
      ...process.env,
      HOMEPORT_PHASE7_TASK_ROOT: originalTaskRoot,
      HOMEPORT_PHASE7_JOURNEYS: "ABCDEFGHIJKLMNO",
      HOMEPORT_PHASE7_PORT: "3754",
      HOMEPORT_PHASE7_SOURCE_SHA: sourceSha,
    });
    const receiptPath = path.join(
      taskRoot,
      "reports",
      "owner-correction-round2-journeys",
      "journey-W-regressions.json",
    );
    mkdirSync(path.dirname(receiptPath), { recursive: true });
    writeFileSync(
      receiptPath,
      `${JSON.stringify(
        {
          sourceSha,
          correctionRound1: "PASSED_A_U",
          originalPhase7: "PASSED_A_O",
          completedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }
  const databasePath = path.join(taskRoot, "browser-databases", `round2-journey-${journeyId}.db`);
  const env = {
    ...process.env,
    HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID: journeyId,
    HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH: databasePath,
    HOMEPORT_PHASE7_CORRECTION_PORT: port,
    HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA: sourceSha,
    DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  };
  run(
    path.join("node_modules", "prisma", "build", "index.js"),
    ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"],
    env,
  );
  run(
    path.join("node_modules", "tsx", "dist", "cli.mjs"),
    ["scripts/homeport/reconcile-claimed-account-capabilities.ts", "--commit"],
    env,
  );
  run(
    path.join("node_modules", "@playwright", "test", "cli.js"),
    ["test", "-c", "playwright.homeport-phase7-owner-correction-round2.config.ts", "--grep", `Journey ${journeyId}:`],
    env,
  );
}

function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}
process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND2_JOURNEYS_PASSED", journeys: [...requested] })}\n`,
);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: repositoryRoot, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
