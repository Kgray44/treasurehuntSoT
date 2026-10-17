import assert from "node:assert/strict";
import { constants, createDecipheriv, createHash, generateKeyPairSync, privateDecrypt } from "node:crypto";
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  HISTORICAL_VALIDATION_POLICY as P,
  HISTORICAL_EVIDENCE_MEMBERS,
  assertHistoricalPublication,
  collectHistoricalEvidence,
  createHistoricalJournal,
  createHistoricalReservation,
  deriveHistoricalInputVector,
  historicalEvidenceContext,
  historicalPrivatePaths,
  historicalPublicSummary,
  historicalValidationPolicyDigest,
  historicalWorkerEnvironment,
  projectHistoricalInputVector,
  publishHistoricalWorkerResult,
  readHistoricalReservation,
  runHistoricalSequence,
  superviseHistoricalWorker,
  validateHistoricalEnvironment,
  validateHistoricalExecution,
  validateHistoricalPublicSummary,
  validateHistoricalWorkerResult,
} from "../../scripts/sounding-line/replay-historical-validation-diagnostic.mjs";
import { REPLAY_SOURCE_DIAGNOSTIC_POLICY as ORIGINAL } from "../../scripts/sounding-line/replay-admission-source-diagnostic.mjs";
import {
  createPosttechnicalGitExceptionLog,
  sealPosttechnicalEvidence,
  withPosttechnicalGitExceptionObserver,
} from "../../scripts/sounding-line/replay-posttechnical-diagnostic.mjs";

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const now = () => new Date("2026-10-17T12:00:00Z");
const execution = { runId: 123456, workflowId: 55, installerSha: "a".repeat(40), runAttempt: 1 };
const clone = (value) => structuredClone(value);

function fixture(t) {
  const workspace = mkdtempSync(path.join(tmpdir(), "historical-validation-synthetic-"));
  mkdirSync(path.join(workspace, "private"), { mode: 0o700 });
  mkdirSync(path.join(workspace, "receipts"), { mode: 0o700 });
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  return workspace;
}
function put(workspace, name, bytes) {
  const file = path.join(workspace, name);
  writeFileSync(file, bytes, { mode: 0o600 });
  return file;
}
function sourcePass() {
  return {
    status: "NOT_REPRODUCED",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    productExecutions: 0,
    consumerAdmissions: 0,
    networkRequests: 0,
    milestones: [
      "SOURCE_RECOGNITION",
      "PLAN_INPUT",
      "REGISTRY_READ",
      "CAMPAIGN_RELATION",
      "HEAD_CHECK",
      "PLAN_REBUILD",
      "PLAN_COMPARE",
      "REGISTRY_READ",
      "HISTORICAL_PREPARE",
    ],
  };
}
function workerResult(overrides = {}) {
  return {
    version: 1,
    diagnosticId: P.id,
    policyDigest: historicalValidationPolicyDigest,
    status: "NOT_REPRODUCED",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    grantsConsumerTrial: false,
    historicalValidationsStarted: 1,
    historicalValidationsCompleted: 1,
    sourcePrefixExecutions: 1,
    dependencyExecutions: 0,
    technicalExecutions: 0,
    browserCaptureCommandLaunches: 0,
    replayCommandLaunches: 0,
    consumerAdmissions: 0,
    actualChromiumLaunches: null,
    phase: "SOURCE_PREFIX",
    historical: { status: "PASS" },
    source: sourcePass(),
    evidenceLoss: false,
    gitExceptionEvidence: { restoreVerified: true, evidenceLoss: false, observedGitThrows: 0, records: 0, bytes: 0 },
    phaseEvidence: { evidenceLoss: false, records: 4, bytes: 0 },
    ...overrides,
  };
}
function journals(workspace, options) {
  return {
    phaseJournal: createHistoricalJournal(path.join(workspace, "private/phase-observations.original.jsonl")),
    gitJournal: createPosttechnicalGitExceptionLog(path.join(workspace, "private"), options),
  };
}
function observer(implementation, synchronize = () => {}) {
  return (options) => withPosttechnicalGitExceptionObserver({ ...options, implementation, synchronize });
}
const records = (file) => readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);

test("historical sequence calls validation once before the same-process prefix and attributes Git throw ranges", async (t) => {
  const workspace = fixture(t),
    lifecycle = [],
    pid = process.pid;
  const implementation = {
    execFileSync() {
      throw Object.assign(new Error("PRIVATE_GIT_FAILURE"), { status: 1 });
    },
  };
  const original = implementation.execFileSync;
  const recover = () => {
    assert.throws(
      () => implementation.execFileSync("git", ["show", "synthetic"], { cwd: "/PRIVATE_PATH" }),
      /PRIVATE_GIT_FAILURE/u,
    );
  };
  const result = await runHistoricalSequence({
    ...journals(workspace),
    observe: observer(implementation),
    verify: () => {
      lifecycle.push("verify");
      assert.equal(process.pid, pid);
      recover();
      return { status: "PASS" };
    },
    prefix: async () => {
      lifecycle.push("prefix");
      assert.equal(process.pid, pid);
      recover();
      return sourcePass();
    },
  });
  assert.deepEqual(lifecycle, ["verify", "prefix"]);
  assert.equal(result.historicalValidationsStarted, 1);
  assert.equal(result.historicalValidationsCompleted, 1);
  assert.equal(result.sourcePrefixExecutions, 1);
  for (const name of [
    "dependencyExecutions",
    "technicalExecutions",
    "browserCaptureCommandLaunches",
    "replayCommandLaunches",
    "consumerAdmissions",
  ])
    assert.equal(result[name], 0);
  assert.equal(result.actualChromiumLaunches, null);
  assert.equal(result.status, "NOT_REPRODUCED");
  assert.equal(result.gitExceptionEvidence.restoreVerified, true);
  assert.equal(implementation.execFileSync, original);
  assert.deepEqual(
    records(path.join(workspace, "private/phase-observations.original.jsonl")).map(({ phase, event, gitThrows }) => [
      phase,
      event,
      gitThrows,
    ]),
    [
      ["HISTORICAL_EXPERIENCE", "STARTED", 0],
      ["HISTORICAL_EXPERIENCE", "TERMINAL", 1],
      ["SOURCE_PREFIX", "STARTED", 1],
      ["SOURCE_PREFIX", "TERMINAL", 2],
    ],
  );
  assert.deepEqual(
    records(path.join(workspace, "private/git-exceptions.original.jsonl")).map(({ ordinal }) => ordinal),
    [1, 2],
  );
  validateHistoricalWorkerResult(result);
});

test("historical failure preserves the original fault and never reaches the prefix", async (t) => {
  for (const throws of [true, false]) {
    const workspace = fixture(t);
    const result = await runHistoricalSequence({
      ...journals(workspace),
      observe: observer({ execFileSync() {} }),
      verify: () => {
        if (throws)
          throw Object.assign(new Error("PRIVATE_VALIDATION_MESSAGE"), {
            path: "/PRIVATE_PATH",
            stderr: Buffer.from([0, 255]),
          });
        return { status: "FAIL" };
      },
      prefix: () => assert.fail("failed historical validation must stop the prefix"),
    });
    assert.equal(result.status, "NEW_HISTORICAL_FAILURE");
    assert.equal(result.historicalValidationsStarted, 1);
    assert.equal(result.historicalValidationsCompleted, throws ? 0 : 1);
    assert.equal(result.sourcePrefixExecutions, 0);
    if (throws) {
      assert.equal(result.fault.message, "PRIVATE_VALIDATION_MESSAGE");
      assert.deepEqual(Buffer.from(result.fault.stderr.content, "base64"), Buffer.from([0, 255]));
    }
    assert.equal(result.gitExceptionEvidence.restoreVerified, true);
  }
});

test("lost Git evidence blocks the prefix and observer restoration loss prevents a successful outcome", async (t) => {
  const workspace = fixture(t);
  const implementation = {
      execFileSync() {
        throw new Error("PRIVATE_THROW");
      },
    },
    original = implementation.execFileSync;
  const result = await runHistoricalSequence({
    ...journals(workspace, { maximumBytes: 1 }),
    observe: observer(implementation),
    verify: () => {
      assert.throws(() => implementation.execFileSync("git", ["show"]));
      return { status: "PASS" };
    },
    prefix: () => assert.fail("lost evidence must stop the prefix"),
  });
  assert.equal(result.status, "EXECUTION_UNKNOWN");
  assert.equal(result.evidenceLoss, true);
  assert.equal(result.sourcePrefixExecutions, 0);
  assert.equal(implementation.execFileSync, original);
  const second = fixture(t);
  let synchronizations = 0;
  const restored = await runHistoricalSequence({
    ...journals(second),
    observe: observer({ execFileSync() {} }, () => {
      if (++synchronizations === 2) throw new Error("PRIVATE_RESTORE_FAILURE");
    }),
    verify: () => ({ status: "PASS" }),
    prefix: () => sourcePass(),
  });
  assert.equal(restored.status, "EXECUTION_UNKNOWN");
  assert.equal(restored.evidenceLoss, true);
  assert.equal(restored.gitExceptionEvidence.restoreVerified, false);
});

test("phase journal bounds retain complete preceding records and permanently report evidence loss", (t) => {
  const workspace = fixture(t),
    file = path.join(workspace, "private/phases.jsonl");
  const journal = createHistoricalJournal(file, 8);
  journal.record({ a: 1 });
  assert.throws(() => journal.record({ b: 2 }), /RAW_EVIDENCE_LOSS/u);
  assert.equal(readFileSync(file, "utf8"), '{"a":1}\n');
  assert.equal(journal.state.records, 1);
  assert.equal(journal.state.evidenceLoss, true);
  journal.close();
  journal.close();
  assert.throws(() => journal.record({}), /RAW_EVIDENCE_LOSS/u);
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test("phase journal failure stops before validation or prefix starts", async (t) => {
  const workspace = fixture(t),
    phaseJournal = createHistoricalJournal(path.join(workspace, "private/phase-observations.original.jsonl"), 1);
  const result = await runHistoricalSequence({
    phaseJournal,
    gitJournal: createPosttechnicalGitExceptionLog(path.join(workspace, "private")),
    observe: observer({ execFileSync() {} }),
    verify: () => assert.fail("phase evidence failed before validation"),
    prefix: () => assert.fail("phase evidence failed before prefix"),
  });
  assert.equal(result.status, "EXECUTION_UNKNOWN");
  assert.equal(result.evidenceLoss, true);
  assert.equal(result.historicalValidationsStarted, 0);
  assert.equal(result.sourcePrefixExecutions, 0);
});

function vectorFixture() {
  const root = "Development_Docs/Testing/Product_Experience/";
  const ref = (name, char) => ({ path: root + name, sha256: char.repeat(64) });
  const evidence = {
    artifacts: [ref("z.png", "1"), ref("a.png", "2"), ref("z.png", "1")],
    pairedEvidence: {
      report: ref("report.json", "3"),
      runtime: ref("runtime.json", "4"),
      profile: ref("profile.json", "5"),
      cases: [{ witness: ref("a.png", "2") }],
    },
  };
  return {
    evidence,
    evidencePath: P.evidencePath,
    evidenceBytes: Buffer.from(JSON.stringify(evidence)),
    metadata: () => ({ mode: "100644", blob: "c".repeat(40), bytes: 7 }),
  };
}
test("synthetic input projection sorts and deduplicates references while the production derivation rejects an unpinned vector", () => {
  const input = vectorFixture(),
    bytes = projectHistoricalInputVector(input),
    vector = JSON.parse(bytes);
  assert.equal(vector[1], ORIGINAL.candidate);
  assert.equal(vector[2], ORIGINAL.base);
  const names = vector[4].map((row) => row[1]);
  assert.deepEqual(names, [...new Set(names)].sort());
  assert.equal(names.length, 6);
  assert.equal(P.inputPaths, 305);
  assert.equal(P.inputVectorDigest, "fac730d19891109de49ab0d293103c6f7a4135d83545e0294513302d57a79a7f");
  assert.throws(
    () => deriveHistoricalInputVector({ ...input, metadata: () => assert.fail("reject before metadata access") }),
    /INPUTS_CHANGED/u,
  );
  for (const change of [
    (value) => value.evidence.artifacts.push({ path: "../escape.png", sha256: "1".repeat(64) }),
    (value) => value.evidence.artifacts.push({ path: value.evidence.artifacts[0].path, sha256: "6".repeat(64) }),
    (value) => {
      value.metadata = () => ({ mode: "120000", blob: "c".repeat(40), bytes: 7 });
    },
  ]) {
    const changed = vectorFixture();
    change(changed);
    changed.evidenceBytes = Buffer.from(JSON.stringify(changed.evidence));
    assert.throws(() => projectHistoricalInputVector(changed), /INPUTS_CHANGED/u);
  }
});

function environment(job = "reserve-diagnostic") {
  return {
    PATH: "/synthetic/bin",
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: P.repository,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: execution.installerSha,
    GITHUB_RUN_ID: String(execution.runId),
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_JOB: job,
    GITHUB_ACTOR: P.actor,
    GITHUB_TRIGGERING_ACTOR: P.actor,
    GITHUB_WORKFLOW_REF: `${P.repository}/${P.workflow}@refs/heads/main`,
  };
}
function executionFixture() {
  const env = environment();
  const run = {
    id: execution.runId,
    workflow_id: execution.workflowId,
    run_attempt: 1,
    event: "workflow_dispatch",
    status: "in_progress",
    conclusion: null,
    head_sha: execution.installerSha,
    head_branch: "main",
    path: P.workflow,
    display_title: P.title,
    actor: { login: P.actor },
    triggering_actor: { login: P.actor },
    repository: { full_name: P.repository },
    head_repository: { full_name: P.repository },
  };
  const responses = new Map([
    [`actions/runs/${execution.runId}`, run],
    [`actions/workflows/${execution.workflowId}`, { id: execution.workflowId, path: P.workflow, state: "active" }],
    [
      "branches/main",
      {
        name: "main",
        commit: { sha: execution.installerSha },
        protected: true,
        protection: {
          required_status_checks: { checks: [{ context: "Sounding Line / Mainline Decision", app_id: 15368 }] },
        },
      },
    ],
    [
      "pulls/721",
      {
        state: "open",
        draft: true,
        merged: false,
        head: { sha: ORIGINAL.candidate, repo: { full_name: P.repository } },
        base: { ref: "main", sha: ORIGINAL.base, repo: { full_name: P.repository } },
      },
    ],
    [
      `actions/workflows/${execution.workflowId}/runs?per_page=100&page=1`,
      { total_count: 1, workflow_runs: [clone(run)] },
    ],
    [
      `actions/workflows/${execution.workflowId}/runs?event=workflow_dispatch&per_page=100&page=1`,
      { total_count: 1, workflow_runs: [clone(run)] },
    ],
  ]);
  const calls = [];
  const request = async (endpoint, method = "GET") => {
    calls.push({ endpoint, method });
    assert.equal(method, "GET");
    assert.ok(responses.has(endpoint), endpoint);
    return clone(responses.get(endpoint));
  };
  return { environment: env, request, responses, calls };
}
test("diagnostic rejects changed owner, trigger, job, ref, expiry and inherited authority before requests", () => {
  assert.equal(validateHistoricalEnvironment(environment(), "reserve-diagnostic", now()).runId, execution.runId);
  for (const changed of [
    { GITHUB_ACTOR: "other" },
    { GITHUB_TRIGGERING_ACTOR: "other" },
    { GITHUB_JOB: "ordinary" },
    { GITHUB_REF: "refs/heads/other" },
    { GITHUB_RUN_ATTEMPT: "2" },
    { GITHUB_RUN_ID: "9007199254740993" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { SOUNDING_LINE_EXCEPTION_PHASE: "qualify" },
    { POSTTECHNICAL_SCOPE: "old" },
    { HISTORICAL_VALIDATION_OVERRIDE: "old" },
  ])
    assert.throws(
      () => validateHistoricalEnvironment({ ...environment(), ...changed }, "reserve-diagnostic", now()),
      /EXECUTOR_CHANGED/u,
    );
  assert.throws(
    () => validateHistoricalEnvironment(environment(), "reserve-diagnostic", new Date("2026-10-23T00:00:00Z")),
    /EXECUTOR_CHANGED/u,
  );
});
test("mocked execution binds protected main, app 15368, draft historical subject and complete single-dispatch history", async () => {
  const execute = (api) =>
    validateHistoricalExecution({
      ...api,
      installerSha: execution.installerSha,
      job: "reserve-diagnostic",
      now: now(),
    });
  const valid = executionFixture();
  assert.equal((await execute(valid)).policyDigest, historicalValidationPolicyDigest);
  assert.ok(
    valid.calls.some(
      ({ endpoint }) => endpoint === `actions/workflows/${execution.workflowId}/runs?per_page=100&page=1`,
    ),
  );
  assert.ok(
    valid.calls.some(
      ({ endpoint }) =>
        endpoint === `actions/workflows/${execution.workflowId}/runs?event=workflow_dispatch&per_page=100&page=1`,
    ),
  );
  for (const mutate of [
    (api) => {
      api.responses.get("branches/main").protection.required_status_checks.checks[0].app_id = 1;
    },
    (api) => {
      api.responses.get("pulls/721").base.sha = "b".repeat(40);
    },
    (api) => {
      api.responses.get(`actions/runs/${execution.runId}`).triggering_actor.login = "other";
    },
    (api) => {
      api.responses.get(
        `actions/workflows/${execution.workflowId}/runs?event=workflow_dispatch&per_page=100&page=1`,
      ).total_count = 2;
    },
    (api) => {
      api.responses.get(
        `actions/workflows/${execution.workflowId}/runs?event=workflow_dispatch&per_page=100&page=1`,
      ).workflow_runs = [];
    },
    (api) => {
      const history = api.responses.get(`actions/workflows/${execution.workflowId}/runs?per_page=100&page=1`);
      history.total_count = 2;
      history.workflow_runs.push({ ...clone(history.workflow_runs[0]), id: execution.runId + 1, event: "schedule" });
    },
    (api) => {
      api.responses.get(`actions/workflows/${execution.workflowId}/runs?per_page=100&page=1`).workflow_runs[0].event =
        "push";
    },
  ]) {
    const api = executionFixture();
    mutate(api);
    await assert.rejects(execute(api), /(?:PROTECTION|BINDING|HISTORY)_INVALID/u);
    assert.ok(api.calls.every(({ method }) => method === "GET"));
  }
});

function reservationFixture({ ambiguous = false } = {}) {
  const calls = [],
    refs = new Map(),
    blobs = new Map(),
    trees = new Map(),
    commits = new Map();
  const initialTree = "f".repeat(40);
  trees.set(initialTree, { tree: [] });
  commits.set(execution.installerSha, { tree: { sha: initialTree }, parents: [] });
  const request = async (endpoint, method = "GET", body) => {
    calls.push({ endpoint, method });
    if (method === "POST") {
      const sha = digest(JSON.stringify(body)).slice(0, 40);
      if (endpoint === "git/blobs") {
        blobs.set(sha, { content: Buffer.from(body.content).toString("base64") });
        return { sha };
      }
      if (endpoint === "git/trees") {
        trees.set(sha, { tree: [...trees.get(body.base_tree).tree, ...body.tree] });
        return { sha };
      }
      if (endpoint === "git/commits") {
        commits.set(sha, { tree: { sha: body.tree }, parents: body.parents.map((sha) => ({ sha })) });
        return { sha };
      }
      if (endpoint === "git/refs") {
        assert.equal(body.ref, `refs/tags/${P.namespace}/${P.slot}`);
        if (refs.has(body.ref)) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED");
        refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
        if (ambiguous) throw Error("PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_WRITE_OUTCOME_UNKNOWN");
        return { ref: body.ref };
      }
    }
    if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
    if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
    if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
    if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
    assert.fail(`unexpected synthetic custody operation: ${method} ${endpoint}`);
  };
  return { request, calls, refs };
}
test("reservation consumes one distinct immutable slot and ambiguous ref writes receive no retry", async () => {
  const api = reservationFixture(),
    claim = await createHistoricalReservation({ request: api.request, execution });
  assert.equal(claim.diagnosticOnly, true);
  assert.equal(claim.qualification, false);
  assert.equal(claim.grantsConsumerTrial, false);
  const writes = api.calls.filter(({ method }) => method === "POST").length;
  assert.equal(
    (await readHistoricalReservation({ request: api.request, execution, reservation: claim.commitSha })).commitSha,
    claim.commitSha,
  );
  assert.equal(api.calls.filter(({ method }) => method === "POST").length, writes);
  await assert.rejects(createHistoricalReservation({ request: api.request, execution }), /SLOT_CONSUMED/u);
  assert.equal(api.calls.filter(({ method }) => method === "POST").length, writes);
  await assert.rejects(
    readHistoricalReservation({
      request: api.request,
      execution: { ...execution, runId: execution.runId + 1 },
      reservation: claim.commitSha,
    }),
    /RESERVATION_INVALID/u,
  );
  const uncertain = reservationFixture({ ambiguous: true });
  await assert.rejects(
    createHistoricalReservation({ request: uncertain.request, execution }),
    /WRITE_OUTCOME_UNKNOWN/u,
  );
  assert.equal(
    uncertain.calls.filter(({ endpoint, method }) => endpoint === "git/refs" && method === "POST").length,
    1,
  );
  assert.equal(uncertain.refs.size, 1);
});

test("worker environment strips credentials, outputs, runtime injection and earlier diagnostic authority", () => {
  const result = historicalWorkerEnvironment(
    {
      ...environment("historical-validation-diagnostic"),
      GH_TOKEN: "PRIVATE_TOKEN",
      GITHUB_TOKEN: "PRIVATE_TOKEN",
      GITHUB_OUTPUT: "/PRIVATE_OUTPUT",
      NODE_OPTIONS: "--import=PRIVATE",
      NODE_PATH: "/PRIVATE_MODULES",
      SOUNDING_LINE_LOCAL_LEASE: "PRIVATE_LEASE",
      POSTTECHNICAL_SCOPE: "PRIVATE_SCOPE",
      HISTORICAL_VALIDATION_SCOPE: "PRIVATE_SCOPE",
    },
    "/synthetic/workspace",
  );
  assert.equal(result.PATH, "/synthetic/bin");
  assert.equal(result.GITHUB_WORKSPACE, "/synthetic/workspace");
  assert.equal(result.GIT_NO_LAZY_FETCH, "1");
  assert.equal(result.GIT_TERMINAL_PROMPT, "0");
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE/u);
});

async function supervisedFixture(
  t,
  {
    rawResult = JSON.stringify(workerResult()),
    timeout = false,
    cleanup = { status: "PASS", treeReaped: true, streamsClosed: true },
    exitFailure = false,
    cleanupFailure = false,
    streamFailure = false,
    stdoutBytes = Buffer.from([0, 255]),
    exitCode = 0,
  } = {},
) {
  const workspace = fixture(t),
    paths = historicalPrivatePaths(workspace),
    child = { stdout: new PassThrough(), stderr: new PassThrough() };
  if (rawResult !== null) put(workspace, "private/worker-result.original.json", rawResult);
  let fire,
    stopCalls = 0,
    cleared = false,
    spawnCall;
  const timer = { unref() {} };
  const implementation = {
    spawnOwnedProcess(...args) {
      spawnCall = args;
      return child;
    },
    stopOwnedProcess(owned) {
      assert.equal(owned, child);
      stopCalls++;
      child.stdout.end();
      child.stderr.end();
      if (cleanupFailure) return Promise.reject(new Error("PRIVATE_CLEANUP_FAILURE"));
      return Promise.resolve(cleanup);
    },
    async processExit(owned) {
      assert.equal(owned, child);
      child.stderr.write("PRIVATE_STDERR");
      child.stdout.write(stdoutBytes);
      if (streamFailure) child.stdout.emit("error", new Error("PRIVATE_STREAM_FAILURE"));
      if (timeout) fire();
      child.stdout.end();
      child.stderr.end();
      if (exitFailure) throw new Error("PRIVATE_EXIT_FAILURE");
      return { code: timeout ? null : exitCode };
    },
    setTimeout(callback, milliseconds) {
      assert.equal(milliseconds, 600000);
      fire = callback;
      return timer;
    },
    clearTimeout(value) {
      assert.equal(value, timer);
      cleared = true;
    },
  };
  const outcome = await superviseHistoricalWorker({
    installer: workspace,
    workspace,
    environment: { ...environment(), GH_TOKEN: "PRIVATE_TOKEN" },
    paths,
    implementation,
  });
  assert.equal(stopCalls, 1);
  assert.equal(cleared, true);
  assert.equal(spawnCall[0], process.execPath);
  assert.equal(spawnCall[2].root, workspace);
  assert.doesNotMatch(JSON.stringify(spawnCall[2].env), /PRIVATE_TOKEN/u);
  assert.deepEqual(
    readFileSync(path.join(workspace, "private/worker.stdout.log")),
    stdoutBytes.subarray(0, P.logBytes),
  );
  assert.equal(readFileSync(path.join(workspace, "private/worker.stderr.log"), "utf8"), "PRIVATE_STDERR");
  return { outcome, workspace };
}
test("owned worker supervisor retains both private streams, reaps its child and clears its finite timer", async (t) => {
  const { outcome } = await supervisedFixture(t);
  assert.equal(outcome.closureProven, true);
  assert.equal(outcome.incomplete, false);
  assert.equal(outcome.result.status, "NOT_REPRODUCED");
  assert.deepEqual(outcome.rawLogBytes, [2, 14]);
});
test("worker timeout, failed cleanup, missing result and exit uncertainty remain incomplete", async (t) => {
  for (const options of [
    { timeout: true },
    { cleanup: { status: "FAIL", treeReaped: false, streamsClosed: true } },
    { rawResult: null },
    { exitFailure: true },
    { cleanupFailure: true },
    { streamFailure: true },
  ]) {
    const { outcome } = await supervisedFixture(t, options);
    assert.equal(outcome.incomplete, true);
    if (options.timeout) assert.equal(outcome.timedOut, true);
    if (options.rawResult === null) assert.equal(outcome.resultInvalid, true);
  }
});
test("worker log cap preserves the exact prefix and makes the first excess byte incomplete", async (t) => {
  for (const excess of [0, 1]) {
    const { outcome } = await supervisedFixture(t, { stdoutBytes: Buffer.alloc(P.logBytes + excess, 46) });
    assert.equal(outcome.logTruncated, Boolean(excess));
    assert.equal(outcome.incomplete, Boolean(excess));
    assert.deepEqual(outcome.rawLogBytes, [P.logBytes + excess, 14]);
    assert.deepEqual(outcome.savedRawLogBytes, [P.logBytes, 14]);
  }
});

async function historicalFailureFixture(t) {
  const workspace = fixture(t);
  const originalError = Object.assign(new Error("PRIVATE_ORIGINAL_VALIDATION_FAILURE"), {
    status: 137,
    signal: "SIGKILL",
    stderr: Buffer.from("PRIVATE_ORIGINAL_STDERR"),
  });
  const result = await runHistoricalSequence({
    ...journals(workspace),
    observe: observer({ execFileSync() {} }),
    verify: () => {
      throw originalError;
    },
    prefix: () => assert.fail("validation failed before prefix"),
  });
  assert.equal(result.status, "NEW_HISTORICAL_FAILURE");
  return { workspace, result };
}

test("fault mirror collision preserves the authoritative original result before returning fixed retention exit 2", async (t) => {
  const { workspace, result } = await historicalFailureFixture(t),
    paths = historicalPrivatePaths(workspace);
  const existingMirror = Buffer.from('{"existing":"PRIVATE_PREEXISTING_FAULT"}\n');
  const mirror = put(workspace, "private/fault.original.json", existingMirror),
    snapshot = clone(result);
  const publication = publishHistoricalWorkerResult({ paths, result });
  assert.deepEqual(publication, { retentionFailed: true, exitCode: 2 });
  assert.deepEqual(readFileSync(mirror), existingMirror);
  assert.deepEqual(readFileSync(paths.result), Buffer.from(JSON.stringify(snapshot) + "\n"));
  assert.deepEqual(result, snapshot);
  assert.equal(JSON.parse(readFileSync(paths.result)).fault.message, "PRIVATE_ORIGINAL_VALIDATION_FAILURE");
  assert.equal(result.historicalValidationsStarted, 1);
  assert.equal(result.historicalValidationsCompleted, 0);
  assert.equal(result.sourcePrefixExecutions, 0);
  const successfulWorkspace = fixture(t),
    successfulPaths = historicalPrivatePaths(successfulWorkspace);
  const unusedMirror = put(successfulWorkspace, "private/fault.original.json", existingMirror);
  const successful = await runHistoricalSequence({
    ...journals(successfulWorkspace),
    observe: observer({ execFileSync() {} }),
    verify: () => ({ status: "PASS" }),
    prefix: () => sourcePass(),
  });
  assert.equal(successful.status, "NOT_REPRODUCED");
  assert.equal(Object.hasOwn(successful, "fault"), false);
  assert.deepEqual(publishHistoricalWorkerResult({ paths: successfulPaths, result: successful }), {
    retentionFailed: false,
    exitCode: 0,
  });
  assert.deepEqual(readFileSync(unusedMirror), existingMirror);
  assert.deepEqual(JSON.parse(readFileSync(successfulPaths.result)), successful);
});

test("retention exit 2 makes the supervised outcome unknown while retaining the parsed original result and counts", async (t) => {
  const { result } = await historicalFailureFixture(t);
  for (const exitCode of [1, 2]) {
    const { outcome } = await supervisedFixture(t, { rawResult: JSON.stringify(result), exitCode });
    assert.deepEqual(outcome.result, result);
    assert.equal(outcome.resultInvalid, false);
    assert.equal(outcome.ioFailed, exitCode === 2);
    assert.equal(outcome.incomplete, exitCode === 2);
    const summary = historicalPublicSummary({
      status: outcome.incomplete ? "EXECUTION_UNKNOWN" : outcome.result.status,
      workerStarted: true,
      worker: outcome,
    });
    assert.equal(summary.status, exitCode === 2 ? "EXECUTION_UNKNOWN" : "NEW_HISTORICAL_FAILURE");
    assert.equal(summary.worker.result.status, "NEW_HISTORICAL_FAILURE");
    assert.equal(summary.worker.result.historicalValidationsStarted, 1);
    assert.equal(summary.worker.result.historicalValidationsCompleted, 0);
    assert.equal(summary.worker.result.sourcePrefixExecutions, 0);
    assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_ORIGINAL_/u);
  }
});

test("evidence collection uses only thirteen fixed members and retains partial runs without generated-state spill", (t) => {
  const workspace = fixture(t);
  const expectedMembers = [
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
  ];
  assert.deepEqual(HISTORICAL_EVIDENCE_MEMBERS, expectedMembers);
  const excluded = [
    "private/worker-input.json",
    "private/worker-started.json",
    "private/lease.json",
    "receipts/reproduction.json",
    "receipts/private-evidence.encrypted",
  ];
  for (const file of excluded) put(workspace, file, "PRIVATE_EXCLUDED");
  assert.deepEqual(collectHistoricalEvidence({ workspace }), { members: [], total: 0 });
  for (const [index, name] of expectedMembers.entries())
    put(workspace, name.startsWith("original/") ? "receipts/" + name.slice(9) : name, Buffer.from([index]));
  const result = collectHistoricalEvidence({ workspace });
  assert.deepEqual(
    result.members.map(({ name }) => name),
    expectedMembers,
  );
  assert.equal(result.total, 13);
  unlinkSync(path.join(workspace, "private/runtime.original.json"));
  assert.equal(collectHistoricalEvidence({ workspace }).members.length, 12);
  assert.throws(() => collectHistoricalEvidence({ workspace, maximumBytes: 11 }), /EVIDENCE_|RAW_EVIDENCE_LOSS/u);
});
test("evidence collection rejects symbolic links, dangling links and hard links", (t) => {
  for (const kind of ["symlink", "dangling", "hardlink"]) {
    const workspace = fixture(t),
      target = put(workspace, "private/target", "PRIVATE_RAW"),
      member = path.join(workspace, "private/worker.stdout.log");
    if (kind === "hardlink") linkSync(target, member);
    else symlinkSync(kind === "dangling" ? target + ".missing" : target, member);
    assert.throws(() => collectHistoricalEvidence({ workspace }), /EVIDENCE_PATH_INVALID|PRIVATE_FILE_INVALID|ELOOP/u);
  }
});

let keyPair;
const keys = () => (keyPair ??= generateKeyPairSync("rsa", { modulusLength: 3072 }));
function decrypt(bytes) {
  const envelope = JSON.parse(bytes),
    aad = Buffer.from(envelope.aad, "base64"),
    header = JSON.parse(aad);
  const key = privateDecrypt(
    {
      key: keys().privateKey,
      oaepHash: "sha256",
      oaepLabel: Buffer.from("VW-POSTTECHNICAL-EVIDENCE-1"),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(header.wrappedKey, "base64"),
  );
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.nonce, "base64"));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]));
}
test("malformed worker result fails closed while its exact bytes remain available inside encrypted evidence", async (t) => {
  const rawResult = '{"PRIVATE_PATH":"/private/raw", "message":"PRIVATE_MESSAGE"';
  const { outcome, workspace } = await supervisedFixture(t, { rawResult });
  assert.equal(outcome.resultInvalid, true);
  assert.equal(outcome.result, null);
  const summary = historicalPublicSummary({ status: "EXECUTION_UNKNOWN", workerStarted: true, worker: outcome });
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_PATH|PRIVATE_MESSAGE|\/private\/raw/u);
  const evidence = collectHistoricalEvidence({ workspace });
  const encrypted = sealPosttechnicalEvidence({
    files: evidence.members,
    aad: historicalEvidenceContext(execution),
    publicKey: keys().publicKey,
  });
  const recovered = decrypt(encrypted).files.find(({ name }) => name === "private/worker-result.original.json");
  assert.equal(Buffer.from(recovered.content, "base64").toString(), rawResult);
  assert.doesNotMatch(encrypted.toString(), /PRIVATE_MESSAGE/u);
});

test("public summary projects safe fields and rejects arbitrary paths, environment, messages and argv", () => {
  const result = workerResult({
    status: "NEW_HISTORICAL_FAILURE",
    phase: "HISTORICAL_EXPERIENCE",
    sourcePrefixExecutions: 0,
    historical: { status: "FAIL" },
    source: null,
    fault: {
      message: "PRIVATE_MESSAGE",
      stack: "/PRIVATE_PATH",
      argv: ["PRIVATE_ARGV"],
      env: { TOKEN: "PRIVATE_TOKEN" },
    },
  });
  const summary = historicalPublicSummary({
    status: "NEW_HISTORICAL_FAILURE",
    workerStarted: true,
    execution: { ...execution, path: "/PRIVATE_PATH" },
    env: { TOKEN: "PRIVATE_TOKEN" },
    worker: {
      exitCode: 0,
      closureProven: true,
      incomplete: false,
      cleanup: { treeReaped: true, streamsClosed: true },
      result,
    },
  });
  assert.doesNotMatch(JSON.stringify(summary), /PRIVATE_|argv|message|stack|TOKEN/u);
  assert.equal(summary.worker.result.faultDigest, digest(JSON.stringify(result.fault)));
  for (const injection of [
    { message: "PRIVATE_MESSAGE" },
    { status: "/PRIVATE_PATH" },
    { worker: { argv: ["PRIVATE_ARGV"] } },
  ])
    assert.throws(() => validateHistoricalPublicSummary({ ...summary, ...injection }), /RESULT_INVALID/u);
  assert.throws(
    () => validateHistoricalWorkerResult(workerResult({ historicalValidationsStarted: 0 })),
    /RESULT_INVALID/u,
  );
  assert.throws(() => validateHistoricalWorkerResult(workerResult({ evidenceLoss: true })), /RESULT_INVALID/u);
});

test("worker result rejects contradictory completion, phase, restoration and success claims", () => {
  for (const change of [
    { historicalValidationsCompleted: 0 },
    { phase: "NOT_STARTED" },
    { historicalValidationsStarted: 0 },
    { gitExceptionEvidence: { restoreVerified: false, evidenceLoss: false } },
    { phaseEvidence: { evidenceLoss: true } },
    { fault: { message: "PRIVATE_IMPOSSIBLE_SUCCESS" } },
    { failure: "SOURCE_PREFIX_FAILED" },
    { status: "NEW_HISTORICAL_FAILURE" },
    { status: "NEW_SOURCE_FAILURE" },
  ])
    assert.throws(() => validateHistoricalWorkerResult(workerResult(change)), /RESULT_INVALID/u);
});

test("new diagnostic AAD roundtrips and publication rejects changed context, bytes, malformed envelopes or unproven closure", (t) => {
  const workspace = fixture(t),
    context = historicalEvidenceContext(execution);
  const encrypted = sealPosttechnicalEvidence({
    files: [{ name: "private/synthetic.bin", bytes: Buffer.from([0, 1, 255]) }],
    aad: context,
    publicKey: keys().publicKey,
  });
  assert.deepEqual(Buffer.from(decrypt(encrypted).files[0].content, "base64"), Buffer.from([0, 1, 255]));
  assert.equal(context.diagnosticId, P.id);
  assert.equal(context.inputVectorDigest, P.inputVectorDigest);
  const summaryFile = path.join(workspace, "receipts/reproduction.json"),
    encryptedFile = path.join(workspace, "receipts/private-evidence.encrypted"),
    outputFile = path.join(workspace, "github-output");
  const makeSummary = (bytes) =>
    historicalPublicSummary({
      status: "NOT_REPRODUCED",
      workerStarted: true,
      execution,
      worker: {
        exitCode: 0,
        closureProven: true,
        cleanup: { treeReaped: true, streamsClosed: true },
        result: workerResult(),
      },
      encryptedEvidence: {
        format: "VW-POSTTECHNICAL-EVIDENCE-1",
        keyId: P.keyId,
        ciphertextDigest: digest(bytes),
        ciphertextBytes: bytes.length,
        memberCount: 1,
        rawBytes: 3,
      },
    });
  const publish = (summary, bytes, diskSummary = summary) => {
    put(workspace, "receipts/reproduction.json", JSON.stringify(diskSummary));
    put(workspace, "receipts/private-evidence.encrypted", bytes);
    put(workspace, "github-output", "");
    return assertHistoricalPublication({ summary, summaryFile, encryptedFile, outputFile });
  };
  assert.equal(publish(makeSummary(encrypted), encrypted), true);
  assert.equal(readFileSync(outputFile, "utf8"), "evidence_safe=true\n");
  for (const field of ["diagnosticId", "inputVectorDigest", "originalPlanDigest", "runId", "job", "keyId"]) {
    const envelope = JSON.parse(encrypted),
      header = JSON.parse(Buffer.from(envelope.aad, "base64"));
    header[field] = typeof header[field] === "number" ? header[field] + 1 : "changed";
    envelope.aad = Buffer.from(JSON.stringify(header)).toString("base64");
    const changed = Buffer.from(JSON.stringify(envelope));
    assert.throws(() => decrypt(changed));
    assert.throws(() => publish(makeSummary(changed), changed), /PUBLICATION_FAILED/u);
    assert.equal(readFileSync(outputFile, "utf8"), "");
  }
  const unclosed = makeSummary(encrypted);
  unclosed.worker.closureProven = false;
  assert.throws(() => publish(unclosed, encrypted), /PUBLICATION_FAILED/u);
  const wrongDigest = makeSummary(encrypted);
  wrongDigest.encryptedEvidence.ciphertextDigest = "0".repeat(64);
  assert.throws(() => publish(wrongDigest, encrypted), /PUBLICATION_FAILED/u);
  const malformed = Buffer.from('{"format":"VW-POSTTECHNICAL-EVIDENCE-1"}');
  assert.throws(() => publish(makeSummary(malformed), malformed));
  assert.throws(
    () => publish(makeSummary(encrypted), encrypted, { ...makeSummary(encrypted), workerStarted: false }),
    /PUBLICATION_FAILED/u,
  );
  for (const mutation of [
    (envelope) => {
      const header = JSON.parse(Buffer.from(envelope.aad, "base64"));
      header.extra = "PRIVATE_EXTRA";
      envelope.aad = Buffer.from(JSON.stringify(header)).toString("base64");
      return Buffer.from(JSON.stringify(envelope));
    },
    (envelope) => Buffer.from(JSON.stringify(envelope) + "\n"),
  ]) {
    const changed = mutation(JSON.parse(encrypted));
    assert.throws(() => publish(makeSummary(changed), changed), /PUBLICATION_FAILED/u);
    assert.equal(readFileSync(outputFile, "utf8"), "");
  }
  for (const kind of ["symlink", "hardlink"]) {
    const summary = makeSummary(encrypted);
    put(workspace, "receipts/reproduction.json", JSON.stringify(summary));
    put(workspace, "receipts/private-evidence.encrypted", encrypted);
    unlinkSync(outputFile);
    const target = put(workspace, `output-target-${kind}`, "");
    if (kind === "symlink") symlinkSync(target, outputFile);
    else linkSync(target, outputFile);
    assert.throws(
      () => assertHistoricalPublication({ summary, summaryFile, encryptedFile, outputFile }),
      /PRIVATE_FILE_INVALID|EVIDENCE_PATH_INVALID/u,
    );
    assert.equal(readFileSync(target, "utf8"), "");
  }
});
