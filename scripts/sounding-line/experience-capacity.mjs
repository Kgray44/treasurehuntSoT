// Nonbinding telemetry: the retained draft estimate is not an accepted limit,
// measured peak, enforced write bound, reserve or capture authorization.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { statfs } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GiB = 1073741824,
  MiB = 1048576;
export const EXPERIENCE_STORAGE_RESERVE = 30 * GiB;
export const EXPERIENCE_INTAKE_LIMITS = Object.freeze({
  archiveBytes: 9 * GiB + 32 * MiB,
  metadataBytes: MiB,
  manifestBytes: 8 * MiB,
  centralBytes: 4 * MiB,
  members: 16384,
  chunkBytes: MiB,
  timeoutMs: 120000,
  cleanupMs: 5000,
});
const resources = Object.freeze(
  [
    ["checkout", 2 * GiB],
    ["dependencies", 6 * GiB],
    ["browser-cache", 2 * GiB],
    ["build", 8 * GiB],
    ["database-profiles", 2 * GiB],
    ["native-temp", 8 * GiB],
    ["logs", GiB],
    ["host-tools", 3 * GiB],
    ["capture-producer", 4 * GiB],
    ["ready-and-preimages", 8 * GiB],
    ["raw-producer", 4 * GiB],
    ["encrypted-raw", 9 * GiB],
    ["metadata-journals", 64 * MiB],
  ].map(([name, bytes]) => Object.freeze({ name, bytes })),
);
const fail = (code) => {
  throw new Error(`PRODUCT_EXPERIENCE_CAPACITY_${code}`);
};
export function capacityBinding(value) {
  const keys = [
    "repository",
    "baseSha",
    "candidateSha",
    "sourceDigest",
    "contractDigest",
    "planDigest",
    "runId",
    "runAttempt",
  ];
  const result = Object.fromEntries(keys.map((key) => [key, value?.[key]]));
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(result.repository ?? "") ||
    result.repository.length > 240 ||
    result.repository.split("/").some((p) => p === "." || p === "..") ||
    ![result.baseSha, result.candidateSha].every((x) => /^[a-f0-9]{40}$/u.test(x ?? "")) ||
    ![result.sourceDigest, result.contractDigest, result.planDigest].every((x) => /^[a-f0-9]{64}$/u.test(x ?? "")) ||
    ![result.runId, result.runAttempt].every((x) => /^[1-9][0-9]*$/u.test(x ?? ""))
  )
    fail("BINDING_INVALID");
  return Object.freeze(result);
}
export function captureCapacityPlan(value) {
  const binding = capacityBinding(value);
  const hosted = Object.freeze({
    stage: "HOSTED_CAPTURE",
    resources,
    additionalBytes: resources.reduce((sum, row) => sum + row.bytes, 0),
    lifetime: "ALL_RETAINED_UNTIL_JOB_END;NO_UNPROVED_CLEANUP_CREDIT",
    classification: "UNMEASURED_DRAFT_ESTIMATE_NOT_AN_ACCEPTED_REQUIREMENT",
    enforcement: "OBSERVATION_ONLY_NO_WRITER_CONFINEMENT",
  });
  const local = Object.freeze({
    stage: "LATER_LOCAL_ARTIFACT_INTAKE",
    additionalBytes: EXPERIENCE_INTAKE_LIMITS.archiveBytes + 64 * MiB,
    inputBufferBytes:
      2 * EXPERIENCE_INTAKE_LIMITS.manifestBytes +
      EXPERIENCE_INTAKE_LIMITS.centralBytes +
      EXPERIENCE_INTAKE_LIMITS.chunkBytes +
      2 * EXPERIENCE_INTAKE_LIMITS.metadataBytes +
      MiB,
    inputBufferAccounting:
      "NAMED_BUFFER_ALLOWANCE_INCLUDES_ZIP_HEADER_MARGIN;EXCLUDES_PARSED_OBJECTS_STRINGS_GARBAGE_TRANSPORT_INTERNALS_AND_RSS",
    lifetime: "ONE_OWNED_ARCHIVE;CALLBACK_THEN_AWAITED_CLEANUP;NO_EXTRACTION",
    requiredReserveEachLocalDrive: EXPERIENCE_STORAGE_RESERVE,
  });
  const plan = { version: 1, classification: "PROPOSED_CEILINGS_NOT_MEASURED_CAPACITY", binding, hosted, local };
  return Object.freeze({ ...plan, digest: createHash("sha256").update(JSON.stringify(plan)).digest("hex") });
}
export function assessHostedCaptureCapacity({ binding, freeBytes }) {
  const plan = captureCapacityPlan(binding);
  return capacityObservation(plan, freeBytes);
}
function capacityObservation(plan, freeBytes) {
  if (!Number.isSafeInteger(freeBytes) || freeBytes < 0) fail("FREE_BYTES_INVALID");
  return Object.freeze({
    status:
      freeBytes > plan.hosted.additionalBytes
        ? "ESTIMATE_FITS_OBSERVED_FREE"
        : "ESTIMATE_EXCEEDS_OR_EQUALS_OBSERVED_FREE",
    plan,
    freeBytes,
    admission: false,
    qualification: false,
    writerBounded: false,
    hostedReserveBytes: 0,
    interpretation: "NONBINDING_TELEMETRY_ONLY;NORMAL_INSTALLED_GATES_UNCHANGED",
  });
}
async function hostedFreeBytes(root) {
  const stats = await statfs(root, { bigint: true });
  const bytes = stats.bavail * stats.bsize;
  if (bytes > BigInt(Number.MAX_SAFE_INTEGER)) fail("FREE_BYTES_INVALID");
  return Number(bytes);
}
export async function observeHostedCapacity({ root, binding, stage, source, measure = hostedFreeBytes }) {
  // Preinstall cannot claim canonical source/contract/plan digests not yet made.
  if (!["preinstall", "postinstall"].includes(stage)) fail("STAGE_INVALID");
  const identity = Object.freeze(
    Object.fromEntries(
      ["repository", "baseSha", "candidateSha", "runId", "runAttempt"].map((key) => [key, binding?.[key]]),
    ),
  );
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(identity.repository ?? "") ||
    identity.repository.length > 240 ||
    identity.repository.split("/").some((p) => p === "." || p === "..") ||
    ![identity.baseSha, identity.candidateSha].every((x) => /^[a-f0-9]{40}$/u.test(x ?? "")) ||
    ![identity.runId, identity.runAttempt].every((x) => /^[1-9][0-9]*$/u.test(x ?? ""))
  )
    fail("BINDING_INVALID");
  const sourceCopy = Object.freeze(
    Object.fromEntries(
      ["authorityModuleSha256", "authorityWorkflowSha256", "candidateLockSha256"].map((key) => [key, source?.[key]]),
    ),
  );
  if (
    !["authorityModuleSha256", "authorityWorkflowSha256", "candidateLockSha256"].every((k) =>
      /^[a-f0-9]{64}$/u.test(sourceCopy[k] ?? ""),
    )
  )
    fail("SOURCE_INVALID");
  const hosted = Object.freeze({
    resources,
    additionalBytes: resources.reduce((n, r) => n + r.bytes, 0),
    classification: "UNMEASURED_DRAFT_ESTIMATE_NOT_AN_ACCEPTED_REQUIREMENT",
  });
  const modelDigest = createHash("sha256").update(JSON.stringify(hosted)).digest("hex");
  const plan = Object.freeze({
    version: 1,
    stage,
    binding: identity,
    source: sourceCopy,
    modelDigest,
    hosted,
    bindingKind: "WORKFLOW_SOURCE_IDENTITY_ONLY_NO_CANONICAL_EXPERIENCE_PLAN",
    sourceKind: "BOUNDED_IMMUTABLE_COMMITTED_GIT_BLOBS_NOT_LIVE_FILE_SNAPSHOTS",
  });
  return capacityObservation(plan, await measure(root));
}
async function main() {
  const options = {},
    allowed = new Set(["workspace", "base", "candidate", "stage"]);
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.slice(2);
    if (!process.argv[i]?.startsWith("--") || !allowed.has(key) || Object.hasOwn(options, key) || !process.argv[i + 1])
      fail("ARGUMENTS_INVALID");
    options[key] = process.argv[i + 1];
  }
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.GITHUB_REF !== "refs/heads/main" ||
    process.env.GITHUB_SHA !== options.base
  )
    fail("PROTECTED_SOURCE_REQUIRED");
  const authority = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
    root = path.resolve(options.workspace);
  const git = (cwd, args, encoding = "utf8", maxBuffer = 2 * 1048576) =>
    execFileSync("git", args, {
      cwd,
      encoding,
      timeout: 5000,
      maxBuffer,
      env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    });
  if (
    git(authority, ["rev-parse", "HEAD"]).trim() !== options.base ||
    git(root, ["rev-parse", "HEAD"]).trim() !== options.candidate
  )
    fail("EXACT_SOURCE_REQUIRED");
  const source = {};
  for (const [key, dir, revision, file] of [
    ["authorityModuleSha256", authority, options.base, "scripts/sounding-line/experience-capacity.mjs"],
    ["authorityWorkflowSha256", authority, options.base, ".github/workflows/sounding-line-ordinary.yml"],
    ["candidateLockSha256", root, options.candidate, "package-lock.json"],
  ]) {
    const entry = git(dir, ["ls-tree", revision, "--", file]).trim();
    if (!/^100(?:644|755) blob [a-f0-9]{40}\t/u.test(entry)) fail("SOURCE_INVALID");
    git(dir, ["diff", "--quiet", revision, "--", file]);
    const bytes = git(dir, ["show", `${revision}:${file}`], "buffer", 1048576);
    if (!bytes.length || bytes.length > 1048576) fail("SOURCE_INVALID");
    source[key] = createHash("sha256").update(bytes).digest("hex");
  }
  const observation = await observeHostedCapacity({
    root,
    stage: options.stage,
    source,
    binding: {
      repository: process.env.GITHUB_REPOSITORY,
      baseSha: options.base,
      candidateSha: options.candidate,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    },
  });
  console.log(JSON.stringify(observation));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error("PRODUCT_EXPERIENCE_CAPACITY_OBSERVATION_UNAVAILABLE");
    process.exitCode = 1;
  });
}
