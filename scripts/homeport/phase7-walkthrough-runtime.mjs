import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const command = process.argv[2] ?? "status";
const repositoryRoot = path.resolve(process.cwd());
const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const correctionRound =
  process.env.HOMEPORT_PHASE7_CORRECTION_ROUND ?? (process.env.HOMEPORT_PHASE7_CORRECTION_RUNTIME === "1" ? "1" : null);
const correctionRuntime = Boolean(correctionRound);
const port = Number.parseInt(
  correctionRuntime
    ? (process.env.HOMEPORT_PHASE7_CORRECTION_WALKTHROUGH_PORT ?? (correctionRound === "2" ? "3756" : "3735"))
    : (process.env.HOMEPORT_PHASE7_WALKTHROUGH_PORT ?? "3717"),
  10,
);
const statePath = path.join(
  taskRoot,
  "leases",
  correctionRuntime ? `owner-correction-round${correctionRound}-rereview-runtime.json` : "walkthrough-runtime.json",
);
const databasePath = correctionRuntime
  ? path.join(
      taskRoot,
      "owner-rereview-database",
      `homeport-phase7-owner-correction-round${correctionRound}-rereview.db`,
    )
  : path.join(taskRoot, "final-walkthrough-database", "homeport-phase7-walkthrough.db");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const logPath = path.join(
  taskRoot,
  "logs",
  correctionRuntime ? `owner-correction-round${correctionRound}-rereview-server.log` : "walkthrough-server.log",
);
const errorLogPath = path.join(
  taskRoot,
  "logs",
  correctionRuntime
    ? `owner-correction-round${correctionRound}-rereview-server-error.log`
    : "walkthrough-server-error.log",
);
const credentialHandoffPath = path.join(
  taskRoot,
  "credentials",
  correctionRuntime
    ? `owner-correction-round${correctionRound}-walkthrough-credentials.private.json`
    : "walkthrough-credentials.private.json",
);
const fixtureVersion = correctionRuntime
  ? (process.env.HOMEPORT_PHASE7_CORRECTION_FIXTURE_VERSION ??
    `homeport-phase7-owner-correction-round${correctionRound}-v1`)
  : "homeport-phase7-integrated-v1";
const baseUrl = `http://127.0.0.1:${port}`;

if (!taskRoot.startsWith(path.resolve("C:/Users/kkids/AppData/Local/ProjectHomeport") + path.sep))
  throw new Error(`HOMEPORT_PHASE7_TASK_ROOT_REFUSED:${taskRoot}`);
if (databasePath === canonicalDatabase || !databasePath.startsWith(taskRoot + path.sep))
  throw new Error(`HOMEPORT_PHASE7_WALKTHROUGH_DATABASE_REFUSED:${databasePath}`);

if (command === "prepare") {
  runOwned(
    correctionRuntime
      ? correctionRound === "2"
        ? "scripts/homeport/phase7-owner-correction-round2-database-clone.mjs"
        : "scripts/homeport/phase7-owner-correction-round1-database-clone.mjs"
      : "scripts/homeport/phase7-database-clone.mjs",
    ["walkthrough"],
  );
  process.stdout.write(
    `${JSON.stringify({ status: correctionRuntime ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_PREPARED` : "HOMEPORT_PHASE7_WALKTHROUGH_PREPARED", databasePath, fixtureVersion })}\n`,
  );
} else if (command === "start") {
  await start();
} else if (command === "status") {
  process.stdout.write(`${JSON.stringify(await status(), null, 2)}\n`);
} else if (command === "reset") {
  await stop(false);
  runOwned(
    correctionRuntime
      ? correctionRound === "2"
        ? "scripts/homeport/phase7-owner-correction-round2-database-clone.mjs"
        : "scripts/homeport/phase7-owner-correction-round1-database-clone.mjs"
      : "scripts/homeport/phase7-database-clone.mjs",
    ["walkthrough"],
  );
  await start();
} else if (command === "stop") {
  await stop(true);
} else {
  throw new Error(`HOMEPORT_PHASE7_WALKTHROUGH_COMMAND_UNKNOWN:${command}`);
}

async function start() {
  const buildDirectory = path.resolve(repositoryRoot, process.env.NEXT_DIST_DIR ?? ".next");
  if (!existsSync(path.join(buildDirectory, "BUILD_ID"))) throw new Error("HOMEPORT_PHASE7_PRODUCTION_BUILD_MISSING");
  if (!existsSync(databasePath) || (await stat(databasePath)).size < 1)
    throw new Error("HOMEPORT_PHASE7_WALKTHROUGH_DATABASE_MISSING");
  if (correctionRound === "2")
    runOwned("scripts/homeport/validate-phase7-owner-correction-round2-fixture.mjs", [databasePath]);
  if (correctionRound === "3")
    runOwned("scripts/homeport/validate-phase7-owner-correction-round3-fixture.mjs", [databasePath]);
  const existing = await status();
  if (existing.processAlive || existing.portOwnerPid) throw new Error(`HOMEPORT_PHASE7_PORT_OR_PROCESS_BUSY:${port}`);
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
        DATABASE_URL: sqliteUrl(databasePath),
        HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
        PROFILE_MEDIA_ROOT: path.join(taskRoot, "synthetic-media", "profile"),
        PRIVATE_CONTENT_ROOT: path.join(taskRoot, "synthetic-media", "private"),
      },
    },
  );
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  const sourceSha = git(["rev-parse", "HEAD"]);
  const state = {
    schemaVersion: "1.0.0",
    runId: path.basename(taskRoot),
    pid: child.pid,
    port,
    url: baseUrl,
    sourceSha,
    branch: git(["branch", "--show-current"]),
    databasePath,
    databaseHash: await sha256(databasePath),
    fixtureVersion,
    credentialHandoffPath,
    startedAt: new Date().toISOString(),
    logPath,
    errorLogPath,
    retainedIntentionally: true,
  };
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (health.ok) {
      process.stdout.write(
        `${JSON.stringify({ status: correctionRuntime ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_RUNNING` : "HOMEPORT_PHASE7_WALKTHROUGH_RUNNING", ...state, health }, null, 2)}\n`,
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("HOMEPORT_PHASE7_WALKTHROUGH_HEALTH_TIMEOUT");
}

async function status() {
  const state = await readState();
  const pid = state?.pid ?? null;
  const portOwnerPid = ownerPid(port);
  const processAlive = pid ? isAlive(pid) : false;
  const health = await fetchHealth();
  return {
    status:
      processAlive && portOwnerPid === pid && health.ok
        ? correctionRuntime
          ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_HEALTHY`
          : "HOMEPORT_PHASE7_WALKTHROUGH_HEALTHY"
        : correctionRuntime
          ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_STOPPED`
          : "HOMEPORT_PHASE7_WALKTHROUGH_STOPPED",
    pid,
    port,
    portOwnerPid,
    processAlive,
    health,
    sourceSha: state?.sourceSha ?? null,
    databasePath: state?.databasePath ?? databasePath,
    databaseHash: state?.databaseHash ?? null,
    fixtureVersion: state?.fixtureVersion ?? fixtureVersion,
    credentialHandoffPath,
    statePath,
  };
}

async function stop(report) {
  const state = await readState();
  if (!state?.pid) {
    if (report)
      process.stdout.write(
        `${JSON.stringify({ status: correctionRuntime ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_ALREADY_STOPPED` : "HOMEPORT_PHASE7_WALKTHROUGH_ALREADY_STOPPED", port })}\n`,
      );
    return;
  }
  const portOwnerPid = ownerPid(port);
  if (portOwnerPid && portOwnerPid !== state.pid)
    throw new Error(`HOMEPORT_PHASE7_REFUSES_UNRELATED_PORT_OWNER:${portOwnerPid}`);
  if (isAlive(state.pid)) {
    const result = spawnSync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0 && isAlive(state.pid)) throw new Error(`HOMEPORT_PHASE7_STOP_FAILED:${result.stderr}`);
  }
  await rm(statePath, { force: true });
  if (report)
    process.stdout.write(
      `${JSON.stringify({ status: correctionRuntime ? `HOMEPORT_PHASE7_CORRECTION_ROUND${correctionRound}_REREVIEW_STOPPED` : "HOMEPORT_PHASE7_WALKTHROUGH_STOPPED", pid: state.pid, port })}\n`,
    );
}

function runOwned(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env: process.env,
    encoding: "utf8",
  });
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

async function readState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return null;
  }
}

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8" });
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
