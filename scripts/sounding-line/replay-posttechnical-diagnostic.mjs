// One independently reserved technical/product diagnostic; never qualification.
import childProcess, { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { createCipheriv, publicEncrypt, randomBytes, randomUUID } from "node:crypto";
import { constants as cryptoConstants } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  createWriteStream,
  openSync,
  writeSync,
  closeSync,
  constants as fsConstants,
} from "node:fs";
import { finished } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCustodyRequest } from "./custody-transport.mjs";
import { exceptionStore } from "./experience-exception.mjs";
import { BROWSER_DIAGNOSTIC_CONTEXT, createBrowserDiagnosticSession } from "./browser-diagnostics.mjs";
import { spawnOwnedProcess, stopOwnedProcess, processExit } from "./owned-process.mjs";
import {
  REPLAY_SOURCE_DIAGNOSTIC_POLICY as ORIGINAL,
  validateDiagnosticPaths,
  createReadOnlyDiagnosticRequest,
  loadOriginalDecision,
  installHistoricalOverlay,
  verifyHistoricalOverlay,
  runSourcePrefixChild,
  sourceDiagnosticChildEnvironment,
  sourceDiagnosticResult,
} from "./replay-admission-source-diagnostic.mjs";
import {
  POSTTECHNICAL_POLICY as P,
  POSTTECHNICAL_WORKLOAD as W,
  POSTTECHNICAL_OUTPUTS as OUTPUTS,
  posttechnicalPolicyDigest,
  posttechnicalHash as hash,
  posttechnicalDigest as digest,
  posttechnicalFail as fail,
  posttechnicalRequire as requireValue,
  assertPosttechnicalRuntime,
  posttechnicalRuntime,
  posttechnicalPrivatePaths,
  readPosttechnicalPrivate,
  writePosttechnicalPrivate,
  posttechnicalSnapshot,
  assertPosttechnicalSources,
  validatePosttechnicalManifest,
  validatePosttechnicalCommand,
  posttechnicalSuiteArguments,
  securePosttechnicalRead,
} from "./replay-posttechnical-suite.mjs";
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const exact = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const evidencePublicKey =
  "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqhR0X1gnk0ll9753ViDR\nia9R8pIDEYZDydLXSaSg9lRNd6kYNdkyeb7Bqt8z/A/MAJP5ngCPUaH0xvq4n+OQ\nXkF0v9XqdD/xkaZX4Cv4xiLyJkTU2lOdMEKI96o9dsHN428BTZ7nbW7sZ5Uh19L7\n8wYIw/mm+A44+3T5Tp0SCcoUcT9HqTZgk3r1CGu33WvNjeqyid22nYVSsPipQga+\ncTpcDQve9MePaFCPsi/KrRrsK2yxkgUwFY20SWu26ZjklAlQ0+isLE06f3MmsH0s\nimq0PLjcRbDG99iCJ/TiwEpZQJNJQT3n1rN7HzSYef0WZFKKkb+vF/vwihOP1AoF\nOwlHPHj3tiy5TR7ZXoqRSYC43NFDRVHp2WP8mDdJT2TInGhrwCuW/l0bpds+p7wQ\nUC2OIfq1p/FivQtp0X+4UDs8YjpSnrhl8cgqz9ipzr72TrB95I60ygrHIAfqKh47\nHKu5BOb2GG1c5KLTH9oJiZ4hsf620/dZ1Y0JjJAYAmmjAgMBAAE=\n-----END PUBLIC KEY-----\n";
const record = { id: P.id, custody: { namespace: P.namespace } };
export function validatePosttechnicalEnvironment(environment, job, now = new Date()) {
  requireValue(
    now <= new Date(P.expiry) &&
      environment.GITHUB_ACTIONS === "true" &&
      environment.GITHUB_REPOSITORY === P.repository &&
      environment.GITHUB_REF === "refs/heads/main" &&
      sha(environment.GITHUB_SHA) &&
      environment.GITHUB_RUN_ATTEMPT === "1" &&
      environment.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      environment.GITHUB_ACTOR === P.actor &&
      environment.GITHUB_TRIGGERING_ACTOR === P.actor &&
      environment.GITHUB_WORKFLOW_REF === `${P.repository}/${P.workflow}@refs/heads/main` &&
      environment.GITHUB_JOB === job &&
      /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") &&
      !Object.entries(environment).some(([key, value]) => value && /^(?:POSTTECHNICAL_|SOUNDING_LINE_)/u.test(key)),
    "EXECUTOR_CHANGED",
  );
  return { runId: Number(environment.GITHUB_RUN_ID), installerSha: environment.GITHUB_SHA };
}
export async function validatePosttechnicalExecution({ request, environment, job, installerSha, now }) {
  const identity = validatePosttechnicalEnvironment(environment, job, now);
  requireValue(identity.installerSha === installerSha, "INSTALLER_CHANGED");
  const run = await request(`actions/runs/${identity.runId}`),
    workflow = await request(`actions/workflows/${run?.workflow_id}`),
    main = await request("branches/main"),
    pr = await request("pulls/721");
  requireValue(
    run?.id === identity.runId &&
      run.run_attempt === 1 &&
      run.event === "workflow_dispatch" &&
      run.status === "in_progress" &&
      run.conclusion === null &&
      run.head_sha === installerSha &&
      run.head_branch === "main" &&
      run.path === P.workflow &&
      run.display_title === P.title &&
      run.actor?.login === P.actor &&
      run.triggering_actor?.login === P.actor &&
      run.repository?.full_name === P.repository &&
      run.head_repository?.full_name === P.repository &&
      workflow?.id === run.workflow_id &&
      workflow.path === P.workflow &&
      workflow.state === "active",
    "LIVE_BINDING_CHANGED",
  );
  requireValue(
    main?.commit?.sha === installerSha &&
      main.protected === true &&
      main.protection?.required_status_checks?.checks?.some(
        (check) => check.context === "Sounding Line / Mainline Decision" && check.app_id === 15368,
      ),
    "PROTECTION_CHANGED",
  );
  requireValue(
    pr?.state === "open" &&
      pr.draft === true &&
      pr.merged === false &&
      pr.head?.sha === W.candidate &&
      pr.head.repo?.full_name === P.repository &&
      pr.base?.ref === "main" &&
      pr.base.sha === W.base &&
      pr.base.repo?.full_name === P.repository,
    "SUBJECT_CHANGED",
  );
  const history = await request(`actions/workflows/${workflow.id}/runs?event=workflow_dispatch&per_page=100&page=1`);
  requireValue(
    history?.total_count === 1 &&
      history.workflow_runs?.length === 1 &&
      history.workflow_runs[0].id === identity.runId &&
      history.workflow_runs[0].run_attempt === 1 &&
      history.workflow_runs[0].head_sha === installerSha &&
      history.workflow_runs[0].path === P.workflow &&
      history.workflow_runs[0].event === "workflow_dispatch",
    "DISPATCH_CONSUMED",
  );
  const prior = await request(`actions/runs/${P.priorRun}`);
  requireValue(
    prior?.id === P.priorRun &&
      prior.run_attempt === 1 &&
      prior.event === "workflow_dispatch" &&
      prior.conclusion === "success" &&
      prior.head_sha === "63188aa225e69a807eb078f1df14e92f7a536da1" &&
      prior.path === ORIGINAL.workflow &&
      prior.actor?.login === P.actor &&
      prior.triggering_actor?.login === P.actor,
    "PREDECESSOR_CHANGED",
  );
  return { ...identity, workflowId: workflow.id, runAttempt: 1, policyDigest: posttechnicalPolicyDigest };
}
function binding(execution) {
  return {
    baseSha: execution.installerSha,
    diagnosticId: P.id,
    policyDigest: posttechnicalPolicyDigest,
    runId: execution.runId,
    runAttempt: 1,
    workflowId: execution.workflowId,
    originalCandidate: W.candidate,
    originalBase: W.base,
    originalRun: ORIGINAL.failedRun,
    originalDecisionDigest: W.originalDecisionSha256,
    priorRun: P.priorRun,
    priorClaim: P.priorClaim,
    priorReceiptDigest: P.priorReceiptDigest,
  };
}
export async function createPosttechnicalReservation({ request, execution }) {
  const claim = await exceptionStore({ record, request }).create(P.slot, {
    binding: binding(execution),
    diagnosticOnly: true,
    qualification: false,
    grantsConsumerTrial: false,
    originalCauseClaim: false,
  });
  requireValue(sha(claim.commitSha), "RESERVATION_INVALID");
  return claim;
}
export async function readPosttechnicalReservation({ request, execution, reservation }) {
  const claim = await exceptionStore({ record, request: createReadOnlyDiagnosticRequest(request) }).read(P.slot);
  requireValue(
    sha(reservation) &&
      claim?.commitSha === reservation &&
      claim.version === 1 &&
      claim.exceptionId === P.id &&
      exact(claim.binding, binding(execution)) &&
      claim.diagnosticOnly === true &&
      claim.qualification === false &&
      claim.grantsConsumerTrial === false &&
      claim.originalCauseClaim === false,
    "RESERVATION_INVALID",
  );
  return claim;
}
export function validatePosttechnicalFreshResult(verification) {
  requireValue(
    verification.freshObligations === 8 &&
      verification.obligations?.length === 8 &&
      verification.reconciliation?.length === 8 &&
      verification.reconciliation.every(
        (item) =>
          item.freshExecuted === true &&
          !["PRESERVED", "REBOUND"].includes(item.disposition) &&
          item.commandsAvoided?.length === 0,
      ) &&
      verification.commandsAvoided?.length === 0 &&
      verification.finalization?.decision === "PASS" &&
      verification.finalization.errors?.length === 0 &&
      verification.finalization.remainder?.length === 0,
    "TECHNICAL_NOT_FRESH_COMPLETE",
  );
  requireValue(
    exact(
      verification.obligations.map((item) => item.id),
      W.groups.map((item) => item[0]),
    ),
    "GROUPS_CHANGED",
  );
  return { freshObligations: 8, commands: 12, canonicalFinalization: "PASS", qualification: false };
}
function safeFailure(error) {
  const allowed = new Set([
    "EXECUTOR_CHANGED",
    "INSTALLER_CHANGED",
    "LIVE_BINDING_CHANGED",
    "PROTECTION_CHANGED",
    "SUBJECT_CHANGED",
    "DISPATCH_CONSUMED",
    "PREDECESSOR_CHANGED",
    "RESERVATION_INVALID",
    "RUNTIME_CHANGED",
    "SOURCE_CHANGED",
    "PRIVATE_PATH_INVALID",
    "PRIVATE_FILE_INVALID",
    "PLAN_CHANGED",
    "GROUPS_CHANGED",
    "COMMAND_CHANGED",
    "SUITE_BINDING_CHANGED",
    "SUITE_INVOCATION_CHANGED",
    "COORDINATOR_EXITED",
    "REPORT_ALREADY_EXISTS",
    "REPORT_SCOPE_CHANGED",
    "REPORT_CASE_FAILED",
    "REPORT_IDENTITIES_CHANGED",
    "BROWSER_SCOPE_MISSING",
    "BROWSER_RECEIPT_TOO_LARGE",
    "BROWSER_CLEANUP_FAILED",
    "TECHNICAL_NOT_FRESH_COMPLETE",
    "CACHE_PRESENT",
    "WORKER_UNKNOWN",
    "LOG_LIMIT",
    "TECHNICAL_COMMAND_FAILED",
    "SETUP_COMMAND_FAILED",
    "ENCRYPTION_FAILED",
    "EVIDENCE_LIMIT",
    "EVIDENCE_PATH_INVALID",
    "CLI_INVALID",
    "RESULT_INVALID",
    "RAW_EVIDENCE_LOSS",
    "EVIDENCE_INCOMPLETE",
  ]);
  return allowed.has(error?.posttechnicalCode)
    ? error.posttechnicalCode
    : error?.message === "PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED"
      ? "DISPATCH_CONSUMED"
      : "EXECUTION_UNKNOWN";
}
function receipt(file, value) {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  requireValue(Buffer.byteLength(bytes) <= 65536, "RESULT_INVALID");
  writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
}
export function posttechnicalWorkerEnvironment(environment, workspace) {
  return {
    ...sourceDiagnosticChildEnvironment(environment),
    GITHUB_WORKSPACE: workspace,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_cache: path.join(workspace, "private/npm-cache"),
    PLAYWRIGHT_BROWSERS_PATH: path.join(workspace, "private/playwright-cache"),
  };
}
function privateInput(paths) {
  const input = readPosttechnicalPrivate(paths.input);
  requireValue(
    input.version === 1 &&
      input.policyDigest === posttechnicalPolicyDigest &&
      sha(input.execution.installerSha) &&
      sha(input.reservation) &&
      input.workspace === process.env.GITHUB_WORKSPACE &&
      input.installer === path.join(input.workspace, "installer") &&
      input.authority === path.join(input.workspace, "authority") &&
      input.candidate === path.join(input.workspace, "candidate") &&
      input.member === path.join(input.workspace, "receipts/ordinary-decision.original.json") &&
      input.execution.runId === Number(process.env.GITHUB_RUN_ID),
    "RESERVATION_INVALID",
  );
  validatePosttechnicalEnvironment(process.env, "posttechnical-diagnostic");
  return input;
}
export function posttechnicalCommandEnvironment({ base, overrides, scopeEnvironment, ordinal }) {
  const environment = { ...base, ...overrides };
  delete environment[BROWSER_DIAGNOSTIC_CONTEXT];
  return ordinal === 8 ? { ...environment, ...scopeEnvironment } : environment;
}
export async function withPosttechnicalGitExceptionObserver({
  operation,
  record,
  state,
  implementation = childProcess,
  synchronize = syncBuiltinESMExports,
}) {
  const original = implementation.execFileSync;
  const wrapper = function (...invocation) {
    try {
      return Reflect.apply(original, this, invocation);
    } catch (error) {
      if (invocation[0] === "git") {
        state.observedGitThrows++;
        try {
          record({ invocation, error });
        } catch {
          state.evidenceLoss = true;
        }
      }
      throw error;
    }
  };
  try {
    implementation.execFileSync = wrapper;
    try {
      synchronize();
    } catch {
      state.evidenceLoss = true;
    }
    return await operation();
  } finally {
    try {
      implementation.execFileSync = original;
      synchronize();
      state.restoreVerified = implementation.execFileSync === original;
    } catch {
      state.evidenceLoss = true;
      state.restoreVerified = false;
    }
  }
}
export function createPosttechnicalGitExceptionLog(
  directory,
  { maximumBytes = P.sourceExceptionBytes, maximumRecords = P.sourceExceptionRecords } = {},
) {
  requireValue(
    Number.isSafeInteger(maximumBytes) &&
      maximumBytes > 0 &&
      maximumBytes <= P.sourceExceptionBytes &&
      Number.isSafeInteger(maximumRecords) &&
      maximumRecords > 0 &&
      maximumRecords <= P.sourceExceptionRecords,
    "RAW_EVIDENCE_LOSS",
  );
  const descriptor = openSync(
    path.join(directory, "git-exceptions.original.jsonl"),
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
    0o600,
  );
  const state = { observedGitThrows: 0, records: 0, bytes: 0, evidenceLoss: false, restoreVerified: false };
  const output = (value) => {
    if (!Buffer.isBuffer(value) && typeof value !== "string") return { available: false };
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    requireValue(bytes.length <= maximumBytes, "RAW_EVIDENCE_LOSS");
    return {
      available: true,
      representation: Buffer.isBuffer(value) ? "BUFFER" : "UTF8_STRING",
      bytes: bytes.length,
      sha256: hash(bytes),
      content: bytes.toString("base64"),
    };
  };
  return {
    state,
    record({ invocation, error }) {
      requireValue(state.records < maximumRecords, "RAW_EVIDENCE_LOSS");
      const args = invocation[1],
        options = invocation[2];
      requireValue(
        Array.isArray(args) && args.length <= 2048 && args.every((value) => typeof value === "string"),
        "RAW_EVIDENCE_LOSS",
      );
      const input = options?.input;
      const inputBytes = Buffer.isBuffer(input) ? input : typeof input === "string" ? Buffer.from(input) : null;
      const value = {
        version: 1,
        ordinal: state.observedGitThrows,
        name: typeof error?.name === "string" ? error.name : null,
        message: typeof error?.message === "string" ? error.message : null,
        stack: typeof error?.stack === "string" ? error.stack : null,
        status: Number.isInteger(error?.status) ? error.status : null,
        code: typeof error?.code === "string" ? error.code : null,
        signal: typeof error?.signal === "string" ? error.signal : null,
        argv: args,
        cwd: typeof options?.cwd === "string" ? options.cwd : null,
        stdout: output(error?.stdout),
        stderr: output(error?.stderr),
        input: inputBytes ? { bytes: inputBytes.length, sha256: hash(inputBytes) } : { available: false },
      };
      const bytes = Buffer.from(JSON.stringify(value) + "\n");
      requireValue(state.bytes + bytes.length <= maximumBytes, "RAW_EVIDENCE_LOSS");
      let offset = 0;
      while (offset < bytes.length) {
        const written = writeSync(descriptor, bytes, offset, bytes.length - offset);
        requireValue(written > 0, "RAW_EVIDENCE_LOSS");
        offset += written;
      }
      state.bytes += bytes.length;
      state.records++;
    },
    close() {
      try {
        closeSync(descriptor);
      } catch {
        state.evidenceLoss = true;
      }
    },
  };
}
const commandErrorCodes = new Set(
  "EACCES EPERM EBUSY EEXIST EISDIR EMFILE ENFILE ENOENT ENOSPC ENOMEM ENOTDIR ENOBUFS ETIMEDOUT EIO EROFS ENAMETOOLONG ERR_FS_FILE_TOO_LARGE ERR_STRING_TOO_LONG ERR_OUT_OF_RANGE ERR_INVALID_ARG_TYPE".split(
    " ",
  ),
);
const commandSignals = new Set("SIGTERM SIGKILL SIGINT SIGABRT SIGSEGV SIGPIPE SIGHUP SIGQUIT".split(" "));
export function createPosttechnicalCommandExecutor({
  workspace,
  execution,
  result,
  spawnImpl = spawnSync,
  fileImplementation = { openSync, writeSync, closeSync },
  maximumBytes = P.reportLimit,
}) {
  requireValue(
    Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= P.reportLimit,
    "RAW_EVIDENCE_LOSS",
  );
  const paths = posttechnicalPrivatePaths(workspace),
    candidate = path.join(workspace, "candidate"),
    state = { records: 0, bytes: 0, evidenceLoss: false };
  let descriptor;
  try {
    descriptor = fileImplementation.openSync(
      path.join(paths.directory, "command-executions.original.jsonl"),
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o600,
    );
  } catch {
    fail("RAW_EVIDENCE_LOSS");
  }
  let closed = false;
  const record = (value) => {
    try {
      requireValue(!closed && state.records < 30, "RAW_EVIDENCE_LOSS");
      const bytes = Buffer.from(JSON.stringify(value) + "\n");
      requireValue(state.bytes + bytes.length <= maximumBytes, "RAW_EVIDENCE_LOSS");
      let offset = 0;
      while (offset < bytes.length) {
        const written = fileImplementation.writeSync(descriptor, bytes, offset, bytes.length - offset);
        requireValue(written > 0, "RAW_EVIDENCE_LOSS");
        offset += written;
      }
      state.bytes += bytes.length;
      state.records++;
    } catch {
      state.evidenceLoss = true;
      fail("RAW_EVIDENCE_LOSS");
    }
  };
  const originalError = (error) => {
    const value = { available: error !== null && error !== undefined };
    for (const key of ["name", "message", "stack", "code", "errno", "syscall", "status", "signal", "pid", "path"]) {
      const field = error?.[key];
      requireValue(typeof field !== "string" || Buffer.byteLength(field) <= maximumBytes, "RAW_EVIDENCE_LOSS");
      value[key] = typeof field === "string" || (typeof field === "number" && Number.isFinite(field)) ? field : null;
    }
    const spawnargs = error?.spawnargs;
    requireValue(
      spawnargs === null ||
        spawnargs === undefined ||
        (Array.isArray(spawnargs) &&
          spawnargs.every((entry) => typeof entry === "string" && Buffer.byteLength(entry) <= maximumBytes)),
      "RAW_EVIDENCE_LOSS",
    );
    value.spawnargs = spawnargs ?? null;
    return value;
  };
  const errorCode = (error) => {
    if (!error) return null;
    try {
      const code = error.code;
      return code === null || code === undefined ? null : commandErrorCodes.has(code) ? code : "UNKNOWN";
    } catch {
      state.evidenceLoss = true;
      return "UNKNOWN";
    }
  };
  return {
    state,
    execute(command, args, env, phase, ordinal) {
      requireValue(
        (phase === "setup" || phase === "technical") &&
          Number.isInteger(ordinal) &&
          ordinal >= 1 &&
          ordinal <= (phase === "setup" ? 3 : 12) &&
          typeof command === "string" &&
          Array.isArray(args) &&
          args.every((entry) => typeof entry === "string"),
        "COMMAND_CHANGED",
      );
      const startedAt = new Date().toISOString(),
        options = {
          cwd: candidate,
          env,
          stdio: ["ignore", "inherit", "inherit"],
          timeout: P.commandMs,
          killSignal: "SIGTERM",
          windowsHide: true,
        },
        observation = {
          version: 1,
          diagnosticId: P.id,
          policyDigest: posttechnicalPolicyDigest,
          runId: execution.runId,
          installerSha: execution.installerSha,
          candidateSha: W.candidate,
          coordinatorPid: process.pid,
          phase,
          ordinal,
          executable: command,
          argv: args,
          cwd: candidate,
          options: {
            stdio: [...options.stdio],
            timeout: options.timeout,
            killSignal: options.killSignal,
            windowsHide: options.windowsHide,
          },
          startedAt,
        };
      writePosttechnicalPrivate(path.join(paths.directory, `${phase}-${ordinal}-started.json`), {
        version: 1,
        ordinal,
        phase,
        coordinatorPid: process.pid,
        argvDigest: digest(args),
        status: "STARTED",
      });
      record({ ...observation, event: "STARTED" });
      const started = process.hrtime.bigint();
      let child,
        errorSource = "NONE";
      try {
        child = spawnImpl(command, args, options);
        if (child.error) errorSource = "CHILD_ERROR";
      } catch (error) {
        child = { error };
        errorSource = "SPAWN_THROW";
      }
      const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6,
        terminal = {
          version: 1,
          ordinal,
          phase,
          exitCode: Number.isInteger(child.status) ? child.status : null,
          signal: typeof child.signal === "string" ? child.signal : null,
          status: !child.error && child.status === 0 ? "PASS" : "FAIL",
        };
      if (child.error || child.signal || child.status !== 0)
        result.failedCommand = {
          phase,
          ordinal,
          argvDigest: digest(args),
          exitCode: Number.isInteger(child.status) && child.status >= 0 ? child.status : null,
          signal:
            typeof child.signal === "string" ? (commandSignals.has(child.signal) ? child.signal : "UNKNOWN") : null,
          errorCode: errorCode(child.error),
          durationMs: elapsedMs,
        };
      try {
        record({
          ...observation,
          event: "TERMINAL",
          elapsedMs,
          status: child.error || child.signal || child.status !== 0 ? "FAIL" : "PASS",
          exitCode: terminal.exitCode,
          signal: terminal.signal,
          pid: Number.isInteger(child.pid) ? child.pid : null,
          errorSource,
          error: originalError(child.error),
          // Inherited streams remain in the controller's existing private raw logs.
          stdout: { available: false },
          stderr: { available: false },
        });
      } catch {
        state.evidenceLoss = true;
      }
      try {
        writePosttechnicalPrivate(path.join(paths.directory, `${phase}-${ordinal}-terminal.json`), terminal);
      } catch {
        state.evidenceLoss = true;
      }
      if (child.error || child.signal || !Number.isInteger(child.status)) fail("WORKER_UNKNOWN");
      requireValue(child.status === 0, phase === "setup" ? "SETUP_COMMAND_FAILED" : "TECHNICAL_COMMAND_FAILED");
      if (state.evidenceLoss) fail("RAW_EVIDENCE_LOSS");
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        fileImplementation.closeSync(descriptor);
      } catch {
        state.evidenceLoss = true;
      }
    },
  };
}
export async function runPosttechnicalWorker() {
  process.umask(0o077);
  const workspace = process.env.GITHUB_WORKSPACE,
    privatePaths = posttechnicalPrivatePaths(workspace),
    input = privateInput(privatePaths);
  const result = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnicalPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    grantsConsumerTrial: false,
    coordinatorPid: process.pid,
    initialDependencySetupExecutions: 0,
    technicalCommandsStarted: 0,
    technicalCommandsCompleted: 0,
    technicalSuiteLaunches: 0,
    actualTechnicalCases: null,
    browserAuthorityCaptureLaunches: null,
    sourcePrefixExecutions: 0,
    technicalTraffic: "LOCKED_DEPENDENCY_FETCH_AND_OWNED_PRODUCT_LOOPBACK_NOT_MEASURED_AS_ZERO",
    nestedGenericSetupCommands: "NOT_SEPARATELY_MEASURED",
    actualChromiumLaunches: null,
    stages: [],
  };
  let commandExecution;
  try {
    requireValue(
      !Object.keys(process.env).some((key) =>
        /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_|POSTTECHNICAL_|GIT_|NODE_OPTIONS)/u.test(key),
      ),
      "EXECUTOR_CHANGED",
    );
    assertPosttechnicalRuntime(posttechnicalRuntime());
    writePosttechnicalPrivate(privatePaths.started, {
      version: 1,
      runId: input.execution.runId,
      policyDigest: posttechnicalPolicyDigest,
      reservation: input.reservation,
      coordinatorPid: process.pid,
    });
    globalThis.fetch = () => fail("EXECUTOR_CHANGED");
    const ordinary = await import(pathToFileURL(path.join(input.authority, "scripts/sounding-line/ordinary.mjs")));
    // Cache these exact B3+observation module objects before any technical work.
    await Promise.all(
      [
        "experience-exception.mjs",
        "product-experience.mjs",
        "verification-diagnostics.mjs",
        "source-diagnostics.mjs",
      ].map((name) => import(pathToFileURL(path.join(input.authority, "scripts/sounding-line", name)))),
    );
    result.stages.push("HISTORICAL_MODULES_PRELOADED");
    const originalBytes = readFileSync(input.member);
    requireValue(hash(originalBytes) === W.originalDecisionSha256, "PLAN_CHANGED");
    const plan = JSON.parse(originalBytes);
    const groups = ordinary.verificationObligationGroups(plan),
      tuples = validatePosttechnicalManifest(groups, plan);
    requireValue(!existsSync(path.join(input.candidate, "artifacts/sounding-line/evidence-store")), "CACHE_PRESENT");
    const marker = {
      version: 1,
      diagnosticId: P.id,
      policyDigest: posttechnicalPolicyDigest,
      reservation: input.reservation,
      nonce: randomUUID(),
      coordinatorPid: process.pid,
      runId: input.execution.runId,
      installerSha: input.execution.installerSha,
      installer: input.installer,
      candidate: input.candidate,
      originalDecisionDigest: W.originalDecisionSha256,
      commandOrdinal: 8,
      originalArguments: tuples[7].arguments,
      sources: { candidate: posttechnicalSnapshot(input.candidate), installer: posttechnicalSnapshot(input.installer) },
    };
    writePosttechnicalPrivate(privatePaths.lease, marker);
    commandExecution = createPosttechnicalCommandExecutor({ workspace, execution: input.execution, result });
    const { execute } = commandExecution;
    for (const [index, [command, args]] of P.setup.entries()) {
      result.initialDependencySetupExecutions++;
      execute(command, args, { ...process.env }, "setup", index + 1);
    }
    assertPosttechnicalSources(marker);
    result.stages.push("DEPENDENCY_SETUP_COMPLETE");
    const diagnostics = createBrowserDiagnosticSession(input.candidate, {
      baseSha: W.base,
      candidateSha: W.candidate,
      planDigest: plan.planDigest,
    });
    requireValue(!existsSync(path.join(input.candidate, "artifacts/sounding-line/evidence-store")), "CACHE_PRESENT");
    const verification = await ordinary.runReconciledVerification(
      input.candidate,
      plan,
      async (root, command, args, options) => {
        const ordinal = ++result.technicalCommandsStarted;
        requireValue(root === input.candidate, "COMMAND_CHANGED");
        validatePosttechnicalCommand(ordinal, command, args);
        assertPosttechnicalSources(marker);
        const scopeEnvironment = diagnostics.beginScope();
        let mappedArgs = args,
          env = posttechnicalCommandEnvironment({
            base: process.env,
            overrides: options.env,
            scopeEnvironment,
            ordinal,
          });
        if (ordinal === 8) {
          result.technicalSuiteLaunches++;
          mappedArgs = [
            path.join(input.installer, "scripts/sounding-line/run-browser-suite.mjs"),
            ...posttechnicalSuiteArguments({
              candidate: input.candidate,
              lease: privatePaths.lease,
              originalArguments: args,
            }),
          ];
          env = { ...env, POSTTECHNICAL_SUITE_LEASE: marker.nonce };
        }
        execute(command, mappedArgs, env, "technical", ordinal);
        result.technicalCommandsCompleted++;
        if (ordinal === 8) {
          const summary = readPosttechnicalPrivate(privatePaths.suiteTerminal);
          requireValue(
            summary.status === "PASS" && summary.actualCases === 38 && summary.cleanup === "PASS",
            "BROWSER_CLEANUP_FAILED",
          );
          result.browser = summary;
          result.actualTechnicalCases = summary.actualCases;
          result.browserAuthorityCaptureLaunches = summary.browserAuthorityCaptureLaunches;
          result.stages.push("TECHNICAL_BROWSER_COMPLETE");
        }
      },
    );
    result.technical = validatePosttechnicalFreshResult(verification);
    requireValue(
      result.technicalCommandsStarted === 12 &&
        result.technicalCommandsCompleted === 12 &&
        result.technicalSuiteLaunches === 1 &&
        result.actualTechnicalCases === 38,
      "TECHNICAL_NOT_FRESH_COMPLETE",
    );
    writeFileSync(
      path.join(privatePaths.directory, "technical-finalization.original.json"),
      JSON.stringify(verification),
      { flag: "wx", mode: 0o600 },
    );
    commandExecution.close();
    if (commandExecution.state.evidenceLoss) fail("RAW_EVIDENCE_LOSS");
    result.stages.push("FRESH_TECHNICAL_FINALIZATION_COMPLETE");
    assertPosttechnicalSources(marker);
    const sourceObservation = createPosttechnicalGitExceptionLog(privatePaths.directory);
    try {
      result.source = await withPosttechnicalGitExceptionObserver({
        operation: () => {
          result.sourcePrefixExecutions++;
          return runSourcePrefixChild({
            workspace,
            installer: input.installer,
            authority: input.authority,
            candidate: input.candidate,
            member: input.member,
          });
        },
        record: sourceObservation.record,
        state: sourceObservation.state,
      });
    } finally {
      sourceObservation.close();
      result.sourceExceptionEvidence = sourceObservation.state;
    }
    if (result.sourceExceptionEvidence.evidenceLoss) fail("RAW_EVIDENCE_LOSS");
    result.stages.push("SAME_PROCESS_SOURCE_PREFIX_COMPLETE");
    result.status = result.source.status;
  } catch (error) {
    if (existsSync(privatePaths.suiteTerminal)) {
      try {
        const partial = readPosttechnicalPrivate(privatePaths.suiteTerminal);
        result.browser = partial;
        result.actualTechnicalCases = partial.actualCases;
        result.browserAuthorityCaptureLaunches = partial.browserAuthorityCaptureLaunches;
      } catch {}
    }
    result.failure = safeFailure(error);
    result.status = ["WORKER_UNKNOWN", "EXECUTION_UNKNOWN", "RAW_EVIDENCE_LOSS"].includes(result.failure)
      ? "EXECUTION_UNKNOWN"
      : "TECHNICAL_DIAGNOSTIC_INCOMPLETE";
    process.exitCode = 1;
  } finally {
    if (commandExecution) {
      commandExecution.close();
      result.commandExecutionEvidence = commandExecution.state;
      if (commandExecution.state.evidenceLoss) {
        result.failure ??= "RAW_EVIDENCE_LOSS";
        result.status = "EXECUTION_UNKNOWN";
        process.exitCode = 1;
      }
    }
    writePosttechnicalPrivate(privatePaths.result, result);
  }
  return result;
}
const workerProgram =
  'import {runPosttechnicalWorker} from "./scripts/sounding-line/replay-posttechnical-diagnostic.mjs"; try { await runPosttechnicalWorker(); } catch { process.exitCode=1; }';
export function posttechnicalSupervisionOutcome({
  exit,
  cleanup,
  counts,
  saved,
  exceeded,
  timedOut,
  ioFailed,
  result,
  resultInvalid,
}) {
  const closureProven = cleanup?.status === "PASS" && cleanup.treeReaped === true && cleanup.streamsClosed === true;
  return {
    exitCode: Number.isInteger(exit?.code) ? exit.code : null,
    cleanup,
    closureProven,
    rawLogBytes: counts,
    savedRawLogBytes: saved,
    incomplete: Boolean(
      exceeded || timedOut || ioFailed || exit?.supervisionFailure || !closureProven || resultInvalid,
    ),
    logTruncated: Boolean(exceeded),
    timedOut: Boolean(timedOut),
    ioFailed: Boolean(ioFailed),
    resultInvalid: Boolean(resultInvalid),
    result,
  };
}
async function superviseWorker({ installer, workspace, environment, privatePaths }) {
  const child = spawnOwnedProcess(process.execPath, ["--input-type=module", "-e", workerProgram], {
    root: installer,
    env: posttechnicalWorkerEnvironment(environment, workspace),
  });
  // Synchronous unpipe before the guardian can launch the fixed worker payload.
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  const streams = [
    createWriteStream(path.join(privatePaths.directory, "worker.stdout.log"), { flags: "wx", mode: 0o600 }),
    createWriteStream(path.join(privatePaths.directory, "worker.stderr.log"), { flags: "wx", mode: 0o600 }),
  ];
  const counts = [0, 0];
  const saved = [0, 0];
  let exceeded = false,
    timedOut = false,
    ioFailed = false;
  let stop;
  const stopUnknown = () => {
    stop ??= stopOwnedProcess(child);
  };
  const completedStreams = streams.map((stream) =>
    finished(stream).then(
      () => true,
      () => {
        ioFailed = true;
        stopUnknown();
        return false;
      },
    ),
  );
  [child.stdout, child.stderr].forEach((source, index) => {
    source.on("data", (bytes) => {
      counts[index] += bytes.length;
      const remaining = P.logLimit - saved[index];
      if (remaining > 0) {
        const accepted = bytes.subarray(0, remaining);
        saved[index] += accepted.length;
        if (!streams[index].write(accepted)) {
          source.pause();
          streams[index].once("drain", () => source.resume());
        }
      }
      if (counts[index] > P.logLimit) {
        exceeded = true;
        stopUnknown();
      }
    });
    source.once("end", () => streams[index].end());
    source.once("close", () => streams[index].end());
    source.once("error", () => {
      ioFailed = true;
      streams[index].end();
      stopUnknown();
    });
  });
  const timer = setTimeout(() => {
    timedOut = true;
    stop ??= stopOwnedProcess(child);
  }, P.workerMs);
  timer.unref?.();
  const cancel = () => {
    timedOut = true;
    stop ??= stopOwnedProcess(child);
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  let exit, cleanup;
  try {
    exit = await processExit(child);
  } catch {
    ioFailed = true;
  } finally {
    try {
      cleanup = await (stop ?? stopOwnedProcess(child));
    } catch {
      cleanup = { status: "FAIL", treeReaped: false, streamsClosed: false };
    }
    await Promise.all(completedStreams);
    clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
  let result = null,
    resultInvalid = false;
  try {
    result = readPosttechnicalPrivate(privatePaths.result, P.reportLimit);
    requireValue(
      result.diagnosticId === P.id &&
        result.policyDigest === posttechnicalPolicyDigest &&
        result.qualification === false &&
        result.originalCauseClaim === false,
      "RESULT_INVALID",
    );
  } catch {
    resultInvalid = true;
    result = null;
  }
  return posttechnicalSupervisionOutcome({
    exit,
    cleanup,
    counts,
    saved,
    exceeded,
    timedOut,
    ioFailed,
    result,
    resultInvalid,
  });
}
// Standard authenticated hybrid envelope. AAD is stored byte-for-byte in base64;
// the inner member names/hashes/bytes are visible only after authenticated decrypt.
const OAEP_LABEL = Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1");
function evidenceLimits(overrides = {}) {
  const maximum = {
    files: P.evidenceFiles,
    rawBytes: P.evidenceBytes,
    fileBytes: P.evidenceFileBytes,
    jsonBytes: P.reportLimit,
    depth: P.evidenceDepth,
    nameBytes: P.evidenceNameBytes,
    envelopeBytes: P.evidenceEnvelopeBytes,
  };
  const limits = { ...maximum, ...overrides };
  requireValue(
    Object.keys(limits).every(
      (key) =>
        Object.hasOwn(maximum, key) &&
        Number.isSafeInteger(limits[key]) &&
        limits[key] > 0 &&
        limits[key] <= maximum[key],
    ),
    "EVIDENCE_LIMIT",
  );
  return limits;
}
export function sealPosttechnicalEvidence({ files, aad, publicKey, inventory = [], limits: overrides }) {
  const limits = evidenceLimits(overrides),
    names = new Set();
  let total = 0;
  requireValue(Array.isArray(files) && files.length <= limits.files, "EVIDENCE_LIMIT");
  for (const { name, bytes } of files) {
    requireValue(
      typeof name === "string" &&
        !name.includes("\\") &&
        !name.includes("\0") &&
        !path.posix.isAbsolute(name) &&
        name.split("/").every((part) => part && part !== "." && part !== "..") &&
        Buffer.byteLength(name) <= limits.nameBytes &&
        !names.has(name) &&
        Buffer.isBuffer(bytes),
      "EVIDENCE_PATH_INVALID",
    );
    names.add(name);
    total += bytes.length;
    requireValue(
      total <= limits.rawBytes &&
        bytes.length <= (name.endsWith(".json") || name.endsWith(".jsonl") ? limits.jsonBytes : limits.fileBytes),
      "EVIDENCE_LIMIT",
    );
  }
  const plaintext = Buffer.from(
    JSON.stringify({
      version: 1,
      inventory,
      files: files.map(({ name, bytes }) => ({
        name,
        bytes: bytes.length,
        sha256: hash(bytes),
        content: bytes.toString("base64"),
      })),
    }),
  );
  const key = randomBytes(32),
    nonce = randomBytes(12);
  try {
    const wrappedKey = publicEncrypt(
      { key: publicKey, oaepHash: "sha256", oaepLabel: OAEP_LABEL, padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING },
      key,
    );
    const header = Buffer.from(
      JSON.stringify({
        ...aad,
        format: "VW-POSTTECHNICAL-EVIDENCE-1",
        algorithms: { content: "AES-256-GCM", keyWrap: "RSA-OAEP-SHA256" },
        plaintextBytes: plaintext.length,
        nonce: nonce.toString("base64"),
        wrappedKey: wrappedKey.toString("base64"),
      }),
    );
    requireValue(header.length <= 8192, "EVIDENCE_LIMIT");
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(header);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = Buffer.from(
      JSON.stringify({
        format: "VW-POSTTECHNICAL-EVIDENCE-1",
        aad: header.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
      }),
    );
    requireValue(envelope.length <= limits.envelopeBytes, "EVIDENCE_LIMIT");
    return envelope;
  } finally {
    key.fill(0);
  }
}
export function validatePosttechnicalRequiredEvidence({ members, workspace }) {
  const index = new Map(members.map((member) => [member.name, member.bytes])),
    missing = [];
  const valid = (name) => {
    const bytes = index.get(name);
    if (!bytes?.length) return false;
    if (name.endsWith(".png")) return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (name.endsWith(".zip")) return bytes.length > 4 && bytes[0] === 80 && bytes[1] === 75;
    if (name.endsWith(".json")) {
      try {
        JSON.parse(bytes);
        return true;
      } catch {
        return false;
      }
    }
    return true;
  };
  for (const relative of OUTPUTS.requiredFixedRelativeFilesOnWholeTechnicalSuccess) {
    const name = `candidate/${relative}`;
    if (!valid(name)) missing.push(name);
  }
  for (const rule of OUTPUTS.requiredRecursiveBasenamesOnWholeTechnicalSuccess) {
    const prefix = `candidate/${rule.directory}/`;
    const matches = [...index.keys()].filter(
      (name) => name.startsWith(prefix) && path.posix.basename(name) === rule.basename && valid(name),
    );
    if (matches.length !== rule.count) missing.push(`${prefix}**/${rule.basename}`);
  }
  for (const rule of OUTPUTS.requestedGeneratedVideoRules) {
    const prefix = `candidate/${rule.directory}/`,
      videos = [...index.entries()].filter(
        ([name, bytes]) => name.startsWith(prefix) && name.endsWith(".webm") && bytes.length > 0,
      );
    if (videos.length !== rule.completedSuccessExpectedNonemptyFiles) missing.push(`${prefix}*.webm`);
    try {
      const observations = JSON.parse(index.get(`candidate/${rule.observationFile}`));
      const selected = [];
      for (const kind of ["desktop", "phone"]) {
        const value = observations.recordings?.[kind];
        requireValue(
          typeof value === "string" &&
            !value.includes("\\") &&
            !value.includes("\0") &&
            path.normalize(value) === value,
          "EVIDENCE_INCOMPLETE",
        );
        const absolute = path.resolve(workspace, "candidate", value),
          directory = path.join(workspace, "candidate", rule.directory);
        requireValue(absolute.startsWith(directory + path.sep) && absolute.endsWith(".webm"), "EVIDENCE_INCOMPLETE");
        const name = path.relative(workspace, absolute).replaceAll("\\", "/");
        requireValue(index.get(name)?.length > 0 && !selected.includes(name), "EVIDENCE_INCOMPLETE");
        selected.push(name);
      }
    } catch {
      missing.push(`candidate/${rule.observationFile}#recordings`);
    }
  }
  return { complete: missing.length === 0, missing };
}
export function collectPosttechnicalEvidence({ workspace, requireMandatory = false, limits: overrides }) {
  const limits = evidenceLimits(overrides),
    privatePaths = posttechnicalPrivatePaths(workspace),
    members = [],
    inventory = [],
    names = new Set();
  let total = 0,
    directories = 0;
  const add = (name, file) => {
    requireValue(Buffer.byteLength(name) <= limits.nameBytes && !names.has(name), "EVIDENCE_PATH_INVALID");
    const maximum = Math.min(
      limits.rawBytes - total,
      /\.(?:json|jsonl)$/u.test(name) ? limits.jsonBytes : limits.fileBytes,
    );
    requireValue(members.length < limits.files && maximum >= 0, "EVIDENCE_LIMIT");
    const bytes = securePosttechnicalRead({ file, root: workspace, maximum });
    total += bytes.length;
    requireValue(total <= limits.rawBytes, "EVIDENCE_LIMIT");
    names.add(name);
    members.push({ name, bytes });
  };
  const walk = (directory, depth = 0) => {
    if (!existsSync(directory)) return;
    requireValue(++directories <= limits.files * 4 + 64, "EVIDENCE_LIMIT");
    requireValue(
      depth <= limits.depth &&
        lstatSync(directory).isDirectory() &&
        !lstatSync(directory).isSymbolicLink() &&
        realpathSync(directory) === directory,
      "EVIDENCE_PATH_INVALID",
    );
    for (const name of readdirSync(directory).sort()) {
      const file = path.join(directory, name),
        stat = lstatSync(file);
      requireValue(!stat.isSymbolicLink(), "EVIDENCE_PATH_INVALID");
      if (stat.isDirectory()) walk(file, depth + 1);
      else {
        requireValue(
          !/(?:\.(?:db|sqlite)(?:-(?:wal|shm|journal))?|\.(?:pem|key)|(?:lease|counter)[^/]*\.json)$/iu.test(name),
          "EVIDENCE_PATH_INVALID",
        );
        add(path.relative(workspace, file).replaceAll("\\", "/"), file);
      }
    }
  };
  for (const name of [
    "worker.stdout.log",
    "worker.stderr.log",
    "worker-result.json",
    "git-exceptions.original.jsonl",
    "command-executions.original.jsonl",
    "playwright-report.json",
    "browser-runtime.original.json",
    "browser-profile.original.json",
    "technical-finalization.original.json",
  ]) {
    const file = path.join(privatePaths.directory, name);
    if (existsSync(file)) add(`private/${name}`, file);
  }
  for (const name of ["ordinary6.original.zip", "ordinary-decision.original.json"]) {
    const file = path.join(workspace, "receipts", name);
    if (existsSync(file)) add(`original/${name}`, file);
  }
  const roots = [
    ["private/html-report", false],
    ["candidate/test-results", false],
    ["candidate/artifacts/sounding-line/browser-diagnostics", false],
    ["candidate/artifacts/sounding-line/evidence-store", false],
    ["candidate/artifacts/crossdeck/refit-no-preference", true],
    ["candidate/artifacts/crossdeck/refit-reduce", true],
    ["candidate/artifacts/crossdeck/refit-recovery", true],
    ["candidate/artifacts/crossdeck-device-lab", true],
    ["candidate/artifacts/crossdeck-phase2", true],
    ["candidate/artifacts/validation/homeport-phase2/sounding-line-evidence", true],
    ["candidate/artifacts/crossdeck/realtime-browser", false],
  ];
  let missingMandatoryCount = 0;
  for (const [name, mandatory] of roots) {
    const directory = path.join(workspace, name),
      produced = existsSync(directory);
    inventory.push({ name, produced, mandatory });
    if (requireMandatory && mandatory && !produced) missingMandatoryCount++;
    walk(directory);
  }
  const required = requireMandatory
    ? validatePosttechnicalRequiredEvidence({ members, workspace })
    : { complete: true, missing: [] };
  if (requireMandatory) inventory.push({ requiredMissing: required.missing });
  missingMandatoryCount += required.missing.length;
  return { members, total, inventory, missingMandatoryCount, complete: missingMandatoryCount === 0 };
}
function encryptEvidence({ workspace, execution, output, requireMandatory = false }) {
  requireValue(hash(evidencePublicKey) === P.evidenceKeyDigest, "ENCRYPTION_FAILED");
  const { members, total, inventory, missingMandatoryCount, complete } = collectPosttechnicalEvidence({
    workspace,
    requireMandatory,
  });
  const envelope = sealPosttechnicalEvidence({
    files: members,
    inventory,
    publicKey: evidencePublicKey,
    aad: {
      version: 1,
      diagnosticId: P.id,
      repository: P.repository,
      runAttempt: 1,
      job: "posttechnical-diagnostic",
      originalRun: ORIGINAL.failedRun,
      originalInputDigest: W.originalDecisionSha256,
      originalArchiveDigest: ORIGINAL.archiveDigest,
      originalPlanDigest: P.originalPlanDigest,
      workloadDigest: W.orderedTuplesSha256,
      runId: execution?.runId ?? null,
      policyDigest: posttechnicalPolicyDigest,
      keyId: P.evidenceKeyDigest,
      installer: execution?.installerSha ?? null,
      candidate: W.candidate,
      historicalBase: W.base,
    },
  });
  requireValue(envelope.length <= P.evidenceEnvelopeBytes, "EVIDENCE_LIMIT");
  writeFileSync(output, envelope, { flag: "wx", mode: 0o600 });
  return {
    format: "VW-POSTTECHNICAL-EVIDENCE-1",
    keyId: P.evidenceKeyDigest,
    ciphertextDigest: hash(envelope),
    ciphertextBytes: envelope.length,
    memberCount: members.length,
    rawBytes: total,
    complete,
    missingMandatoryCount,
  };
}
const publicReceiptKeys = new Set(
  `version diagnosticId policyDigest status completeness qualification originalCauseClaim grantsConsumerTrial originalRun priorDiagnosticRun controllerNetwork apiGetAttempts apiPostAttempts archiveGetAttempts execution runId installerSha workflowId runAttempt reservation workerStarted worker exitCode cleanup rawLogBytes result coordinatorPid initialDependencySetupExecutions technicalCommandsStarted technicalCommandsCompleted technicalSuiteLaunches actualTechnicalCases browserAuthorityCaptureLaunches sourcePrefixExecutions technicalTraffic stages browser technical source failure actualCases actualSuites retries repetitions workers identityDigest mediaAttachments browserLaunches reportDigest runtimeDigest profileDigest freshObligations commands canonicalFinalization milestones observation planDigest excludedStages productExecutions consumerAdmissions networkRequests scratchWrites sourceErrorWithoutGitObservation stage phase errorName code causeCode syscall signal replayAdmission substage git component operation classification argumentCount argumentsSha256 arguments index sha256 fixed revision sha selector pathSha256 cwdSha256 stdout stderr metadata available representation bytes hashedBytes complete file revisions postconditions installer authority candidate originMain head tree shallow shallowDigest indexDigest refsDigest registryDigest encryptedEvidence format keyId ciphertextDigest ciphertextBytes memberCount rawBytes directExitObserved treeReaped streamsClosed escalated payloadExitCode elapsedMs ownership reconstructionDifferences historicalProcessRecreated historicalRunnerImageRecreated checkoutCredentialsPersisted oldConsumerAdmissionRecreated technicalAndSourceCoordinator browserReporters telemetryDisabled dependencyCaches technicalWorkloadCompleted candidateOriginMain`.split(
    " ",
  ),
);
const publicReceiptStrings = new Set(
  `PASS FAIL NOT_STARTED UNKNOWN EXECUTION_UNKNOWN DIAGNOSTIC_INCOMPLETE DIAGNOSTIC_RESERVED DIAGNOSTIC_SETUP_OR_BINDING_FAILURE TECHNICAL_DIAGNOSTIC_INCOMPLETE NOT_REPRODUCED SOURCE_OPERATION_FAILURE_REPRODUCED SOURCE_RECONSTRUCTION_FAILURE SAME_FIXED_PROCESS LIST_HTML_JSON NEW_OWNED_PRIVATE_CACHES HISTORICAL_MODULES_PRELOADED DEPENDENCY_SETUP_COMPLETE TECHNICAL_BROWSER_COMPLETE FRESH_TECHNICAL_FINALIZATION_COMPLETE SAME_PROCESS_SOURCE_PREFIX_COMPLETE LOCKED_DEPENDENCY_FETCH_AND_OWNED_PRODUCT_LOOPBACK_NOT_MEASURED_AS_ZERO EXISTING_OWNED_TEMPORARY_METADATA_MERGES_ONLY LINUX_SUBREAPER_AND_PIDFD VW-POSTTECHNICAL-EVIDENCE-1 ENTRY SOURCE_RECOGNITION PLAN_INPUT REGISTRY_READ CAMPAIGN_RELATION HEAD_CHECK PLAN_REBUILD EXECUTOR_CONTEXT LOCAL_LEASE PLAN_COMPARE ORDINARY_LEASE CUSTODY_REQUEST LIVE_CONTEXT HISTORICAL_CUSTODY RESERVATION TECHNICAL_COMPLETE HISTORICAL_PREPARE PHASE_CLAIM REPLAY_ADMISSION UNCLASSIFIED EXPERIENCE_EXCEPTION PRODUCT_EXPERIENCE DIAGNOSED_CONTINUATION R8_FORMAT R9_CONTINUATION R10_CONTINUATION R11_CONTINUATION ANCESTRY METADATA_MERGE REV_PARSE SHOW LS_TREE MERGE_BASE CAT_FILE DIFF OTHER_GIT_OPERATION NOT_ANCESTOR MERGE_CONFLICT UNCLASSIFIED_GIT_FAILURE OBJECT PATH TREE BUFFER UTF8_STRING AGENTS_README DOCS_INDEX EXPERIENCE_README Error TypeError RangeError SyntaxError ReferenceError URIError AggregateError EACCES EPERM EBUSY EEXIST EISDIR EMFILE ENFILE ENOENT ENOSPC ENOMEM ENOTDIR ENOBUFS ETIMEDOUT EIO EROFS ENAMETOOLONG ERR_FS_FILE_TOO_LARGE ERR_STRING_TOO_LONG ERR_OUT_OF_RANGE ERR_INVALID_ARG_TYPE SIGTERM SIGKILL SIGINT SIGABRT SIGSEGV SIGPIPE SIGHUP SIGQUIT mkdir open write read stat lstat rename unlink spawn spawnSync EXECUTOR_CHANGED INSTALLER_CHANGED LIVE_BINDING_CHANGED PROTECTION_CHANGED SUBJECT_CHANGED DISPATCH_CONSUMED PREDECESSOR_CHANGED RESERVATION_INVALID RUNTIME_CHANGED SOURCE_CHANGED PRIVATE_PATH_INVALID PRIVATE_FILE_INVALID PLAN_CHANGED GROUPS_CHANGED COMMAND_CHANGED SUITE_BINDING_CHANGED SUITE_INVOCATION_CHANGED COORDINATOR_EXITED REPORT_ALREADY_EXISTS REPORT_SCOPE_CHANGED REPORT_CASE_FAILED REPORT_IDENTITIES_CHANGED BROWSER_SCOPE_MISSING BROWSER_RECEIPT_TOO_LARGE BROWSER_CLEANUP_FAILED TECHNICAL_NOT_FRESH_COMPLETE CACHE_PRESENT WORKER_UNKNOWN LOG_LIMIT TECHNICAL_COMMAND_FAILED SETUP_COMMAND_FAILED ENCRYPTION_FAILED EVIDENCE_LIMIT EVIDENCE_PATH_INVALID CLI_INVALID RESULT_INVALID SOURCE_POSTCONDITION_INVALID rev-parse show ls-tree merge-base cat-file diff merge-file --path-format=absolute --git-common-dir HEAD origin/main --name-only --no-renames --is-ancestor --stdout --batch -rz -- --exit-code`.split(
    " ",
  ),
);
for (const key of "closureProven savedRawLogBytes incomplete logTruncated timedOut ioFailed resultInvalid sourceExceptionEvidence observedGitThrows records evidenceLoss restoreVerified nestedGenericSetupCommands actualChromiumLaunches missingMandatoryCount evidenceLimits rawByteCap fileCountCap individualFileByteCap jsonByteCap envelopeByteCap nameByteCap depthCap failedCommand ordinal argvDigest errorCode durationMs commandExecutionEvidence".split(
  " ",
))
  publicReceiptKeys.add(key);
for (const value of ["NOT_SEPARATELY_MEASURED", "RAW_EVIDENCE_LOSS", "EVIDENCE_INCOMPLETE", "setup", "technical"])
  publicReceiptStrings.add(value);
publicReceiptStrings.add(P.id);
publicReceiptStrings.add("");
publicReceiptStrings.add(
  ORIGINAL.overlay
    .map((entry) => `${entry.before ? " M" : "??"} ${entry.path}\n`)
    .sort()
    .join(""),
);
export function validatePosttechnicalPublicReceipt(summary) {
  requireValue(
    summary &&
      [
        "EXECUTION_UNKNOWN",
        "DIAGNOSTIC_RESERVED",
        "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE",
        "TECHNICAL_DIAGNOSTIC_INCOMPLETE",
        "NOT_REPRODUCED",
        "SOURCE_OPERATION_FAILURE_REPRODUCED",
        "SOURCE_RECONSTRUCTION_FAILURE",
      ].includes(summary.status) &&
      summary.version === 1 &&
      summary.diagnosticId === P.id &&
      summary.policyDigest === posttechnicalPolicyDigest &&
      summary.qualification === false &&
      summary.originalCauseClaim === false &&
      summary.grantsConsumerTrial === false,
    "RESULT_INVALID",
  );
  const walk = (value, depth = 0) => {
    requireValue(depth <= 16, "RESULT_INVALID");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      requireValue(Number.isFinite(value) && value >= 0, "RESULT_INVALID");
      return;
    }
    if (typeof value === "string") {
      requireValue(publicReceiptStrings.has(value) || /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value), "RESULT_INVALID");
      return;
    }
    if (Array.isArray(value)) {
      requireValue(value.length <= 256, "RESULT_INVALID");
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    requireValue(value && typeof value === "object", "RESULT_INVALID");
    for (const [key, entry] of Object.entries(value)) {
      requireValue(publicReceiptKeys.has(key), "RESULT_INVALID");
      if (key === "failedCommand")
        requireValue(
          entry &&
            Object.keys(entry).length === 7 &&
            ["phase", "ordinal", "argvDigest", "exitCode", "signal", "errorCode", "durationMs"].every((field) =>
              Object.hasOwn(entry, field),
            ) &&
            ["setup", "technical"].includes(entry.phase) &&
            Number.isInteger(entry.ordinal) &&
            entry.ordinal >= 1 &&
            entry.ordinal <= (entry.phase === "setup" ? 3 : 12) &&
            typeof entry.argvDigest === "string" &&
            /^[a-f0-9]{64}$/u.test(entry.argvDigest) &&
            (entry.exitCode === null || (Number.isInteger(entry.exitCode) && entry.exitCode >= 0)) &&
            (entry.signal === null || entry.signal === "UNKNOWN" || commandSignals.has(entry.signal)) &&
            (entry.errorCode === null || entry.errorCode === "UNKNOWN" || commandErrorCodes.has(entry.errorCode)) &&
            Number.isFinite(entry.durationMs) &&
            entry.durationMs >= 0,
          "RESULT_INVALID",
        );
      walk(entry, depth + 1);
    }
  };
  walk(summary);
  if (summary.worker?.result?.source) sourceDiagnosticResult(summary.worker.result.source);
  requireValue(Buffer.byteLength(JSON.stringify(summary)) <= 65536, "RESULT_INVALID");
  return summary;
}
export function assertPosttechnicalPublication({ summary, summaryFile, encryptedFile, outputFile }) {
  validatePosttechnicalPublicReceipt(summary);
  requireValue(
    !summary.workerStarted ||
      (summary.worker?.closureProven === true &&
        summary.worker?.cleanup?.status === "PASS" &&
        summary.worker.cleanup.treeReaped === true &&
        summary.worker.cleanup.streamsClosed === true),
    "RESULT_INVALID",
  );
  for (const file of [summaryFile, encryptedFile, outputFile])
    requireValue(
      typeof file === "string" &&
        path.isAbsolute(file) &&
        lstatSync(file).isFile() &&
        !lstatSync(file).isSymbolicLink() &&
        realpathSync(file) === file,
      "PRIVATE_FILE_INVALID",
    );
  const summaryBytes = securePosttechnicalRead({ file: summaryFile, root: path.dirname(summaryFile), maximum: 65536 });
  requireValue(summaryBytes.length <= 65536 && exact(JSON.parse(summaryBytes), summary), "RESULT_INVALID");
  const metadata = summary.encryptedEvidence,
    encrypted = securePosttechnicalRead({
      file: encryptedFile,
      root: path.dirname(encryptedFile),
      maximum: P.evidenceEnvelopeBytes,
    });
  requireValue(
    metadata &&
      metadata.keyId === P.evidenceKeyDigest &&
      metadata.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      metadata.ciphertextBytes === encrypted.length &&
      metadata.ciphertextDigest === hash(encrypted),
    "RESULT_INVALID",
  );
  const envelope = JSON.parse(encrypted),
    headerBytes = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(headerBytes);
  requireValue(
    Buffer.byteLength(JSON.stringify(envelope)) === encrypted.length &&
      Buffer.from(JSON.stringify(envelope)).equals(encrypted) &&
      headerBytes.length <= 8192 &&
      Buffer.from(JSON.stringify(header)).equals(headerBytes),
    "RESULT_INVALID",
  );
  requireValue(
    envelope.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      Buffer.from(envelope.tag, "base64").length === 16 &&
      Buffer.from(envelope.ciphertext, "base64").length > 0 &&
      header.version === 1 &&
      header.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      header.repository === P.repository &&
      header.runAttempt === 1 &&
      header.job === "posttechnical-diagnostic" &&
      header.originalRun === ORIGINAL.failedRun &&
      header.originalInputDigest === W.originalDecisionSha256 &&
      header.originalArchiveDigest === ORIGINAL.archiveDigest &&
      header.originalPlanDigest === P.originalPlanDigest &&
      header.workloadDigest === W.orderedTuplesSha256 &&
      header.algorithms?.content === "AES-256-GCM" &&
      header.algorithms?.keyWrap === "RSA-OAEP-SHA256" &&
      Number.isSafeInteger(header.plaintextBytes) &&
      header.plaintextBytes === Buffer.from(envelope.ciphertext, "base64").length &&
      header.plaintextBytes <= P.evidenceEnvelopeBytes &&
      header.diagnosticId === P.id &&
      header.runId === summary.execution.runId &&
      header.policyDigest === posttechnicalPolicyDigest &&
      header.keyId === P.evidenceKeyDigest &&
      header.installer === summary.execution.installerSha &&
      header.candidate === W.candidate &&
      header.historicalBase === W.base &&
      Buffer.from(header.nonce, "base64").length === 12 &&
      Buffer.from(header.wrappedKey, "base64").length === 384,
    "RESULT_INVALID",
  );
  appendFileSync(outputFile, "evidence_safe=true\n");
  return true;
}
export function minimalPosttechnicalUnknownReceipt(result) {
  const minimal = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnicalPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
    originalRun: ORIGINAL.failedRun,
    priorDiagnosticRun: P.priorRun,
    failure: "RESULT_INVALID",
  };
  if (result.execution)
    minimal.execution = {
      runId: result.execution.runId,
      installerSha: result.execution.installerSha,
      workflowId: result.execution.workflowId,
      runAttempt: 1,
      policyDigest: posttechnicalPolicyDigest,
    };
  if (sha(result.reservation)) minimal.reservation = result.reservation;
  if (result.workerStarted) {
    minimal.workerStarted = true;
    minimal.worker = {
      closureProven: result.worker?.closureProven === true,
      cleanup: {
        status: result.worker?.closureProven ? "PASS" : "FAIL",
        treeReaped: result.worker?.closureProven === true,
        streamsClosed: result.worker?.closureProven === true,
      },
      incomplete: true,
    };
  }
  if (result.encryptedEvidence) minimal.encryptedEvidence = { ...result.encryptedEvidence };
  return validatePosttechnicalPublicReceipt(minimal);
}
export async function runPosttechnicalDiagnostic({ mode, paths, reservation, environment = process.env }) {
  const owned = validateDiagnosticPaths({ ...paths, mode });
  const result = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnicalPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
    originalRun: ORIGINAL.failedRun,
    priorDiagnosticRun: P.priorRun,
    controllerNetwork: { apiGetAttempts: 0, apiPostAttempts: 0, archiveGetAttempts: 0 },
    evidenceLimits: {
      rawByteCap: P.evidenceBytes,
      fileCountCap: P.evidenceFiles,
      individualFileByteCap: P.evidenceFileBytes,
      jsonByteCap: P.reportLimit,
      envelopeByteCap: P.evidenceEnvelopeBytes,
      nameByteCap: P.evidenceNameBytes,
      depthCap: P.evidenceDepth,
    },
    reconstructionDifferences: {
      historicalProcessRecreated: false,
      historicalRunnerImageRecreated: false,
      checkoutCredentialsPersisted: false,
      oldConsumerAdmissionRecreated: false,
      technicalAndSourceCoordinator: "SAME_FIXED_PROCESS",
      browserReporters: "LIST_HTML_JSON",
      telemetryDisabled: true,
      dependencyCaches: "NEW_OWNED_PRIVATE_CACHES",
      technicalWorkloadCompleted: false,
    },
  };
  let privatePaths,
    baseline,
    execution,
    success = false;
  try {
    execution = await (async () => {
      const installer = posttechnicalSnapshot(owned.installer);
      requireValue(installer.status === "" && installer.head === environment.GITHUB_SHA, "INSTALLER_CHANGED");
      const token = environment.GH_TOKEN ?? environment.GITHUB_TOKEN;
      const request = createCustodyRequest({
        repository: P.repository,
        token,
        report: () => {},
        fetchImpl: (url, options) => {
          if (options.method === "GET") result.controllerNetwork.apiGetAttempts++;
          if (options.method === "POST") result.controllerNetwork.apiPostAttempts++;
          return globalThis.fetch(url, options);
        },
      });
      const current = await validatePosttechnicalExecution({
        request: createReadOnlyDiagnosticRequest(request),
        environment,
        job: mode === "reserve" ? "reserve-diagnostic" : "posttechnical-diagnostic",
        installerSha: installer.head,
      });
      result.execution = current;
      execution = current;
      if (mode === "reserve") {
        requireValue(
          typeof environment.GITHUB_OUTPUT === "string" &&
            path.isAbsolute(environment.GITHUB_OUTPUT) &&
            lstatSync(environment.GITHUB_OUTPUT).isFile(),
          "PRIVATE_PATH_INVALID",
        );
        const claim = await createPosttechnicalReservation({ request, execution: current });
        result.reservation = claim.commitSha;
        result.status = "DIAGNOSTIC_RESERVED";
        appendFileSync(environment.GITHUB_OUTPUT, `reservation=${claim.commitSha}\n`);
        success = true;
        return current;
      }
      const claim = await readPosttechnicalReservation({ request, execution: current, reservation });
      result.reservation = claim.commitSha;
      mkdirSync(path.join(paths.workspace, "private"), { mode: 0o700 });
      privatePaths = posttechnicalPrivatePaths(paths.workspace);
      await loadOriginalDecision({
        request: createReadOnlyDiagnosticRequest(request),
        token,
        directory: owned.receipts,
        fetchImpl: (url, options) => {
          result.controllerNetwork.archiveGetAttempts++;
          return globalThis.fetch(url, options);
        },
      });
      baseline = installHistoricalOverlay({ ...owned, installerSha: current.installerSha });
      writePosttechnicalPrivate(privatePaths.input, {
        version: 1,
        policyDigest: posttechnicalPolicyDigest,
        workspace: paths.workspace,
        installer: owned.installer,
        authority: owned.authority,
        candidate: owned.candidate,
        member: path.join(owned.receipts, "ordinary-decision.original.json"),
        execution: current,
        reservation: claim.commitSha,
      });
      return current;
    })();
    if (mode === "reserve") return result;
    result.workerStarted = true;
    const worker = await superviseWorker({
      installer: owned.installer,
      workspace: paths.workspace,
      environment,
      privatePaths,
    });
    result.worker = worker;
    result.reconstructionDifferences.candidateOriginMain = execution.installerSha;
    result.reconstructionDifferences.technicalWorkloadCompleted = worker.result?.technicalCommandsCompleted === 12;
    result.status = worker.incomplete ? "EXECUTION_UNKNOWN" : worker.result.status;
    if (worker.incomplete) result.failure = "WORKER_UNKNOWN";
    success =
      !worker.incomplete &&
      worker.exitCode === 0 &&
      ["NOT_REPRODUCED", "SOURCE_OPERATION_FAILURE_REPRODUCED"].includes(result.status);
  } catch (error) {
    result.failure = safeFailure(error);
    result.status =
      result.workerStarted || result.failure === "EXECUTION_UNKNOWN"
        ? "EXECUTION_UNKNOWN"
        : "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE";
  } finally {
    if (baseline) {
      try {
        result.postconditions = verifyHistoricalOverlay({ ...owned, installerSha: execution.installerSha, baseline });
      } catch {
        result.status = "EXECUTION_UNKNOWN";
        result.failure = "SOURCE_POSTCONDITION_INVALID";
        success = false;
      }
    }
    if (privatePaths) {
      try {
        result.encryptedEvidence = encryptEvidence({
          workspace: paths.workspace,
          execution,
          output: path.join(owned.receipts, "private-evidence.encrypted"),
          requireMandatory:
            result.worker?.result?.technicalCommandsCompleted === 12 &&
            result.worker?.result?.actualTechnicalCases === 38,
        });
        if (!result.encryptedEvidence.complete) {
          result.status = "EXECUTION_UNKNOWN";
          result.failure = "EVIDENCE_INCOMPLETE";
          success = false;
        }
      } catch {
        result.status = "EXECUTION_UNKNOWN";
        result.failure = "ENCRYPTION_FAILED";
        success = false;
      }
    }
    let publicResult;
    try {
      publicResult = validatePosttechnicalPublicReceipt(result);
    } catch {
      publicResult = minimalPosttechnicalUnknownReceipt(result);
      success = false;
    }
    receipt(owned.output, publicResult);
    if (
      publicResult.encryptedEvidence &&
      (!publicResult.workerStarted || publicResult.worker?.closureProven === true)
    ) {
      try {
        assertPosttechnicalPublication({
          summary: publicResult,
          summaryFile: owned.output,
          encryptedFile: path.join(owned.receipts, "private-evidence.encrypted"),
          outputFile: environment.GITHUB_OUTPUT,
        });
      } catch {
        publicResult.status = "EXECUTION_UNKNOWN";
        publicResult.failure = "PUBLICATION_FAILED";
        success = false;
      }
    }
    process.stdout.write(
      JSON.stringify({
        diagnosticId: P.id,
        status: publicResult.status,
        qualification: false,
        originalCauseClaim: false,
      }) + "\n",
    );
    if (!success) process.exitCode = 1;
  }
  return result;
}
function cli(argv) {
  const mode = argv.shift(),
    keys =
      mode === "reserve"
        ? ["--installer", "--output"]
        : mode === "diagnose"
          ? ["--installer", "--authority", "--candidate", "--reservation", "--output"]
          : [];
  requireValue(keys.length && argv.length === keys.length * 2, "CLI_INVALID");
  const values = {};
  keys.forEach((key, index) => {
    requireValue(argv[index * 2] === key && typeof argv[index * 2 + 1] === "string", "CLI_INVALID");
    values[key.slice(2)] = argv[index * 2 + 1];
  });
  const { reservation, ...paths } = values;
  return { mode, reservation, paths: { ...paths, workspace: process.env.GITHUB_WORKSPACE } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runPosttechnicalDiagnostic(cli(process.argv.slice(2)));
  } catch {
    process.stdout.write(
      JSON.stringify({ status: "INVALID_DIAGNOSTIC_BINDING", qualification: false, originalCauseClaim: false }) + "\n",
    );
    process.exitCode = 1;
  }
}
