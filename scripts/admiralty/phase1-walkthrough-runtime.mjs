import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const command = process.argv[2] ?? "status";
const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("ADMIRALTY_PHASE1_TASK_ROOT"));
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectAdmiralty");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const port = Number.parseInt(process.env.ADMIRALTY_PHASE1_WALKTHROUGH_PORT ?? "3792", 10);
const databasePath = path.join(taskRoot, "database", "admiralty-phase1.db");
const credentialHandoffPath = path.join(taskRoot, "credentials", "admiralty-phase1-walkthrough.private.json");
const preparationPath = path.join(taskRoot, "reports", "walkthrough-preparation.json");
const statePath = path.join(taskRoot, "leases", "walkthrough-runtime.json");
const logPath = path.join(taskRoot, "logs", "walkthrough-server.log");
const errorLogPath = path.join(taskRoot, "logs", "walkthrough-server-error.log");
const baseUrl = `http://127.0.0.1:${port}`;

if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`ADMIRALTY_TASK_ROOT_REFUSED:${taskRoot}`);
if (!databasePath.startsWith(`${taskRoot}${path.sep}`) || databasePath === canonicalDatabase)
  throw new Error(`ADMIRALTY_WALKTHROUGH_DATABASE_REFUSED:${databasePath}`);
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error(`ADMIRALTY_PORT_REFUSED:${port}`);

if (command === "prepare") {
  await prepare();
} else if (command === "start") {
  await start();
} else if (command === "status") {
  process.stdout.write(`${JSON.stringify(await status(), null, 2)}\n`);
} else if (command === "reset") {
  await stop(false);
  await prepare();
  await start();
} else if (command === "stop") {
  await stop(true);
} else {
  throw new Error(`ADMIRALTY_WALKTHROUGH_COMMAND_UNKNOWN:${command}`);
}

async function prepare() {
  const existing = await status();
  if (existing.processAlive || existing.portOwnerPid) throw new Error(`ADMIRALTY_PORT_OR_PROCESS_BUSY:${port}`);
  const sourceSha = git(["rev-parse", "HEAD"]);
  const env = {
    ...process.env,
    ADMIRALTY_PHASE1_TASK_ROOT: taskRoot,
    DATABASE_URL: sqliteUrl(databasePath),
    NEXT_DIST_DIR: ".next",
    VOYAGEWRIGHT_BUILD_SHA: sourceSha,
  };
  run("scripts/admiralty/prepare-phase1-fixture.mjs", [], env);
  run("node_modules/next/dist/bin/next", ["build"], env);
  const preparation = {
    status: "ADMIRALTY_PHASE1_WALKTHROUGH_PREPARED",
    sourceSha,
    branch: git(["branch", "--show-current"]),
    fixtureVersion: "admiralty-phase1-v1",
    databasePath,
    databaseHash: await sha256(databasePath),
    buildId: (await readFile(path.join(repositoryRoot, ".next", "BUILD_ID"), "utf8")).trim(),
    credentialHandoffPath,
    privacy: "SYNTHETIC_RESERVED_DATA_ONLY",
    ownerDecision: "PENDING_OWNER_DECISION",
    preparedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(preparationPath), { recursive: true });
  await writeFile(preparationPath, `${JSON.stringify(preparation, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(preparation, null, 2)}\n`);
}

async function start() {
  const preparation = await readJson(preparationPath);
  if (!preparation) throw new Error("ADMIRALTY_WALKTHROUGH_NOT_PREPARED");
  const sourceSha = git(["rev-parse", "HEAD"]);
  if (preparation.sourceSha !== sourceSha) throw new Error("ADMIRALTY_WALKTHROUGH_SOURCE_CHANGED_REPREPARE_REQUIRED");
  if (!existsSync(path.join(repositoryRoot, ".next", "BUILD_ID")))
    throw new Error("ADMIRALTY_WALKTHROUGH_PRODUCTION_BUILD_MISSING");
  if (!existsSync(databasePath) || (await stat(databasePath)).size < 1)
    throw new Error("ADMIRALTY_WALKTHROUGH_DATABASE_MISSING");
  const existing = await status();
  if (existing.processAlive || existing.portOwnerPid) throw new Error(`ADMIRALTY_PORT_OR_PROCESS_BUSY:${port}`);
  await mkdir(path.dirname(statePath), { recursive: true });
  await mkdir(path.dirname(logPath), { recursive: true });
  const stdout = openSync(logPath, "a");
  const stderr = openSync(errorLogPath, "a");
  const child = spawn(
    process.execPath,
    [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: repositoryRoot,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", stdout, stderr],
      env: {
        ...process.env,
        ADMIRALTY_PHASE1_TASK_ROOT: taskRoot,
        DATABASE_URL: sqliteUrl(databasePath),
        NEXT_DIST_DIR: ".next",
        VOYAGEWRIGHT_BUILD_SHA: sourceSha,
      },
    },
  );
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  const state = {
    status: "ADMIRALTY_PHASE1_WALKTHROUGH_RUNNING",
    pid: child.pid,
    port,
    url: baseUrl,
    sourceSha,
    branch: preparation.branch,
    buildId: preparation.buildId,
    databasePath,
    databaseHash: await sha256(databasePath),
    fixtureVersion: preparation.fixtureVersion,
    credentialHandoffPath,
    ownerDecision: "PENDING_OWNER_DECISION",
    startedAt: new Date().toISOString(),
    logPath,
    errorLogPath,
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (health.ok) {
      process.stdout.write(`${JSON.stringify({ ...state, health }, null, 2)}\n`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("ADMIRALTY_WALKTHROUGH_HEALTH_TIMEOUT");
}

async function status() {
  const state = await readJson(statePath);
  const pid = state?.pid ?? null;
  const portOwnerPid = ownerPid(port);
  const processAlive = pid ? isAlive(pid) : false;
  const health = await fetchHealth();
  return {
    status:
      processAlive && portOwnerPid === pid && health.ok
        ? "ADMIRALTY_PHASE1_WALKTHROUGH_HEALTHY"
        : "ADMIRALTY_PHASE1_WALKTHROUGH_STOPPED",
    pid,
    port,
    portOwnerPid,
    processAlive,
    health,
    sourceSha: state?.sourceSha ?? null,
    databasePath: state?.databasePath ?? databasePath,
    databaseHash: state?.databaseHash ?? null,
    fixtureVersion: state?.fixtureVersion ?? "admiralty-phase1-v1",
    credentialHandoffPath,
    statePath,
  };
}

async function stop(report) {
  const state = await readJson(statePath);
  if (!state?.pid) {
    if (report)
      process.stdout.write(`${JSON.stringify({ status: "ADMIRALTY_PHASE1_WALKTHROUGH_ALREADY_STOPPED", port })}\n`);
    return;
  }
  const portOwnerPid = ownerPid(port);
  if (portOwnerPid && portOwnerPid !== state.pid)
    throw new Error(`ADMIRALTY_REFUSES_UNRELATED_PORT_OWNER:${portOwnerPid}`);
  if (isAlive(state.pid)) {
    const result = spawnSync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0 && isAlive(state.pid))
      throw new Error(`ADMIRALTY_WALKTHROUGH_STOP_FAILED:${result.stderr}`);
  }
  await rm(statePath, { force: true });
  if (report)
    process.stdout.write(
      `${JSON.stringify({ status: "ADMIRALTY_PHASE1_WALKTHROUGH_STOPPED", pid: state.pid, port })}\n`,
    );
}

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed:\n${result.stderr || result.stdout}`);
}

function ownerPid(value) {
  const script = `(Get-NetTCPConnection -State Listen -LocalPort ${value} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`;
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  const parsed = Number.parseInt(result.stdout.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function fetchHealth() {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    return { ok: response.status >= 200 && response.status < 400, status: response.status };
  } catch {
    return { ok: false, status: null };
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
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
