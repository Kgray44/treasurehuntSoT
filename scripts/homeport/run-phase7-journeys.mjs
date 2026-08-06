import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const seed = path.join(taskRoot, "immutable-fixture-seed", "homeport-phase7-integrated-v1.db");
const requested = (process.env.HOMEPORT_PHASE7_JOURNEYS ?? "ABCDEFGHIJKLMNO").replaceAll(/[^A-O]/gu, "");
const port = process.env.HOMEPORT_PHASE7_PORT ?? "3718";
const canonical = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");

if (!taskRoot.startsWith(path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport") + path.sep))
  throw new Error(`HOMEPORT_PHASE7_TASK_ROOT_REFUSED:${taskRoot}`);
if (!existsSync(seed) || seed === canonical) throw new Error(`HOMEPORT_PHASE7_IMMUTABLE_SEED_MISSING:${seed}`);
if (!existsSync(path.join(repositoryRoot, ".next", "BUILD_ID")))
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], process.env);

run("scripts/homeport/phase7-database-clone.mjs", ["journeys"], process.env);
for (const journeyId of requested) {
  const databasePath = path.join(taskRoot, "automated-journey-databases", `journey-${journeyId}.db`);
  const env = {
    ...process.env,
    HOMEPORT_PHASE7_JOURNEY_ID: journeyId,
    HOMEPORT_PHASE7_DATABASE_PATH: databasePath,
    HOMEPORT_PHASE7_PORT: port,
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
    ["test", "-c", "playwright.homeport-phase7.config.ts", "--grep", `Journey ${journeyId}:`],
    env,
  );
}
process.stdout.write(`${JSON.stringify({ status: "HOMEPORT_PHASE7_JOURNEYS_PASSED", journeys: [...requested] })}\n`);

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
