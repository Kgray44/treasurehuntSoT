import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const approvedTemporaryRoot = path.resolve("C:/Users/kkids/AppData/Local/Temp");
const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE6_TASK_ROOT ?? "C:/Users/kkids/AppData/Local/Temp/homeport-phase6-019fcb64",
);
const sourceDatabase = path.resolve(
  process.env.HOMEPORT_PHASE6_SOURCE_DATABASE ?? path.join(taskRoot, "database", "phase6.db"),
);
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
if (!taskRoot.startsWith(approvedTemporaryRoot + path.sep))
  throw new Error(`HOMEPORT_PHASE6_TASK_ROOT_REFUSED:${taskRoot}`);
if (!sourceDatabase.startsWith(taskRoot + path.sep) || sourceDatabase === canonicalDatabase)
  throw new Error(`HOMEPORT_PHASE6_BUILD_DATABASE_REFUSED:${sourceDatabase}`);
if (!statSync(sourceDatabase).isFile()) throw new Error(`HOMEPORT_PHASE6_SOURCE_DATABASE_MISSING:${sourceDatabase}`);

const env = {
  ...process.env,
  DATABASE_URL: `file:${sourceDatabase.replaceAll("\\", "/")}`,
  HOMEPORT_PHASE6_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE6_SOURCE_DATABASE: sourceDatabase,
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "storage", "profile"),
  PRIVATE_CONTENT_ROOT: path.join(taskRoot, "storage", "private"),
};
run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], env);
run(
  path.join("node_modules", "@playwright", "test", "cli.js"),
  ["test", "-c", "playwright.homeport-phase6.config.ts", ...process.argv.slice(2)],
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
