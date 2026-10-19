// One separately reserved, nonqualifying reconstruction of public source reads.
// This module never imports candidate code or enters consumer admission.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";
import { artifactJson } from "./experience-attestation.mjs";
import { exceptionStore } from "./experience-exception.mjs";
import { createCustodyRequest } from "./custody-transport.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const overlay = [
  [
    "experience-diagnosed-continuation.mjs",
    "aea9cd745dd779adcd6591cc594d6ea66b9dcdb039b93bbe294bd23e14580830",
    "2f2109f80e5dada200ef72f255d011bc387ef44febb8e51415ed481c85404b19",
  ],
  [
    "experience-exception.mjs",
    "f28e7698e97f99301685bdd6170951bcefcabf5db146703c4d992fe20b92c2bd",
    "40ee84a0e4ce74ebac31f6a0d4f15ac27ea18cf0a0b08d7504d712becd99a186",
  ],
  [
    "experience-r10.mjs",
    "d452e6e238834e0d876df0915f725e505308c4cb46bfe69a594fc4bbbea35552",
    "d6765a2bab70167a759465547b28c9ef48fc04225a3b0ee0e4c1aea89c87212e",
  ],
  [
    "experience-r11.mjs",
    "1e6071ca92cb485dc1ba1ab518b744dfe2b606ed2e2a62c2b825a1fd170416a4",
    "a2cbefb482d1f0fb98042bf4f5fc3fdca6e81b084e466b7308cc4af5f46928dd",
  ],
  [
    "experience-r8-format.mjs",
    "a13ff4bcb5ee2ea4c6148cce81d65ee57ccc7024c3deb7163fa05520bd269c01",
    "f575fdf8f67bd7007689d154956d0534af63060cc633e225a923e1d2c40059bc",
  ],
  [
    "experience-r9.mjs",
    "9a909535f24a490e05f6ba3b527b895e12d61214e9578ebca99d0f4bca5c781d",
    "d620c9414951716b5c683cfb5d023efb42a3ab4a8151808d82bd6d0af671349c",
  ],
  [
    "product-experience.mjs",
    "10f799c611b89a36a092c68f713ead6e6829b0ffb98063af115652e58a3468cc",
    "bbf4676a2d52a7526053a3d1310360bf1636a0d83b77f1e58f147cbb8e2a5064",
  ],
  ["source-diagnostics.mjs", null, "814cb7394c407665d6268e98675c66433b0be8efa6373d7f5ca62c42c24e89b9"],
  [
    "verification-diagnostics.mjs",
    "337c0483c342604ae212c3fe2708f9357c90242248a0376b39618c8eb795626e",
    "a323b080310a564036435bc748a0a9bf8b17e76acb10f082b60d90a5e1c889a3",
  ],
].map(([name, before, after]) => Object.freeze({ path: `scripts/sounding-line/${name}`, before, after }));
export const REPLAY_SOURCE_DIAGNOSTIC_POLICY = Object.freeze({
  version: 1,
  id: "CROSSDECK-ORDINARY6-SOURCE-DIAGNOSTIC-20261017",
  repository: "Kgray44/treasurehuntSoT",
  actor: "Kgray44",
  workflow: ".github/workflows/sounding-line-replay-admission-diagnostic.yml",
  namespace: "sounding-line-diagnostics/CROSSDECK-ORDINARY6-SOURCE-DIAGNOSTIC-20261017",
  slot: "attempt-1",
  expiry: "2026-10-22T23:59:59Z",
  candidate: "7681d297f281ab03f30b4224b8288b7c942024c6",
  candidateTree: "471d8540d803344d1c7d7794fb641d47c3d01817",
  base: "24fb189a90435ccb6021b63fd6953603ae090bc0",
  baseTree: "aa6a19ee46894b5abbcaa4c6dca9409c233e7b9b",
  instrumentation: "7b8616cf9d5e0f4c0f59de7e523c5d75f2e81e81",
  failedRun: 39004965102,
  failedSuite: 105707932574,
  custodyJob: 117315442535,
  focusedJob: 117316423743,
  mainlineJob: 117320859655,
  artifactId: 12091437088,
  archiveBytes: 664974,
  archiveDigest: "9919037f8cdc51ed037afff0a1c800d6f22e6ac2c60e5ceaf6d4146b03972384",
  memberName: "ordinary-decision.json",
  memberBytes: 3995675,
  memberDigest: "64606358a5501e2c2914bee8c31271446adafa7a9bc195b95cc435b2f97f6c85",
  sourceDigest: "a63073cbf3850900c91a25979467bb68f3930812e23af3f6daab00b21ab5d17a",
  contractDigest: "33b7621269fa18417c20713ccc185783861ef043e38a527f727df7e1047c7274",
  exceptionId: "PE-X-CROSSDECK-FINAL-VERIFY-20261015-R13",
  registryDigest: "d0375b04a1ff873a0837b546918b193ebff69725a098a92d2e582cc28fec2659",
  overlay: Object.freeze(overlay),
  limits: Object.freeze({
    archive: 1024 * 1024,
    json: 8 * 1024 * 1024,
    timeoutMs: 20000,
    childMs: 120000,
    receipt: 65536,
  }),
});
const P = REPLAY_SOURCE_DIAGNOSTIC_POLICY;
export const replaySourceDiagnosticPolicyDigest = hash(JSON.stringify(P));
const fail = (code) => {
  const error = new Error(`SOURCE_DIAGNOSTIC_${code}`);
  error.diagnosticCode = code;
  throw error;
};
const requireValue = (condition, code) => {
  if (!condition) fail(code);
};
const codes = new Set([
  "CONTEXT_INVALID",
  "EXPIRED",
  "CHECKOUT_INVALID",
  "PATH_INVALID",
  "BINDING_INVALID",
  "PROTECTION_INVALID",
  "HISTORY_INVALID",
  "SLOT_CONSUMED",
  "WRITE_OUTCOME_UNKNOWN",
  "RESERVATION_INVALID",
  "READ_ONLY_REQUEST_REQUIRED",
  "ARTIFACT_INVALID",
  "ARCHIVE_INVALID",
  "ARCHIVE_TRANSPORT_FAILED",
  "ARCHIVE_TOO_LARGE",
  "OVERLAY_INVALID",
  "SOURCE_POSTCONDITION_INVALID",
  "SOURCE_CHILD_INVALID",
  "SOURCE_CHILD_UNKNOWN",
  "OUTPUT_INVALID",
  "CLI_INVALID",
  "ORIGINAL_PLAN_INVALID",
  "SOURCE_SENTINEL_CALLED",
  "SOURCE_HELPER_RESULT_INVALID",
]);
const safeCode = (error) => (codes.has(error?.diagnosticCode) ? error.diagnosticCode : "EXECUTION_UNKNOWN");
const git = (root, args, binary = false) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: binary ? undefined : "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 32 * 1024 * 1024,
    timeout: P.limits.timeoutMs,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
const gitText = (root, ...args) => git(root, args).trim();
const exactFile = (root, file) => {
  const target = path.join(root, file);
  requireValue(lstatSync(target).isFile() && !lstatSync(target).isSymbolicLink(), "CHECKOUT_INVALID");
  requireValue(realpathSync(target) === target, "CHECKOUT_INVALID");
  return readFileSync(target);
};
function directory(workspace, name, supplied) {
  const expected = path.join(workspace, name);
  requireValue(
    path.isAbsolute(workspace) && supplied === expected && realpathSync(workspace) === workspace,
    "PATH_INVALID",
  );
  requireValue(
    lstatSync(expected).isDirectory() && !lstatSync(expected).isSymbolicLink() && realpathSync(expected) === expected,
    "PATH_INVALID",
  );
  return expected;
}
export function validateDiagnosticPaths({ workspace, installer, authority, candidate, output, mode }) {
  directory(workspace, "installer", installer);
  if (mode === "diagnose") {
    directory(workspace, "authority", authority);
    directory(workspace, "candidate", candidate);
  }
  const receipts = path.join(workspace, "receipts");
  requireValue(
    output === path.join(receipts, mode === "reserve" ? "reservation.json" : "reproduction.json"),
    "PATH_INVALID",
  );
  if (!existsSync(receipts)) mkdirSync(receipts);
  directory(workspace, "receipts", receipts);
  requireValue(!existsSync(output), "OUTPUT_INVALID");
  return { installer, authority, candidate, receipts, output };
}
export function diagnosticCheckoutSnapshot(root) {
  const gitDirectory = path.join(root, ".git");
  requireValue(
    lstatSync(gitDirectory).isDirectory() &&
      !lstatSync(gitDirectory).isSymbolicLink() &&
      realpathSync(gitDirectory) === gitDirectory,
    "CHECKOUT_INVALID",
  );
  const shallow = gitText(root, "rev-parse", "--is-shallow-repository") === "true";
  return {
    head: gitText(root, "rev-parse", "HEAD"),
    tree: gitText(root, "rev-parse", "HEAD^{tree}"),
    shallow,
    shallowDigest: shallow ? hash(readFileSync(path.join(gitDirectory, "shallow"))) : null,
    indexDigest: hash(readFileSync(path.join(gitDirectory, "index"))),
    refsDigest: hash(git(root, ["for-each-ref", "--format=%(refname) %(objecttype) %(objectname)"])),
    status: git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
    registryDigest: hash(exactFile(root, "testing/product-experience-exceptions.json")),
  };
}
function cleanCheckout(root, head, tree, shallow) {
  const snapshot = diagnosticCheckoutSnapshot(root);
  requireValue(
    snapshot.head === head &&
      (!tree || snapshot.tree === tree) &&
      snapshot.shallow === shallow &&
      snapshot.status === "" &&
      snapshot.registryDigest === P.registryDigest,
    "CHECKOUT_INVALID",
  );
  return snapshot;
}
export function validateDiagnosticEnvironment(environment, job, now = new Date()) {
  requireValue(Number.isFinite(now.getTime()) && now <= new Date(P.expiry), "EXPIRED");
  requireValue(
    environment.GITHUB_ACTIONS === "true" &&
      environment.GITHUB_REPOSITORY === P.repository &&
      environment.GITHUB_REF === "refs/heads/main" &&
      sha(environment.GITHUB_SHA) &&
      environment.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      environment.GITHUB_RUN_ATTEMPT === "1" &&
      environment.GITHUB_ACTOR === P.actor &&
      environment.GITHUB_TRIGGERING_ACTOR === P.actor &&
      environment.GITHUB_WORKFLOW_REF === `${P.repository}/${P.workflow}@refs/heads/main` &&
      environment.GITHUB_JOB === job &&
      /^[1-9][0-9]*$/u.test(environment.GITHUB_RUN_ID ?? "") &&
      !Object.entries(environment).some(
        ([key, value]) => value && /^SOUNDING_LINE_(?:EXCEPTION_|R\d+_LOCAL_LEASE)/u.test(key),
      ),
    "CONTEXT_INVALID",
  );
  return { runId: Number(environment.GITHUB_RUN_ID), installerSha: environment.GITHUB_SHA };
}
export function createReadOnlyDiagnosticRequest(request) {
  return (endpoint, method = "GET", body) => {
    requireValue(method === "GET" && body === undefined, "READ_ONLY_REQUEST_REQUIRED");
    return request(endpoint, method);
  };
}
export async function validateDiagnosticExecution({ request, environment, installerSha, job, now }) {
  const identity = validateDiagnosticEnvironment(environment, job, now);
  requireValue(identity.installerSha === installerSha, "BINDING_INVALID");
  const run = await request(`actions/runs/${identity.runId}`);
  const workflow = await request(`actions/workflows/${run?.workflow_id}`);
  const main = await request("branches/main");
  const pull = await request("pulls/721");
  requireValue(
    run?.id === identity.runId &&
      run.run_attempt === 1 &&
      run.event === "workflow_dispatch" &&
      run.head_sha === installerSha &&
      run.head_branch === "main" &&
      run.path === P.workflow &&
      run.status === "in_progress" &&
      run.conclusion === null &&
      run.repository?.full_name === P.repository &&
      run.head_repository?.full_name === P.repository &&
      run.actor?.login === P.actor &&
      run.triggering_actor?.login === P.actor &&
      workflow?.id === run.workflow_id &&
      workflow.path === P.workflow &&
      workflow.state === "active",
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
    pull?.state === "open" &&
      pull.draft === true &&
      pull.merged === false &&
      pull.base?.ref === "main" &&
      pull.base.repo?.full_name === P.repository &&
      pull.head?.repo?.full_name === P.repository &&
      pull.head.sha === P.candidate,
    "BINDING_INVALID",
  );
  // No status filter: a cancelled/failed earlier dispatch also consumes the one opportunity.
  const history = await request(`actions/workflows/${workflow.id}/runs?event=workflow_dispatch&per_page=100&page=1`);
  requireValue(
    history?.total_count === 1 &&
      history.workflow_runs?.length === 1 &&
      history.workflow_runs[0].id === identity.runId &&
      history.workflow_runs[0].run_attempt === 1 &&
      history.workflow_runs[0].head_sha === installerSha &&
      history.workflow_runs[0].event === "workflow_dispatch" &&
      history.workflow_runs[0].path === P.workflow,
    "HISTORY_INVALID",
  );
  return { ...identity, workflowId: workflow.id, runAttempt: 1, policyDigest: replaySourceDiagnosticPolicyDigest };
}
function reservationBinding(execution) {
  return {
    baseSha: execution.installerSha,
    diagnosticId: P.id,
    policyDigest: replaySourceDiagnosticPolicyDigest,
    runId: execution.runId,
    runAttempt: 1,
    workflowId: execution.workflowId,
    originalCandidate: P.candidate,
    originalBase: P.base,
    originalRun: P.failedRun,
    originalArchiveDigest: P.archiveDigest,
  };
}
const diagnosticRecord = Object.freeze({ id: P.id, custody: { namespace: P.namespace } });
export async function createDiagnosticReservation({ request, execution }) {
  const store = exceptionStore({ record: diagnosticRecord, request });
  try {
    const claim = await store.create(P.slot, {
      binding: reservationBinding(execution),
      diagnosticOnly: true,
      grantsQualification: false,
      originalCauseClaim: false,
    });
    requireValue(sha(claim.commitSha), "RESERVATION_INVALID");
    return claim;
  } catch (error) {
    if (error?.message === "PRODUCT_EXPERIENCE_EXCEPTION_SLOT_CONSUMED") fail("SLOT_CONSUMED");
    if (error?.message === "PRODUCT_EXPERIENCE_EXCEPTION_CUSTODY_WRITE_OUTCOME_UNKNOWN") fail("WRITE_OUTCOME_UNKNOWN");
    throw error;
  }
}
export async function readDiagnosticReservation({ request, execution, reservation }) {
  requireValue(sha(reservation), "RESERVATION_INVALID");
  const claim = await exceptionStore({
    record: diagnosticRecord,
    request: createReadOnlyDiagnosticRequest(request),
  }).read(P.slot);
  requireValue(
    claim?.commitSha === reservation &&
      claim.version === 1 &&
      claim.exceptionId === P.id &&
      same(claim.binding, reservationBinding(execution)) &&
      claim.diagnosticOnly === true &&
      claim.grantsQualification === false &&
      claim.originalCauseClaim === false,
    "RESERVATION_INVALID",
  );
  return claim;
}
export async function readBoundedDiagnosticBody(response, maximum) {
  const declared = response.headers.get("content-length");
  requireValue(!declared || (/^\d+$/u.test(declared) && Number(declared) <= maximum), "ARCHIVE_TOO_LARGE");
  const reader = response.body?.getReader();
  requireValue(reader, "ARCHIVE_TRANSPORT_FAILED");
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      requireValue(length <= maximum, "ARCHIVE_TOO_LARGE");
      chunks.push(Buffer.from(item.value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export async function downloadDiagnosticArchive({ token, fetchImpl = globalThis.fetch }) {
  requireValue(typeof token === "string" && token.length > 0, "ARCHIVE_TRANSPORT_FAILED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), P.limits.timeoutMs);
  timer.unref?.();
  let target = `https://api.github.com/repos/${P.repository}/actions/artifacts/${P.artifactId}/zip`;
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const url = new URL(target);
      requireValue(url.protocol === "https:" && !url.username && !url.password, "ARCHIVE_TRANSPORT_FAILED");
      const headers =
        url.hostname === "api.github.com"
          ? {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            }
          : {};
      const response = await fetchImpl(url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        requireValue(location && redirects < 3, "ARCHIVE_TRANSPORT_FAILED");
        target = new URL(location, url).href;
        continue;
      }
      requireValue(response.ok, "ARCHIVE_TRANSPORT_FAILED");
      const archive = await readBoundedDiagnosticBody(response, P.limits.archive);
      requireValue(archive.length === P.archiveBytes && hash(archive) === P.archiveDigest, "ARCHIVE_INVALID");
      return archive;
    }
    fail("ARCHIVE_TRANSPORT_FAILED");
  } catch (error) {
    if (error?.diagnosticCode) throw error;
    fail("ARCHIVE_TRANSPORT_FAILED");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export function strictDiagnosticZipMember(archive, expected) {
  requireValue(
    Buffer.isBuffer(archive) && archive.length <= P.limits.archive && expected && expected.bytes <= P.limits.json,
    "ARCHIVE_INVALID",
  );
  // The exact pinned ZIP has one entry. Check EOCD, central/local bounds and raw
  // member hash without extracting paths or rewriting the original archive.
  const end = archive.length - 22;
  requireValue(
    end >= 0 &&
      archive.readUInt32LE(end) === 0x06054b50 &&
      archive.readUInt16LE(end + 4) === 0 &&
      archive.readUInt16LE(end + 6) === 0 &&
      archive.readUInt16LE(end + 8) === 1 &&
      archive.readUInt16LE(end + 10) === 1 &&
      archive.readUInt16LE(end + 20) === 0,
    "ARCHIVE_INVALID",
  );
  const central = archive.readUInt32LE(end + 16);
  requireValue(
    central + archive.readUInt32LE(end + 12) === end &&
      central + 46 <= end &&
      archive.readUInt32LE(central) === 0x02014b50,
    "ARCHIVE_INVALID",
  );
  const nameLength = archive.readUInt16LE(central + 28),
    extra = archive.readUInt16LE(central + 30),
    comment = archive.readUInt16LE(central + 32);
  requireValue(
    central + 46 + nameLength + extra + comment === end &&
      archive.subarray(central + 46, central + 46 + nameLength).toString() === expected.name &&
      [0, 8].includes(archive.readUInt16LE(central + 8)) &&
      archive.readUInt32LE(central + 24) === expected.bytes,
    "ARCHIVE_INVALID",
  );
  const local = archive.readUInt32LE(central + 42),
    compressed = archive.readUInt32LE(central + 20),
    method = archive.readUInt16LE(central + 10);
  requireValue(
    local + 30 <= central &&
      archive.readUInt32LE(local) === 0x04034b50 &&
      archive.readUInt16LE(local + 6) === archive.readUInt16LE(central + 8) &&
      archive.readUInt16LE(local + 8) === method,
    "ARCHIVE_INVALID",
  );
  const localNameLength = archive.readUInt16LE(local + 26),
    start = local + 30 + localNameLength + archive.readUInt16LE(local + 28);
  const descriptor = archive.readUInt16LE(central + 8) === 8 ? 16 : 0;
  requireValue(
    start + compressed + descriptor === central &&
      archive.subarray(local + 30, local + 30 + localNameLength).toString() === expected.name,
    "ARCHIVE_INVALID",
  );
  if (descriptor)
    requireValue(
      archive.readUInt32LE(start + compressed) === 0x08074b50 &&
        archive.readUInt32LE(start + compressed + 4) === archive.readUInt32LE(central + 16) &&
        archive.readUInt32LE(start + compressed + 8) === compressed &&
        archive.readUInt32LE(start + compressed + 12) === expected.bytes,
      "ARCHIVE_INVALID",
    );
  const data = archive.subarray(start, start + compressed);
  const bytes = method === 0 ? data : method === 8 ? inflateRawSync(data, { maxOutputLength: P.limits.json }) : null;
  requireValue(bytes && bytes.length === expected.bytes && hash(bytes) === expected.digest, "ARCHIVE_INVALID");
  return bytes;
}
export function originalDecisionMember(archive) {
  requireValue(archive.length === P.archiveBytes && hash(archive) === P.archiveDigest, "ARCHIVE_INVALID");
  const bytes = strictDiagnosticZipMember(archive, {
    name: P.memberName,
    bytes: P.memberBytes,
    digest: P.memberDigest,
  });
  const decision = artifactJson(archive, P.memberName);
  requireValue(
    hash(Buffer.from(JSON.stringify(JSON.parse(bytes)))) === hash(Buffer.from(JSON.stringify(decision))),
    "ARCHIVE_INVALID",
  );
  return { bytes, decision };
}
export function validateOriginalDecision(decision) {
  const plan = decision?.productExperience;
  requireValue(
    decision?.decision === "FAIL" &&
      decision.baseSha === P.base &&
      decision.candidateSha === P.candidate &&
      decision.baseTree === P.baseTree &&
      decision.candidateTree === P.candidateTree &&
      decision.failureObservation?.stage === "REPLAY_ADMISSION" &&
      decision.failureObservation.exitCode === 1 &&
      decision.productExperienceReplay === undefined &&
      plan?.applicable === true &&
      plan.baseSha === P.base &&
      plan.candidateSha === P.candidate &&
      plan.sourceDigest === P.sourceDigest &&
      plan.contractDigest === P.contractDigest &&
      plan.contextCount === 38 &&
      plan.exception?.id === P.exceptionId,
    "ORIGINAL_PLAN_INVALID",
  );
  return plan;
}
export async function loadOriginalDecision({ request, token, directory: outputDirectory, fetchImpl }) {
  const artifact = await request(`actions/artifacts/${P.artifactId}`);
  const run = await request(`actions/runs/${P.failedRun}`);
  const jobs = await request(`actions/runs/${P.failedRun}/jobs?filter=all&per_page=100&page=1`);
  requireValue(
    artifact?.id === P.artifactId &&
      artifact.name === `sounding-line-ordinary-${P.candidate}` &&
      artifact.expired === false &&
      artifact.size_in_bytes === P.archiveBytes &&
      artifact.digest === `sha256:${P.archiveDigest}` &&
      artifact.workflow_run?.id === P.failedRun &&
      artifact.workflow_run.head_sha === P.candidate &&
      run?.id === P.failedRun &&
      run.run_attempt === 1 &&
      run.conclusion === "failure" &&
      run.event === "pull_request_target" &&
      run.head_sha === P.candidate &&
      run.check_suite_id === P.failedSuite &&
      run.path === ".github/workflows/sounding-line-ordinary.yml" &&
      run.actor?.login === P.actor &&
      run.triggering_actor?.login === P.actor &&
      run.repository?.full_name === P.repository &&
      jobs?.total_count === jobs.jobs?.length &&
      jobs.jobs.length <= 100 &&
      [
        [P.custodyJob, "success"],
        [P.focusedJob, "failure"],
        [P.mainlineJob, "failure"],
      ].every(([id, conclusion]) =>
        jobs.jobs.some((job) => job.id === id && job.run_id === P.failedRun && job.conclusion === conclusion),
      ),
    "ARTIFACT_INVALID",
  );
  const archive = await downloadDiagnosticArchive({ token, fetchImpl });
  const { bytes, decision } = originalDecisionMember(archive);
  const plan = validateOriginalDecision(decision);
  writeFileSync(path.join(outputDirectory, "ordinary6.original.zip"), archive, { flag: "wx", mode: 0o600 });
  writeFileSync(path.join(outputDirectory, "ordinary-decision.original.json"), bytes, { flag: "wx", mode: 0o600 });
  return {
    plan,
    provenance: {
      artifactId: P.artifactId,
      originalRunId: P.failedRun,
      archiveBytes: archive.length,
      archiveDigest: hash(archive),
      memberBytes: bytes.length,
      memberDigest: hash(bytes),
      planDigest: hash(JSON.stringify(plan)),
    },
  };
}
export function installHistoricalOverlay({ installer, authority, candidate, installerSha }) {
  const installerBefore = cleanCheckout(installer, installerSha, null, true);
  const authorityBefore = cleanCheckout(authority, P.base, P.baseTree, true);
  const candidateBefore = cleanCheckout(candidate, P.candidate, P.candidateTree, false);
  const originMain = gitText(candidate, "rev-parse", "origin/main");
  requireValue(originMain === installerSha, "CHECKOUT_INVALID");
  const content = [];
  for (const entry of P.overlay) {
    const bytes = exactFile(installer, entry.path);
    requireValue(
      hash(bytes) === entry.after &&
        hash(git(installer, ["show", `${installerSha}:${entry.path}`], true)) === entry.after,
      "OVERLAY_INVALID",
    );
    const target = path.join(authority, entry.path);
    if (entry.before)
      requireValue(
        hash(exactFile(authority, entry.path)) === entry.before &&
          hash(git(authority, ["show", `${P.base}:${entry.path}`], true)) === entry.before,
        "OVERLAY_INVALID",
      );
    else requireValue(!existsSync(target), "OVERLAY_INVALID");
    content.push([target, bytes, entry.before]);
  }
  // All validation completes before any overlay byte is written. No Git write.
  for (const [target, bytes, previous] of content) writeFileSync(target, bytes, { flag: previous ? "w" : "wx" });
  const baseline = { installer: installerBefore, authority: authorityBefore, candidate: candidateBefore, originMain };
  verifyHistoricalOverlay({ installer, authority, candidate, installerSha, baseline });
  return baseline;
}
export function verifyHistoricalOverlay({ installer, authority, candidate, installerSha, baseline }) {
  const installed = cleanCheckout(installer, installerSha, baseline.installer.tree, true);
  const subject = cleanCheckout(candidate, P.candidate, P.candidateTree, false);
  const historical = diagnosticCheckoutSnapshot(authority);
  for (const [before, after] of [
    [baseline.installer, installed],
    [baseline.authority, historical],
    [baseline.candidate, subject],
  ])
    requireValue(
      ["indexDigest", "refsDigest", "shallowDigest"].every((field) => before[field] === after[field]),
      "SOURCE_POSTCONDITION_INVALID",
    );
  const expectedStatus = P.overlay
    .map((entry) => `${entry.before ? " M" : "??"} ${entry.path}\n`)
    .sort()
    .join("");
  requireValue(
    historical.head === P.base &&
      historical.tree === P.baseTree &&
      historical.shallow === true &&
      historical.registryDigest === P.registryDigest &&
      historical.status
        .split(/(?<=\n)/u)
        .filter(Boolean)
        .sort()
        .join("") === expectedStatus &&
      gitText(candidate, "rev-parse", "origin/main") === baseline.originMain &&
      P.overlay.every((entry) => hash(exactFile(authority, entry.path)) === entry.after),
    "SOURCE_POSTCONDITION_INVALID",
  );
  return { installer: installed, authority: historical, candidate: subject, originMain: baseline.originMain };
}
export function sourceDiagnosticChildEnvironment(environment) {
  const safe = {};
  for (const name of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "TZ",
    "GITHUB_ACTIONS",
    "GITHUB_REPOSITORY",
    "GITHUB_REF",
    "GITHUB_SHA",
    "GITHUB_RUN_ID",
    "GITHUB_RUN_ATTEMPT",
    "GITHUB_EVENT_NAME",
    "GITHUB_JOB",
    "GITHUB_ACTOR",
    "GITHUB_TRIGGERING_ACTOR",
    "GITHUB_WORKFLOW_REF",
  ])
    if (typeof environment[name] === "string") safe[name] = environment[name];
  return safe;
}
const excludedStages = Object.freeze([
  "EXECUTOR_CONTEXT",
  "LOCAL_LEASE",
  "ORDINARY_LEASE",
  "CUSTODY_REQUEST",
  "LIVE_CONTEXT",
  "HISTORICAL_CUSTODY",
  "RESERVATION",
  "TECHNICAL_COMPLETE",
  "PHASE_CLAIM",
]);
export function diagnosticFailureResult(error, sourceExecutionStarted = false) {
  const failure = safeCode(error);
  return {
    status:
      sourceExecutionStarted || ["WRITE_OUTCOME_UNKNOWN", "SOURCE_CHILD_UNKNOWN", "EXECUTION_UNKNOWN"].includes(failure)
        ? "EXECUTION_UNKNOWN"
        : "DIAGNOSTIC_SETUP_OR_BINDING_FAILURE",
    failure,
    completeness: "DIAGNOSTIC_INCOMPLETE",
  };
}
export function sourceDiagnosticResult(result) {
  requireValue(
    result &&
      ["NOT_REPRODUCED", "SOURCE_OPERATION_FAILURE_REPRODUCED", "SOURCE_RECONSTRUCTION_FAILURE"].includes(
        result.status,
      ) &&
      result.completeness === "DIAGNOSTIC_INCOMPLETE" &&
      result.originalCauseClaim === false &&
      result.qualification === false &&
      result.productExecutions === 0 &&
      result.consumerAdmissions === 0 &&
      result.networkRequests === 0 &&
      Array.isArray(result.milestones) &&
      result.milestones.every((value) =>
        [
          "SOURCE_RECOGNITION",
          "PLAN_INPUT",
          "REGISTRY_READ",
          "CAMPAIGN_RELATION",
          "HEAD_CHECK",
          "PLAN_REBUILD",
          "PLAN_COMPARE",
          "HISTORICAL_PREPARE",
        ].includes(value),
      ),
    "SOURCE_CHILD_INVALID",
  );
  const complete = [
    "SOURCE_RECOGNITION",
    "PLAN_INPUT",
    "REGISTRY_READ",
    "CAMPAIGN_RELATION",
    "HEAD_CHECK",
    "PLAN_REBUILD",
    "PLAN_COMPARE",
    "REGISTRY_READ",
    "HISTORICAL_PREPARE",
  ];
  requireValue(
    result.status !== "NOT_REPRODUCED" || (same(result.milestones, complete) && !result.observation),
    "SOURCE_CHILD_INVALID",
  );
  requireValue(
    result.status !== "SOURCE_OPERATION_FAILURE_REPRODUCED" || Boolean(result.observation?.replayAdmission?.git),
    "SOURCE_CHILD_INVALID",
  );
  return result;
}
export async function runSourcePrefixChild({ workspace, installer, authority, candidate, member }) {
  // Called only by the fixed private child protocol. Recheck immutable public
  // bytes before imports; there is no API client or admission/lease in this child.
  directory(workspace, "installer", installer);
  directory(workspace, "authority", authority);
  directory(workspace, "candidate", candidate);
  requireValue(
    member === path.join(workspace, "receipts", "ordinary-decision.original.json") &&
      !Object.keys(process.env).some((key) => /^(?:GH_TOKEN|GITHUB_TOKEN|SOUNDING_LINE_)/u.test(key)),
    "CONTEXT_INVALID",
  );
  const originalBytes = exactFile(workspace, "receipts/ordinary-decision.original.json");
  requireValue(
    originalBytes.length === P.memberBytes && hash(originalBytes) === P.memberDigest,
    "ORIGINAL_PLAN_INVALID",
  );
  const plan = validateOriginalDecision(JSON.parse(originalBytes));
  requireValue(
    P.overlay.every((entry) => hash(exactFile(authority, entry.path)) === entry.after),
    "OVERLAY_INVALID",
  );
  globalThis.fetch = () => fail("SOURCE_SENTINEL_CALLED");
  const exception = await import(pathToFileURL(path.join(authority, "scripts/sounding-line/experience-exception.mjs")));
  const experience = await import(pathToFileURL(path.join(authority, "scripts/sounding-line/product-experience.mjs")));
  const diagnostic = await import(
    pathToFileURL(path.join(authority, "scripts/sounding-line/verification-diagnostics.mjs"))
  );
  const source = await import(pathToFileURL(path.join(authority, "scripts/sounding-line/source-diagnostics.mjs")));
  const sourceGit = (...args) =>
    source
      .sourceDiagnosticGit("EXPERIENCE_EXCEPTION", args, {
        cwd: candidate,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      })
      .trim();
  const milestones = [];
  const substage = async (name, operation) => {
    const value = await source.withReplayAdmissionSubstage(name, operation);
    milestones.push(name);
    return value;
  };
  let observation = null,
    rebuilt = null;
  try {
    await diagnostic.withVerificationStage("REPLAY_ADMISSION", async () => {
      requireValue(
        await substage("SOURCE_RECOGNITION", () =>
          exception.recognizeExceptionExecution({
            root: candidate,
            baseSha: P.base,
            candidateSha: P.candidate,
            environment: { SOUNDING_LINE_PR_NUMBER: "721" },
          }),
        ),
        "SOURCE_HELPER_RESULT_INVALID",
      );
      await substage("PLAN_INPUT", () => validateOriginalDecision(JSON.parse(originalBytes)));
      const records = await substage("REGISTRY_READ", () => exception.trustedExceptions(candidate, P.base));
      requireValue(
        await substage("CAMPAIGN_RELATION", () =>
          records.some((record) =>
            exception.campaignRelated({
              root: candidate,
              baseSha: P.base,
              candidateSha: P.candidate,
              record,
              prNumber: "721",
            }),
          ),
        ),
        "SOURCE_HELPER_RESULT_INVALID",
      );
      requireValue(
        (await substage("HEAD_CHECK", () => sourceGit("rev-parse", "HEAD"))) === P.candidate,
        "SOURCE_HELPER_RESULT_INVALID",
      );
      rebuilt = await substage("PLAN_REBUILD", () =>
        experience.planProductExperience({
          root: candidate,
          baseSha: P.base,
          candidateSha: P.candidate,
          changedPaths: sourceGit("diff", "--name-only", "--no-renames", P.base, P.candidate).split(/\r?\n/u),
          prNumber: "721",
        }),
      );
      await substage("PLAN_COMPARE", () => exception.validateExceptionExecutionPlan(plan, rebuilt));
      const record = await substage("REGISTRY_READ", () =>
        exception.trustedExceptions(candidate, P.base).find((value) => value.id === rebuilt.exception?.id),
      );
      requireValue(record?.id === P.exceptionId, "SOURCE_HELPER_RESULT_INVALID");
      await substage("HISTORICAL_PREPARE", () => {
        const context = exception.historicalExceptionContext({
          root: candidate,
          plan,
          request: () => fail("SOURCE_SENTINEL_CALLED"),
        });
        requireValue(context?.record && context?.plan && context?.store, "SOURCE_HELPER_RESULT_INVALID");
        // The returned store is deliberately never read or invoked.
      });
    });
  } catch (error) {
    observation = diagnostic.verificationFailureObservation(error);
  }
  const complete = [
    "SOURCE_RECOGNITION",
    "PLAN_INPUT",
    "REGISTRY_READ",
    "CAMPAIGN_RELATION",
    "HEAD_CHECK",
    "PLAN_REBUILD",
    "PLAN_COMPARE",
    "REGISTRY_READ",
    "HISTORICAL_PREPARE",
  ];
  if (!observation && !same(milestones, complete)) fail("SOURCE_HELPER_RESULT_INVALID");
  const sourceFailure = observation?.replayAdmission?.git;
  return {
    version: 1,
    status: sourceFailure
      ? "SOURCE_OPERATION_FAILURE_REPRODUCED"
      : observation
        ? "SOURCE_RECONSTRUCTION_FAILURE"
        : "NOT_REPRODUCED",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    milestones,
    observation,
    planDigest: rebuilt ? hash(JSON.stringify(rebuilt)) : null,
    excludedStages,
    productExecutions: 0,
    consumerAdmissions: 0,
    networkRequests: 0,
    scratchWrites: "EXISTING_OWNED_TEMPORARY_METADATA_MERGES_ONLY",
    sourceErrorWithoutGitObservation: Boolean(observation && !sourceFailure),
  };
}
const sourceChildProgram = `
import { runSourcePrefixChild } from "./scripts/sounding-line/replay-admission-source-diagnostic.mjs";
let input = "";
for await (const chunk of process.stdin) { input += chunk; if (Buffer.byteLength(input) > 8192) process.exit(2); }
try { const result = await runSourcePrefixChild(JSON.parse(input)); process.stdout.write(JSON.stringify(result)); }
catch { process.stdout.write(JSON.stringify({ version: 1, status: "SOURCE_CHILD_SETUP_FAILURE" })); process.exitCode = 1; }
`;
export function executeSourceDiagnosticChild({ workspace, installer, authority, candidate, environment }) {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", sourceChildProgram], {
    cwd: installer,
    env: sourceDiagnosticChildEnvironment(environment),
    encoding: "utf8",
    input: JSON.stringify({
      workspace,
      installer,
      authority,
      candidate,
      member: path.join(workspace, "receipts", "ordinary-decision.original.json"),
    }),
    stdio: ["pipe", "pipe", "ignore"],
    timeout: P.limits.childMs,
    maxBuffer: P.limits.receipt,
  });
  requireValue(
    !child.error &&
      child.signal === null &&
      child.status === 0 &&
      Buffer.byteLength(child.stdout ?? "") <= P.limits.receipt,
    "SOURCE_CHILD_UNKNOWN",
  );
  try {
    return sourceDiagnosticResult(JSON.parse(child.stdout));
  } catch (error) {
    if (error?.diagnosticCode) throw error;
    fail("SOURCE_CHILD_INVALID");
  }
}
function writeReceipt(target, value) {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  requireValue(Buffer.byteLength(bytes) <= P.limits.receipt, "OUTPUT_INVALID");
  writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
}
export async function runReplaySourceDiagnostic({ mode, paths, reservation, environment = process.env }) {
  const safePaths = validateDiagnosticPaths({ ...paths, mode });
  const receipt = {
    version: 1,
    diagnosticId: P.id,
    policyDigest: replaySourceDiagnosticPolicyDigest,
    status: "EXECUTION_UNKNOWN",
    completeness: "DIAGNOSTIC_INCOMPLETE",
    originalCauseClaim: false,
    qualification: false,
    grantsConsumerTrial: false,
    originalOrdinaryRun: P.failedRun,
    candidate: P.candidate,
    historicalBase: P.base,
    reservation: null,
    controllerNetwork: { apiGetAttempts: 0, apiPostAttempts: 0, archiveGetAttempts: 0 },
  };
  let success = false;
  try {
    const job = mode === "reserve" ? "reserve-diagnostic" : "source-diagnostic";
    const head = gitText(safePaths.installer, "rev-parse", "HEAD");
    cleanCheckout(safePaths.installer, head, null, true);
    const token = environment.GH_TOKEN ?? environment.GITHUB_TOKEN;
    const transport = createCustodyRequest({
      repository: P.repository,
      token,
      report: () => {},
      fetchImpl: (url, options) => {
        if (options.method === "GET") receipt.controllerNetwork.apiGetAttempts++;
        if (options.method === "POST") receipt.controllerNetwork.apiPostAttempts++;
        return globalThis.fetch(url, options);
      },
    });
    const readonly = createReadOnlyDiagnosticRequest(transport);
    const execution = await validateDiagnosticExecution({ request: readonly, environment, installerSha: head, job });
    receipt.execution = execution;
    const gitVersion = gitText(safePaths.installer, "--version");
    requireValue(/^git version [0-9]+\.[0-9]+\.[0-9]+$/u.test(gitVersion), "CHECKOUT_INVALID");
    receipt.runtime = {
      platform: process.platform,
      architecture: process.arch,
      node: process.versions.node,
      git: gitVersion,
    };
    if (mode === "reserve") {
      requireValue(
        typeof environment.GITHUB_OUTPUT === "string" &&
          path.isAbsolute(environment.GITHUB_OUTPUT) &&
          lstatSync(environment.GITHUB_OUTPUT).isFile(),
        "OUTPUT_INVALID",
      );
      const claim = await createDiagnosticReservation({ request: transport, execution });
      receipt.reservation = claim.commitSha;
      receipt.status = "DIAGNOSTIC_RESERVED";
      writeReceipt(safePaths.output, receipt);
      // No output granting the worker permission exists before confirmed creation.
      appendFileSync(environment.GITHUB_OUTPUT, `reservation=${claim.commitSha}\n`);
      success = true;
      return receipt;
    }
    const claim = await readDiagnosticReservation({ request: readonly, execution, reservation });
    receipt.reservation = claim.commitSha;
    const original = await loadOriginalDecision({
      request: readonly,
      token,
      directory: safePaths.receipts,
      fetchImpl: (url, options) => {
        receipt.controllerNetwork.archiveGetAttempts++;
        return globalThis.fetch(url, options);
      },
    });
    receipt.original = original.provenance;
    const baseline = installHistoricalOverlay({ ...safePaths, installerSha: head });
    receipt.reconstructionDifferences = {
      candidateOriginMain: baseline.originMain,
      authority: "HISTORICAL_SHALLOW_B3_WITH_NINE_FILE_OBSERVATIONAL_OVERLAY",
      technicalWorkloadReplayed: false,
      historicalProcessRecreated: false,
      historicalRunnerImageRecreated: false,
      checkoutCredentialsPersisted: false,
    };
    let child;
    receipt.sourceExecutionStarted = true;
    try {
      child = executeSourceDiagnosticChild({ ...safePaths, workspace: paths.workspace, environment });
    } finally {
      receipt.postconditions = verifyHistoricalOverlay({ ...safePaths, installerSha: head, baseline });
      // Status vectors contain only nine fixed public paths; no host paths/config.
    }
    receipt.result = child;
    receipt.status = child.status;
    success = !child.sourceErrorWithoutGitObservation;
    return receipt;
  } catch (error) {
    Object.assign(receipt, diagnosticFailureResult(error, receipt.sourceExecutionStarted));
    return receipt;
  } finally {
    if (!existsSync(safePaths.output)) writeReceipt(safePaths.output, receipt);
    process.stdout.write(
      JSON.stringify({ diagnosticId: P.id, status: receipt.status, originalCauseClaim: false, qualification: false }) +
        "\n",
    );
    if (!success) process.exitCode = 1;
  }
}
function cli(args) {
  const mode = args.shift();
  const names =
    mode === "reserve"
      ? ["--installer", "--output"]
      : mode === "diagnose"
        ? ["--installer", "--authority", "--candidate", "--reservation", "--output"]
        : [];
  requireValue(names.length && args.length === names.length * 2, "CLI_INVALID");
  const options = {};
  for (let i = 0; i < names.length; i++) {
    requireValue(args[i * 2] === names[i] && typeof args[i * 2 + 1] === "string", "CLI_INVALID");
    options[names[i].slice(2)] = args[i * 2 + 1];
  }
  const { reservation, ...paths } = options;
  return { mode, paths: { ...paths, workspace: process.env.GITHUB_WORKSPACE }, reservation };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runReplaySourceDiagnostic(cli(process.argv.slice(2)));
  } catch {
    process.stdout.write(
      JSON.stringify({ status: "INVALID_DIAGNOSTIC_BINDING", qualification: false, originalCauseClaim: false }) + "\n",
    );
    process.exitCode = 1;
  }
}
