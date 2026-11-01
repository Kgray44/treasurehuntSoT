// Original event facts only, not receipt admission or permission to reuse.
// Fetches exact provider endpoints and pins both producer and reader source.
// https://docs.github.com/en/rest/git/trees#get-a-tree
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readNativeEvidenceContextStepLog, PROVIDER_RUN_LOG_ARCHIVE_MAXIMUM } from "./provider-run-log-archive.mjs";
const REPOSITORY = "Kgray44/treasurehuntSoT",
  REPOSITORY_ID = 1303074266,
  OWNER_ID = 64373011;
const WORKFLOW = ".github/workflows/sounding-line-ordinary.yml",
  PRODUCER = "scripts/sounding-line/native-evidence-context.mjs";
const READERS = [
  "scripts/sounding-line/native-original-context-auth.mjs",
  "scripts/sounding-line/provider-run-log-archive.mjs",
];
const proofs = new WeakMap(),
  failedObservations = new WeakMap(),
  hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_NATIVE_ORIGINAL_${code}`);
};
const parse = (bytes, maximum) => {
  need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximum, "BYTE_BOUND");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw Error("SOUNDING_LINE_NATIVE_ORIGINAL_JSON");
  }
};
const time = (value) =>
  typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/u.test(value) ? Date.parse(value) : NaN;
const tuple = ({ root, acceptedBaseSha, runId, attempt, prNumber, jobKey, expectedOriginalSource }) =>
  JSON.stringify([
    path.resolve(root),
    acceptedBaseSha,
    runId,
    attempt,
    prNumber,
    jobKey,
    expectedOriginalSource?.baseSha,
    expectedOriginalSource?.candidateSha,
  ]);
function localBytes(file) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd);
    need(before.isFile() && before.nlink === 1 && before.size <= 1024 * 1024, "READER_FILE");
    const bytes = Buffer.alloc(1024 * 1024 + 1);
    let count = 0,
      read;
    while ((read = fs.readSync(fd, bytes, count, bytes.length - count, null)) > 0) {
      count += read;
      need(count <= 1024 * 1024, "READER_FILE");
    }
    const after = fs.fstatSync(fd),
      named = fs.lstatSync(file);
    need(
      count === before.size &&
        !named.isSymbolicLink() &&
        [after, named].every(
          (s) =>
            s.ino === before.ino &&
            s.dev === before.dev &&
            s.size === before.size &&
            s.mtimeMs === before.mtimeMs &&
            s.ctimeMs === before.ctimeMs,
        ),
      "READER_CHANGED",
    );
    return bytes.subarray(0, count);
  } finally {
    fs.closeSync(fd);
  }
}
function nativeGit(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", ["-c", "core.fsmonitor=false", "-c", "protocol.allow=never", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 65536,
    env: {
      ...env,
      GIT_NO_LAZY_FETCH: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
  }).trim();
}
function providerRequest(endpoint, { maximumBytes, timeoutMs }) {
  return execFileSync("gh", ["api", "--hostname", "github.com", `repos/${REPOSITORY}/${endpoint}`], {
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: maximumBytes,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" },
  });
}
export async function authenticateNativeOriginalContext(input) {
  let bindingTuple;
  const originals = [],
    observations = [];
  let capturedBytes = 0;
  try {
    let { root, acceptedBaseSha, runId, attempt, prNumber, jobKey, expectedOriginalSource, budgetMs = 60000 } = input;
    need(!Object.hasOwn(input, "request"), "TRANSPORT_OVERRIDE");
    need([runId, attempt, prNumber].every(positive) && ![721, 776, 805].includes(prNumber), "ORDINARY_SCOPE");
    need(
      oid(acceptedBaseSha) &&
        oid(expectedOriginalSource?.baseSha) &&
        oid(expectedOriginalSource?.candidateSha) &&
        ["final-check", "experience-preparation"].includes(jobKey),
      "BINDING",
    );
    need(Number.isSafeInteger(budgetMs) && budgetMs >= 20 && budgetMs <= 60000, "BUDGET");
    expectedOriginalSource = {
      baseSha: expectedOriginalSource.baseSha,
      candidateSha: expectedOriginalSource.candidateSha,
    };
    root = fs.realpathSync(root);
    need(fs.realpathSync(fileURLToPath(new URL("../../", import.meta.url))) === root, "INSTALLED_READER_ROOT");
    const local = nativeGit(root, ["rev-parse", "HEAD", "HEAD^{tree}"]).split(/\r?\n/u);
    need(local[0] === acceptedBaseSha && oid(local[1]), "INSTALLED_BASE");
    nativeGit(root, ["diff", "--quiet", "HEAD", "--"]);
    bindingTuple = tuple({ root, acceptedBaseSha, runId, attempt, prNumber, jobKey, expectedOriginalSource });
    const began = performance.now();
    const read = async (endpoint, maximumBytes = 2 * 1024 * 1024) => {
      const remaining = budgetMs - (performance.now() - began);
      need(remaining > 0, "DEADLINE");
      let timer;
      let bytes;
      try {
        bytes = await Promise.race([
          Promise.resolve().then(() =>
            providerRequest(endpoint, { maximumBytes, timeoutMs: Math.max(1, Math.min(20000, Math.floor(remaining))) }),
          ),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error("SOUNDING_LINE_NATIVE_ORIGINAL_DEADLINE")), remaining);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes, "BYTE_BOUND");
      capturedBytes += bytes.length;
      need(capturedBytes <= 64 * 1024 * 1024, "AGGREGATE_BYTE_BOUND");
      // Retain the original response before parsing. A later denial must not erase it.
      bytes = Buffer.from(bytes);
      originals.push({ endpoint, bytes });
      observations.push({ endpoint, bytes: bytes.length, sha256: hash(bytes) });
      return bytes;
    };
    const json = async (endpoint, maximum) => parse(await read(endpoint, maximum), maximum ?? 2 * 1024 * 1024);
    need((await json("git/ref/heads/main")).object?.sha === acceptedBaseSha, "ACCEPTED_BASE_MOVED");
    const run = await json(`actions/runs/${runId}/attempts/${attempt}`),
      jobs = await json(`actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`),
      workflow = await json("actions/workflows/sounding-line-ordinary.yml");
    need(
      run.id === runId &&
        run.run_attempt === attempt &&
        run.status === "completed" &&
        ["success", "failure", "cancelled"].includes(run.conclusion) &&
        ["pull_request_target", "workflow_dispatch"].includes(run.event) &&
        run.path === WORKFLOW &&
        run.repository?.id === REPOSITORY_ID &&
        run.repository.full_name === REPOSITORY &&
        run.repository.owner?.id === OWNER_ID &&
        run.head_repository?.id === REPOSITORY_ID &&
        run.head_repository.full_name === REPOSITORY &&
        Array.isArray(run.referenced_workflows) &&
        run.referenced_workflows.length === 0,
      "RUN",
    );
    need(
      run.actor?.id === OWNER_ID &&
        run.actor.login === "Kgray44" &&
        run.triggering_actor?.id === OWNER_ID &&
        run.triggering_actor.login === "Kgray44",
      "OWNER",
    );
    need(
      positive(workflow.id) &&
        workflow.id === run.workflow_id &&
        workflow.path === WORKFLOW &&
        workflow.state === "active",
      "WORKFLOW",
    );
    need(
      positive(jobs.total_count) &&
        jobs.total_count <= 100 &&
        Array.isArray(jobs.jobs) &&
        jobs.jobs.length === jobs.total_count,
      "JOBS_INCOMPLETE",
    );
    const name =
      jobKey === "final-check"
        ? "Sounding Line / Focused verification"
        : "Sounding Line / Experience preparation (no mainline decision)";
    const matching = jobs.jobs.filter((job) => job.name === name);
    need(matching.length === 1, "JOB_AMBIGUOUS");
    const job = matching[0];
    need(
      positive(job.id) &&
        job.run_id === runId &&
        job.run_attempt === attempt &&
        job.head_sha === run.head_sha &&
        job.status === "completed" &&
        ["success", "failure", "cancelled"].includes(job.conclusion) &&
        Array.isArray(job.steps) &&
        job.steps.length <= 100,
      "JOB",
    );
    const names =
      jobKey === "final-check"
        ? [
            "Set up job",
            "Bind the event to exact source identities",
            "Run actions/checkout@v4",
            "Observe immutable original evidence context",
          ]
        : ["Set up job", "Checkout exact protected authority", "Observe immutable original evidence context"];
    need(new Set(job.steps.map((step) => step.number)).size === job.steps.length, "STEP_AMBIGUOUS");
    for (let i = 0; i < names.length; i++) {
      const steps = job.steps.filter((step) => step.number === i + 1 && step.name === names[i]);
      need(steps.length === 1 && steps[0].status === "completed" && steps[0].conclusion === "success", "EARLY_STEP");
    }
    const contextSteps = job.steps.filter((step) => step.name === "Observe immutable original evidence context");
    need(contextSteps.length === 1, "STEP_AMBIGUOUS");
    const contextStep = contextSteps[0];
    const checkout = job.steps.filter(
      (step) => step.name === "Checkout exact ordinary ancestry and installed reader closure",
    );
    need(checkout.length === 1 && checkout[0].number > contextStep.number, "CANDIDATE_ORDER");
    const archive = await read(`actions/runs/${runId}/attempts/${attempt}/logs`, PROVIDER_RUN_LOG_ARCHIVE_MAXIMUM),
      log = readNativeEvidenceContextStepLog(archive, { jobKey });
    const text = new TextDecoder("utf-8", { fatal: true }).decode(log);
    const frames = [];
    for (const line of text.trimEnd().split(/\r?\n/u)) {
      const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z) (.*)$/u.exec(line);
      need(match, "LOG_FRAME");
      if (match[2].startsWith("SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 "))
        frames.push({
          at: time(match[1]),
          payload: match[2].slice("SOUNDING_LINE_NATIVE_EVIDENCE_CONTEXT_V2 ".length),
        });
    }
    need(
      frames.length === 1 &&
        Number.isFinite(frames[0].at) &&
        frames[0].at >= time(contextStep.started_at) - 2000 &&
        frames[0].at <= time(contextStep.completed_at) + 2000 &&
        frames[0].at >= time(job.started_at) - 2000 &&
        frames[0].at <= time(job.completed_at) + 2000,
      "LOG_TIME",
    );
    const context = parse(Buffer.from(frames[0].payload), 16384);
    const keys = [
      "schemaVersion",
      "kind",
      "authentication",
      "repository",
      "repositoryId",
      "actorId",
      "runId",
      "attempt",
      "jobKey",
      "event",
      "mode",
      "prNumber",
      "baseSha",
      "candidateSha",
      "workflowRef",
      "workflowSha",
      "qualification",
      "reuseAuthorized",
    ];
    need(
      Object.keys(context).sort().join() === keys.sort().join() &&
        context.schemaVersion === 2 &&
        context.kind === "NATIVE_ORIGINAL_EVIDENCE_CONTEXT_SHADOW" &&
        context.authentication === "OBSERVED_EVENT_DATA_NOT_AUTHENTICATED_BY_SERIALIZATION" &&
        context.qualification === false &&
        context.reuseAuthorized === false,
      "CONTEXT_KIND",
    );
    need(
      context.repository === REPOSITORY &&
        context.repositoryId === REPOSITORY_ID &&
        context.actorId === OWNER_ID &&
        context.runId === runId &&
        context.attempt === attempt &&
        context.jobKey === jobKey &&
        context.event === run.event &&
        context.prNumber === prNumber &&
        context.baseSha === expectedOriginalSource.baseSha &&
        context.candidateSha === expectedOriginalSource.candidateSha &&
        context.workflowSha === context.baseSha &&
        context.workflowRef === `${REPOSITORY}/${WORKFLOW}@refs/heads/main`,
      "CONTEXT_BINDING",
    );
    need(
      run.event === "pull_request_target"
        ? jobKey === "final-check" && context.mode === "ordinary" && run.head_sha === context.candidateSha
        : run.head_branch === "main" &&
            run.head_sha === context.baseSha &&
            context.mode === (jobKey === "final-check" ? "ordinary" : "capture"),
      "EVENT_SOURCE",
    );
    const trees = new Map();
    const tree = async (revision) => {
      if (trees.has(revision)) return trees.get(revision);
      const commit = await json(`git/commits/${revision}`);
      need(commit.sha === revision && oid(commit.tree?.sha), "SOURCE_COMMIT");
      const result = await json(`git/trees/${commit.tree.sha}?recursive=1`, 16 * 1024 * 1024);
      need(
        result.sha === commit.tree.sha &&
          result.truncated === false &&
          Array.isArray(result.tree) &&
          result.tree.length > 0 &&
          result.tree.length <= 100000,
        "SOURCE_TREE",
      );
      const entries = new Map();
      for (const entry of result.tree) {
        need(
          typeof entry.path === "string" &&
            entry.path.length <= 4096 &&
            !/[\\\u0000-\u001f\u007f]/u.test(entry.path) &&
            !entry.path.startsWith("/") &&
            entry.path.split("/").every((part) => part && part !== "." && part !== "..") &&
            oid(entry.sha) &&
            !entries.has(entry.path),
          "SOURCE_TREE",
        );
        entries.set(entry.path, entry);
      }
      trees.set(revision, { sha: commit.tree.sha, entries });
      return trees.get(revision);
    };
    const current = await tree(acceptedBaseSha);
    need(current.sha === local[1], "LOCAL_TREE_MISMATCH");
    if (context.baseSha !== acceptedBaseSha) {
      const compared = await json(`compare/${context.baseSha}...${acceptedBaseSha}?per_page=1`);
      need(
        compared.base_commit?.sha === context.baseSha &&
          compared.merge_base_commit?.sha === context.baseSha &&
          ["ahead", "identical"].includes(compared.status) &&
          compared.behind_by === 0,
        "SOURCE_ANCESTRY",
      );
    }
    const producer = await tree(context.baseSha),
      blobCache = new Map();
    const sourceBlob = async (file) => {
      const entry = current.entries.get(file);
      need(entry?.mode === "100644" && entry.type === "blob", "SOURCE_MODE");
      if (!blobCache.has(entry.sha)) {
        const data = await json(`git/blobs/${entry.sha}`);
        need(
          data.sha === entry.sha &&
            data.encoding === "base64" &&
            typeof data.content === "string" &&
            data.content.length <= 2 * 1024 * 1024 &&
            positive(data.size) &&
            data.size <= 1024 * 1024,
          "SOURCE_BLOB",
        );
        const clean = data.content.replace(/[\r\n]/gu, ""),
          bytes = Buffer.from(clean, "base64");
        need(
          bytes.toString("base64") === clean &&
            bytes.length === data.size &&
            createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") === entry.sha,
          "SOURCE_BLOB",
        );
        blobCache.set(entry.sha, bytes);
      }
      return blobCache.get(entry.sha);
    };
    for (const file of [WORKFLOW, PRODUCER]) {
      const before = producer.entries.get(file),
        after = current.entries.get(file);
      need(before?.mode === "100644" && before.type === "blob" && before.sha === after?.sha, "PRODUCER_SOURCE_CHANGED");
      await sourceBlob(file);
    }
    for (const file of READERS) {
      const expected = await sourceBlob(file),
        actual = localBytes(path.join(root, file));
      need(actual.equals(expected), "INSTALLED_READER_CHANGED");
    }
    need(
      (await json("git/ref/heads/main")).object?.sha === acceptedBaseSha &&
        nativeGit(root, ["rev-parse", "HEAD"]) === acceptedBaseSha,
      "ACCEPTED_BASE_MOVED",
    );
    const proof = Object.freeze({
      kind: "PROVIDER_BOUND_ORIGINAL_CONTEXT_NOT_REUSE_AUTHORITY",
      qualification: false,
      reuseAuthorized: false,
    });
    proofs.set(proof, {
      tuple: bindingTuple,
      context: JSON.parse(JSON.stringify(context)),
      jobId: job.id,
      acceptedBaseSha,
      observations,
      nativeStepLogSha256: hash(log),
      nativeStepLogBytes: log.length,
      originals,
    });
    return proof;
  } catch (error) {
    const denied = /^SOUNDING_LINE_NATIVE_ORIGINAL_[A-Z0-9_]+$/u.test(error?.message ?? "")
      ? error
      : Error("SOUNDING_LINE_NATIVE_ORIGINAL_UNAVAILABLE");
    if (bindingTuple) failedObservations.set(denied, { tuple: bindingTuple, observations, originals });
    throw denied;
  }
}
export function inspectNativeOriginalContext(proof, input) {
  try {
    const value = proofs.get(proof);
    if (!value || value.tuple !== tuple(input)) return null;
    return JSON.parse(
      JSON.stringify({
        ...value,
        tuple: undefined,
        originals: undefined,
        qualification: false,
        reuseAuthorized: false,
      }),
    );
  } catch {
    return null;
  }
}
// Copies for private immutable custody. Failed observations never become proofs.
export function retainedNativeOriginalContextEvidence(handle, input) {
  try {
    const value = proofs.get(handle) ?? failedObservations.get(handle);
    if (!value || value.tuple !== tuple(input)) return null;
    return {
      classification: proofs.has(handle)
        ? "ORIGINAL_PROVIDER_EVIDENCE_RETENTION"
        : "FAILED_ORIGINAL_PROVIDER_OBSERVATION_RETENTION",
      qualification: false,
      reuseAuthorized: false,
      responses: value.originals.map(({ endpoint, bytes }) => ({
        endpoint,
        bytes: Buffer.from(bytes),
        sha256: hash(bytes),
      })),
    };
  } catch {
    return null;
  }
}
