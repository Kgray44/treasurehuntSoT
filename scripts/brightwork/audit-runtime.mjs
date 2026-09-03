import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const command = process.argv[2] ?? "status";
const repositoryRoot = path.resolve(process.cwd());
const localAppData = required("LOCALAPPDATA");
const allowedRoot = path.resolve(localAppData, "VoyagewrightBrightwork");
const auditRoot = path.resolve(
  process.env.BRIGHTWORK_AUDIT_ROOT ?? path.join(allowedRoot, "stage6-creator-continuation"),
);
const port = integer(process.env.BRIGHTWORK_AUDIT_PORT ?? "3110", "BRIGHTWORK_AUDIT_PORT_INVALID");
const hostname = hostnameOf(process.env.VOYAGEWRIGHT_AUDIT_HOSTNAME ?? "audit.absoluterelativesystems.com");
const localOrigin = exactOrigin(process.env.VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN ?? `http://localhost:${port}`);
const publicOrigin = exactOrigin(process.env.VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN ?? `https://${hostname}`);
const fixtureBuildRoot = path.join(auditRoot, "fixture-build");
const fixtureName = path.basename(auditRoot);
const homeportRoot = path.resolve(localAppData, "ProjectHomeport", fixtureName);
const admiraltyRoot = path.resolve(localAppData, "ProjectAdmiralty", fixtureName);
const databasePath = path.join(auditRoot, "database", "brightwork-stage6-audit.db");
const privateContentRoot = path.join(auditRoot, "storage", "private-content");
const profileMediaRoot = path.join(auditRoot, "storage", "profile-media");
const outboxPath = path.join(auditRoot, "outbox", "synthetic-email.jsonl");
const preparationPath = path.join(auditRoot, "reports", "audit-preparation.json");
const fixtureReceiptPath = path.join(auditRoot, "reports", "audit-fixture-receipt.json");
const personaRegistryPath = path.join(auditRoot, "reports", "audit-personas.json");
const statePath = path.join(auditRoot, "leases", "audit-runtime.json");
const logPath = path.join(auditRoot, "logs", "audit-server.log");
const errorLogPath = path.join(auditRoot, "logs", "audit-server-error.log");
const distDir = ".next-brightwork-stage6-creator-continuation";

if (!inside(allowedRoot, auditRoot)) throw new Error("BRIGHTWORK_AUDIT_ROOT_REFUSED");
if (publicOrigin.hostname.toLowerCase() !== hostname) throw new Error("BRIGHTWORK_AUDIT_PUBLIC_HOST_MISMATCH");
if (!isLoopback(localOrigin.hostname)) throw new Error("BRIGHTWORK_AUDIT_LOCAL_ORIGIN_REFUSED");

if (command === "prepare") await prepare();
else if (command === "start") await start();
else if (command === "status") process.stdout.write(`${JSON.stringify(await status(), null, 2)}\n`);
else if (command === "reset") {
  await stop(false);
  await resetFixtureState();
  await prepare();
  await start();
} else if (command === "recertify") {
  await recertify();
} else if (command === "stop") await stop(true);
else throw new Error(`BRIGHTWORK_AUDIT_COMMAND_UNKNOWN:${command}`);

async function prepare() {
  const existing = await status();
  if (existing.processAlive || existing.portOwnerPid) throw new Error(`BRIGHTWORK_AUDIT_PORT_OR_PROCESS_BUSY:${port}`);
  const sourceSha = git(["rev-parse", "HEAD"]);
  const environment = runtimeEnvironment(sourceSha);
  await mkdir(path.dirname(databasePath), { recursive: true });
  await mkdir(privateContentRoot, { recursive: true });
  await mkdir(profileMediaRoot, { recursive: true });
  await mkdir(path.dirname(outboxPath), { recursive: true });
  run("scripts/brightwork/prepare-fixture.mjs", [], {
    ...environment,
    BRIGHTWORK_TASK_ROOT: fixtureBuildRoot,
    BRIGHTWORK_HOMEPORT_ROOT: homeportRoot,
    BRIGHTWORK_ADMIRALTY_ROOT: admiraltyRoot,
    BRIGHTWORK_ADMIRALTY_SYNTHETIC_PASSWORD: auditFixturePassword(sourceSha),
  });
  const combinedDatabase = path.join(fixtureBuildRoot, "database", "brightwork-combined-synthetic.db");
  if (!(await stat(combinedDatabase)).size) throw new Error("BRIGHTWORK_AUDIT_COMBINED_FIXTURE_EMPTY");
  await copyFile(combinedDatabase, databasePath);

  const sourceFixture = await readJson(path.join(fixtureBuildRoot, "reports", "fixture-receipt.json"));
  const personas = await auditPersonas();
  const databaseHash = await sha256(databasePath);
  const receipt = {
    schemaVersion: "1.0.0",
    classification: "SYNTHETIC_DISPOSABLE_AUDIT_DATA",
    sourceSha,
    productBaselineSha: sourceFixture.sourceSha,
    fixtureVersion: sourceFixture.fixtureVersion,
    databasePath,
    databaseHash,
    privateContentRoot,
    profileMediaRoot,
    providerIsolation: "NO_EXTERNAL_PROVIDER_CREDENTIALS; SYNTHETIC_OUTBOX_ONLY",
    environment: auditEnvironmentMetadata(),
    generatedAt: new Date().toISOString(),
  };
  await writeJson(fixtureReceiptPath, receipt);
  await writeJson(personaRegistryPath, {
    classification: "SYNTHETIC_DISPOSABLE_AUDIT_DATA",
    sourceSha,
    personas,
  });
  run(path.join("node_modules", "next", "dist", "bin", "next"), ["build"], environment);
  const preparation = {
    status: "BRIGHTWORK_STAGE6_AUDIT_PREPARED",
    sourceSha,
    productBaselineSha: sourceFixture.sourceSha,
    branch: git(["branch", "--show-current"]),
    worktree: repositoryRoot,
    auditRoot,
    hostname,
    localOrigin: localOrigin.origin,
    publicOrigin: publicOrigin.origin,
    port,
    databasePath,
    databaseHash,
    fixtureVersion: sourceFixture.fixtureVersion,
    buildId: (await readFile(path.join(repositoryRoot, distDir, "BUILD_ID"), "utf8")).trim(),
    distDir,
    privateContentRoot,
    profileMediaRoot,
    outboxPath,
    dataIsolation: "TASK_OWNED_SYNTHETIC_SQLITE_AND_STORAGE_ONLY",
    providerIsolation: "EXTERNAL_DISABLED; SYNTHETIC_EMAIL_OUTBOX_ONLY",
    environment: auditEnvironmentMetadata(),
    preparedAt: new Date().toISOString(),
  };
  await writeJson(preparationPath, preparation);
  process.stdout.write(`${JSON.stringify(preparation, null, 2)}\n`);
}

async function recertify() {
  const preparation = await readJson(preparationPath);
  const currentSourceSha = git(["rev-parse", "HEAD"]);
  if (!preparation || preparation.sourceSha !== currentSourceSha)
    throw new Error("BRIGHTWORK_AUDIT_SOURCE_CHANGED_REPREPARE_REQUIRED");
  const current = await status();
  if (current.status !== "BRIGHTWORK_STAGE6_AUDIT_HEALTHY")
    throw new Error("BRIGHTWORK_AUDIT_RECERTIFICATION_RUNTIME_NOT_HEALTHY");
  const environment = {
    ...runtimeEnvironment(currentSourceSha),
    BRIGHTWORK_BASE_URL: localOrigin.origin,
    BRIGHTWORK_FIXTURE_ROOT: fixtureBuildRoot,
    BRIGHTWORK_AUDIT_METADATA_PATH: fixtureReceiptPath,
  };
  run("scripts/brightwork/current-experience-images.mjs", ["plan"], environment);
  run("scripts/brightwork/current-experience-images.mjs", ["capture"], environment);
  run("scripts/brightwork/stage4b-evidence.mjs", ["finalize"], environment);
  process.stdout.write(
    `${JSON.stringify({
      status: "BRIGHTWORK_STAGE8_WAVE0_RECERTIFIED",
      sourceSha: preparation.productBaselineSha,
      auditRuntimeSourceSha: currentSourceSha,
      environment: auditEnvironmentMetadata(),
    })}\n`,
  );
}

async function start() {
  const preparation = await readJson(preparationPath);
  if (!preparation) throw new Error("BRIGHTWORK_AUDIT_NOT_PREPARED");
  const sourceSha = git(["rev-parse", "HEAD"]);
  if (preparation.sourceSha !== sourceSha || preparation.distDir !== distDir)
    throw new Error("BRIGHTWORK_AUDIT_SOURCE_CHANGED_REPREPARE_REQUIRED");
  if (!existsSync(path.join(repositoryRoot, distDir, "BUILD_ID")))
    throw new Error("BRIGHTWORK_AUDIT_PRODUCTION_BUILD_MISSING");
  if (!existsSync(databasePath) || (await stat(databasePath)).size < 1)
    throw new Error("BRIGHTWORK_AUDIT_DATABASE_MISSING");
  const existing = await status();
  if (existing.processAlive || existing.portOwnerPid) throw new Error(`BRIGHTWORK_AUDIT_PORT_OR_PROCESS_BUSY:${port}`);
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
      env: runtimeEnvironment(sourceSha),
    },
  );
  child.unref();
  closeSync(stdout);
  closeSync(stderr);
  const state = {
    status: "BRIGHTWORK_STAGE6_AUDIT_RUNNING",
    pid: child.pid,
    port,
    localOrigin: localOrigin.origin,
    publicOrigin: publicOrigin.origin,
    hostname,
    sourceSha,
    productBaselineSha: preparation.productBaselineSha,
    branch: preparation.branch,
    worktree: repositoryRoot,
    auditRoot,
    databasePath,
    initialDatabaseHash: preparation.databaseHash,
    fixtureVersion: preparation.fixtureVersion,
    environment: preparation.environment,
    logPath,
    errorLogPath,
    startedAt: new Date().toISOString(),
  };
  await writeJson(statePath, state);
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const health = await fetchHealth();
    if (health.ok) {
      process.stdout.write(`${JSON.stringify({ ...state, health }, null, 2)}\n`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("BRIGHTWORK_AUDIT_HEALTH_TIMEOUT");
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
        ? "BRIGHTWORK_STAGE6_AUDIT_HEALTHY"
        : "BRIGHTWORK_STAGE6_AUDIT_STOPPED",
    pid,
    port,
    portOwnerPid,
    processAlive,
    health,
    sourceSha: state?.sourceSha ?? null,
    productBaselineSha: state?.productBaselineSha ?? null,
    hostname,
    localOrigin: localOrigin.origin,
    publicOrigin: publicOrigin.origin,
    databasePath,
    auditRoot,
    statePath,
  };
}

async function stop(report) {
  const state = await readJson(statePath);
  if (!state?.pid) {
    if (report)
      process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_STAGE6_AUDIT_ALREADY_STOPPED", port })}\n`);
    return;
  }
  const portOwnerPid = ownerPid(port);
  if (portOwnerPid && portOwnerPid !== state.pid)
    throw new Error(`BRIGHTWORK_AUDIT_REFUSES_UNRELATED_PORT_OWNER:${portOwnerPid}`);
  if (isAlive(state.pid)) {
    const result = spawnSync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0 && isAlive(state.pid)) throw new Error(`BRIGHTWORK_AUDIT_STOP_FAILED:${result.stderr}`);
  }
  await waitForOwnedProcessExit(state.pid);
  await rm(statePath, { force: true });
  if (report)
    process.stdout.write(`${JSON.stringify({ status: "BRIGHTWORK_STAGE6_AUDIT_STOPPED", pid: state.pid, port })}\n`);
}

async function resetFixtureState() {
  for (const target of [
    path.join(auditRoot, "database"),
    path.join(auditRoot, "storage"),
    path.join(auditRoot, "outbox"),
  ]) {
    if (!inside(auditRoot, target)) throw new Error("BRIGHTWORK_AUDIT_RESET_TARGET_REFUSED");
    await removeAuditTarget(target);
  }
}

async function waitForOwnedProcessExit(pid) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const portOwnerPid = ownerPid(port);
    if (portOwnerPid && portOwnerPid !== pid)
      throw new Error(`BRIGHTWORK_AUDIT_REFUSES_UNRELATED_PORT_OWNER:${portOwnerPid}`);
    if (!isAlive(pid) && !portOwnerPid) {
      await pause(250);
      return;
    }
    await pause(100);
  }
  throw new Error(`BRIGHTWORK_AUDIT_PROCESS_EXIT_TIMEOUT:${pid}`);
}

async function removeAuditTarget(target) {
  const deadline = Date.now() + 10_000;
  while (true) {
    try {
      await rm(target, { recursive: true, force: true, maxRetries: 0 });
      return;
    } catch (error) {
      if ((error?.code !== "EBUSY" && error?.code !== "EPERM") || Date.now() >= deadline) throw error;
      await pause(250);
    }
  }
}

async function auditPersonas() {
  const homeport = await readJson(
    path.join(homeportRoot, "credentials", "owner-correction-round3-walkthrough-credentials.private.json"),
  );
  const admiralty = await readJson(
    path.join(admiraltyRoot, "credentials", "admiralty-phase2-walkthrough.private.json"),
  );
  const homeportAccounts = homeport.accounts ?? homeport.aliases ?? {};
  const fullCapability =
    homeportAccounts.FULL_CAPABILITY ??
    homeportAccounts.VERIFIED_FULL_CAPABILITY ??
    homeportAccounts.RETURNING_FULL_CAPABILITY;
  const administrator = (admiralty.accounts ?? admiralty.aliases ?? {}).ADMINISTRATOR;
  if (!fullCapability?.accountId || !administrator?.accountId)
    throw new Error("BRIGHTWORK_AUDIT_SYNTHETIC_PERSONAS_MISSING");
  return {
    player: { accountId: fullCapability.accountId, destination: "/passport" },
    "captain-player": { accountId: fullCapability.accountId, destination: "/captain" },
    creator: { accountId: "brightwork-stage6-creator-account", destination: "/studio" },
    admiralty: { accountId: administrator.accountId, destination: "/admin" },
  };
}

function runtimeEnvironment(sourceSha) {
  const retained = [
    "APPDATA",
    "COMSPEC",
    "HOMEDRIVE",
    "HOMEPATH",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "OS",
    "PATH",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "ProgramData",
    "SystemDrive",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ];
  const base = Object.fromEntries(retained.flatMap((name) => (process.env[name] ? [[name, process.env[name]]] : [])));
  return {
    ...base,
    NODE_ENV: "production",
    DATABASE_URL: sqliteUrl(databasePath),
    NEXT_DIST_DIR: distDir,
    HOMEPORT_PUBLIC_APP_ORIGIN: publicOrigin.origin,
    NEXT_PUBLIC_APP_URL: publicOrigin.origin,
    VOYAGEWRIGHT_AUDIT_MODE: "true",
    VOYAGEWRIGHT_AUDIT_ROOT: auditRoot,
    VOYAGEWRIGHT_AUDIT_HOSTNAME: hostname,
    VOYAGEWRIGHT_AUDIT_LOCAL_ORIGIN: localOrigin.origin,
    VOYAGEWRIGHT_AUDIT_PUBLIC_ORIGIN: publicOrigin.origin,
    VOYAGEWRIGHT_BUILD_SHA: sourceSha,
    VOYAGEWRIGHT_OAUTH_TEST_MODE: "false",
    OUTBOUND_EMAIL_DISABLED: "true",
    HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
    HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
    HOMEPORT_PHASE7_TASK_ROOT: auditRoot,
    HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
    PRIVATE_CONTENT_ENABLED: "false",
    PRIVATE_CONTENT_STORAGE_PROVIDER: "local",
    PRIVATE_CONTENT_PROVIDER_ROOT: privateContentRoot,
    PROFILE_MEDIA_ROOT: profileMediaRoot,
    PRIVATE_CONTENT_SCANNER_PROVIDER: "disabled",
    PRIVATE_CONTENT_KEY_PROVIDER: "local",
    PRIVATE_CONTENT_WORKER_ENABLED: "false",
  };
}

function auditEnvironmentMetadata() {
  return {
    buildMode: "NEXT_PRODUCTION_BUILD",
    deploymentData: "BRIGHTWORK_TASK_OWNED_SYNTHETIC_DEPLOYMENT_AND_DATA",
    providerIsolation: "EXTERNAL_DISABLED_SYNTHETIC_OUTBOX_ONLY",
    authorityBoundary: "AUDIT_EVIDENCE_ONLY_NOT_PRODUCTION_DEPLOYMENT",
  };
}

function auditFixturePassword(sourceSha) {
  return `BrwAdm-${createHash("sha256")
    .update(`Voyagewright Brightwork Stage 6 synthetic fixture:${sourceSha}`)
    .digest("base64url")}!`;
}

function pause(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    const response = await fetch(new URL("/__audit/health", localOrigin), { redirect: "manual" });
    const body = response.ok ? await response.json() : null;
    return { ok: response.status === 200 && body?.status === "BRIGHTWORK_STAGE6_AUDIT_READY", status: response.status };
  } catch {
    return { ok: false, status: null };
  }
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

function git(args) {
  const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

function sqliteUrl(file) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function exactOrigin(value) {
  const origin = new URL(value);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("BRIGHTWORK_AUDIT_ORIGIN_INVALID");
  return origin;
}

function hostnameOf(value) {
  const hostname = value.trim().toLowerCase();
  if (
    hostname.length > 253 ||
    hostname.includes(":") ||
    hostname.includes("/") ||
    hostname.includes("*") ||
    !hostname.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  )
    throw new Error("BRIGHTWORK_AUDIT_HOSTNAME_INVALID");
  return hostname;
}

function isLoopback(value) {
  const hostname = value.toLowerCase();
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname.endsWith(".localhost");
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function integer(value, code) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65_535) throw new Error(code);
  return parsed;
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
