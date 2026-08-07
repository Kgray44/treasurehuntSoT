import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const approvedTemporaryRoot = path.resolve("C:/Users/kkids/AppData/Local/Temp");
const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE5_TASK_ROOT ?? "C:/Users/kkids/AppData/Local/Temp/homeport-phase5-019fc830",
);
const sourceDatabase = path.resolve(
  process.env.HOMEPORT_PHASE5_SOURCE_DATABASE ?? path.join(taskRoot, "database", "phase5.db"),
);
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");

if (!taskRoot.startsWith(approvedTemporaryRoot + path.sep))
  throw new Error(`Homeport Phase 5 refuses a task root outside the approved temporary root: ${taskRoot}`);
if (!sourceDatabase.startsWith(taskRoot + path.sep) || sourceDatabase === canonicalDatabase)
  throw new Error(`Homeport Phase 5 refuses this build database: ${sourceDatabase}`);
if (!statSync(sourceDatabase).isFile())
  throw new Error(`Homeport Phase 5 source database is unavailable: ${sourceDatabase}`);

const env = {
  ...process.env,
  DATABASE_URL: `file:${sourceDatabase.replaceAll("\\", "/")}`,
  HOMEPORT_PHASE5_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE5_SOURCE_DATABASE: sourceDatabase,
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "storage", "profile"),
  PRIVATE_CONTENT_ROOT: path.join(taskRoot, "storage", "private"),
};

run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], env);
run(
  path.join("node_modules", "@playwright", "test", "cli.js"),
  ["test", "-c", "playwright.homeport-phase5.config.ts", ...process.argv.slice(2)],
  env,
);

function run(script, args, childEnv) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: childEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
