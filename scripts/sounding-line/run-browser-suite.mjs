#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { browserSuiteProfiles, isolatedBrowserFixtureCredentials } from "./browser-suite-profiles.mjs";
import {
  assertExceptionExecution,
  claimExceptionPhase,
  exceptionSuitePlan,
  trustedExceptions,
} from "./experience-exception.mjs";
import {
  browserReceiptPaths,
  readBrowserDiagnosticReceipt,
  writeBrowserDiagnosticReceipt,
} from "./browser-diagnostics.mjs";
import { assertR12TechnicalSource, requireR12TechnicalSuite } from "./experience-r12-technical-proof.mjs";
import {
  assertR13TechnicalSource,
  requireR13TechnicalSuite,
  requireR13DependencyReadinessSuite,
  r13CaseProfileContext,
} from "./experience-r13-technical-proof.mjs";
import {
  sealReadinessProfileContext,
  runNativeDependencyChecks,
  runBrowserDependencyProbe,
} from "./experience-dependency-readiness.mjs";

import {
  requirePosttechnicalDiagnosticSuite,
  assertPosttechnicalSources,
  capturePosttechnicalSuiteEvidence,
  scrubPosttechnicalSuiteEnvironment,
  POSTTECHNICAL_POLICY,
} from "./replay-posttechnical-suite.mjs";

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

if (
  !profile ||
  !/^[a-f0-9]{40}$/u.test(candidateSha ?? "") ||
  !databaseUrl ||
  (!browserTests.length && !options["experience-plan"] && !options["r13-dependency-readiness"])
)
  throw new Error("SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:INVALID_PROFILE_INVOCATION");

// This distinct finite route validates its own private permission before any
// existing consumer selector. Invalid requests never fall through to old grants.
const posttechnical = options["posttechnical-diagnostic"]
  ? await requirePosttechnicalDiagnosticSuite({
      root,
      candidateSha,
      options,
      browserTests,
      argv: process.argv.slice(2),
    })
  : null;

// This exact one-case diagnostic grant is independent of the normal six-file
// technical allowance. Its create-only launch reservation precedes all setup.
const readiness = options["r13-dependency-readiness"]
  ? await requireR13DependencyReadinessSuite({ root, candidateSha, options, browserTests, argv: process.argv.slice(2) })
  : null;
const r13Technical = options["r13-technical-proof"]
  ? await requireR13TechnicalSuite({ root, candidateSha, options, browserTests, argv: process.argv.slice(2) })
  : null;
const r12Technical = options["r12-technical-proof"]
  ? await requireR12TechnicalSuite({ root, candidateSha, options, browserTests, argv: process.argv.slice(2) })
  : null;
const exceptionPlan =
  r12Technical || r13Technical || readiness || posttechnical ? null : await exceptionSuitePlan({ root, candidateSha });
if (exceptionPlan) {
  if (options["experience-plan"]) {
    const guardedPlan =
      process.env.SOUNDING_LINE_R3_LOCAL_LEASE ||
      process.env.SOUNDING_LINE_R6_LOCAL_LEASE ||
      process.env.SOUNDING_LINE_R8_LOCAL_LEASE ||
      process.env.SOUNDING_LINE_R7_LOCAL_LEASE
        ? JSON.parse(await readFile(options["experience-plan"], "utf8"))
        : exceptionPlan;
    await assertExceptionExecution({ root, plan: guardedPlan, kind: "experience" });
  } else {
    const record = trustedExceptions(root, exceptionPlan.baseSha).find(
      (value) => value.id === exceptionPlan.exception.id,
    );
    if (
      profile?.id !== "generic" ||
      JSON.stringify([...browserTests].sort()) !== JSON.stringify(record.requiredTechnicalBrowserTests)
    )
      throw new Error("PRODUCT_EXPERIENCE_EXCEPTION_TECHNICAL_SCOPE_CHANGED");
    await assertExceptionExecution({ root, plan: exceptionPlan, kind: "technical" });
    claimExceptionPhase({
      root,
      phase: "technical-launch",
      plan: exceptionPlan,
      runId: Number(process.env.GITHUB_RUN_ID),
    });
  }
}

const artifactRoot = path.join(root, "artifacts", "sounding-line");
const receiptPaths = browserReceiptPaths(root);
// R13 reuses the exact private profile context created by its successful bounded
// infrastructure attempt. The ordinary suite still reruns every setup command.
const environment = r13Technical
  ? await r13CaseProfileContext({ root, marker: r13Technical })
  : profileEnvironment({ profileId: profile.id, candidateSha, databaseUrl });
if (posttechnical) Object.assign(environment, posttechnical.environment);
if (readiness) sealReadinessProfileContext({ attempt: readiness, profileEnvironment: environment });
const setupSteps = [];
let setupStatus = "FAIL";

try {
  if (readiness)
    await runNativeDependencyChecks({ attempt: readiness, environment: { ...process.env, ...environment } });
  if (receiptPaths && !receiptPaths.binding) {
    await rm(receiptPaths.runtime, { force: true });
    await rm(receiptPaths.profile, { force: true });
  }
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
  if (readiness) {
    await runBrowserDependencyProbe({ attempt: readiness, environment: { ...process.env, ...environment } });
  } else if (options["experience-plan"]) {
    if (!options["experience-runner"]) throw new Error("PRODUCT_EXPERIENCE_TRUSTED_RUNNER_REQUIRED");
    // Candidate build/setup must not mutate either the checked-out product or
    // the separately checked-out protected helper before evidence execution.
    execFileSync("git", ["diff", "--exit-code", "HEAD", "--"], { cwd: root, stdio: "inherit" });
    const authorityRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "scripts/sounding-line"], {
      cwd: authorityRoot,
      stdio: "inherit",
    });
    run(
      process.execPath,
      [options["experience-runner"], "--workspace", root, "--run-server", options["experience-plan"]],
      environment,
    );
  } else {
    if (r12Technical) assertR12TechnicalSource(root, r12Technical);
    if (r13Technical) {
      assertR13TechnicalSource(root, r13Technical);
      // Repeated setup must preserve the exact dependency/context state proved
      // by readiness before the single product case can launch.
      await r13CaseProfileContext({ root, marker: r13Technical });
    }
    if (posttechnical) assertPosttechnicalSources(posttechnical.marker);
    run(
      process.execPath,
      [
        "scripts/sounding-line/browser-authority.mjs",
        ...profile.fixtureArguments.flatMap((argument) => ["--fixture", argument]),
        ...(profile.fixtureProject ? ["--fixture-project", profile.fixtureProject] : []),
        "--",
        ...browserTests,
        ...(profile.browserArguments ?? []),
        ...(posttechnical?.browserArguments ?? []),
        "--project",
        profile.browserProject ?? "chromium",
      ],
      environment,
    );
  }
  setupStatus = "PASS";
  if (!readiness) await writeReceipt({ status: "PASS", failureCategory: null });
} catch (error) {
  if (readiness) throw error;
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
} finally {
  if (posttechnical) capturePosttechnicalSuiteEvidence({ context: posttechnical, root, status: setupStatus });
  if (readiness)
    await writeFile(
      readiness.paths.setupReceipt,
      JSON.stringify({ version: 1, status: setupStatus, steps: setupSteps }, null, 2) + "\n",
      { flag: "wx" },
    );
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
  const emailTaskRoot =
    profileId === "generic"
      ? genericTaskRoot
      : path.join(root, "artifacts", "sounding-line", "transactional-email", `${profileId}-${sha.slice(0, 12)}`);
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
  if (profileId === "generic") {
    environment.SOUNDING_LINE_INTERNAL_RUNTIME = "1";
    Object.assign(environment, isolatedBrowserFixtureCredentials(profileId));
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
    ...(readiness
      ? { timeout: argumentsList[0] === "node_modules/next/dist/bin/next" ? 900000 : 120000, killSignal: "SIGTERM" }
      : {}),
    ...(posttechnical
      ? {
          env: scrubPosttechnicalSuiteEnvironment({ ...process.env, ...env }),
          timeout: POSTTECHNICAL_POLICY.commandMs,
          killSignal: "SIGTERM",
        }
      : {}),
  });
  if (readiness) {
    const fixedIds = [
      "prisma-generate",
      "sqlite-bootstrap",
      "seed",
      "migrate-legacy-companion",
      "prepare-validation-isolation",
      "next-build",
    ];
    setupSteps.push({
      id: fixedIds[setupSteps.length],
      status: !result.error && result.status === 0 ? "PASS" : "FAIL",
      command,
      arguments: argumentsList,
      exitCode: result.status,
      error: result.error ? { code: result.error.code ?? null, message: result.error.message } : null,
    });
  }
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
  return readBrowserDiagnosticReceipt(root, "browser-runtime.json");
}

async function writeReceipt({ status, failureCategory, failureCode = null }) {
  await writeBrowserDiagnosticReceipt(root, "browser-suite-profile.json", {
    version: 1,
    profile: profile.id,
    browserTests,
    status,
    failureCategory,
    failureCode,
  });
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
