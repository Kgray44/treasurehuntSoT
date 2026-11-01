/* Completed PASS receipts are retained data until this protected reader authenticates
 * their provider run, installed producer and artifact bytes. Browser reuse remains
 * unavailable: source equality does not attest the browser runtime environment. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { canonicalJson, createEvidenceFingerprint, digest, verifyReceipt } from "./evidence.mjs";
// CLI startup awaits intake, so a deferred import would wait on that same startup.
import { buildEvidenceObligations, completedEvidenceEnvironmentClass } from "./ordinary.mjs";
import { withVerificationStage } from "./verification-diagnostics.mjs";

const REPOSITORY = "Kgray44/treasurehuntSoT";
const WORKFLOW = ".github/workflows/sounding-line-ordinary.yml";
const JOB = "Sounding Line / Focused verification";
const UPLOAD = "Retain completed whole obligations after any verifier outcome";
const MODULES = [
  WORKFLOW,
  "scripts/sounding-line/ordinary.mjs",
  "scripts/sounding-line/evidence.mjs",
  "scripts/sounding-line/authenticated-completed-evidence.mjs",
];
const SUPERVISED_MODULES = [
  "ordinary-supervised.mjs",
  "verification-budget.mjs",
  "verification-preflight.mjs",
  "verification-supervisor.mjs",
  "owned-process.mjs",
  "owned-process-linux.py",
  "owned-process-windows.ps1",
].map((name) => `scripts/sounding-line/${name}`);
const CHECKOUT_MODULES = [
  "ordinary-checkout.mjs",
  "experience-selected-checkout.mjs",
  "experience-checkout-hydration.mjs",
  "experience-checkout-roots.mjs",
  "experience-pr776-controller-reconciliation.mjs",
  "ordinary-documentation-checkout-profile.mjs",
  "ordinary-custody-probe.mjs",
  "experience-exception.mjs",
  "product-experience.mjs",
  "source-snapshot-batches.mjs",
  "source-diagnostics.mjs",
].map((name) => `scripts/sounding-line/${name}`);
const CHECKOUT_COMMAND = "node authority/scripts/sounding-line/ordinary-checkout.mjs --workspace candidate --base";
const CHECKOUT_STEP = "Checkout exact ordinary ancestry and installed reader closure";
const LIMITS = Object.freeze({
  producers: 3,
  runs: 5,
  artifacts: 100,
  archive: 8 * 1024 * 1024,
  member: 2 * 1024 * 1024,
  expanded: 16 * 1024 * 1024,
  members: 128,
  metadata: 2 * 1024 * 1024,
  timeout: 20000,
});
const SHA = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const proofs = new WeakMap();
const clone = (value) => JSON.parse(canonicalJson(value));
const rawHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const equal = (left, right) => canonicalJson(left) === canonicalJson(right);
const requireValue = (condition, code) => {
  if (!condition) throw new Error(`SOUNDING_LINE_COMPLETED_EVIDENCE_${code}`);
};
const exactKeys = (value, names) => object(value) && equal(Object.keys(value).sort(), [...names].sort());

function git(root, args, binary = false) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
  return execFileSync("git", ["-c", "core.fsmonitor=false", ...args], {
    cwd: root,
    env: { ...env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" },
    encoding: binary ? undefined : "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: LIMITS.metadata,
  });
}

function productionContext() {
  const env = process.env;
  requireValue(
    env.GITHUB_ACTIONS === "true" &&
      env.GITHUB_EVENT_NAME === "pull_request_target" &&
      env.GITHUB_REPOSITORY === REPOSITORY &&
      env.GITHUB_JOB === "final-check",
    "PRODUCER_ENVIRONMENT_UNAUTHENTICATED",
  );
  requireValue(
    env.SOUNDING_LINE_EVIDENCE_PURPOSE === "PROTECTED_FINAL_VERIFICATION" &&
      env.GITHUB_WORKFLOW_REF === `${REPOSITORY}/${WORKFLOW}@refs/heads/main`,
    "PRODUCER_ENVIRONMENT_UNAUTHENTICATED",
  );
}

async function boundedBody(response, maximum) {
  const length = response.headers.get("content-length");
  requireValue(length === null || (/^[0-9]+$/u.test(length) && Number(length) <= maximum), "BODY_TOO_LARGE");
  requireValue(response.body, "TRANSPORT_FAILED");
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      requireValue(size <= maximum, "BODY_TOO_LARGE");
      chunks.push(Buffer.from(item.value));
    }
    return Buffer.concat(chunks, size);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function authenticatedTransport() {
  productionContext();
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  requireValue(typeof token === "string" && token.length > 0, "AUTHENTICATED_ACCESS_REQUIRED");
  return async (endpoint, binary = false) => {
    requireValue(
      typeof endpoint === "string" &&
        /^(?:actions|git|branches)\//u.test(endpoint) &&
        !endpoint.includes("..") &&
        !endpoint.includes("#"),
      "ENDPOINT_INVALID",
    );
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LIMITS.timeout);
    timer.unref?.();
    let target = `https://api.github.com/repos/${REPOSITORY}/${endpoint}`;
    try {
      for (let redirects = 0; redirects <= 3; redirects++) {
        const url = new URL(target);
        requireValue(
          url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.port &&
            (url.hostname === "api.github.com" ||
              (binary && /(?:^|\.)(?:blob\.core\.windows\.net|githubusercontent\.com)$/u.test(url.hostname))),
          "TRANSPORT_REDIRECT_INVALID",
        );
        const response = await fetch(url, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers:
            url.hostname === "api.github.com"
              ? {
                  Authorization: `Bearer ${token}`,
                  Accept: "application/vnd.github+json",
                  "X-GitHub-Api-Version": "2022-11-28",
                }
              : {},
        });
        if (binary && [301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          requireValue(location && redirects < 3, "TRANSPORT_REDIRECT_INVALID");
          target = new URL(location, url).href;
          continue;
        }
        if (!binary && response.status === 404) {
          await response.body?.cancel();
          return null;
        }
        requireValue(response.status === 200, "AUTHENTICATED_READ_FAILED");
        const bytes = await boundedBody(response, binary ? LIMITS.archive : LIMITS.metadata);
        return binary ? bytes : JSON.parse(bytes.toString("utf8"));
      }
      requireValue(false, "TRANSPORT_REDIRECT_INVALID");
    } catch (error) {
      if (error.message?.startsWith("SOUNDING_LINE_COMPLETED_EVIDENCE_")) throw error;
      throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_TRANSPORT_FAILED");
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
}

// This small recent window is intentionally nonexhaustive. Each result remains
// an untrusted hint; history, names and uploaded assertions never admit receipts.
export async function discoverCompletedEvidenceProducerHints({ request, limit = LIMITS.producers } = {}) {
  requireValue(positive(limit) && limit <= LIMITS.producers, "DISCOVERY_LIMIT_INVALID");
  const api = request ?? authenticatedTransport();
  const listing = await api(
    "actions/workflows/sounding-line-ordinary.yml/runs?event=pull_request_target&status=completed&per_page=5",
  );
  requireValue(
    object(listing) &&
      Number.isSafeInteger(listing.total_count) &&
      listing.total_count >= 0 &&
      Array.isArray(listing.workflow_runs) &&
      listing.workflow_runs.length <= LIMITS.runs &&
      listing.workflow_runs.length <= listing.total_count,
    "DISCOVERY_INVALID",
  );
  const seen = new Set(),
    hints = [];
  let examinedRuns = 0;
  for (const run of listing.workflow_runs) {
    if (!positive(run?.id) || !positive(run?.run_attempt) || seen.has(run.id)) continue;
    seen.add(run.id);
    examinedRuns++;
    const artifacts = await api(`actions/runs/${run.id}/artifacts?per_page=100`);
    // Per-run ambiguity or incomplete pagination invalidates only that source.
    if (
      !object(artifacts) ||
      !Number.isSafeInteger(artifacts.total_count) ||
      artifacts.total_count < 0 ||
      artifacts.total_count > LIMITS.artifacts ||
      !Array.isArray(artifacts.artifacts) ||
      artifacts.artifacts.length !== artifacts.total_count
    )
      continue;
    const matching = artifacts.artifacts.filter(
      (artifact) => artifact?.name === `sounding-line-completed-evidence-${run.id}-${run.run_attempt}`,
    );
    if (matching.length !== 1 || !positive(matching[0].id) || matching[0].expired !== false) continue;
    hints.push({ runId: run.id, attempt: run.run_attempt, artifactId: matching[0].id });
    if (hints.length === limit) break;
  }
  return {
    hints,
    complete: false,
    reason: "UNTRUSTED_BOUNDED_RECENT_WORKFLOW_WINDOW",
    examinedRuns,
    windowLimit: LIMITS.runs,
  };
}

// Strict in-memory ZIP reading: no extraction, ZIP64, encryption, path aliases,
// overlapping local records, unknown members, duplicate names or unbounded inflate.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function checkpointMembers(archive) {
  requireValue(Buffer.isBuffer(archive) && archive.length >= 22 && archive.length <= LIMITS.archive, "ZIP_INVALID");
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--)
    if (archive.readUInt32LE(i) === 0x06054b50 && i + 22 + archive.readUInt16LE(i + 20) === archive.length) {
      end = i;
      break;
    }
  requireValue(
    end >= 0 &&
      archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0 &&
      archive.readUInt16LE(end + 8) === archive.readUInt16LE(end + 10),
    "ZIP_INVALID",
  );
  const count = archive.readUInt16LE(end + 10),
    centralSize = archive.readUInt32LE(end + 12),
    centralStart = archive.readUInt32LE(end + 16);
  requireValue(count > 0 && count <= LIMITS.members && centralStart + centralSize === end, "ZIP_INVALID");
  const entries = [];
  let offset = centralStart,
    expanded = 0;
  for (let i = 0; i < count; i++) {
    requireValue(offset + 46 <= end && archive.readUInt32LE(offset) === 0x02014b50, "ZIP_INVALID");
    const flags = archive.readUInt16LE(offset + 8),
      method = archive.readUInt16LE(offset + 10),
      crc = archive.readUInt32LE(offset + 16),
      compressed = archive.readUInt32LE(offset + 20),
      bytes = archive.readUInt32LE(offset + 24),
      nameSize = archive.readUInt16LE(offset + 28),
      extraSize = archive.readUInt16LE(offset + 30),
      commentSize = archive.readUInt16LE(offset + 32),
      local = archive.readUInt32LE(offset + 42);
    const next = offset + 46 + nameSize + extraSize + commentSize;
    const attributes = archive.readUInt32LE(offset + 38),
      fileType = (attributes >>> 16) & 0xf000;
    requireValue([0, 0x8000].includes(fileType) && !(attributes & 0x10), "ZIP_MEMBER_INVALID");
    requireValue(
      next <= end &&
        archive.readUInt16LE(offset + 34) === 0 &&
        [0, 8, 0x800, 0x808].includes(flags) &&
        [0, 8].includes(method) &&
        bytes <= LIMITS.member &&
        compressed <= LIMITS.archive,
      "ZIP_INVALID",
    );
    const name = archive.subarray(offset + 46, offset + 46 + nameSize).toString("utf8");
    requireValue(
      /^checkpoint-[0-9]{4}\.json$/u.test(name) &&
        !entries.some((entry) => entry.name === name) &&
        local + 30 <= centralStart &&
        archive.readUInt32LE(local) === 0x04034b50,
      "ZIP_MEMBER_INVALID",
    );
    const localNameSize = archive.readUInt16LE(local + 26),
      localExtra = archive.readUInt16LE(local + 28),
      start = local + 30 + localNameSize + localExtra;
    requireValue(
      archive.readUInt16LE(local + 6) === flags &&
        archive.readUInt16LE(local + 8) === method &&
        archive.subarray(local + 30, local + 30 + localNameSize).toString("utf8") === name &&
        start + compressed <= centralStart,
      "ZIP_INVALID",
    );
    const descriptor = flags & 8 ? 16 : 0;
    if (descriptor)
      requireValue(
        start + compressed + 16 <= centralStart &&
          archive.readUInt32LE(start + compressed) === 0x08074b50 &&
          archive.readUInt32LE(start + compressed + 4) === crc &&
          archive.readUInt32LE(start + compressed + 8) === compressed &&
          archive.readUInt32LE(start + compressed + 12) === bytes,
        "ZIP_INVALID",
      );
    else
      requireValue(
        archive.readUInt32LE(local + 14) === crc &&
          archive.readUInt32LE(local + 18) === compressed &&
          archive.readUInt32LE(local + 22) === bytes,
        "ZIP_INVALID",
      );
    const compressedBytes = archive.subarray(start, start + compressed);
    let value;
    try {
      value = method === 0 ? compressedBytes : inflateRawSync(compressedBytes, { maxOutputLength: LIMITS.member });
    } catch {
      throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_ZIP_INVALID");
    }
    expanded += value.length;
    requireValue(value.length === bytes && crc32(value) === crc && expanded <= LIMITS.expanded, "ZIP_INVALID");
    entries.push({ name, bytes: value, start: local, end: start + compressed + descriptor });
    offset = next;
  }
  requireValue(offset === end, "ZIP_INVALID");
  const regions = [...entries].sort((a, b) => a.start - b.start);
  requireValue(
    regions[0].start === 0 &&
      regions.every((entry, index) => entry.end === (regions[index + 1]?.start ?? centralStart)),
    "ZIP_INVALID",
  );
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

async function acceptedSource(root, baseSha, authoritySha, api) {
  requireValue(SHA.test(baseSha ?? "") && SHA.test(authoritySha ?? ""), "AUTHORITY_INVALID");
  git(root, ["merge-base", "--is-ancestor", authoritySha, baseSha]);
  const installed = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const source = new Map();
  const workflowBytes = git(root, ["show", `${authoritySha}:${WORKFLOW}`], true);
  const workflow = workflowBytes.toString("utf8");
  const direct = workflow.includes(
    "node authority/scripts/sounding-line/ordinary.mjs --mode ordinary --workspace candidate --base",
  );
  const supervised = workflow.includes(
    "node authority/scripts/sounding-line/ordinary-supervised.mjs --mode ordinary --workspace candidate --base",
  );
  requireValue(direct !== supervised, "WORKFLOW_CONTRACT_UNSUPPORTED");
  const selectedCheckout = workflow.includes(CHECKOUT_COMMAND);
  for (const name of [
    ...MODULES,
    ...(supervised ? SUPERVISED_MODULES : []),
    ...(selectedCheckout ? CHECKOUT_MODULES : []),
  ]) {
    requireValue(
      git(root, ["ls-tree", authoritySha, "--", name]).startsWith("100644 blob ") &&
        git(root, ["ls-tree", baseSha, "--", name]).startsWith("100644 blob "),
      "AUTHORITY_MODE_INVALID",
    );
    const pinned = git(root, ["show", `${authoritySha}:${name}`], true);
    requireValue(
      pinned.equals(git(root, ["show", `${baseSha}:${name}`], true)) &&
        (name === WORKFLOW || pinned.equals(await readFile(path.join(installed, name)))),
      "AUTHORITY_SOURCE_CHANGED",
    );
    const blob = git(root, ["rev-parse", `${authoritySha}:${name}`]).trim();
    const remote = await api(`git/blobs/${blob}`);
    requireValue(
      remote?.sha === blob &&
        remote.encoding === "base64" &&
        Number.isSafeInteger(remote.size) &&
        remote.size === pinned.length &&
        typeof remote.content === "string",
      "AUTHORITY_BLOB_INVALID",
    );
    const decoded = Buffer.from(remote.content.replaceAll("\n", ""), "base64");
    requireValue(
      decoded.equals(pinned) &&
        createHash("sha1")
          .update(Buffer.from(`blob ${decoded.length}\0`))
          .update(decoded)
          .digest("hex") === blob,
      "AUTHORITY_BLOB_INVALID",
    );
    source.set(name, pinned);
  }
  for (const fragment of [
    "pull_request_target:",
    "branches: [main]",
    "name: Sounding Line / Focused verification",
    "ref: ${{ steps.source.outputs.base }}",
    "path: authority",
    `name: ${UPLOAD}`,
    "id: completed-evidence-artifact",
    "uses: actions/upload-artifact@v4",
    "sounding-line-completed-evidence-${{ github.run_id }}-${{ github.run_attempt }}",
    "authority/artifacts/sounding-line/completed-evidence/checkpoint-*.json",
    "SOUNDING_LINE_EVIDENCE_PURPOSE: PROTECTED_FINAL_VERIFICATION",
  ])
    requireValue(workflow.includes(fragment), "WORKFLOW_CONTRACT_UNSUPPORTED");
  const commit = await api(`git/commits/${authoritySha}`);
  requireValue(commit?.sha === authoritySha && SHA.test(commit.tree?.sha ?? ""), "AUTHORITY_COMMIT_INVALID");
  return { ordinarySha256: rawHash(source.get(MODULES[1])), selectedCheckout };
}

function validateRun(run, producer) {
  requireValue(
    run?.id === producer.runId &&
      run.run_attempt === producer.attempt &&
      run.status === "completed" &&
      ["success", "failure", "cancelled"].includes(run.conclusion) &&
      run.event === "pull_request_target" &&
      run.path === WORKFLOW &&
      positive(run.workflow_id) &&
      SHA.test(run.head_sha ?? "") &&
      run.repository?.full_name === REPOSITORY &&
      run.head_repository?.full_name === REPOSITORY &&
      positive(run.repository?.id) &&
      run.head_repository?.id === run.repository.id &&
      run.actor?.login === "Kgray44" &&
      run.triggering_actor?.login === "Kgray44" &&
      Array.isArray(run.pull_requests) &&
      run.pull_requests.length === 1 &&
      Array.isArray(run.referenced_workflows) &&
      run.referenced_workflows.length === 0,
    "PROVIDER_RUN_INVALID",
  );
  const pr = run.pull_requests[0];
  requireValue(
    positive(pr.number) &&
      SHA.test(pr.base?.sha ?? "") &&
      pr.base.ref === "main" &&
      pr.base.repo?.id === run.repository.id &&
      pr.head?.sha === run.head_sha &&
      pr.head.ref === run.head_branch &&
      pr.head.repo?.id === run.repository.id &&
      (!producer.authoritySha || producer.authoritySha === pr.base.sha),
    "PROVIDER_PULL_REQUEST_INVALID",
  );
  return pr.base.sha;
}

function validateJobs(value, run, source) {
  requireValue(
    Number.isSafeInteger(value?.total_count) &&
      Array.isArray(value.jobs) &&
      value.total_count === value.jobs.length &&
      value.jobs.length <= 100,
    "PROVIDER_JOBS_INCOMPLETE",
  );
  const matching = value.jobs.filter((job) => job.name === JOB);
  requireValue(matching.length === 1, "PROVIDER_JOB_INVALID");
  const job = matching[0];
  requireValue(
    positive(job.id) &&
      job.run_id === run.id &&
      job.run_attempt === run.run_attempt &&
      job.head_sha === run.head_sha &&
      job.status === "completed" &&
      ["success", "failure", "cancelled"].includes(job.conclusion) &&
      Array.isArray(job.steps),
    "PROVIDER_JOB_INVALID",
  );
  const step = (name) => {
    const found = job.steps.filter((item) => item.name === name);
    requireValue(
      found.length === 1 && positive(found[0].number) && found[0].status === "completed",
      "PROVIDER_STEP_INVALID",
    );
    return found[0];
  };
  const bind = step("Bind the event to exact source identities"),
    route = step("Route through trusted protected-main classification"),
    verifier = step("Run the trusted focused verifier against the exact candidate tree"),
    upload = step(UPLOAD);
  requireValue(
    bind.conclusion === "success" &&
      route.conclusion === "success" &&
      ["success", "failure", "cancelled"].includes(verifier.conclusion) &&
      upload.conclusion === "success" &&
      bind.number < route.number &&
      route.number < verifier.number &&
      verifier.number < upload.number,
    "PROVIDER_STEP_INVALID",
  );
  const checkouts = job.steps.filter(
    (item) => item.name === "Run actions/checkout@v4" && item.number > bind.number && item.number < route.number,
  );
  if (source.selectedCheckout) {
    const helper = step(CHECKOUT_STEP);
    const authority = checkouts.filter((item) => item.conclusion === "success");
    requireValue(
      helper.conclusion === "success" &&
        bind.number < helper.number &&
        helper.number < route.number &&
        checkouts.length >= 1 &&
        checkouts.length <= 2 &&
        authority.length === 1 &&
        authority[0].number < helper.number &&
        checkouts.every((item) => item.status === "completed" && ["success", "skipped"].includes(item.conclusion)),
      "PROVIDER_CHECKOUT_INVALID",
    );
    return;
  }
  requireValue(
    !job.steps.some((item) => item.name === CHECKOUT_STEP && item.conclusion !== "skipped"),
    "PROVIDER_CHECKOUT_INVALID",
  );
  requireValue(
    checkouts.length === 2 && checkouts.every((item) => item.status === "completed" && item.conclusion === "success"),
    "PROVIDER_CHECKOUT_INVALID",
  );
}

function canonicalReceipt(receipt, checkpoint) {
  const names = [
    "version",
    "kind",
    "immutable",
    "id",
    "candidateSha",
    "obligationId",
    "fingerprint",
    "planDigest",
    "commands",
    "durationMs",
    "authorityVersion",
    "producer",
    "result",
    "disposition",
    "originalReceiptId",
    "receiptDigest",
  ];
  if (receipt?.disposition !== "FRESH") names.push("lineage");
  requireValue(
    exactKeys(receipt, names) &&
      verifyReceipt(receipt).valid &&
      ["FRESH", "PRESERVED", "REBOUND"].includes(receipt.disposition) &&
      receipt.candidateSha === checkpoint.candidateSha &&
      receipt.planDigest === checkpoint.planDigest &&
      receipt.authorityVersion === "1.4" &&
      receipt.producer === "SOUNDING_LINE_DIRECT" &&
      Array.isArray(receipt.commands) &&
      receipt.commands.length > 0 &&
      receipt.commands.length <= 1000 &&
      receipt.commands.every(
        (command) => typeof command === "string" && command.length > 0 && command.length <= 32768,
      ) &&
      Number.isFinite(receipt.durationMs) &&
      receipt.durationMs >= 0 &&
      receipt.durationMs <= 7 * 24 * 60 * 60 * 1000,
    "RECEIPT_INVALID",
  );
  const fingerprint = createEvidenceFingerprint(receipt.fingerprint);
  requireValue(
    equal(fingerprint, receipt.fingerprint) && receipt.obligationId === fingerprint.obligationId,
    "RECEIPT_FINGERPRINT_INVALID",
  );
  const identity = digest({
    candidateSha: receipt.candidateSha,
    obligationId: receipt.obligationId,
    fingerprintDigest: fingerprint.fingerprintDigest,
    disposition: receipt.disposition,
    originalReceiptId: receipt.originalReceiptId,
  });
  requireValue(receipt.id === `sl14-${identity.slice(0, 32)}`, "RECEIPT_ID_INVALID");
  if (receipt.disposition === "FRESH") requireValue(receipt.originalReceiptId === null, "RECEIPT_LINEAGE_INVALID");
  else {
    const lineage = receipt.lineage;
    requireValue(
      typeof receipt.originalReceiptId === "string" &&
        /^sl14-[a-f0-9]{32}$/u.test(receipt.originalReceiptId) &&
        exactKeys(lineage, [
          "version",
          "immutable",
          "originalReceiptId",
          "priorFingerprintDigest",
          "currentFingerprintDigest",
          "disposition",
          "reasonCodes",
          "lineageDigest",
        ]) &&
        lineage.version === "1.4" &&
        lineage.immutable === true &&
        lineage.originalReceiptId === receipt.originalReceiptId &&
        lineage.priorFingerprintDigest === fingerprint.fingerprintDigest &&
        lineage.currentFingerprintDigest === fingerprint.fingerprintDigest &&
        lineage.disposition === receipt.disposition &&
        (equal(lineage.reasonCodes, ["TRUSTED_PARENT_OBSERVED_SEMANTIC_FINGERPRINT_MATCH"]) ||
          equal(lineage.reasonCodes, ["AUTHENTICATED_PROTECTED_PRODUCER_FINGERPRINT_MATCH"])) &&
        lineage.lineageDigest ===
          digest({
            originalReceiptId: receipt.originalReceiptId,
            priorFingerprintDigest: fingerprint.fingerprintDigest,
            currentFingerprintDigest: fingerprint.fingerprintDigest,
            disposition: receipt.disposition,
          }),
      "RECEIPT_LINEAGE_INVALID",
    );
  }
  return receipt;
}

function authenticatedCheckpoints(archive, { run, authoritySha, source, candidateTree }) {
  const entries = checkpointMembers(archive);
  let prior = [],
    observation;
  const topKeys = [
    "version",
    "kind",
    "authentication",
    "candidateSha",
    "baseSha",
    "planDigest",
    "producerObservation",
    "completedWholeObligations",
    "receipts",
    "wholeVerificationPassed",
    "qualification",
  ];
  for (const [index, entry] of entries.entries()) {
    requireValue(entry.name === `checkpoint-${String(index + 1).padStart(4, "0")}.json`, "CHECKPOINT_SEQUENCE_INVALID");
    let checkpoint;
    try {
      checkpoint = JSON.parse(entry.bytes.toString("utf8"));
    } catch {
      throw new Error("SOUNDING_LINE_COMPLETED_EVIDENCE_CHECKPOINT_INVALID");
    }
    requireValue(
      entry.bytes.equals(Buffer.from(`${canonicalJson(checkpoint)}\n`)) &&
        exactKeys(checkpoint, topKeys) &&
        checkpoint.version === 1 &&
        checkpoint.kind === "sounding-line-completed-obligation-checkpoint" &&
        checkpoint.authentication === "RETENTION_ONLY_NO_AUTHENTICATED_PRODUCER" &&
        checkpoint.candidateSha === run.head_sha &&
        checkpoint.baseSha === authoritySha &&
        SHA256.test(checkpoint.planDigest ?? "") &&
        checkpoint.wholeVerificationPassed === false &&
        checkpoint.qualification === false &&
        checkpoint.completedWholeObligations === index + 1 &&
        Array.isArray(checkpoint.receipts) &&
        checkpoint.receipts.length === index + 1 &&
        equal(checkpoint.receipts.slice(0, -1), prior),
      "CHECKPOINT_INVALID",
    );
    const seen = new Set();
    checkpoint.receipts.forEach((receipt) => {
      canonicalReceipt(receipt, checkpoint);
      requireValue(!seen.has(receipt.obligationId), "CHECKPOINT_DUPLICATE_OBLIGATION");
      seen.add(receipt.obligationId);
    });
    const metadata = checkpoint.producerObservation;
    requireValue(
      exactKeys(metadata, [
        "authentication",
        "repository",
        "runId",
        "runAttempt",
        "workflowRef",
        "workflowSha",
        "event",
        "job",
        "authoritySha",
        "authorityModuleSha256",
        "candidateTree",
        "sourceDigest",
        "environmentClass",
      ]) &&
        metadata.authentication === "UNAUTHENTICATED_OBSERVED_METADATA" &&
        metadata.environmentClass === "github-actions-nonbrowser-controlled" &&
        metadata.repository === REPOSITORY &&
        metadata.runId === run.id &&
        metadata.runAttempt === run.run_attempt &&
        metadata.workflowRef === `${REPOSITORY}/${WORKFLOW}@refs/heads/main` &&
        metadata.workflowSha === authoritySha &&
        metadata.event === "pull_request_target" &&
        metadata.job === "final-check" &&
        metadata.authoritySha === authoritySha &&
        metadata.authorityModuleSha256 === source.ordinarySha256 &&
        metadata.candidateTree === candidateTree &&
        (metadata.sourceDigest === null || SHA256.test(metadata.sourceDigest)),
      "CHECKPOINT_PRODUCER_INVALID",
    );
    requireValue(!observation || equal(observation, metadata), "CHECKPOINT_PRODUCER_CHANGED");
    observation = metadata;
    prior = checkpoint.receipts;
  }
  return prior;
}

async function authenticateProducer(root, plan, producer, api, download) {
  requireValue(
    object(producer) &&
      positive(producer.runId) &&
      positive(producer.attempt) &&
      positive(producer.artifactId) &&
      (producer.authoritySha === undefined || SHA.test(producer.authoritySha)),
    "PRODUCER_HINT_INVALID",
  );
  const run = await api(`actions/runs/${producer.runId}`);
  const authoritySha = validateRun(run, producer);
  const source = await acceptedSource(root, plan.baseSha, authoritySha, api);
  const workflow = await api("actions/workflows/sounding-line-ordinary.yml");
  requireValue(
    workflow?.id === run.workflow_id && workflow.path === WORKFLOW && workflow.state === "active",
    "PROVIDER_WORKFLOW_INVALID",
  );
  validateJobs(await api(`actions/runs/${producer.runId}/attempts/${producer.attempt}/jobs?per_page=100`), run, source);
  const commit = await api(`git/commits/${run.head_sha}`);
  requireValue(commit?.sha === run.head_sha && SHA.test(commit.tree?.sha ?? ""), "CANDIDATE_COMMIT_INVALID");
  const artifact = await api(`actions/artifacts/${producer.artifactId}`);
  requireValue(
    artifact?.id === producer.artifactId &&
      artifact.name === `sounding-line-completed-evidence-${producer.runId}-${producer.attempt}` &&
      artifact.expired === false &&
      positive(artifact.size_in_bytes) &&
      artifact.size_in_bytes <= LIMITS.archive &&
      /^sha256:[a-f0-9]{64}$/u.test(artifact.digest ?? "") &&
      artifact.workflow_run?.id === run.id &&
      artifact.workflow_run.repository_id === run.repository.id &&
      artifact.workflow_run.head_repository_id === run.repository.id &&
      artifact.workflow_run.head_sha === run.head_sha &&
      artifact.workflow_run.head_branch === run.head_branch,
    "PROVIDER_ARTIFACT_INVALID",
  );
  const archive = await download(`actions/artifacts/${producer.artifactId}/zip`);
  requireValue(
    Buffer.isBuffer(archive) &&
      archive.length === artifact.size_in_bytes &&
      `sha256:${rawHash(archive)}` === artifact.digest,
    "ARTIFACT_DIGEST_INVALID",
  );
  return {
    receipts: authenticatedCheckpoints(archive, { run, authoritySha, source, candidateTree: commit.tree.sha }),
    provenance: {
      runId: run.id,
      attempt: run.run_attempt,
      artifactId: artifact.id,
      authoritySha,
      artifactDigest: artifact.digest,
      workflowId: run.workflow_id,
      producerCandidateSha: run.head_sha,
    },
  };
}

// request/download are trusted-parent fixture seams, never serialized options or
// a CLI. The opaque token is the only authority consumed by the ordinary parent.
export async function authenticateCompletedEvidence({ root, plan, producers, request, download } = {}) {
  productionContext();
  requireValue(
    typeof root === "string" &&
      object(plan) &&
      SHA.test(plan.candidateSha ?? "") &&
      SHA.test(plan.baseSha ?? "") &&
      plan.mode === "ordinary",
    "CURRENT_PLAN_INVALID",
  );
  const currentRoot = await realpath(root);
  requireValue(git(currentRoot, ["rev-parse", "HEAD"]).trim() === plan.candidateSha, "CURRENT_HEAD_CHANGED");
  git(currentRoot, ["diff", "--no-ext-diff", "--no-textconv", "--exit-code", "HEAD", "--"]);
  requireValue(typeof completedEvidenceEnvironmentClass === "function", "CURRENT_AUTHORITY_UNSUPPORTED");
  requireValue(
    completedEvidenceEnvironmentClass(plan) === "github-actions-nonbrowser-controlled",
    "PRODUCER_ENVIRONMENT_UNAUTHENTICATED",
  );
  const api = request ?? authenticatedTransport();
  const getArchive = download ?? ((endpoint) => api(endpoint, true));
  const branch = await api("branches/main");
  requireValue(
    branch?.name === "main" && branch.protected === true && branch.commit?.sha === plan.baseSha,
    "CURRENT_ACCEPTED_BASE_CHANGED",
  );
  const hints = producers ?? (await discoverCompletedEvidenceProducerHints({ request: api })).hints;
  requireValue(Array.isArray(hints) && hints.length <= LIMITS.producers, "PRODUCER_LIMIT_INVALID");
  // No producer hints can authenticate receipts. Defer the expensive immutable
  // closure until reuse is possible; the verifier still fingerprints every group.
  const obligations = hints.length
    ? await withVerificationStage("EVIDENCE_FINGERPRINTS", () => buildEvidenceObligations(currentRoot, plan), {
        observeFailure: false,
      })
    : [];
  const current = new Map(obligations.map((obligation) => [obligation.id, clone(obligation)]));
  requireValue(current.size === obligations.length, "CURRENT_OBLIGATION_DUPLICATE");
  const receipts = new Map(),
    provenance = new Map(),
    rejections = [];
  const seen = new Set();
  for (const hint of hints) {
    try {
      requireValue(!seen.has(hint?.artifactId), "PRODUCER_DUPLICATE");
      seen.add(hint?.artifactId);
      const authenticated = await authenticateProducer(currentRoot, plan, hint, api, getArchive);
      for (const receipt of authenticated.receipts) {
        const obligation = current.get(receipt.obligationId);
        if (
          !obligation ||
          obligation.kind === "browser" ||
          obligation.reuseIndeterminate ||
          !equal(createEvidenceFingerprint(obligation.fingerprint), obligation.fingerprint) ||
          !equal(receipt.fingerprint, obligation.fingerprint)
        )
          continue;
        if (!receipts.has(obligation.id)) {
          receipts.set(obligation.id, clone(receipt));
          provenance.set(obligation.id, {
            obligationId: obligation.id,
            receiptId: receipt.id,
            receiptDigest: receipt.receiptDigest,
            ...authenticated.provenance,
          });
        }
      }
    } catch (error) {
      rejections.push({
        artifactId: positive(hint?.artifactId) ? hint.artifactId : null,
        reason: /^SOUNDING_LINE_COMPLETED_EVIDENCE_[A-Z0-9_]+$/u.test(error?.message ?? "")
          ? error.message
          : "SOUNDING_LINE_COMPLETED_EVIDENCE_PRODUCER_UNAVAILABLE",
      });
    }
  }
  requireValue(git(currentRoot, ["rev-parse", "HEAD"]).trim() === plan.candidateSha, "CURRENT_HEAD_CHANGED");
  git(currentRoot, ["diff", "--no-ext-diff", "--no-textconv", "--exit-code", "HEAD", "--"]);
  const token = Object.freeze({
    kind: "authenticated-completed-evidence",
    version: 1,
    admitted: receipts.size,
    provenance: Object.freeze([...provenance.values()].map(Object.freeze)),
    rejections: Object.freeze(rejections.map(Object.freeze)),
    qualification: false,
  });
  proofs.set(token, { root: currentRoot, candidateSha: plan.candidateSha, current, receipts, provenance });
  return token;
}

export function authenticatedCompletedReceipt(token, { root, candidateSha, obligationId, fingerprint } = {}) {
  const proof = object(token) ? proofs.get(token) : undefined;
  const obligation = proof?.current.get(obligationId);
  if (
    !proof ||
    path.resolve(root ?? "") !== proof.root ||
    candidateSha !== proof.candidateSha ||
    !obligation ||
    obligation.kind === "browser" ||
    obligation.reuseIndeterminate ||
    !equal(fingerprint, obligation.fingerprint)
  )
    return null;
  const receipt = proof.receipts.get(obligationId);
  return receipt ? clone(receipt) : null;
}
