#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { browserSuiteProfiles } from "./browser-suite-profiles.mjs";

const separator = process.argv.indexOf("--");
const options = Object.fromEntries(
  process.argv.slice(2, separator === -1 ? undefined : separator).reduce((pairs, value, index, values) => {
    if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, []),
);
const profile = browserSuiteProfiles[options.profile];
const browserTests = separator === -1 ? [] : process.argv.slice(separator + 1);
const root = path.resolve(options.workspace ?? process.cwd());
const candidateSha = options.candidate;
const databaseUrl = options["database-url"];

if (!profile || !/^[a-f0-9]{40}$/u.test(candidateSha ?? "") || !databaseUrl || !browserTests.length)
  throw new Error("SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:INVALID_PROFILE_INVOCATION");

const artifactRoot = path.join(root, "artifacts", "sounding-line");
const receiptPath = path.join(artifactRoot, "browser-suite-profile.json");
const environment = profileEnvironment({ profileId: profile.id, candidateSha, databaseUrl });

try {
  await rm(path.join(artifactRoot, "browser-runtime.json"), { force: true });
  await rm(receiptPath, { force: true });
  if (profile.validationIsolation) {
    await mkdir(path.dirname(sqlitePath(environment.DATABASE_URL)), { recursive: true });
    await clearOwnedIsolationDatabase(environment.DATABASE_URL, profile.id);
  }
  run(
    process.execPath,
    ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"],
    environment,
  );
  if (profile.bootstrap)
    run(
      process.execPath,
      ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", environment.DATABASE_URL],
      environment,
    );
  if (profile.seed) run(process.execPath, ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"], environment);
  for (const preparer of profile.preparers ?? []) run(process.execPath, preparerArguments(preparer), environment);
  ensureProductionBuild();
  run(
    process.execPath,
    [
      "scripts/sounding-line/browser-authority.mjs",
      ...profile.fixtureArguments.flatMap((argument) => ["--fixture", argument]),
      ...(profile.fixtureProject ? ["--fixture-project", profile.fixtureProject] : []),
      "--",
      ...browserTests,
      ...(profile.browserArguments ?? []),
      "--project",
      profile.browserProject ?? "chromium",
    ],
    environment,
  );
  await writeReceipt({ status: "PASS", failureCategory: null });
} catch (error) {
  const runtimeReceipt = await readBrowserReceipt();
  await writeReceipt(
    runtimeReceipt
      ? { status: "FAIL", failureCategory: runtimeReceipt.failureCategory, failureCode: runtimeReceipt.failureCode }
      : {
          status: "FAIL",
          failureCategory: "SUITE_FIXTURE_CONTRACT_UNSATISFIED",
          failureCode: `SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:${profile.id}`,
        },
  );
  throw error;
}

function ensureProductionBuild() {
  if (!profile.taskOwnedProductionHttp) return;
  run(process.execPath, ["node_modules/next/dist/bin/next", "build"], environment);
}

function profileEnvironment({ profileId, candidateSha: sha, databaseUrl: requestedDatabaseUrl }) {
  const runtimeEnvironment = taskOwnedProductionHttpEnvironment(profileId, sha);
  if (profileId === "admiralty-phase1" || profileId === "admiralty-phase3") {
    const phase = profileId.endsWith("phase1") ? "1" : "3";
    const localAppData = path.join(root, "artifacts", "sounding-line");
    const taskRoot = path.join(localAppData, "ProjectAdmiralty", `${profileId}-${sha.slice(0, 12)}`);
    const databasePath = path.join(taskRoot, "database", `admiralty-phase${phase === "3" ? "2" : phase}.db`);
    const browserPath =
      process.env.PLAYWRIGHT_BROWSERS_PATH ??
      (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "ms-playwright") : "");
    return {
      LOCALAPPDATA: localAppData,
      [`ADMIRALTY_PHASE${phase}_TASK_ROOT`]: taskRoot,
      [`ADMIRALTY_PHASE${phase}_DATABASE_PATH`]: databasePath,
      [`ADMIRALTY_PHASE${phase}_SOURCE_SHA`]: sha,
      DATABASE_URL: sqliteUrl(databasePath),
      ...runtimeEnvironment,
      ...(browserPath ? { PLAYWRIGHT_BROWSERS_PATH: browserPath } : {}),
    };
  }
  const requiresIsolation = browserSuiteProfiles[profileId].validationIsolation;
  const resolvedDatabaseUrl = requiresIsolation ? absoluteSqliteUrl(requestedDatabaseUrl) : requestedDatabaseUrl;
  if (!requiresIsolation) return { DATABASE_URL: resolvedDatabaseUrl, ...runtimeEnvironment };
  return {
    ...runtimeEnvironment,
    ...(browserSuiteProfiles[profileId].environment ?? {}),
    DATABASE_URL: resolvedDatabaseUrl,
    ...(browserSuiteProfiles[profileId].homeportPhase3Runtime
      ? { HOMEPORT_PHASE3_DATABASE_PATH: sqlitePath(resolvedDatabaseUrl) }
      : {}),
    VALIDATION_ARTIFACTS: path.join(root, "artifacts", "sounding-line", `${profileId}-${sha.slice(0, 12)}`),
  };
}

function taskOwnedProductionHttpEnvironment(profileId, sha) {
  const suiteProfile = browserSuiteProfiles[profileId];
  const genericTaskRoot = path.join(root, `.sounding-line-${sha.slice(0, 12)}.outbox`);
  const emailTaskRoot = profileId === "generic" ? genericTaskRoot : path.join(
    root,
    "artifacts",
    "sounding-line",
    "transactional-email",
    `${profileId}-${sha.slice(0, 12)}`,
  );
  const environment = { SOUNDING_LINE_SUITE_PROFILE: profileId };
  if (suiteProfile.taskOwnedProductionHttp) {
    Object.assign(environment, {
      SOUNDING_LINE_TASK_OWNED_HTTP: "1",
      HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
      HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
      HOMEPORT_PHASE7_TASK_ROOT: emailTaskRoot,
      HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(emailTaskRoot, "outbox", "messages.jsonl"),
    });
  }
  if (suiteProfile.validationIsolation) {
    environment.FOREVER_VALIDATION_ISOLATION = "1";
    environment.FOREVER_VALIDATION_NONCE_HASH = createHash("sha256")
      .update(`sounding-line:${sha}:${profileId}`)
      .digest("hex");
  }
  if (suiteProfile.cookieAdapter === "isolated-loopback") {
    environment.SOUNDING_LINE_TASK_OWNED_HTTP = "1";
    environment.FOREVER_VALIDATION_PRODUCTION_IDENTITY = "1";
  }
  return environment;
}

function run(command, argumentsList, env) {
  const result = spawnSync(command, argumentsList, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`SOUNDING_LINE_SUITE_PROFILE_COMMAND_FAILED:${profile.id}`);
}

function preparerArguments(preparer) {
  if (typeof preparer === "string") return [preparer];
  if (!preparer || typeof preparer !== "object" || typeof preparer.script !== "string")
    throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:INVALID_PREPARER:${profile.id}`);
  if (preparer.runtime === "node") return [preparer.script, ...(preparer.arguments ?? [])];
  if (preparer.runtime === "tsx")
    return ["node_modules/tsx/dist/cli.mjs", preparer.script, ...(preparer.arguments ?? [])];
  throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:INVALID_PREPARER:${profile.id}`);
}

async function readBrowserReceipt() {
  try {
    return JSON.parse(await readFile(path.join(artifactRoot, "browser-runtime.json"), "utf8"));
  } catch {
    return null;
  }
}

async function writeReceipt({ status, failureCategory, failureCode = null }) {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(
    receiptPath,
    `${JSON.stringify({ version: 1, profile: profile.id, browserTests, status, failureCategory, failureCode }, null, 2)}\n`,
  );
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

function absoluteSqliteUrl(value) {
  const databasePath = value.replace(/^file:/u, "");
  return sqliteUrl(path.resolve(root, databasePath));
}

function sqlitePath(value) {
  return value.slice("file:".length).replaceAll("/", path.sep);
}

async function clearOwnedIsolationDatabase(databaseUrl, profileId) {
  const databasePath = path.resolve(sqlitePath(databaseUrl));
  const profileRoot = path.resolve(artifactRoot, `${profileId}-${candidateSha.slice(0, 12)}`);
  const relative = path.relative(profileRoot, databasePath);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.dirname(databasePath) !== profileRoot ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(databasePath))
  ) {
    throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:${profileId}:DATABASE_PATH`);
  }
  await Promise.all(["", "-wal", "-shm", "-journal"].map((suffix) => rm(`${databasePath}${suffix}`, { force: true })));
}
