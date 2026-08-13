import { spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ForeverTreasureCompanion");
const taskRoot = path.resolve(process.env.DRYDOCK_PHASE4_TASK_ROOT ?? path.join(allowedRoot, "drydock-phase4-browser"));
const databasePath = path.join(taskRoot, "database", "drydock-phase4.sqlite");
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`DRYDOCK_PHASE4_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`)) throw new Error(`DRYDOCK_PHASE4_DATABASE_REFUSED:${databasePath}`);

await mkdir(path.dirname(databasePath), { recursive: true });
for (const target of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) await rm(target, { force: true });
const port = await availablePort();
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const env = { ...process.env, DRYDOCK_PHASE4_TASK_ROOT: taskRoot, DRYDOCK_PHASE4_PORT: String(port), DRYDOCK_PHASE4_REHEARSAL_DB: databasePath, DATABASE_URL: sqliteUrl(databasePath), NEXT_DIST_DIR: ".next-drydock-phase4-browser", VOYAGEWRIGHT_BUILD_SHA: sourceSha };

run("scripts/drydock/rehearse-phase4-migrations.mjs", [], env);
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.drydock-phase4.config.ts"], env);
process.stdout.write(`${JSON.stringify({ status: "DRYDOCK_PHASE4_LOCAL_BROWSER_AXE_PASSED", sourceSha, taskRoot, port, database: "TASK_OWNED_REHEARSED_SQLITE" })}\n`);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: repositoryRoot, env, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`${command} failed`);
  return result.stdout.trim();
}
function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("DRYDOCK_PHASE4_DYNAMIC_PORT_UNAVAILABLE"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
function sqliteUrl(value) { return `file:${value.replaceAll("\\", "/")}`; }
function required(name) { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; }
