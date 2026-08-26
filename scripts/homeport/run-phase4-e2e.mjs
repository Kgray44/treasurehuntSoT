import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE4_TASK_ROOT ??
    "C:/Users/kkids/AppData/Local/Temp/project-homeport-phase4-20260803-022307-9a3252f7",
);
const sourceDatabase = path.resolve(
  process.env.HOMEPORT_PHASE4_SOURCE_DATABASE ?? path.join(taskRoot, "database", "phase4.db"),
);
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const soundingLineOwned = process.env.HOMEPORT_SOUNDING_LINE_TASK_ROOT === "1";
const approvedTaskRoot = soundingLineOwned
  ? path.join(repositoryRoot, "artifacts", "sounding-line")
  : path.resolve("C:/Users/kkids/AppData/Local/Temp");
const approvedSoundingLineSource =
  soundingLineOwned &&
  sourceDatabase.startsWith(repositoryRoot + path.sep) &&
  /^\.sounding-line-[a-f0-9]{12}\.sqlite$/u.test(path.basename(sourceDatabase));

if (!taskRoot.startsWith(approvedTaskRoot + path.sep))
  throw new Error(`Homeport Phase 4 refuses a task root outside the approved temporary root: ${taskRoot}`);
if (
  (!sourceDatabase.startsWith(taskRoot + path.sep) && !approvedSoundingLineSource) ||
  sourceDatabase === canonicalDatabase
)
  throw new Error(`Homeport Phase 4 refuses this build database: ${sourceDatabase}`);
if (!statSync(sourceDatabase).isFile())
  throw new Error(`Homeport Phase 4 source database is unavailable: ${sourceDatabase}`);

const env = {
  ...process.env,
  DATABASE_URL: `file:${sourceDatabase.replaceAll("\\", "/")}`,
  HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE4_SOURCE_DATABASE: sourceDatabase,
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "media", "profile"),
  PRIVATE_CONTENT_ROOT: path.join(taskRoot, "media", "private"),
};

if (process.env.HOMEPORT_PHASE4_REUSE_BUILD !== "1")
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], env);
run(
  path.join("node_modules", "@playwright", "test", "cli.js"),
  ["test", "-c", "playwright.homeport-phase4.config.ts", ...process.argv.slice(2)],
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
