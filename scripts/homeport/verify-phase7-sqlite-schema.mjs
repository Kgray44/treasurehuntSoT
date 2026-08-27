import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const databaseUrl = required("DATABASE_URL");
const soundingLineOwned = process.env.HOMEPORT_SOUNDING_LINE_TASK_ROOT === "1";
const approvedTaskRoot = soundingLineOwned
  ? path.join(repositoryRoot, "artifacts", "sounding-line")
  : path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport");

if (!databaseUrl.startsWith("file:")) throw new Error("HOMEPORT_PHASE7_SQLITE_DATABASE_URL_REQUIRED");
if (!taskRoot.startsWith(`${approvedTaskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_CORRECTION_TASK_ROOT_REFUSED:${taskRoot}`);

const databasePath = path.resolve(databaseUrl.slice("file:".length));
if (!databasePath.startsWith(`${taskRoot}${path.sep}`))
  throw new Error(`HOMEPORT_PHASE7_SQLITE_DATABASE_REFUSED:${databasePath}`);
if ((await stat(databasePath)).size < 1) throw new Error("HOMEPORT_PHASE7_SQLITE_DATABASE_EMPTY");

const validationRoot = await mkdtemp(path.join(taskRoot, "schema-validation-"));
const shadowDatabase = path.join(validationRoot, "shadow.sqlite");
const prismaCli = path.join(repositoryRoot, "node_modules", "prisma", "build", "index.js");
try {
  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--exit-code",
      "--from-url",
      databaseUrl,
      "--to-migrations",
      "prisma/migrations",
      "--shadow-database-url",
      sqliteUrl(shadowDatabase),
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `HOMEPORT_PHASE7_SQLITE_SCHEMA_INVALID:${result.status}:${(result.stderr || result.stdout).trim()}`,
    );

  const migrations = await migrationDirectories(path.join(repositoryRoot, "prisma", "migrations"));
  process.stdout.write(
    `${JSON.stringify({
      status: "HOMEPORT_PHASE7_SQLITE_SCHEMA_VALID",
      databaseHash: await sha256(databasePath),
      migrationCount: migrations.length,
      migrationHash: createHash("sha256").update(migrations.join("\n")).digest("hex"),
      verification: "PRISMA_MIGRATE_DIFF_FROM_TASK_DATABASE_TO_CHECKED_IN_MIGRATIONS",
    })}\n`,
  );
} finally {
  await rm(validationRoot, { recursive: true, force: true });
}

async function migrationDirectories(root) {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
