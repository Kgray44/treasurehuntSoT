// Fixed-provider authentication of original preparation observations. This
// establishes provenance only: it never issues a preparation reuse certificate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalJson, digest } from "./evidence.mjs";
import {
  PREPARATION_PUBLISHER_READERS,
  PREPARATION_SHADOW_WORKFLOW,
  preparationPublisherContext,
} from "./preparation-publisher-shadow.mjs";
const repository = "Kgray44/treasurehuntSoT",
  repositoryId = 1303074266,
  ownerId = 64373011;
const proofs = new WeakMap(),
  retained = new WeakMap();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const oid = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const need = (value, code) => {
  if (!value) throw Error(`SOUNDING_LINE_PREPARATION_PROVIDER_${code}`);
};
const time = (value) =>
  typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?Z$/u.test(value) ? Date.parse(value) : NaN;
function git(root, args) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return execFileSync("git", ["-c", "protocol.allow=never", "-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    env: {
      ...env,
      GIT_NO_LAZY_FETCH: "1",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_TERMINAL_PROMPT: "0",
    },
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
function providerRequest(endpoint, { maximumBytes, timeoutMs }) {
  return execFileSync("gh", ["api", "--hostname", "github.com", `repos/${repository}/${endpoint}`], {
    timeout: timeoutMs,
    maxBuffer: maximumBytes,
    encoding: null,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GH_PROMPT_DISABLED: "1", NO_COLOR: "1" },
  });
}
function originalMarker(bytes, marker, job, stepName) {
  const steps = job.steps.filter((step) => step.name === stepName);
  need(steps.length === 1 && steps[0].status === "completed" && steps[0].conclusion === "success", "STEP");
  const step = steps[0],
    frames = [];
  for (const line of new TextDecoder("utf-8", { fatal: true }).decode(bytes).split(/\r?\n/u)) {
    const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z) (.*)$/u.exec(line);
    if (match?.[2].startsWith(marker + " "))
      frames.push({ at: time(match[1]), payload: match[2].slice(marker.length + 1) });
  }
  need(
    frames.length === 1 &&
      frames[0].at >= time(step.started_at) - 2000 &&
      frames[0].at <= time(step.completed_at) + 2000 &&
      frames[0].at >= time(job.started_at) - 2000 &&
      frames[0].at <= time(job.completed_at) + 2000,
    "LOG_BINDING",
  );
  return JSON.parse(frames[0].payload);
}
function sourceReaders(root, source) {
  const inventory = new Map(
    git(root, ["ls-tree", "-rz", source, "--", ...PREPARATION_PUBLISHER_READERS])
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((row) => {
        const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/u.exec(row);
        need(match, "SOURCE_READER_TYPE");
        return [match[3], match[1]];
      }),
  );
  need(inventory.size === PREPARATION_PUBLISHER_READERS.length, "SOURCE_CLOSURE");
  return digest(
    PREPARATION_PUBLISHER_READERS.map((file) => ({
      path: file,
      mode: inventory.get(file),
      sha256: hash(git(root, ["show", `${source}:${file}`])),
    })),
  );
}
export function authenticatePreparationProvider(input) {
  const originals = [],
    failures = [],
    started = performance.now();
  let root, source, runId;
  const read = (endpoint, maximumBytes = 2 * 1024 * 1024) => {
    const remaining = 60000 - (performance.now() - started);
    need(
      remaining > 0 && originals.reduce((sum, row) => sum + row.bytes.length, 0) + maximumBytes <= 16 * 1024 * 1024,
      "BUDGET",
    );
    let bytes;
    try {
      bytes = providerRequest(endpoint, {
        maximumBytes,
        timeoutMs: Math.max(1, Math.min(15000, Math.floor(remaining))),
      });
    } catch (error) {
      failures.push({ endpoint, originalError: error });
      throw error;
    }
    need(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= maximumBytes, "PROVIDER_BYTES");
    originals.push({ endpoint, bytes: Buffer.from(bytes), sha256: hash(bytes) });
    return bytes;
  };
  const json = (endpoint) => JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read(endpoint)));
  try {
    need(
      input &&
        Object.getPrototypeOf(input) === Object.prototype &&
        Object.keys(input).sort().join(",") === "acceptedBaseSha,root,runId",
      "INPUT",
    );
    ({ root, acceptedBaseSha: source, runId } = input);
    need(oid(source) && positive(runId), "SOURCE");
    root = fs.realpathSync(root);
    need(root === fs.realpathSync(fileURLToPath(new URL("../../", import.meta.url))), "INSTALLED_ROOT");
    const local = git(root, ["rev-parse", "HEAD", "HEAD^{tree}"]).toString("utf8").trim().split(/\r?\n/u);
    need(local[0] === source && oid(local[1]), "INSTALLED_MAIN");
    need(
      git(root, ["show", `${source}:scripts/sounding-line/preparation-provider-auth.mjs`]).equals(
        fs.readFileSync(fileURLToPath(import.meta.url)),
      ),
      "INSTALLED_AUTHENTICATOR",
    );
    git(root, ["diff", "--quiet", "HEAD", "--"]);
    const before = json("git/ref/heads/main");
    need(
      before.ref === "refs/heads/main" && before.object?.type === "commit" && before.object.sha === source,
      "CURRENT_MAIN",
    );
    const run = json(`actions/runs/${runId}/attempts/1`);
    need(
      run.id === runId &&
        run.run_attempt === 1 &&
        run.head_sha === source &&
        run.head_branch === "main" &&
        run.event === "workflow_dispatch" &&
        run.path === PREPARATION_SHADOW_WORKFLOW &&
        run.status === "completed" &&
        run.conclusion === "success" &&
        run.repository?.id === repositoryId &&
        run.repository.full_name === repository &&
        run.repository.owner?.id === ownerId &&
        run.head_repository?.id === repositoryId &&
        run.head_repository.full_name === repository &&
        [run.actor, run.triggering_actor].every((actor) => actor?.id === ownerId && actor.login === "Kgray44") &&
        Array.isArray(run.referenced_workflows) &&
        run.referenced_workflows.length === 0,
      "RUN",
    );
    const workflow = json(`actions/workflows/${run.workflow_id}`);
    need(
      positive(workflow.id) &&
        workflow.id === run.workflow_id &&
        workflow.path === PREPARATION_SHADOW_WORKFLOW &&
        workflow.state === "active",
      "WORKFLOW",
    );
    const commit = json(`git/commits/${source}`);
    need(commit.sha === source && commit.tree?.sha === local[1], "SOURCE_TREE");
    const readerDigest = sourceReaders(root, source);
    const list = json(`actions/runs/${runId}/attempts/1/jobs?per_page=100`);
    need(list.total_count === 2 && Array.isArray(list.jobs) && list.jobs.length === 2, "COMPLETE_JOBS");
    const names = [
      "Sounding Line / Preparation producer shadow",
      "Sounding Line / Preparation independent fresh verifier",
    ];
    const jobs = names.map((name) => {
      const matches = list.jobs.filter((job) => job.name === name);
      need(matches.length === 1, "JOB_AMBIGUITY");
      const job = matches[0];
      need(
        positive(job.id) &&
          job.run_id === runId &&
          job.run_attempt === 1 &&
          job.head_sha === source &&
          job.status === "completed" &&
          job.conclusion === "success" &&
          positive(job.runner_id) &&
          Array.isArray(job.labels) &&
          job.labels.includes("ubuntu-latest") &&
          !job.labels.includes("self-hosted") &&
          Array.isArray(job.steps) &&
          job.steps.length <= 40 &&
          new Set(job.steps.map((step) => step.number)).size === job.steps.length,
        "JOB",
      );
      return job;
    });
    need(
      jobs[0].id !== jobs[1].id &&
        jobs[0].runner_id !== jobs[1].runner_id &&
        time(jobs[1].started_at) >= time(jobs[0].completed_at),
      "INDEPENDENT_JOBS",
    );
    const logs = jobs.map((job) => read(`actions/jobs/${job.id}/logs`));
    const contexts = jobs.map((job, i) =>
      preparationPublisherContext(
        originalMarker(
          logs[i],
          "SOUNDING_LINE_PREPARATION_CONTEXT_V1",
          job,
          i === 0 ? "Observe original preparation producer context" : "Observe original independent verifier context",
        ),
      ),
    );
    for (const [i, context] of contexts.entries())
      need(
        context.sourceCommit === source &&
          context.sourceTree === local[1] &&
          context.runId === runId &&
          context.attempt === 1 &&
          context.readerDigest === readerDigest &&
          context.jobKey === (i === 0 ? "publisher" : "independent-verifier"),
        "CONTEXT",
      );
    need(contexts[0].nonce !== contexts[1].nonce, "NONCE");
    const capsule = originalMarker(
      logs[0],
      "SOUNDING_LINE_PREPARATION_CAPSULE_V1",
      jobs[0],
      "Measure and seal private preparation capsule shadow",
    );
    const equivalence = originalMarker(
      logs[1],
      "SOUNDING_LINE_PREPARATION_EQUIVALENCE_V1",
      jobs[1],
      "Independently compare complete fresh and transferred outputs",
    );
    need(
      capsule.sourceCommit === source &&
        capsule.runId === runId &&
        capsule.attempt === 1 &&
        capsule.qualification === false &&
        capsule.reuseAuthorized === false &&
        /^[a-f0-9]{64}$/u.test(capsule.inputFingerprint) &&
        /^[a-f0-9]{64}$/u.test(capsule.manifestSha256),
      "CAPSULE",
    );
    need(
      equivalence.kind === "PREPARATION_INDEPENDENT_EQUIVALENCE_SHADOW" &&
        equivalence.version === 1 &&
        equivalence.equivalent === true &&
        equivalence.certificate === "NOT_ISSUED" &&
        equivalence.qualification === false &&
        equivalence.reuseAuthorized === false &&
        canonicalJson(equivalence.originalProducer) === canonicalJson(contexts[0]) &&
        canonicalJson(equivalence.independentVerifier) === canonicalJson(contexts[1]) &&
        equivalence.inputFingerprint === capsule.inputFingerprint &&
        equivalence.originalManifestSha256 === capsule.manifestSha256,
      "EQUIVALENCE",
    );
    const artifacts = json(`actions/runs/${runId}/artifacts?per_page=100`);
    need(
      Number.isSafeInteger(artifacts.total_count) &&
        artifacts.total_count <= 100 &&
        Array.isArray(artifacts.artifacts) &&
        artifacts.artifacts.length === artifacts.total_count,
      "ARTIFACT_LIST",
    );
    const matches = artifacts.artifacts.filter(
      (artifact) => artifact.name === `sounding-line-preparation-capsule-${runId}-1`,
    );
    need(matches.length === 1, "ARTIFACT_AMBIGUITY");
    const artifact = json(`actions/artifacts/${matches[0].id}`);
    need(
      positive(artifact.id) &&
        artifact.id === matches[0].id &&
        artifact.name === matches[0].name &&
        artifact.expired === false &&
        artifact.workflow_run?.id === runId &&
        artifact.workflow_run.head_sha === source &&
        artifact.workflow_run.head_branch === "main" &&
        positive(artifact.size_in_bytes) &&
        artifact.size_in_bytes <= 160 * 1024 * 1024 &&
        /^sha256:[a-f0-9]{64}$/u.test(artifact.digest) &&
        artifact.digest === matches[0].digest &&
        artifact.size_in_bytes === matches[0].size_in_bytes &&
        time(artifact.created_at) >= time(jobs[0].started_at) - 2000 &&
        time(artifact.created_at) <= time(jobs[0].completed_at) + 2000 &&
        time(artifact.expires_at) > Date.now(),
      "ARTIFACT",
    );
    const after = json("git/ref/heads/main");
    need(after.ref === before.ref && after.object?.type === "commit" && after.object.sha === source, "MAIN_ADVANCED");
    const proof = Object.freeze({
      kind: "PROVIDER_BOUND_PREPARATION_SHADOW_NOT_REUSE_AUTHORITY",
      sourceCommit: source,
      sourceTree: local[1],
      runId,
      attempt: 1,
      artifactId: artifact.id,
      artifactSha256: artifact.digest.slice(7),
      artifactBytes: artifact.size_in_bytes,
      inputFingerprint: capsule.inputFingerprint,
      manifestSha256: capsule.manifestSha256,
      inventoryDigest: equivalence.inventoryDigest,
      certificate: "NOT_ISSUED",
      qualification: false,
      reuseAuthorized: false,
    });
    proofs.set(proof, { root, source, runId, expiresAt: Math.min(Date.now() + 60000, time(artifact.expires_at)) });
    retained.set(proof, { originals, failures });
    return proof;
  } catch (originalError) {
    const failure = Object.freeze({
      kind: "PREPARATION_PROVIDER_DENIED",
      certificate: "NOT_ISSUED",
      qualification: false,
      reuseAuthorized: false,
    });
    retained.set(failure, { originals, failures, originalError });
    return failure;
  }
}
export function inspectPreparationProvider(proof, { root, acceptedBaseSha, runId }) {
  const value = proofs.get(proof);
  if (
    !value ||
    value.root !== path.resolve(root) ||
    value.source !== acceptedBaseSha ||
    value.runId !== runId ||
    Date.now() >= value.expiresAt
  )
    return null;
  return Object.freeze({ ...proof });
}
export function retainedPreparationProviderEvidence(handle) {
  const value = retained.get(handle);
  if (!value) return null;
  return Object.freeze({
    originals: Object.freeze(value.originals.map((row) => Object.freeze({ ...row, bytes: Buffer.from(row.bytes) }))),
    failures: Object.freeze(value.failures.map((row) => Object.freeze({ ...row }))),
    originalError: value.originalError,
    qualification: false,
    reuseAuthorized: false,
  });
}
