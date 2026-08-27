import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) throw new Error("HELM_A2_LOCALAPPDATA_MISSING");
const allowedRoot = path.resolve(localAppData, "ProjectHelm");
const taskRoot = path.resolve(
  process.env.HELM_A2_TASK_ROOT ?? path.join(allowedRoot, `helm-a2-browser-${randomUUID().replaceAll("-", "")}`),
);
const databasePath = path.join(taskRoot, "database", "helm-a2.db");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const distDir = ".next-helm-a2-browser";
const distPath = path.resolve(repositoryRoot, distDir);

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`HELM_A2_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`HELM_A2_DATABASE_REFUSED:${databasePath}`);
if (!distPath.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error(`HELM_A2_DIST_REFUSED:${distPath}`);
if (await exists(databasePath)) throw new Error(`HELM_A2_DATABASE_ALREADY_EXISTS:${databasePath}`);

await mkdir(path.dirname(databasePath), { recursive: true });
await mkdir(path.join(taskRoot, "outbox"), { recursive: true });
await writeFile(databasePath, "", "utf8");

const port = await availablePort();
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const env = {
  ...process.env,
  DATABASE_URL: sqliteUrl(databasePath),
  HELM_A2_TASK_ROOT: taskRoot,
  HELM_A2_DATABASE_PATH: databasePath,
  HELM_A2_BROWSER_PORT: String(port),
  SESSION_SECRET: `helm-a2-${randomUUID()}-task-owned-session-secret`,
  HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
  HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(taskRoot, "outbox", "messages.jsonl"),
  NEXT_DIST_DIR: distDir,
  NEXT_TELEMETRY_DISABLED: "1",
};

run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.sqlite.prisma"], env);
run("node_modules/prisma/build/index.js", ["migrate", "deploy", "--schema", "prisma/schema.sqlite.prisma"], env);
run("node_modules/next/dist/bin/next", ["build"], env);
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.helm-a2.config.ts", "-g", "Pass the Helm"], env);

process.stdout.write(
  `${JSON.stringify({
    status: "HELM_A2_BROWSER_JOURNEYS_PASSED",
    sourceSha,
    taskRoot,
    databasePath,
    distDir,
    browserServer: "next-start-no-dev-hmr",
    privacy: "SYNTHETIC_TASK_OWNED_DATABASE_AND_ACCOUNTS_ONLY",
    canonicalDatabaseUntouched: canonicalDatabase,
  })}\n`,
);

function run(command, args, environment) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: repositoryRoot,
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

function exists(value) {
  return stat(value).then(
    () => true,
    () => false,
  );
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("HELM_A2_DYNAMIC_PORT_UNAVAILABLE"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
