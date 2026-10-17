// One separately reserved historical validation, then source observation; never qualification.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  writeSync,
  constants as fsConstants,
} from "node:fs";
import { finished } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCustodyRequest } from "./custody-transport.mjs";
import { exceptionStore } from "./experience-exception.mjs";
import { spawnOwnedProcess, stopOwnedProcess, processExit } from "./owned-process.mjs";
import {
  REPLAY_SOURCE_DIAGNOSTIC_POLICY as ORIGINAL,
  replaySourceDiagnosticPolicyDigest,
  validateDiagnosticPaths,
  createReadOnlyDiagnosticRequest,
  loadOriginalDecision,
  installHistoricalOverlay,
  verifyHistoricalOverlay,
  runSourcePrefixChild,
  sourceDiagnosticChildEnvironment,
  sourceDiagnosticResult,
  validateOriginalDecision,
  readBoundedDiagnosticBody,
} from "./replay-admission-source-diagnostic.mjs";
import {
  withPosttechnicalGitExceptionObserver,
  createPosttechnicalGitExceptionLog,
  sealPosttechnicalEvidence,
  posttechnicalSupervisionOutcome,
} from "./replay-posttechnical-diagnostic.mjs";
import {
  POSTTECHNICAL_POLICY as CAPS,
  posttechnicalPrivatePaths,
  readPosttechnicalPrivate,
  writePosttechnicalPrivate,
  securePosttechnicalRead,
  assertPosttechnicalRuntime,
  posttechnicalRuntime,
  posttechnicalSnapshot,
} from "./replay-posttechnical-suite.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export const HISTORICAL_VALIDATION_POLICY = Object.freeze({
  version: 1,
  id: "CROSSDECK-ORDINARY6-HISTORICAL-VALIDATION-CONTRACT-SUCCESSOR-20261017",
  namespace: "sounding-line-diagnostics/CROSSDECK-ORDINARY6-HISTORICAL-VALIDATION-CONTRACT-SUCCESSOR-20261017",
  slot: "attempt-1",
  repository: ORIGINAL.repository,
  actor: ORIGINAL.actor,
  workflow: ".github/workflows/sounding-line-replay-historical-validation-diagnostic.yml",
  workflowId: 387562208,
  title: "Sounding Line historical validation diagnostic 2 ordinary6",
  previousRun: Object.freeze({
    id: 39026979523,
    workflow_id: 387562208,
    check_suite_id: 105766005817,
    run_attempt: 1,
    event: "workflow_dispatch",
    path: ".github/workflows/sounding-line-replay-historical-validation-diagnostic.yml",
    head_sha: "2442baaf0879afe15b47cc7ad148a81bca311449",
    head_branch: "main",
    display_title: "Sounding Line historical validation diagnostic 1 ordinary6",
    status: "completed",
    conclusion: "failure",
    actor: Object.freeze({ login: ORIGINAL.actor }),
    triggering_actor: Object.freeze({ login: ORIGINAL.actor }),
    repository: Object.freeze({ full_name: ORIGINAL.repository }),
    head_repository: Object.freeze({ full_name: ORIGINAL.repository }),
  }),
  expiry: "2026-10-22T23:59:59Z",
  workerMs: 10 * 60 * 1000,
  originalSourcePolicyDigest: replaySourceDiagnosticPolicyDigest,
  originalCandidate: ORIGINAL.candidate,
  originalBase: ORIGINAL.base,
  originalRun: ORIGINAL.failedRun,
  originalInputDigest: ORIGINAL.memberDigest,
  originalArchiveDigest: ORIGINAL.archiveDigest,
  runtimeFingerprint: CAPS.workload.toolchain.fingerprint,
  originalPlanDigest: CAPS.originalPlanDigest,
  inputVectorDigest: "fac730d19891109de49ab0d293103c6f7a4135d83545e0294513302d57a79a7f",
  inputVectorBytes: 96040,
  inputPaths: 305,
  inputBlobs: 254,
  inputBytes: 555972930,
  uniqueBlobBytes: 545999955,
  evidencePath: "Development_Docs/Testing/Product_Experience/candidate-review.json",
  reviewBytes: 546555,
  evidenceDigest: "42be2f80c309612e752a07a53ca04615fde5d24845b8bf8a7e5cb2c575695ddd",
  pngHeaderVectorDigest: "f0d4df11b9d0e9ed9480b57af031771e85478d6e446f6c4885b86d4694e9120c",
  expectedMaximumPngOutputBytes: 4321000,
  expectedCumulativePngOutputBytes: 642215096,
  originalPerImageInflateLimit: 134217728,
  requiredCommits: Object.freeze(
    [
      ["151417a772c1bcde4e5c7f256302b803d25d40da", "8f2129580356aa5a901e4d4865fa2957d0ddf13c"],
      ["4e365e82fda3f272ca6fc2fec61b599b07746834", "7c9de4fe2001f62e447ec5bd4d9007d1096f7064"],
      ["3415165ed9c4c11f2512d99aea0947f62696146a", "8069deb92f810deeafd9e1afa953abd18f15bc3a"],
    ].map(Object.freeze),
  ),
  evidenceBytes: 256 * 1024 * 1024,
  jsonBytes: 16 * 1024 * 1024,
  logBytes: 16 * 1024 * 1024,
  fileBytes: 64 * 1024 * 1024,
  evidenceFiles: 1024,
  envelopeBytes: 512 * 1024 * 1024,
  keyId: CAPS.evidenceKeyDigest,
});
const P = HISTORICAL_VALIDATION_POLICY;
export const historicalValidationPolicyDigest = hash(JSON.stringify(P));
const publicKey =
  "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAqhR0X1gnk0ll9753ViDR\nia9R8pIDEYZDydLXSaSg9lRNd6kYNdkyeb7Bqt8z/A/MAJP5ngCPUaH0xvq4n+OQ\nXkF0v9XqdD/xkaZX4Cv4xiLyJkTU2lOdMEKI96o9dsHN428BTZ7nbW7sZ5Uh19L7\n8wYIw/mm+A44+3T5Tp0SCcoUcT9HqTZgk3r1CGu33WvNjeqyid22nYVSsPipQga+\ncTpcDQve9MePaFCPsi/KrRrsK2yxkgUwFY20SWu26ZjklAlQ0+isLE06f3MmsH0s\nimq0PLjcRbDG99iCJ/TiwEpZQJNJQT3n1rN7HzSYef0WZFKKkb+vF/vwihOP1AoF\nOwlHPHj3tiy5TR7ZXoqRSYC43NFDRVHp2WP8mDdJT2TInGhrwCuW/l0bpds+p7wQ\nUC2OIfq1p/FivQtp0X+4UDs8YjpSnrhl8cgqz9ipzr72TrB95I60ygrHIAfqKh47\nHKu5BOb2GG1c5KLTH9oJiZ4hsf620/dZ1Y0JjJAYAmmjAgMBAAE=\n-----END PUBLIC KEY-----\n";
const fail = (code) => {
  const error = new Error(code);
  error.historicalCode = code;
  throw error;
};
const requireValue = (condition, code) => {
  if (!condition) fail(code);
};
const failureCodes = new Set(
  "EXECUTOR_CHANGED INSTALLER_CHANGED BINDING_INVALID PROTECTION_INVALID HISTORY_INVALID RESERVATION_INVALID SLOT_CONSUMED WRITE_OUTCOME_UNKNOWN INPUTS_CHANGED SOURCE_CHANGED RUNTIME_CHANGED PRIVATE_FILE_INVALID RAW_EVIDENCE_LOSS WORKER_UNKNOWN ENCRYPTION_FAILED RESULT_INVALID PUBLICATION_FAILED HISTORICAL_VALIDATION_FAILED SOURCE_PREFIX_FAILED CLI_INVALID EXECUTION_UNKNOWN".split(
    " ",
  ),
);
const safeFailure = (error) =>
  failureCodes.has(error?.historicalCode)
    ? error.historicalCode
    : error?.message === "PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED"
      ? "SLOT_CONSUMED"
      : error?.message === "PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_WRITE_OUTCOME_UNKNOWN"
        ? "WRITE_OUTCOME_UNKNOWN"
        : "EXECUTION_UNKNOWN";

function writePrivate(file, value, maximum = P.jsonBytes) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  requireValue(bytes.length <= maximum, "RAW_EVIDENCE_LOSS");
  writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
}
export function historicalPrivatePaths(workspace) {
  const { directory } = posttechnicalPrivatePaths(workspace);
  return {
    directory,
    input: path.join(directory, "worker-input.json"),
    started: path.join(directory, "worker-started.json"),
    result: path.join(directory, "worker-result.original.json"),
  };
}
export function createHistoricalJournal(file, maximumBytes = P.jsonBytes) {
  requireValue(
    Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= P.jsonBytes,
    "RAW_EVIDENCE_LOSS",
  );
  const descriptor = openSync(
      file,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o600,
    ),
    state = { records: 0, bytes: 0, evidenceLoss: false };
  let closed = false;
  return {
    state,
    record(value) {
      try {
        requireValue(!closed && state.records < 128, "RAW_EVIDENCE_LOSS");
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
      } catch {
        state.evidenceLoss = true;
        fail("RAW_EVIDENCE_LOSS");
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        closeSync(descriptor);
      } catch {
        state.evidenceLoss = true;
      }
    },
  };
}
export function validateHistoricalEnvironment(environment, job, now = new Date()) {
  requireValue(
    Number.isFinite(now.getTime()) &&
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
      Number.isSafeInteger(Number(environment.GITHUB_RUN_ID)) &&
      !Object.entries(environment).some(
        ([key, value]) => value && /^(?:HISTORICAL_VALIDATION_|POSTTECHNICAL_|SOUNDING_LINE_)/u.test(key),
      ),
    "EXECUTOR_CHANGED",
  );
  return { runId: Number(environment.GITHUB_RUN_ID), installerSha: environment.GITHUB_SHA };
}
function historicalRunMatches(run, expected) {
  return (
    run &&
    [
      "id",
      "workflow_id",
      "check_suite_id",
      "run_attempt",
      "event",
      "path",
      "head_sha",
      "head_branch",
      "display_title",
      "status",
      "conclusion",
    ].every((field) => run[field] === expected[field]) &&
    run.actor?.login === expected.actor.login &&
    run.triggering_actor?.login === expected.triggering_actor.login &&
    run.repository?.full_name === expected.repository.full_name &&
    run.head_repository?.full_name === expected.head_repository.full_name
  );
}
export async function validateHistoricalExecution({ request, environment, job, installerSha, now }) {
  const identity = validateHistoricalEnvironment(environment, job, now);
  requireValue(identity.installerSha === installerSha, "INSTALLER_CHANGED");
  requireValue(identity.runId !== P.previousRun.id, "HISTORY_INVALID");
  const run = await request(`actions/runs/${identity.runId}`),
    currentRun = {
      ...P.previousRun,
      id: identity.runId,
      check_suite_id: run?.check_suite_id,
      head_sha: installerSha,
      display_title: P.title,
      status: "in_progress",
      conclusion: null,
    };
  requireValue(
    Number.isSafeInteger(run?.check_suite_id) && run.check_suite_id > 0 && historicalRunMatches(run, currentRun),
    "BINDING_INVALID",
  );
  const workflow = await request(`actions/workflows/${P.workflowId}`),
    main = await request("branches/main"),
    pr = await request("pulls/721");
  requireValue(
    workflow?.id === P.workflowId && workflow.path === P.workflow && workflow.state === "active",
    "BINDING_INVALID",
  );
  requireValue(
    main?.name === "main" &&
      main.commit?.sha === installerSha &&
      main.protected === true &&
      main.protection?.required_status_checks?.checks?.some(
        (check) => check.context === "Sounding Line / Mainline Decision" && check.app_id === 15368,
      ),
    "PROTECTION_INVALID",
  );
  requireValue(
    pr?.state === "open" &&
      pr.draft === true &&
      pr.merged === false &&
      pr.head?.sha === ORIGINAL.candidate &&
      pr.head.repo?.full_name === P.repository &&
      pr.base?.ref === "main" &&
      pr.base.sha === ORIGINAL.base &&
      pr.base.repo?.full_name === P.repository,
    "BINDING_INVALID",
  );
  for (const suffix of ["?per_page=100&page=1", "?event=workflow_dispatch&per_page=100&page=1"]) {
    const history = await request(`actions/workflows/${workflow.id}/runs${suffix}`);
    requireValue(
      history?.total_count === 2 &&
        Array.isArray(history.workflow_runs) &&
        history.workflow_runs?.length === 2 &&
        history.workflow_runs.filter((entry) => historicalRunMatches(entry, P.previousRun)).length === 1 &&
        history.workflow_runs.filter((entry) => historicalRunMatches(entry, currentRun)).length === 1,
      "HISTORY_INVALID",
    );
  }
  return { ...identity, workflowId: workflow.id, runAttempt: 1, policyDigest: historicalValidationPolicyDigest };
}
const reservationRecord = { id: P.id, custody: { namespace: P.namespace } };
const reservationBinding = (execution) => ({
  baseSha: execution.installerSha,
  diagnosticId: P.id,
  policyDigest: historicalValidationPolicyDigest,
  runId: execution.runId,
  runAttempt: 1,
  workflowId: execution.workflowId,
  candidate: ORIGINAL.candidate,
  historicalBase: ORIGINAL.base,
  originalRun: ORIGINAL.failedRun,
  originalInputDigest: ORIGINAL.memberDigest,
  inputVectorDigest: P.inputVectorDigest,
});
export async function createHistoricalReservation({ request, execution }) {
  const claim = await exceptionStore({ record: reservationRecord, request }).create(P.slot, {
    binding: reservationBinding(execution),
    diagnosticOnly: true,
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
  });
  requireValue(sha(claim.commitSha), "RESERVATION_INVALID");
  return claim;
}
export async function readHistoricalReservation({ request, execution, reservation }) {
  const claim = await exceptionStore({
    record: reservationRecord,
    request: createReadOnlyDiagnosticRequest(request),
  }).read(P.slot);
  requireValue(
    sha(reservation) &&
      claim?.commitSha === reservation &&
      claim.version === 1 &&
      claim.exceptionId === P.id &&
      same(claim.binding, reservationBinding(execution)) &&
      claim.diagnosticOnly === true &&
      claim.qualification === false &&
      claim.originalCauseClaim === false &&
      claim.grantsConsumerTrial === false,
    "RESERVATION_INVALID",
  );
  return claim;
}
export function historicalWorkerEnvironment(environment, workspace) {
  return {
    ...sourceDiagnosticChildEnvironment(environment),
    GITHUB_WORKSPACE: workspace,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_TERMINAL_PROMPT: "0",
  };
}
function localGit(root, args, input) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
    input,
    timeout: 20000,
    maxBuffer: P.jsonBytes,
    env: {
      ...sourceDiagnosticChildEnvironment(process.env),
      GIT_NO_LAZY_FETCH: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
    },
  });
}
export function historicalInstallerSnapshot(root, installerSha) {
  const installer = posttechnicalSnapshot(root),
    shallow = localGit(root, ["rev-parse", "--is-shallow-repository"]).trim();
  requireValue(installer.status === "" && installer.head === installerSha && shallow === "true", "INSTALLER_CHANGED");
  return installer;
}
export function projectHistoricalInputVector({ evidenceBytes, evidencePath, metadata }) {
  requireValue(
    Buffer.isBuffer(evidenceBytes) && evidenceBytes.length <= P.jsonBytes && evidencePath === P.evidencePath,
    "INPUTS_CHANGED",
  );
  const evidence = JSON.parse(evidenceBytes),
    references = new Map([[evidencePath, P.evidenceDigest]]);
  const add = ({ path: file, sha256 }) => {
    requireValue(
      typeof file === "string" &&
        file.startsWith("Development_Docs/Testing/Product_Experience/") &&
        !file.includes("\\") &&
        !file.includes("\0") &&
        file.split("/").every((part) => part && part !== "." && part !== "..") &&
        typeof sha256 === "string" &&
        /^[a-f0-9]{64}$/u.test(sha256) &&
        (!references.has(file) || references.get(file) === sha256),
      "INPUTS_CHANGED",
    );
    references.set(file, sha256);
  };
  for (const artifact of evidence.artifacts ?? []) add(artifact);
  for (const kind of ["report", "runtime", "profile"]) add(evidence.pairedEvidence?.[kind] ?? {});
  for (const entry of evidence.pairedEvidence?.cases ?? []) add(entry.witness ?? {});
  const rows = [...references.keys()].sort().map((file) => {
    const entry = metadata(file);
    requireValue(
      entry && entry.mode === "100644" && sha(entry.blob) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0,
      "INPUTS_CHANGED",
    );
    return [ORIGINAL.candidate, file, entry.mode, entry.blob, entry.bytes, references.get(file)];
  });
  return Buffer.from(JSON.stringify([1, ORIGINAL.candidate, ORIGINAL.base, ORIGINAL.memberDigest, rows]));
}
export function deriveHistoricalInputVector(input) {
  requireValue(
    input.evidenceBytes.length === P.reviewBytes && hash(input.evidenceBytes) === P.evidenceDigest,
    "INPUTS_CHANGED",
  );
  const bytes = projectHistoricalInputVector(input),
    rows = JSON.parse(bytes)[4];
  requireValue(
    rows.length === P.inputPaths &&
      new Set(rows.map((row) => row[3])).size === P.inputBlobs &&
      rows.reduce((total, row) => total + row[4], 0) === P.inputBytes &&
      bytes.length === P.inputVectorBytes &&
      hash(bytes) === P.inputVectorDigest,
    "INPUTS_CHANGED",
  );
  return bytes;
}
export function bindHistoricalInputs(candidate, originalDecision) {
  const plan = validateOriginalDecision(originalDecision);
  requireValue(
    originalDecision.planDigest === P.originalPlanDigest && plan.evidencePath === P.evidencePath,
    "INPUTS_CHANGED",
  );
  const gitDirectory = path.join(candidate, ".git");
  requireValue(
    !existsSync(path.join(gitDirectory, "objects/info/alternates")) &&
      !existsSync(path.join(gitDirectory, "objects/info/http-alternates")) &&
      !readdirSync(path.join(gitDirectory, "objects/pack")).some((name) => name.endsWith(".promisor")) &&
      !localGit(candidate, ["config", "--local", "--list"])
        .split(/\r?\n/u)
        .some((line) => /^(?:extensions\.partialclone|remote\.[^.]+\.(?:promisor|partialclonefilter))=/iu.test(line)),
    "INPUTS_CHANGED",
  );
  for (const [revision, tree] of P.requiredCommits)
    requireValue(
      localGit(candidate, ["cat-file", "-t", revision]).trim() === "commit" &&
        localGit(candidate, ["rev-parse", `${revision}^{tree}`]).trim() === tree,
      "INPUTS_CHANGED",
    );
  const entries = new Map(
    localGit(candidate, ["ls-tree", "-rlz", ORIGINAL.candidate])
      .split("\0")
      .filter(Boolean)
      .map((entry) => {
        const match = /^(\d+) blob ([a-f0-9]{40})\s+(\d+)\t(.+)$/u.exec(entry);
        return match ? [match[4], { mode: match[1], blob: match[2], bytes: Number(match[3]) }] : [entry, null];
      }),
  );
  const evidenceBytes = Buffer.from(localGit(candidate, ["show", `${ORIGINAL.candidate}:${P.evidencePath}`]));
  const vector = deriveHistoricalInputVector({
      evidenceBytes,
      evidencePath: plan.evidencePath,
      metadata: (file) => entries.get(file),
    }),
    rows = JSON.parse(vector)[4],
    blobs = [...new Map(rows.map((row) => [row[3], row[4]])).entries()];
  const observed = localGit(
    candidate,
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    blobs.map(([blob]) => blob).join("\n") + "\n",
  )
    .trim()
    .split("\n");
  requireValue(
    observed.length === blobs.length &&
      observed.every((line, index) => line === `${blobs[index][0]} blob ${blobs[index][1]}`) &&
      blobs.reduce((total, [, bytes]) => total + bytes, 0) === P.uniqueBlobBytes,
    "INPUTS_CHANGED",
  );
  return vector;
}

function originalFault(error) {
  const fault = {};
  for (const field of ["name", "message", "stack", "code", "errno", "syscall", "status", "signal", "pid", "path"]) {
    const value = error?.[field];
    fault[field] = typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : null;
  }
  const output = (value) => {
    if (!Buffer.isBuffer(value) && typeof value !== "string") return { available: false };
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    requireValue(bytes.length <= P.jsonBytes, "RAW_EVIDENCE_LOSS");
    return { available: true, bytes: bytes.length, sha256: hash(bytes), content: bytes.toString("base64") };
  };
  fault.stdout = output(error?.stdout);
  fault.stderr = output(error?.stderr);
  const spawnargs = error?.spawnargs;
  requireValue(
    spawnargs === undefined ||
      spawnargs === null ||
      (Array.isArray(spawnargs) && spawnargs.every((entry) => typeof entry === "string")),
    "RAW_EVIDENCE_LOSS",
  );
  fault.spawnargs = spawnargs ?? null;
  requireValue(Buffer.byteLength(JSON.stringify(fault)) <= P.jsonBytes, "RAW_EVIDENCE_LOSS");
  return fault;
}
export async function runHistoricalSequence({
  verify,
  prefix,
  phaseJournal,
  gitJournal,
  observe = withPosttechnicalGitExceptionObserver,
}) {
  const result = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: historicalValidationPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    grantsConsumerTrial: false,
    historicalValidationsStarted: 0,
    historicalValidationsCompleted: 0,
    sourcePrefixExecutions: 0,
    dependencyExecutions: 0,
    technicalExecutions: 0,
    browserCaptureCommandLaunches: 0,
    replayCommandLaunches: 0,
    consumerAdmissions: 0,
    actualChromiumLaunches: null,
    phase: "NOT_STARTED",
    historical: null,
    source: null,
    evidenceLoss: false,
  };
  const marker = (event) =>
    phaseJournal.record({
      version: 1,
      phase: result.phase,
      event,
      observedAt: new Date().toISOString(),
      gitThrows: gitJournal.state.observedGitThrows,
    });
  try {
    await observe({
      state: gitJournal.state,
      record: gitJournal.record,
      operation: async () => {
        result.phase = "HISTORICAL_EXPERIENCE";
        marker("STARTED");
        result.historicalValidationsStarted++;
        result.historical = verify();
        result.historicalValidationsCompleted++;
        marker("TERMINAL");
        requireValue(result.historical?.status === "PASS", "HISTORICAL_VALIDATION_FAILED");
        requireValue(!gitJournal.state.evidenceLoss && !phaseJournal.state.evidenceLoss, "RAW_EVIDENCE_LOSS");
        result.phase = "SOURCE_PREFIX";
        marker("STARTED");
        result.sourcePrefixExecutions++;
        result.source = sourceDiagnosticResult(await prefix());
        marker("TERMINAL");
        result.status = result.source.status === "NOT_REPRODUCED" ? "NOT_REPRODUCED" : "NEW_SOURCE_FAILURE";
      },
    });
  } catch (error) {
    result.failure = safeFailure(error);
    result.status =
      result.failure === "RAW_EVIDENCE_LOSS"
        ? "EXECUTION_UNKNOWN"
        : result.phase === "HISTORICAL_EXPERIENCE"
          ? "NEW_HISTORICAL_FAILURE"
          : "EXECUTION_UNKNOWN";
    try {
      result.fault = originalFault(error);
    } catch {
      result.evidenceLoss = true;
    }
    try {
      marker("FAILED");
    } catch {
      result.evidenceLoss = true;
    }
  } finally {
    try {
      gitJournal.close();
    } catch {
      gitJournal.state.evidenceLoss = true;
    }
    try {
      phaseJournal.close();
    } catch {
      phaseJournal.state.evidenceLoss = true;
    }
    result.gitExceptionEvidence = gitJournal.state;
    result.phaseEvidence = phaseJournal.state;
    result.evidenceLoss ||=
      gitJournal.state.evidenceLoss || phaseJournal.state.evidenceLoss || !gitJournal.state.restoreVerified;
    if (result.evidenceLoss) result.status = "EXECUTION_UNKNOWN";
  }
  return result;
}
const workerProgram =
  'import {runHistoricalWorker} from "./scripts/sounding-line/replay-historical-validation-diagnostic.mjs"; try { await runHistoricalWorker(); } catch { process.exitCode=1; }';
export async function superviseHistoricalWorker({
  installer,
  workspace,
  environment,
  paths,
  implementation = { spawnOwnedProcess, stopOwnedProcess, processExit, setTimeout, clearTimeout },
}) {
  const child = implementation.spawnOwnedProcess(process.execPath, ["--input-type=module", "-e", workerProgram], {
    root: installer,
    env: historicalWorkerEnvironment(environment, workspace),
  });
  // Unpipe synchronously, before the guardian can launch any payload output.
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  const streams = ["worker.stdout.log", "worker.stderr.log"].map((name) =>
    createWriteStream(path.join(paths.directory, name), { flags: "wx", mode: 0o600 }),
  );
  const counts = [0, 0],
    saved = [0, 0];
  let exceeded = false,
    timedOut = false,
    ioFailed = false,
    stop;
  const stopUnknown = () => {
    stop ??= implementation.stopOwnedProcess(child);
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
      const remaining = P.logBytes - saved[index];
      if (remaining > 0) {
        const accepted = bytes.subarray(0, remaining);
        saved[index] += accepted.length;
        if (!streams[index].write(accepted)) {
          source.pause();
          streams[index].once("drain", () => source.resume());
        }
      }
      if (counts[index] > P.logBytes) {
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
  const timer = implementation.setTimeout(() => {
    timedOut = true;
    stopUnknown();
  }, P.workerMs);
  timer.unref?.();
  const cancel = () => {
    timedOut = true;
    stopUnknown();
  };
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  let exit, cleanup;
  try {
    exit = await implementation.processExit(child);
  } catch {
    ioFailed = true;
  } finally {
    try {
      cleanup = await (stop ?? implementation.stopOwnedProcess(child));
    } catch {
      cleanup = { status: "FAIL", treeReaped: false, streamsClosed: false };
    }
    await Promise.all(completedStreams);
    implementation.clearTimeout(timer);
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
  let result = null,
    resultInvalid = false;
  try {
    result = readPosttechnicalPrivate(paths.result, P.jsonBytes);
    validateHistoricalWorkerResult(result);
    if (exit?.code !== (result.status === "NOT_REPRODUCED" ? 0 : 1)) ioFailed = true;
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
export const HISTORICAL_EVIDENCE_MEMBERS = Object.freeze([
  "original/ordinary6.original.zip",
  "original/ordinary-decision.original.json",
  "private/historical-inputs.original.json",
  "private/worker.stdout.log",
  "private/worker.stderr.log",
  "private/worker-result.original.json",
  "private/phase-observations.original.jsonl",
  "private/git-exceptions.original.jsonl",
  "private/fault.original.json",
  "private/controller.original.json",
  "private/checkout-postconditions.original.json",
  "private/runtime.original.json",
  "private/control-reads.original.jsonl",
]);
export function collectHistoricalEvidence({ workspace, maximumBytes = P.evidenceBytes }) {
  requireValue(
    Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= P.evidenceBytes,
    "RAW_EVIDENCE_LOSS",
  );
  historicalPrivatePaths(workspace);
  const members = [];
  let total = 0;
  for (const name of HISTORICAL_EVIDENCE_MEMBERS) {
    const file = path.join(workspace, name.startsWith("original/") ? "receipts/" + name.slice(9) : name);
    if (!existsSync(file)) {
      try {
        lstatSync(file);
        fail("PRIVATE_FILE_INVALID");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      continue;
    }
    const maximum = Math.min(maximumBytes - total, /\.(?:json|jsonl|log)$/u.test(name) ? P.jsonBytes : P.fileBytes);
    requireValue(members.length < P.evidenceFiles && maximum >= 0, "RAW_EVIDENCE_LOSS");
    const bytes = securePosttechnicalRead({ file, root: workspace, maximum });
    total += bytes.length;
    members.push({ name, bytes });
  }
  return { members, total };
}
export function historicalEvidenceContext(execution) {
  requireValue(
    execution && Number.isSafeInteger(execution.runId) && execution.runId > 0 && sha(execution.installerSha),
    "BINDING_INVALID",
  );
  return {
    version: 1,
    diagnosticId: P.id,
    repository: P.repository,
    runAttempt: 1,
    job: "historical-validation-diagnostic",
    originalRun: ORIGINAL.failedRun,
    originalInputDigest: ORIGINAL.memberDigest,
    originalArchiveDigest: ORIGINAL.archiveDigest,
    originalPlanDigest: P.originalPlanDigest,
    inputVectorDigest: P.inputVectorDigest,
    runId: execution.runId,
    policyDigest: historicalValidationPolicyDigest,
    keyId: P.keyId,
    installer: execution.installerSha,
    candidate: ORIGINAL.candidate,
    historicalBase: ORIGINAL.base,
  };
}
function encryptHistoricalEvidence({ workspace, execution, output }) {
  requireValue(hash(publicKey) === P.keyId, "ENCRYPTION_FAILED");
  const { members, total } = collectHistoricalEvidence({ workspace }),
    envelope = sealPosttechnicalEvidence({
      files: members,
      inventory: [],
      publicKey,
      aad: historicalEvidenceContext(execution),
    });
  requireValue(envelope.length <= P.envelopeBytes, "ENCRYPTION_FAILED");
  writeFileSync(output, envelope, { flag: "wx", mode: 0o600 });
  return {
    format: "VW-POSTTECHNICAL-EVIDENCE-1",
    keyId: P.keyId,
    ciphertextDigest: hash(envelope),
    ciphertextBytes: envelope.length,
    memberCount: members.length,
    rawBytes: total,
  };
}
const statuses = new Set([
  "EXECUTION_UNKNOWN",
  "DIAGNOSTIC_RESERVED",
  "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE",
  "NEW_HISTORICAL_FAILURE",
  "NEW_SOURCE_FAILURE",
  "NOT_REPRODUCED",
]);
const phases = new Set(["NOT_STARTED", "HISTORICAL_EXPERIENCE", "SOURCE_PREFIX"]);
const milestones = new Set([
  "SOURCE_RECOGNITION",
  "PLAN_INPUT",
  "REGISTRY_READ",
  "CAMPAIGN_RELATION",
  "HEAD_CHECK",
  "PLAN_REBUILD",
  "PLAN_COMPARE",
  "HISTORICAL_PREPARE",
]);
export function validateHistoricalWorkerResult(result) {
  requireValue(
    result &&
      result.version === 1 &&
      result.diagnosticId === P.id &&
      result.policyDigest === historicalValidationPolicyDigest &&
      ["EXECUTION_UNKNOWN", "NEW_HISTORICAL_FAILURE", "NEW_SOURCE_FAILURE", "NOT_REPRODUCED"].includes(result.status) &&
      result.completeness === "DIAGNOSTIC_INCOMPLETE" &&
      result.originalCauseClaim === false &&
      result.qualification === false &&
      result.grantsConsumerTrial === false &&
      [0, 1].includes(result.historicalValidationsStarted) &&
      [0, 1].includes(result.historicalValidationsCompleted) &&
      result.historicalValidationsCompleted <= result.historicalValidationsStarted &&
      [0, 1].includes(result.sourcePrefixExecutions) &&
      phases.has(result.phase) &&
      typeof result.evidenceLoss === "boolean",
    "RESULT_INVALID",
  );
  if (result.source) sourceDiagnosticResult(result.source);
  if (result.status !== "EXECUTION_UNKNOWN")
    requireValue(
      !result.evidenceLoss &&
        result.gitExceptionEvidence?.restoreVerified === true &&
        result.gitExceptionEvidence.evidenceLoss === false &&
        result.phaseEvidence?.evidenceLoss === false,
      "RESULT_INVALID",
    );
  requireValue(
    result.sourcePrefixExecutions === 0 ||
      (result.historicalValidationsStarted === 1 &&
        result.historicalValidationsCompleted === 1 &&
        result.historical?.status === "PASS"),
    "RESULT_INVALID",
  );
  requireValue(
    result.status !== "NOT_REPRODUCED" ||
      (!result.evidenceLoss &&
        result.phase === "SOURCE_PREFIX" &&
        !result.fault &&
        !result.failure &&
        result.historicalValidationsStarted === 1 &&
        result.historicalValidationsCompleted === 1 &&
        result.sourcePrefixExecutions === 1 &&
        result.source?.status === "NOT_REPRODUCED"),
    "RESULT_INVALID",
  );
  requireValue(
    result.status !== "NEW_HISTORICAL_FAILURE" ||
      (result.phase === "HISTORICAL_EXPERIENCE" &&
        result.historicalValidationsStarted === 1 &&
        result.sourcePrefixExecutions === 0),
    "RESULT_INVALID",
  );
  requireValue(
    result.status !== "NEW_SOURCE_FAILURE" ||
      (result.phase === "SOURCE_PREFIX" &&
        result.sourcePrefixExecutions === 1 &&
        ["SOURCE_OPERATION_FAILURE_REPRODUCED", "SOURCE_RECONSTRUCTION_FAILURE"].includes(result.source?.status)),
    "RESULT_INVALID",
  );
  return result;
}
export function historicalPublicSummary(result) {
  const summary = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: historicalValidationPolicyDigest,
    status: statuses.has(result.status) ? result.status : "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    qualification: false,
    originalCauseClaim: false,
    grantsConsumerTrial: false,
    originalRun: ORIGINAL.failedRun,
    inputVectorDigest: P.inputVectorDigest,
    nextAction: "STOP_CAUSE_REVIEW_REQUIRED",
    workerStarted: result.workerStarted === true,
    ...historicalExecutionCounts(result),
  };
  if (result.execution)
    summary.execution = {
      runId: result.execution.runId,
      installerSha: result.execution.installerSha,
      workflowId: result.execution.workflowId,
      runAttempt: 1,
    };
  if (sha(result.reservation)) summary.reservation = result.reservation;
  if (result.failure) summary.failure = failureCodes.has(result.failure) ? result.failure : "EXECUTION_UNKNOWN";
  if (result.worker) {
    const worker = result.worker;
    summary.worker = {
      exitCode: Number.isInteger(worker.exitCode) && worker.exitCode >= 0 ? worker.exitCode : null,
      closureProven: worker.closureProven === true,
      incomplete: worker.incomplete === true,
      timedOut: worker.timedOut === true,
      logTruncated: worker.logTruncated === true,
      ioFailed: worker.ioFailed === true,
      resultInvalid: worker.resultInvalid === true,
      cleanup: {
        status: worker.closureProven === true ? "PASS" : "FAIL",
        treeReaped: worker.cleanup?.treeReaped === true,
        streamsClosed: worker.cleanup?.streamsClosed === true,
      },
    };
    try {
      const value = validateHistoricalWorkerResult(worker.result);
      summary.worker.result = {
        status: value.status,
        phase: value.phase,
        historicalValidationsStarted: value.historicalValidationsStarted,
        historicalValidationsCompleted: value.historicalValidationsCompleted,
        sourcePrefixExecutions: value.sourcePrefixExecutions,
        evidenceLoss: value.evidenceLoss,
        milestones: value.source?.milestones ?? [],
        historicalStatus: value.historical?.status === "PASS" ? "PASS" : "UNKNOWN",
        sourceStatus: value.source?.status ?? "NOT_STARTED",
        observedGitThrows: value.gitExceptionEvidence?.observedGitThrows ?? 0,
      };
      if (value.failure)
        summary.worker.result.failure = failureCodes.has(value.failure) ? value.failure : "EXECUTION_UNKNOWN";
      if (value.fault) summary.worker.result.faultDigest = hash(JSON.stringify(value.fault));
      if (value.source?.observation)
        summary.worker.result.sourceObservationDigest = hash(JSON.stringify(value.source.observation));
    } catch {
      summary.status = "EXECUTION_UNKNOWN";
      summary.failure = "RESULT_INVALID";
      summary.worker.incomplete = true;
    }
  }
  if (result.encryptedEvidence) summary.encryptedEvidence = { ...result.encryptedEvidence };
  return validateHistoricalPublicSummary(summary);
}
function historicalExecutionCounts(result) {
  let worker;
  try {
    worker = validateHistoricalWorkerResult(result.worker?.result);
  } catch {}
  const count = (name) => (!result.workerStarted ? 0 : (worker?.[name] ?? null));
  return {
    historicalValidationsStarted: count("historicalValidationsStarted"),
    historicalValidationsCompleted: count("historicalValidationsCompleted"),
    sourcePrefixExecutions: count("sourcePrefixExecutions"),
    dependencyExecutions: 0,
    technicalExecutions: 0,
    browserCaptureCommandLaunches: 0,
    replayCommandLaunches: 0,
    consumerAdmissions: 0,
    actualChromiumLaunches: null,
  };
}
const publicKeys = new Set(
  "version diagnosticId policyDigest status completeness qualification originalCauseClaim grantsConsumerTrial originalRun inputVectorDigest nextAction workerStarted execution runId installerSha workflowId runAttempt reservation failure worker exitCode closureProven incomplete timedOut logTruncated ioFailed resultInvalid cleanup treeReaped streamsClosed result phase historicalValidationsStarted historicalValidationsCompleted sourcePrefixExecutions dependencyExecutions technicalExecutions browserCaptureCommandLaunches replayCommandLaunches consumerAdmissions actualChromiumLaunches evidenceLoss milestones historicalStatus sourceStatus observedGitThrows faultDigest sourceObservationDigest encryptedEvidence format keyId ciphertextDigest ciphertextBytes memberCount rawBytes".split(
    " ",
  ),
);
const publicStrings = new Set([
  ...statuses,
  ...phases,
  ...milestones,
  ...failureCodes,
  P.id,
  "DIAGNOSTIC_INCOMPLETE",
  "STOP_CAUSE_REVIEW_REQUIRED",
  "PASS",
  "FAIL",
  "UNKNOWN",
  "NOT_STARTED",
  "SOURCE_OPERATION_FAILURE_REPRODUCED",
  "SOURCE_RECONSTRUCTION_FAILURE",
  "VW-POSTTECHNICAL-EVIDENCE-1",
]);
export function validateHistoricalPublicSummary(summary) {
  requireValue(
    summary?.version === 1 &&
      summary.diagnosticId === P.id &&
      summary.policyDigest === historicalValidationPolicyDigest &&
      statuses.has(summary.status) &&
      summary.completeness === "DIAGNOSTIC_INCOMPLETE" &&
      summary.qualification === false &&
      summary.originalCauseClaim === false &&
      summary.grantsConsumerTrial === false &&
      summary.nextAction === "STOP_CAUSE_REVIEW_REQUIRED",
    "RESULT_INVALID",
  );
  const walk = (value, depth = 0) => {
    requireValue(depth <= 12, "RESULT_INVALID");
    if (value === null || typeof value === "boolean") return;
    if (typeof value === "number") {
      requireValue(Number.isFinite(value) && value >= 0, "RESULT_INVALID");
      return;
    }
    if (typeof value === "string") {
      requireValue(publicStrings.has(value) || /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value), "RESULT_INVALID");
      return;
    }
    if (Array.isArray(value)) {
      requireValue(value.length <= 16, "RESULT_INVALID");
      value.forEach((entry) => walk(entry, depth + 1));
      return;
    }
    requireValue(value && typeof value === "object", "RESULT_INVALID");
    for (const [key, entry] of Object.entries(value)) {
      requireValue(publicKeys.has(key), "RESULT_INVALID");
      walk(entry, depth + 1);
    }
  };
  walk(summary);
  requireValue(Buffer.byteLength(JSON.stringify(summary)) <= 65536, "RESULT_INVALID");
  return summary;
}
export function assertHistoricalPublication({ summary, summaryFile, encryptedFile, outputFile }) {
  validateHistoricalPublicSummary(summary);
  requireValue(
    path.basename(summaryFile) === "reproduction.json" &&
      path.basename(encryptedFile) === "private-evidence.encrypted" &&
      path.dirname(summaryFile) === path.dirname(encryptedFile),
    "PUBLICATION_FAILED",
  );
  requireValue(
    !summary.workerStarted ||
      (summary.worker?.closureProven === true &&
        summary.worker.cleanup?.treeReaped === true &&
        summary.worker.cleanup.streamsClosed === true),
    "PUBLICATION_FAILED",
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
  securePosttechnicalRead({ file: outputFile, root: path.dirname(outputFile), maximum: 65536 });
  const summaryBytes = securePosttechnicalRead({ file: summaryFile, root: path.dirname(summaryFile), maximum: 65536 }),
    encrypted = securePosttechnicalRead({
      file: encryptedFile,
      root: path.dirname(encryptedFile),
      maximum: P.envelopeBytes,
    }),
    metadata = summary.encryptedEvidence;
  requireValue(
    same(JSON.parse(summaryBytes), summary) &&
      metadata?.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      metadata.keyId === P.keyId &&
      Number.isSafeInteger(metadata.memberCount) &&
      metadata.memberCount >= 0 &&
      metadata.memberCount <= HISTORICAL_EVIDENCE_MEMBERS.length &&
      Number.isSafeInteger(metadata.rawBytes) &&
      metadata.rawBytes >= 0 &&
      metadata.rawBytes <= P.evidenceBytes &&
      metadata.ciphertextBytes === encrypted.length &&
      metadata.ciphertextDigest === hash(encrypted),
    "PUBLICATION_FAILED",
  );
  const envelope = JSON.parse(encrypted),
    aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad),
    expected = historicalEvidenceContext(summary.execution);
  requireValue(
    Buffer.from(JSON.stringify(envelope)).equals(encrypted) &&
      aad.length <= 8192 &&
      Buffer.from(JSON.stringify(header)).equals(aad) &&
      Object.entries(expected).every(([key, value]) => header[key] === value) &&
      Object.keys(header).length === Object.keys(expected).length + 5 &&
      envelope.format === "VW-POSTTECHNICAL-EVIDENCE-1" &&
      header.format === envelope.format &&
      header.algorithms?.content === "AES-256-GCM" &&
      header.algorithms?.keyWrap === "RSA-OAEP-SHA256" &&
      Buffer.from(header.nonce, "base64").length === 12 &&
      Buffer.from(header.wrappedKey, "base64").length === 384 &&
      Buffer.from(envelope.tag, "base64").length === 16 &&
      Number.isSafeInteger(header.plaintextBytes) &&
      header.plaintextBytes > 0 &&
      header.plaintextBytes === Buffer.from(envelope.ciphertext, "base64").length &&
      header.plaintextBytes <= P.envelopeBytes,
    "PUBLICATION_FAILED",
  );
  appendFileSync(outputFile, "evidence_safe=true\n");
  return true;
}
export async function runHistoricalDiagnostic({ mode, paths, reservation, environment = process.env }) {
  process.umask(0o077);
  const owned = validateDiagnosticPaths({ ...paths, mode }),
    result = { status: "EXECUTION_UNKNOWN", workerStarted: false };
  let privatePaths,
    reads,
    baseline,
    execution,
    success = false;
  try {
    validateHistoricalEnvironment(
      environment,
      mode === "reserve" ? "reserve-diagnostic" : "historical-validation-diagnostic",
    );
    const installer = historicalInstallerSnapshot(owned.installer, environment.GITHUB_SHA);
    mkdirSync(path.join(paths.workspace, "private"), { mode: 0o700 });
    privatePaths = historicalPrivatePaths(paths.workspace);
    reads = createHistoricalJournal(path.join(privatePaths.directory, "control-reads.original.jsonl"));
    const token = environment.GH_TOKEN ?? environment.GITHUB_TOKEN,
      request = createCustodyRequest({
        repository: P.repository,
        token,
        report: () => {},
        fetchImpl: async (url, options) => {
          const response = await globalThis.fetch(url, options),
            bytes = await readBoundedDiagnosticBody(response, P.jsonBytes);
          reads.record({
            version: 1,
            method: options.method,
            endpoint: new URL(url).pathname + new URL(url).search,
            status: response.status,
            bytes: bytes.length,
            sha256: hash(bytes),
            content: bytes.toString("base64"),
          });
          return { status: response.status, ok: response.ok, json: async () => JSON.parse(bytes) };
        },
      });
    execution = await validateHistoricalExecution({
      request: createReadOnlyDiagnosticRequest(request),
      environment,
      job: mode === "reserve" ? "reserve-diagnostic" : "historical-validation-diagnostic",
      installerSha: installer.head,
    });
    result.execution = execution;
    if (mode === "reserve") {
      const file = environment.GITHUB_OUTPUT;
      requireValue(typeof file === "string" && path.isAbsolute(file), "PRIVATE_FILE_INVALID");
      securePosttechnicalRead({ file, root: path.dirname(file), maximum: 65536 });
      const claim = await createHistoricalReservation({ request, execution });
      result.reservation = claim.commitSha;
      reads.close();
      requireValue(!reads.state.evidenceLoss, "RAW_EVIDENCE_LOSS");
      result.status = "DIAGNOSTIC_RESERVED";
      appendFileSync(file, `reservation=${claim.commitSha}\n`);
      success = true;
    } else {
      const claim = await readHistoricalReservation({ request, execution, reservation });
      result.reservation = claim.commitSha;
      await loadOriginalDecision({
        request: createReadOnlyDiagnosticRequest(request),
        token,
        directory: owned.receipts,
      });
      baseline = installHistoricalOverlay({ ...owned, installerSha: execution.installerSha });
      const original = JSON.parse(
          securePosttechnicalRead({
            file: path.join(owned.receipts, "ordinary-decision.original.json"),
            root: paths.workspace,
            maximum: P.jsonBytes,
          }),
        ),
        vector = bindHistoricalInputs(owned.candidate, original);
      writeFileSync(path.join(privatePaths.directory, "historical-inputs.original.json"), vector, {
        flag: "wx",
        mode: 0o600,
      });
      const fresh = await validateHistoricalExecution({
        request: createReadOnlyDiagnosticRequest(request),
        environment,
        job: "historical-validation-diagnostic",
        installerSha: execution.installerSha,
      });
      requireValue(same(fresh, execution), "BINDING_INVALID");
      await readHistoricalReservation({ request, execution, reservation });
      verifyHistoricalOverlay({ ...owned, installerSha: execution.installerSha, baseline });
      reads.close();
      requireValue(!reads.state.evidenceLoss, "RAW_EVIDENCE_LOSS");
      writePosttechnicalPrivate(privatePaths.input, {
        version: 1,
        policyDigest: historicalValidationPolicyDigest,
        workspace: paths.workspace,
        installer: owned.installer,
        authority: owned.authority,
        candidate: owned.candidate,
        member: path.join(owned.receipts, "ordinary-decision.original.json"),
        execution,
        reservation,
        baseline,
      });
      result.workerStarted = true;
      result.worker = await superviseHistoricalWorker({
        installer: owned.installer,
        workspace: paths.workspace,
        environment,
        paths: privatePaths,
      });
      result.status =
        result.worker.incomplete || (result.worker.exitCode !== 0 && result.worker.result?.status === "NOT_REPRODUCED")
          ? "EXECUTION_UNKNOWN"
          : (result.worker.result?.status ?? "EXECUTION_UNKNOWN");
      if (result.worker.incomplete) result.failure = "WORKER_UNKNOWN";
      success =
        !result.worker.incomplete &&
        ["NOT_REPRODUCED", "NEW_HISTORICAL_FAILURE", "NEW_SOURCE_FAILURE"].includes(result.status);
    }
  } catch (error) {
    result.failure = safeFailure(error);
    result.status = result.workerStarted ? "EXECUTION_UNKNOWN" : "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE";
    if (privatePaths) {
      try {
        if (!existsSync(path.join(privatePaths.directory, "fault.original.json")))
          writePrivate(path.join(privatePaths.directory, "fault.original.json"), originalFault(error));
      } catch {
        result.failure = "RAW_EVIDENCE_LOSS";
      }
    }
  } finally {
    reads?.close();
    if (reads?.state.evidenceLoss) {
      result.status = "EXECUTION_UNKNOWN";
      result.failure ??= "RAW_EVIDENCE_LOSS";
      success = false;
    }
    if (baseline) {
      try {
        writePrivate(
          path.join(privatePaths.directory, "checkout-postconditions.original.json"),
          verifyHistoricalOverlay({ ...owned, installerSha: execution.installerSha, baseline }),
        );
      } catch {
        result.status = "EXECUTION_UNKNOWN";
        result.failure = "SOURCE_CHANGED";
        success = false;
      }
    }
    if (privatePaths && mode === "diagnose") {
      try {
        Object.assign(result, historicalExecutionCounts(result));
        writePrivate(path.join(privatePaths.directory, "controller.original.json"), result);
        result.encryptedEvidence = encryptHistoricalEvidence({
          workspace: paths.workspace,
          execution,
          output: path.join(owned.receipts, "private-evidence.encrypted"),
        });
      } catch {
        result.status = "EXECUTION_UNKNOWN";
        result.failure = "ENCRYPTION_FAILED";
        success = false;
      }
    }
    let summary;
    try {
      summary = historicalPublicSummary(result);
    } catch {
      summary = historicalPublicSummary({
        status: "EXECUTION_UNKNOWN",
        failure: "RESULT_INVALID",
        workerStarted: result.workerStarted,
        execution: result.execution,
        reservation: result.reservation,
        ...(result.worker
          ? { worker: { closureProven: result.worker.closureProven, cleanup: result.worker.cleanup, incomplete: true } }
          : {}),
        encryptedEvidence: result.encryptedEvidence,
      });
      success = false;
    }
    writePrivate(owned.output, summary, 65536);
    if (mode === "diagnose" && summary.encryptedEvidence && (!summary.workerStarted || summary.worker?.closureProven)) {
      try {
        assertHistoricalPublication({
          summary,
          summaryFile: owned.output,
          encryptedFile: path.join(owned.receipts, "private-evidence.encrypted"),
          outputFile: environment.GITHUB_OUTPUT,
        });
      } catch {
        success = false;
      }
    }
    process.stdout.write(
      JSON.stringify({
        diagnosticId: P.id,
        status: summary.status,
        qualification: false,
        originalCauseClaim: false,
        grantsConsumerTrial: false,
      }) + "\n",
    );
    if (!success) process.exitCode = 1;
  }
  return result;
}
export function historicalDiagnosticCli(argv, environment = process.env) {
  const mode = argv[0],
    keys =
      mode === "reserve"
        ? ["--installer", "--output"]
        : mode === "diagnose"
          ? ["--installer", "--authority", "--candidate", "--reservation", "--output"]
          : [];
  requireValue(keys.length && argv.length === keys.length * 2 + 1, "CLI_INVALID");
  const values = {};
  keys.forEach((key, index) => {
    requireValue(argv[index * 2 + 1] === key && typeof argv[index * 2 + 2] === "string", "CLI_INVALID");
    values[key.slice(2)] = argv[index * 2 + 2];
  });
  const { reservation, ...paths } = values;
  return { mode, reservation, paths: { ...paths, workspace: environment.GITHUB_WORKSPACE } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runHistoricalDiagnostic(historicalDiagnosticCli(process.argv.slice(2)));
  } catch {
    process.stdout.write(
      JSON.stringify({
        status: "EXECUTION_UNKNOWN",
        qualification: false,
        originalCauseClaim: false,
        grantsConsumerTrial: false,
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
export async function runHistoricalWorker() {
  try {
    return await executeHistoricalWorker();
  } catch (error) {
    process.exitCode = 1;
    try {
      const paths = historicalPrivatePaths(process.env.GITHUB_WORKSPACE),
        fault = originalFault(error);
      if (!existsSync(path.join(paths.directory, "fault.original.json")))
        writePrivate(path.join(paths.directory, "fault.original.json"), fault);
      if (!existsSync(paths.result))
        writePrivate(paths.result, {
          version: 1,
          diagnosticId: P.id,
          policyDigest: historicalValidationPolicyDigest,
          status: "EXECUTION_UNKNOWN",
          qualification: false,
          originalCauseClaim: false,
          grantsConsumerTrial: false,
          failure: safeFailure(error),
          evidenceLoss: true,
          fault,
        });
    } catch {}
    throw error;
  }
}
export function publishHistoricalWorkerResult({ paths, result }) {
  // Preserve the authoritative observed result before any optional fault mirror.
  try {
    writePrivate(paths.result, result);
  } catch (error) {
    if (result.fault) {
      try {
        writePrivate(path.join(paths.directory, "fault.original.json"), result.fault);
      } catch {}
    }
    throw error;
  }
  if (result.fault) {
    try {
      writePrivate(path.join(paths.directory, "fault.original.json"), result.fault);
    } catch {
      return { retentionFailed: true, exitCode: 2 };
    }
  }
  return { retentionFailed: false, exitCode: result.status === "NOT_REPRODUCED" ? 0 : 1 };
}
async function executeHistoricalWorker() {
  process.umask(0o077);
  const workspace = process.env.GITHUB_WORKSPACE,
    paths = historicalPrivatePaths(workspace),
    input = readPosttechnicalPrivate(paths.input);
  validateHistoricalEnvironment(process.env, "historical-validation-diagnostic");
  requireValue(
    input.version === 1 &&
      input.policyDigest === historicalValidationPolicyDigest &&
      input.workspace === workspace &&
      input.installer === path.join(workspace, "installer") &&
      input.authority === path.join(workspace, "authority") &&
      input.candidate === path.join(workspace, "candidate") &&
      input.member === path.join(workspace, "receipts/ordinary-decision.original.json") &&
      input.execution?.runId === Number(process.env.GITHUB_RUN_ID) &&
      input.execution.installerSha === process.env.GITHUB_SHA &&
      sha(input.reservation) &&
      !Object.keys(process.env).some((key) =>
        /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_|POSTTECHNICAL_|HISTORICAL_VALIDATION_|NODE_OPTIONS)/u.test(key),
      ),
    "BINDING_INVALID",
  );
  const runtime = posttechnicalRuntime();
  assertPosttechnicalRuntime(runtime);
  writePosttechnicalPrivate(paths.started, {
    version: 1,
    diagnosticId: P.id,
    policyDigest: historicalValidationPolicyDigest,
    runId: input.execution.runId,
    coordinatorPid: process.pid,
  });
  const bytes = securePosttechnicalRead({ file: input.member, root: workspace, maximum: P.jsonBytes });
  requireValue(bytes.length === ORIGINAL.memberBytes && hash(bytes) === ORIGINAL.memberDigest, "INPUTS_CHANGED");
  const original = JSON.parse(bytes),
    plan = validateOriginalDecision(original),
    vector = securePosttechnicalRead({
      file: path.join(paths.directory, "historical-inputs.original.json"),
      root: workspace,
      maximum: P.jsonBytes,
    });
  requireValue(
    original.planDigest === P.originalPlanDigest &&
      vector.length === P.inputVectorBytes &&
      hash(vector) === P.inputVectorDigest,
    "INPUTS_CHANGED",
  );
  verifyHistoricalOverlay({ ...input, installerSha: input.execution.installerSha, baseline: input.baseline });
  globalThis.fetch = () => fail("EXECUTOR_CHANGED");
  await import(pathToFileURL(path.join(input.authority, "scripts/sounding-line/ordinary.mjs")));
  const [experience] = await Promise.all(
    [
      "product-experience.mjs",
      "experience-exception.mjs",
      "verification-diagnostics.mjs",
      "source-diagnostics.mjs",
    ].map((name) => import(pathToFileURL(path.join(input.authority, "scripts/sounding-line", name)))),
  );
  writePrivate(path.join(paths.directory, "runtime.original.json"), {
    runtime,
    coordinatorPid: process.pid,
    workerMs: P.workerMs,
    pngHeaderVectorDigest: P.pngHeaderVectorDigest,
    expectedMaximumPngOutputBytes: P.expectedMaximumPngOutputBytes,
    expectedCumulativePngOutputBytes: P.expectedCumulativePngOutputBytes,
    hardRssBoundClaim: false,
    originalPerImageInflateLimit: P.originalPerImageInflateLimit,
    dependencyExecutions: 0,
    technicalExecutions: 0,
    browserExecutions: 0,
  });
  const phaseJournal = createHistoricalJournal(path.join(paths.directory, "phase-observations.original.jsonl"));
  let gitJournal;
  try {
    gitJournal = createPosttechnicalGitExceptionLog(paths.directory);
  } catch (error) {
    phaseJournal.close();
    throw error;
  }
  const result = await runHistoricalSequence({
    verify: () => experience.verifyProductExperience(input.candidate, ORIGINAL.candidate, plan),
    prefix: () =>
      runSourcePrefixChild({
        workspace,
        installer: input.installer,
        authority: input.authority,
        candidate: input.candidate,
        member: input.member,
      }),
    phaseJournal,
    gitJournal,
  });
  result.coordinatorPid = process.pid;
  const publication = publishHistoricalWorkerResult({ paths, result });
  if (publication.exitCode !== 0) process.exitCode = publication.exitCode;
  return result;
}
