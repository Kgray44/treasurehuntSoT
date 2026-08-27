import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const seed = path.join(taskRoot, "immutable-seed", "homeport-phase7-owner-correction-round3-v1.db");
const requested = (process.env.HOMEPORT_PHASE7_CORRECTION_JOURNEYS ?? "ABCDEFGHIJKLMNOPQRSTUV").replaceAll(
  /[^A-V]/gu,
  "",
);
const port = process.env.HOMEPORT_PHASE7_CORRECTION_PORT ?? "3762";
const canonical = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const round2TaskRoot = path.resolve(
  process.env.HOMEPORT_PHASE7_ROUND2_TASK_ROOT ??
    "C:/Users/kkids/AppData/Local/ProjectHomeport/phase7-owner-correction-round2-019fd274-d58b-7d00-ab01-8d68b1a29216",
);
const approvedTaskRoot =
  process.env.HOMEPORT_SOUNDING_LINE_TASK_ROOT === "1"
    ? path.join(repositoryRoot, "artifacts", "sounding-line")
    : path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport");

if (!taskRoot.startsWith(`${approvedTaskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);
if (!existsSync(seed) || path.resolve(seed) === canonical)
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_IMMUTABLE_SEED_MISSING:${seed}`);
if (!requested) throw new Error("HOMEPORT_PHASE7_CORRECTION_JOURNEYS selected no Round 3 journeys.");
run("scripts/homeport/phase7-owner-correction-round3-database-clone.mjs", ["journeys"], {
  ...process.env,
  HOMEPORT_PHASE7_CORRECTION_JOURNEYS: requested,
});
const buildDatabasePath = path.join(taskRoot, "browser-databases", `round3-journey-${requested[0]}.db`);
const reuseBuild =
  process.env.HOMEPORT_PHASE7_CORRECTION_REUSE_BUILD === "1" &&
  existsSync(path.join(repositoryRoot, ".next", "BUILD_ID"));
if (!reuseBuild)
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], {
    ...process.env,
    DATABASE_URL: `file:${buildDatabasePath.replaceAll("\\", "/")}`,
    HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(taskRoot, "synthetic-outbox", "round3-build.jsonl"),
    PROFILE_MEDIA_ROOT: path.join(taskRoot, "media"),
    PRIVATE_CONTENT_ROOT: path.join(taskRoot, "media", "private", "build"),
  });

for (const journeyId of requested) {
  if (journeyId === "V") runPriorRegression(sourceSha);
  const databasePath = path.join(taskRoot, "browser-databases", `round3-journey-${journeyId}.db`);
  const env = {
    ...process.env,
    HOMEPORT_PHASE7_CORRECTION_JOURNEY_ID: journeyId,
    HOMEPORT_PHASE7_CORRECTION_DATABASE_PATH: databasePath,
    HOMEPORT_PHASE7_CORRECTION_PORT: port,
    HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA: sourceSha,
    DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  };
  run(
    path.join("node_modules", "@playwright", "test", "cli.js"),
    ["test", "-c", "playwright.homeport-phase7-owner-correction-round3.config.ts", "--grep", `Journey ${journeyId}:`],
    env,
  );
}

process.stdout.write(
  `${JSON.stringify({ status: "HOMEPORT_PHASE7_OWNER_CORRECTION_ROUND3_JOURNEYS_PASSED", journeys: [...requested] })}\n`,
);

function runPriorRegression(exactSourceSha) {
  if (!existsSync(round2TaskRoot)) throw new Error(`Round 2 task root is unavailable: ${round2TaskRoot}`);
  run("scripts/homeport/run-phase7-owner-correction-round2-journeys.mjs", [], {
    ...process.env,
    HOMEPORT_PHASE7_TASK_ROOT: round2TaskRoot,
    HOMEPORT_PHASE7_CORRECTION_JOURNEYS: "ABCDEFGHIJKLMNOPQRSTUVW",
    HOMEPORT_PHASE7_CORRECTION_PORT: "3763",
    HOMEPORT_PHASE7_CORRECTION_SOURCE_SHA: exactSourceSha,
  });
  const receiptPath = path.join(taskRoot, "reports", "owner-correction-round3-journeys", "journey-V-regressions.json");
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(
    receiptPath,
    `${JSON.stringify(
      {
        sourceSha: exactSourceSha,
        correctionRound2: "PASSED_A_W",
        correctionRound1: "PASSED_A_U_VIA_ROUND2_W",
        originalPhase7: "PASSED_A_O_VIA_ROUND2_W",
        completedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

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
