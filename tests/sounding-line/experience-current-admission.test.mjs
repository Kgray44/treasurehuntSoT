// Inert source/HTTP fixtures only. None of these records is installed or grants a run.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import {
  CURRENT_ADMISSION_KIND,
  CURRENT_LEGACY,
  currentAdmissionBinding,
  currentRunIdentity,
  validateCurrentAdmissionRecord,
  validateCurrentAdmissionRegistry,
  validateCurrentAdmissionEvidence,
  validateCurrentAdmissionOverlay,
  validateCurrentPublicationArtifacts,
  validateCurrentCaptureIdentity,
  validateCurrentAdmissionPredecessors,
  validateCurrentAdmissionFinalDecision,
  assertCurrentAdmissionCap,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import {
  trustedExceptions,
  exceptionBinding,
  sealedReviewIdentity,
  sealExceptionQualification,
  exceptionStore,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { verificationObligationGroups } from "../../scripts/sounding-line/ordinary.mjs";
import { verifyTrustedExperienceAttestation } from "../../scripts/sounding-line/experience-attestation.mjs";
import {
  createCurrentAdmissionObservation,
  validateCurrentAdmissionObservationCiphertext,
} from "../../scripts/sounding-line/experience-current-observability.mjs";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const historicalRegistry = JSON.parse(
  execFileSync("git", ["show", "6381fb812ab2c00a60ea8c296256b9a0f5ae5b47:testing/product-experience-exceptions.json"], {
    cwd: sourceRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }),
);
const old = historicalRegistry.exceptions.at(-1);
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const bytesHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sha = (value) => String(value).padStart(40, "0");
const contracts = [
  "crossdeck.phase2.continuity",
  "crossdeck.refit.companion",
  "crossdeck.refit.published-lens",
  "homeport.shell.crossdeck-access-recovery",
  "homeport.shell.crossdeck-companion",
  "homeport.shell.crossdeck-companion-mobile",
  "reach.phase1.foundation",
];
const browsers = [
  "crossdeck-phase1",
  "crossdeck-phase2",
  "crossdeck-experience-refit",
  "crossdeck-refit-recovery",
  "homeport-phase2",
  "reach-laboratory",
  "reach-device-return",
  "reach-page-accessibility",
].map((name) => `tests/e2e/${name}.spec.ts`);
const clocked = new WeakSet();
function fixtureRecord(t) {
  if (!clocked.has(t)) {
    clocked.add(t);
    t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-18T00:00:00Z") });
  }
  const history = {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 18,
    currentPreparationOrdinal: 19,
    completedIndependentReviews: 7,
  };
  // 12/19/8 are explicitly synthetic fixture values, never production defaults.
  return {
    version: 15,
    id: "FIXTURE-ONLY-CURRENT-ADMISSION-NOT-INSTALLED",
    status: "ACTIVE",
    repository: "Kgray44/treasurehuntSoT",
    pullRequest: 721,
    ownerApproval: { actor: "Kgray44", approvedAtUtcMinute: "2026-10-18T00:00:00Z" },
    expiresAt: CURRENT_LEGACY.expiry,
    custody: { namespace: "sounding-line-exceptions/FIXTURE-ONLY-CURRENT-ADMISSION-NOT-INSTALLED" },
    predecessor: {
      id: CURRENT_LEGACY.id,
      recordDigest: CURRENT_LEGACY.recordDigest,
      qualifyCommit: CURRENT_LEGACY.qualifyCommit,
      runId: CURRENT_LEGACY.runId,
      qualifyPayloadDigest: "e".repeat(64),
      campaignEpoch: "2026-10-15T00:00:00Z",
      artifacts: [{ id: 91, bytes: 100, sha256: "9".repeat(64) }],
    },
    frozenReferenceSha: sha(20),
    frozenTrees: { src: sha(21) },
    contractDigest: "c".repeat(64),
    contractIds: contracts,
    contexts: 32,
    requiredTechnicalBrowserTests: browsers,
    remainingIndependentReviewOrdinal: 8,
    immutableHistory: structuredClone(old.immutableHistory),
    currentSourceAdmission: {
      kind: CURRENT_ADMISSION_KIND,
      protectedBaseAncestorSha: sha(22),
      preservationRevision: "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f",
      sourceDigest: "b".repeat(64),
      contextCount: 38,
      pairedBrowserContexts: 6,
      requiredReviewIterations: 12,
      cumulativeHistory: history,
      historyLedger: { path: "Development_Docs/Engineering/fixture-history.json", sha256: "a".repeat(64) },
      disposition: { path: "Development_Docs/Engineering/fixture-disposition.json", sha256: "d".repeat(64) },
      protectedOverlay: [
        {
          path: "scripts/sounding-line/fixture-current.mjs",
          oldMode: null,
          oldBlob: null,
          newMode: "100644",
          newBlob: sha(23),
          candidateMode: "100644",
          candidateBlob: sha(23),
        },
      ],
      historicalRuns: Array.from({ length: 17 }, (_, index) => ({
        id: index === 16 ? CURRENT_LEGACY.runId : index + 1,
        runAttempt: 1,
        workflowId: 341545080,
        event: "workflow_dispatch",
        headSha: sha(24),
        headBranch: "main",
        actor: "Kgray44",
        triggeringActor: "Kgray44",
        repository: "Kgray44/treasurehuntSoT",
        status: "completed",
        conclusion: "failure",
        createdAt: "2026-10-16T00:00:00Z",
        displayTitle: "SOURCE ONLY SYNTHETIC HISTORY",
        checkSuiteId: index + 50,
      })),
      legacyR14History: { predecessor: old.predecessor, inheritedRemotePredecessor: old.inheritedRemotePredecessor },
      publicationFiles: [
        "Development_Docs/Testing/Product_Experience/candidate-review.json",
        "Development_Docs/Testing/Product_Experience/evidence/capture.json",
      ],
      caps: { capture: 1, review: 1, ordinary: 1, technical: 1, replay: 1 },
      reruns: 0,
      refunds: 0,
      paidProviderCalls: 0,
      requiredObligationIds: Array.from({ length: 8 }, (_, index) => `fixture-group-${index}`),
      observation: {
        id: "FIXTURE-CURRENT-OBSERVATION-NOT-INSTALLED",
        keyId: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
      },
    },
  };
}
const artifact = () => ({
  id: "fixture-current-screen",
  type: "screenshot",
  origin: "ACTUAL_APPLICATION",
  path: "Development_Docs/Testing/Product_Experience/evidence/fixture-current.png",
  sha256: "f".repeat(64),
  contractId: contracts[0],
  state: "READY",
  device: "DESKTOP",
  role: "PLAYER",
  motionMode: "NORMAL",
});
function planFor(record) {
  return {
    applicable: true,
    baseSha: sha(30),
    candidateSha: sha(31),
    sourceDigest: "b".repeat(64),
    contractDigest: record.contractDigest,
    contractIds: contracts,
    contextCount: 38,
    exception: currentAdmissionBinding(record),
    attestationPolicy: { required: true, trustedReviewActors: ["Kgray44"] },
  };
}
test("absent current record preserves exact legacy selection and cannot authorize current adapter", (t) => {
  fixtureRecord(t);
  assert.equal(trustedExceptions(sourceRoot, "6381fb812ab2c00a60ea8c296256b9a0f5ae5b47")[0].id, CURRENT_LEGACY.id);
  assert.throws(() => validateCurrentAdmissionRegistry(historicalRegistry), /REGISTRY_INVALID/u);
  assert.equal(
    createCurrentAdmissionObservation({
      root: sourceRoot,
      plan: { exception: { id: CURRENT_LEGACY.id } },
      environment: {},
    }),
    null,
  );
});
test("current record requires unchanged fourteen predecessors, independent counters and closed caps", (t) => {
  const record = fixtureRecord(t),
    registry = structuredClone(historicalRegistry);
  registry.exceptions.push(record);
  assert.equal(validateCurrentAdmissionRegistry(registry).id, record.id);
  for (const mutate of [
    (r) => {
      r.pullRequest = 766;
    },
    (r) => {
      r.currentSourceAdmission.cumulativeHistory.legacyRepairRecaptureAttempts = 1;
    },
    (r) => {
      r.remainingIndependentReviewOrdinal = 7;
    },
    (r) => {
      r.currentSourceAdmission.reruns = 1;
    },
    (r) => {
      r.currentSourceAdmission.caps.capture = 2;
    },
    (r) => {
      r.currentSourceAdmission.paidProviderCalls = 1;
    },
  ]) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRecord(changed), /CURRENT_ADMISSION_/u);
  }
  registry.exceptions[0].id = "TAMPERED-HISTORICAL-ROW";
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /LEGACY_REGISTRY_CHANGED/u);
  record.currentSourceAdmission.caps.capture = 0;
  assert.throws(() => assertCurrentAdmissionCap(record, "capture"), /STAGE_NOT_AUTHORIZED/u);
});
test("current review retains protected ledger counters without old iterations11 or ordinal7 reuse", (t) => {
  const record = fixtureRecord(t),
    plan = planFor(record);
  const evidence = {
    exception: plan.exception,
    artifacts: [artifact()],
    reviews: contracts.map((contractId) => ({
      contractId,
      iterations: 12,
      independentReviewOrdinal: 8,
      cumulativeHistory: record.currentSourceAdmission.cumulativeHistory,
    })),
  };
  validateCurrentAdmissionEvidence(plan, evidence);
  evidence.reviews[0].iterations = 11;
  assert.throws(() => validateCurrentAdmissionEvidence(plan, evidence), /REVIEW_HISTORY_CHANGED/u);
  evidence.reviews[0].iterations = 12;
  evidence.reviews[0].independentReviewOrdinal = 7;
  assert.throws(() => validateCurrentAdmissionEvidence(plan, evidence), /REVIEW_HISTORY_CHANGED/u);
});
test("publication rejects arbitrary repeated paths and IDs and preserves capture identity", (t) => {
  const plan = planFor(fixtureRecord(t)),
    item = artifact();
  validateCurrentPublicationArtifacts([item]);
  for (const items of [
    [item, { ...item, id: "duplicate-path" }],
    [item, { ...item, path: item.path + ".png" }],
    [{ ...item, path: "src/app/escaped.png" }],
    [{ ...item, path: "Development_Docs/Testing/Product_Experience/evidence/../escaped.png" }],
  ])
    assert.throws(() => validateCurrentPublicationArtifacts(items), /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u);
  validateCurrentCaptureIdentity(plan, { artifacts: [item] }, { artifacts: [item] });
  assert.throws(
    () =>
      validateCurrentCaptureIdentity(
        plan,
        { artifacts: [item] },
        { artifacts: [{ ...item, path: item.path.replace("fixture-current", "relocated") }] },
      ),
    /CURRENT_CAPTURE_PATH_OR_CONTEXT_CHANGED/u,
  );
});
test("publication preserves actual paired multi-contract media without accepting conflicting references", () => {
  const report = JSON.parse(
    execFileSync(
      "git",
      [
        "show",
        "43b5f4d55b6ac751ed9b2e05d4e4cace38544c4f:Development_Docs/Testing/Product_Experience/candidate-review.json",
      ],
      { cwd: sourceRoot, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    ),
  );
  const byPath = new Map();
  for (const artifact of report.artifacts) {
    const group = byPath.get(artifact.path) ?? [];
    group.push(artifact);
    byPath.set(artifact.path, group);
  }
  const shared = [...byPath.values()].filter((group) => group.length > 1);
  assert.equal(report.artifacts.length, 368);
  assert.equal(shared.length, 70);
  validateCurrentPublicationArtifacts(report.artifacts);
  for (const pair of shared) {
    validateCurrentPublicationArtifacts(pair);
    for (const changed of [
      { sha256: "0".repeat(64) },
      { contractId: pair[0].contractId },
      { contractId: "reach.phase1.foundation" },
      { state: "READY" },
      { role: "CREATOR" },
      { device: pair[0].device === "DESKTOP" ? "MOBILE" : "DESKTOP" },
      { motionMode: pair[0].motionMode === "NORMAL" ? "REDUCED" : "NORMAL" },
      { origin: "SYNTHETIC" },
      { id: "unbound-paired-reference" },
      { viewport: { width: 1, height: 1 } },
    ])
      assert.throws(
        () => validateCurrentPublicationArtifacts([pair[0], { ...pair[1], ...changed }]),
        /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u,
      );
    assert.throws(
      () => validateCurrentPublicationArtifacts([...pair, { ...pair[1], id: "third-reference" }]),
      /CURRENT_ARTIFACT_PATH_OR_CONTEXT_INVALID/u,
    );
  }
});

test("current package overlay adopts exact protected registration and rejects candidate package authority", (t) => {
  const record = fixtureRecord(t);
  record.currentSourceAdmission.protectedOverlay.push({
    path: "package.json",
    oldMode: "100644",
    oldBlob: sha(50),
    newMode: "100644",
    newBlob: sha(51),
    candidateMode: "100644",
    candidateBlob: sha(51),
  });
  const code = record.currentSourceAdmission.protectedOverlay[0];
  const reference = new Map([["package.json", "100644 blob " + sha(50)]]);
  const protectedAncestor = new Map(reference);
  const base = new Map([
    ["package.json", "100644 blob " + sha(51)],
    [code.path, "100644 blob " + code.newBlob],
  ]);
  const candidate = new Map(base);
  const args = { record, reference, protectedAncestor, base, candidate };
  validateCurrentAdmissionOverlay(args);
  const changedBase = new Map(base);
  changedBase.set("package.json", "100644 blob " + sha(52));
  assert.throws(
    () => validateCurrentAdmissionOverlay({ ...args, base: changedBase }),
    /PROTECTED_BASE_OVERLAY_CHANGED/u,
  );
  const changedRecord = structuredClone(record);
  changedRecord.currentSourceAdmission.protectedOverlay.at(-1).candidateBlob = sha(52);
  const changedCandidate = new Map(candidate);
  changedCandidate.set("package.json", "100644 blob " + sha(52));
  assert.throws(
    () => validateCurrentAdmissionOverlay({ ...args, record: changedRecord, candidate: changedCandidate }),
    /CANDIDATE_AUTHORITY_CHANGED/u,
  );
});

test("current closed overlay allows only protected code plus literal bound publication data", (t) => {
  const record = fixtureRecord(t),
    code = record.currentSourceAdmission.protectedOverlay[0],
    item = artifact(),
    oldData = "100644 blob " + sha(40),
    newData = "100644 blob " + sha(41),
    product = ["src/fixture.ts", "100644 blob " + sha(42)],
    registry = ["testing/product-experience-exceptions.json", "100644 blob " + sha(43)],
    reference = new Map([product, [record.currentSourceAdmission.publicationFiles[0], oldData]]),
    protectedAncestor = new Map([registry]),
    base = new Map([registry, [code.path, `100644 blob ${code.newBlob}`]]),
    candidate = new Map([
      ...reference,
      ...base,
      [record.currentSourceAdmission.publicationFiles[0], newData],
      [item.path, newData],
    ]);
  const args = { record, reference, protectedAncestor, base, candidate, publicationArtifacts: [item] };
  validateCurrentAdmissionOverlay(args);
  for (const [file, metadata] of [
    [product[0], newData],
    ["Development_Docs/unlisted-record.json", newData],
    ["Development_Docs/Testing/Product_Experience/evidence/unlisted.png", newData],
    [code.path, oldData],
    [registry[0], oldData],
    [item.path, "120000 blob " + sha(44)],
  ]) {
    const changed = new Map(candidate);
    changed.set(file, metadata);
    assert.throws(() => validateCurrentAdmissionOverlay({ ...args, candidate: changed }), /CURRENT_ADMISSION_/u);
  }
  const changedBase = new Map(base);
  changedBase.set("scripts/sounding-line/unlisted.mjs", newData);
  assert.throws(
    () => validateCurrentAdmissionOverlay({ ...args, base: changedBase }),
    /PROTECTED_BASE_OVERLAY_CHANGED/u,
  );
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const [name, value] of Object.entries(files)) {
    const filename = Buffer.from(name),
      bytes = Buffer.from(JSON.stringify(value)),
      compressed = deflateRawSync(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(bytes), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    const item = Buffer.alloc(46);
    item.writeUInt32LE(0x02014b50);
    item.writeUInt16LE(20, 4);
    item.writeUInt16LE(20, 6);
    item.writeUInt16LE(8, 10);
    item.writeUInt32LE(crc32(bytes), 16);
    item.writeUInt32LE(compressed.length, 20);
    item.writeUInt32LE(bytes.length, 24);
    item.writeUInt16LE(filename.length, 28);
    item.writeUInt32LE(offset, 42);
    locals.push(local, filename, compressed);
    central.push(item, filename);
    offset += local.length + filename.length + compressed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
function loaderFixture(t) {
  const record = fixtureRecord(t),
    root = mkdtempSync(path.join(tmpdir(), "current-admission-http-only-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Inert fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("remote", "add", "origin", "https://github.com/Kgray44/treasurehuntSoT.git");
  mkdirSync(path.join(root, "testing"));
  const registry = structuredClone(historicalRegistry);
  registry.exceptions.push(record);
  writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(registry));
  git("add", ".");
  git("commit", "--quiet", "-m", "explicit inert source-only fixture");
  const plan = { ...planFor(record), baseSha: git("rev-parse", "HEAD") };
  const baseTree = git("rev-parse", "HEAD^{tree}"),
    baseEntries = git("ls-tree", "HEAD")
      .split("\n")
      .map((line) => {
        const [metadata, file] = line.split("\t"),
          [mode, type, sha] = metadata.split(" ");
        return { path: file, mode, type, sha };
      });
  const evidence = {
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    exception: plan.exception,
    artifacts: [artifact()],
    journeys: [{ id: "fixture-only-no-product-journey", status: "PASS" }],
    reviews: [{ contractId: contracts[0], iterations: 12, status: "ACCEPTED", reviewerContext: "fixture-only" }],
    captureArtifactId: 1001,
    reviewArtifactId: 1002,
  };
  const reservation = {
    binding: exceptionBinding(plan),
    candidateSha: plan.candidateSha,
    run: { runId: 601, headSha: plan.baseSha, headBranch: "main", event: "workflow_dispatch", actor: "Kgray44" },
  };
  const capture = { ...evidence, exceptionPreparationReservation: sha(701) };
  const review = {
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    exception: plan.exception,
    exceptionPreparationReservation: sha(701),
    exceptionReviewSeal: sha(703),
    captureArtifactId: evidence.captureArtifactId,
    reviews: evidence.reviews,
  };
  const archives = { 1001: zip({ "capture.json": capture }), 1002: zip({ "review.json": review }) };
  const run = (id) => ({
    id,
    run_attempt: 1,
    workflow_id: 341545080,
    event: "workflow_dispatch",
    head_branch: "main",
    head_sha: plan.baseSha,
    head_repository: { full_name: record.repository },
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    conclusion: "success",
  });
  const responses = new Map([
    [`git/commits/${plan.baseSha}`, { tree: { sha: baseTree } }],
    [`git/trees/${baseTree}`, { tree: baseEntries }],
    ["actions/runs/601", run(601)],
    ["actions/runs/602", run(602)],
    ["actions/workflows/341545080", { path: ".github/workflows/sounding-line-ordinary.yml" }],
  ]);
  for (const [id, kind, runId] of [
    [1001, "capture", 601],
    [1002, "review", 602],
  ])
    responses.set(`actions/artifacts/${id}`, {
      id,
      name: `product-experience-${kind}-${plan.sourceDigest.slice(0, 16)}`,
      expired: false,
      digest: `sha256:${bytesHash(archives[id])}`,
      workflow_run: { id: runId },
    });
  const trustedCapture = { id: 1001, digest: `sha256:${bytesHash(archives[1001])}`, runId: 601, runAttempt: 1 };
  function slot(name, value, commit, tree, blob) {
    responses.set(`git/ref/tags/${record.custody.namespace}/${name}`, { object: { type: "commit", sha: sha(commit) } });
    responses.set(`git/commits/${sha(commit)}`, { parents: [{ sha: plan.baseSha }], tree: { sha: sha(tree) } });
    responses.set(`git/trees/${sha(tree)}`, {
      tree: [
        ...baseEntries,
        { path: ".sounding-line-exception-reservation.json", mode: "100644", type: "blob", sha: sha(blob) },
      ],
    });
    responses.set(`git/blobs/${sha(blob)}`, {
      content: Buffer.from(JSON.stringify({ version: 1, exceptionId: record.id, ...value })).toString("base64"),
    });
  }
  slot("prepare", reservation, 701, 801, 901);
  slot("capture", { ...reservation, provenance: trustedCapture }, 702, 802, 902);
  slot(
    "review8",
    { ...reservation, run: { ...reservation.run, runId: 602 }, reviewIdentity: sealedReviewIdentity(plan, evidence) },
    703,
    803,
    903,
  );
  const saved = { token: process.env.GH_TOKEN, repository: process.env.GITHUB_REPOSITORY };
  process.env.GH_TOKEN = "INERT_FIXTURE_TOKEN_NOT_A_CREDENTIAL";
  process.env.GITHUB_REPOSITORY = record.repository;
  t.after(() => {
    for (const [name, value] of [
      ["GH_TOKEN", saved.token],
      ["GITHUB_REPOSITORY", saved.repository],
    ]) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    assert.equal(options.method ?? "GET", "GET");
    const prefix = "https://api.github.com/repos/Kgray44/treasurehuntSoT/";
    assert.ok(String(url).startsWith(prefix));
    const endpoint = String(url).slice(prefix.length);
    calls.push(endpoint);
    const archive = /^actions\/artifacts\/(1001|1002)\/zip$/u.exec(endpoint);
    if (archive) return new Response(archives[archive[1]], { status: 200 });
    assert.ok(responses.has(endpoint), `Unexpected inert HTTP route: ${endpoint}`);
    return new Response(JSON.stringify(responses.get(endpoint)), { status: 200 });
  });
  return {
    root,
    record,
    plan,
    evidence,
    responses,
    archives,
    calls,
    verify: () => verifyTrustedExperienceAttestation({ root, plan, evidence }),
  };
}
test("real default current loader validates complete original ZIPs and real custody seams", async (t) => {
  const f = loaderFixture(t),
    actual = await f.verify();
  assert.equal(actual.status, "PASS");
  assert.equal(actual.currentBaseSha, f.plan.baseSha);
  assert.equal(actual.currentCandidateSha, f.plan.candidateSha);
  assert.ok(f.calls.includes("actions/artifacts/1001/zip") && f.calls.includes("actions/artifacts/1002/zip"));
  f.archives[1001] = Buffer.concat([f.archives[1001], Buffer.from("tampered")]);
  await assert.rejects(f.verify(), /ATTESTATION_ARCHIVE_DIGEST_MISMATCH/u);
});
test("real default loader rejects stale actor provenance and current-only path substitution", async (t) => {
  const f = loaderFixture(t);
  f.responses.get("actions/runs/601").actor.login = "candidate-bot";
  await assert.rejects(f.verify(), /ATTESTATION_PROVENANCE_INVALID/u);
  f.responses.get("actions/runs/601").actor.login = "Kgray44";
  f.evidence.artifacts[0].path = f.evidence.artifacts[0].path.replace("fixture-current", "moved");
  await assert.rejects(f.verify(), /CURRENT_CAPTURE_PATH_OR_CONTEXT_CHANGED/u);
});
test("real current custody cannot borrow an absent or mismatched review seal", async (t) => {
  const f = loaderFixture(t);
  f.responses.set(`git/ref/tags/${f.record.custody.namespace}/review8`, null);
  await assert.rejects(f.verify(), /SEALED_EVIDENCE_MISMATCH/u);
});

function finalFixture(t, identity = {}) {
  const record = fixtureRecord(t),
    a = record.currentSourceAdmission,
    run = { runId: 444 },
    publicationNonce = "11111111-2222-3333-4444-555555555555";
  const ordinary = {
    mode: "ordinary",
    baseSha: sha(30),
    candidateSha: sha(31),
    ...identity,
    selected: { unitTests: ["src/fixture.test.ts"], browserTests: browsers },
    safetyPaths: ["prisma/seed.ts"],
    lintPaths: ["prisma/seed.ts"],
    databaseUrl: "file:./fixture.sqlite",
    migrationRequired: true,
    buildRequired: true,
    registrationValidationRequired: true,
    migrationScripts: [],
  };
  const groups = verificationObligationGroups(ordinary);
  assert.equal(groups.length, 8);
  a.requiredObligationIds = groups.map(({ id }) => id);
  const plan = { ...planFor(record), ...identity };
  const decision = {
    decision: "PASS",
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    selected: { browserTests: browsers },
    productExperience: {
      ...plan,
      trustedAttestation: {
        status: "PASS",
        exception: plan.exception,
        currentBaseSha: plan.baseSha,
        currentCandidateSha: plan.candidateSha,
        currentSourceDigest: plan.sourceDigest,
        currentContractDigest: plan.contractDigest,
        captureArtifactId: 1001,
        reviewArtifactId: 1002,
        exceptionCustody: { prepareReservation: sha(701), reviewSeal: sha(703) },
      },
    },
    productExperienceDecision: { status: "PASS", sourceDigest: plan.sourceDigest },
    productExperienceReplay: { status: "PASS", sourceDigest: plan.sourceDigest },
    currentAdmissionObservation: {
      status: "COMPLETE",
      observationId: a.observation.id,
      exceptionId: record.id,
      recordDigest: plan.exception.recordDigest,
      repository: record.repository,
      baseSha: plan.baseSha,
      candidateSha: plan.candidateSha,
      sourceDigest: plan.sourceDigest,
      contractDigest: plan.contractDigest,
      runId: run.runId,
      runAttempt: 1,
      job: "final-check",
      keyId: a.observation.keyId,
      evidenceLoss: false,
      cleanup: true,
      sourceUnchanged: true,
      publicationReady: true,
      publicationNonceDigest: bytesHash(Buffer.from(publicationNonce)),
      memberCount: 2,
      format: "VW-POSTTECHNICAL-EVIDENCE-1",
      ciphertextDigest: "a".repeat(64),
      ciphertextBytes: 100,
      rawBytes: 90,
      classification: "PRIVATE_OBSERVATIONS_NOT_ACCEPTANCE",
      coverage: "SUPPORTED_REPLAY_ADMISSION_GIT_READS_AND_FINAL_PROPAGATED_ERROR",
      supportedGitReads: 1,
      observedGitThrows: 0,
      retainedGitThrows: 0,
    },
    timing: { commands: groups.map(({ id }) => ({ obligationId: id, status: "PASS" })) },
    evidenceReconciliation: {
      requiredObligations: groups.length,
      obligations: groups.map((g) => ({ id: g.id, commands: g.commandLabels })),
      reconciliation: groups.map((g) => ({
        obligationId: g.id,
        receiptId: `fixture-${g.id}`,
        freshExecuted: true,
        disposition: "FRESH",
      })),
      finalization: {
        authority: "SOUNDING_LINE_EVIDENCE_FINALIZER",
        decision: "PASS",
        requiredObligations: groups.length,
        errors: [],
        remainder: [],
        closure: groups.map((g) => ({ obligationId: g.id, satisfied: true, receiptId: `fixture-${g.id}` })),
      },
    },
  };
  return { record, plan, run, groups, decision, ordinary, publicationNonce };
}
test("current finalizer checks current attestation, fresh browser, all groups and observation tuple", (t) => {
  const f = finalFixture(t);
  assert.equal(validateCurrentAdmissionFinalDecision(f).status, "PASS");
  for (const mutate of [
    (d) => {
      d.productExperience.trustedAttestation.currentBaseSha = sha(99);
    },
    (d) => {
      d.productExperienceReplay.sourceDigest = "0".repeat(64);
    },
    (d) => {
      d.evidenceReconciliation.finalization.remainder.push("unclosed");
    },
    (d) => {
      d.evidenceReconciliation.reconciliation.find(({ obligationId }) =>
        obligationId.startsWith("browser."),
      ).freshExecuted = false;
    },
    (d) => {
      d.currentAdmissionObservation.recordDigest = "0".repeat(64);
    },
    (d) => {
      d.currentAdmissionObservation.evidenceLoss = true;
    },
    (d) => {
      d.currentAdmissionObservation.publicationNonceDigest = "0".repeat(64);
    },
  ]) {
    const decision = structuredClone(f.decision);
    mutate(decision);
    assert.throws(() => validateCurrentAdmissionFinalDecision({ ...f, decision }), /CURRENT_ADMISSION_/u);
  }
});

test("normal current seal requires its own reservation, real current cipher and complete canonical groups exactly once", async (t) => {
  const fixture = loaderFixture(t),
    f = finalFixture(t, { baseSha: fixture.plan.baseSha, candidateSha: fixture.plan.baseSha });
  const observation = createCurrentAdmissionObservation({
    root: fixture.root,
    plan: f.plan,
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_OUTPUT: path.join(fixture.root, "fixture-github-output.txt"),
      SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE: "11111111-2222-3333-4444-555555555555",
      GITHUB_RUN_ID: String(f.run.runId),
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_REPOSITORY: f.record.repository,
      GITHUB_JOB: "final-check",
    },
  });
  observation.executeGitRead(execFileSync, ["rev-parse", "HEAD"], { cwd: fixture.root, encoding: "utf8" });
  f.decision.currentAdmissionObservation = await observation.finish();
  assert.equal(
    readFileSync(path.join(fixture.root, "fixture-github-output.txt"), "utf8"),
    "current_admission_observation_publish=11111111-2222-3333-4444-555555555555\n",
  );
  f.decision.candidateTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: fixture.root,
    encoding: "utf8",
  }).trim();
  const baseTree = f.decision.candidateTree,
    baseEntries = [
      {
        path: "testing",
        mode: "040000",
        type: "tree",
        sha: execFileSync("git", ["rev-parse", "HEAD:testing"], { cwd: fixture.root, encoding: "utf8" }).trim(),
      },
    ],
    refs = new Map(),
    commits = new Map([[f.plan.baseSha, { tree: { sha: baseTree } }]]),
    trees = new Map([[baseTree, { tree: baseEntries }]]),
    blobs = new Map(),
    writes = [];
  const request = async (endpoint, method = "GET", body) => {
    if (method === "GET") {
      if (endpoint.startsWith("git/ref/")) return refs.get(`refs/${endpoint.slice(8)}`) ?? null;
      if (endpoint.startsWith("git/commits/")) return commits.get(endpoint.slice(12));
      if (endpoint.startsWith("git/trees/")) return trees.get(endpoint.slice(10));
      if (endpoint.startsWith("git/blobs/")) return blobs.get(endpoint.slice(10));
      throw new Error(`Unexpected inert custody read ${endpoint}`);
    }
    assert.equal(method, "POST");
    writes.push(endpoint);
    const value = hash(body).slice(0, 40);
    if (endpoint === "git/blobs") blobs.set(value, { content: Buffer.from(body.content).toString("base64") });
    else if (endpoint === "git/trees") trees.set(value, { tree: [...trees.get(body.base_tree).tree, ...body.tree] });
    else if (endpoint === "git/commits")
      commits.set(value, { tree: { sha: body.tree }, parents: body.parents.map((sha) => ({ sha })) });
    else if (endpoint === "git/refs") {
      if (refs.has(body.ref)) throw new Error("INERT_SLOT_ALREADY_EXISTS");
      refs.set(body.ref, { object: { type: "commit", sha: body.sha } });
    } else throw new Error(`Unexpected inert custody write ${endpoint}`);
    return { sha: value };
  };
  const store = exceptionStore({ record: f.record, request });
  const options = {
    ...f,
    root: fixture.root,
    store,
    observationFile: path.join(fixture.root, "artifacts/sounding-line/current-admission-observation.encrypted"),
  };
  await assert.rejects(sealExceptionQualification(options), /FINAL_DECISION_MISMATCH/u);
  assert.equal(writes.length, 0);
  await store.create("qualify", {
    binding: exceptionBinding(f.plan),
    run: f.run,
    candidateSha: f.plan.candidateSha,
    candidateTree: f.decision.candidateTree,
  });
  const before = writes.length,
    broken = structuredClone(f.decision);
  await assert.rejects(
    sealExceptionQualification({ ...options, publicationNonce: "" }),
    /CURRENT_OBSERVATION_REQUIRED/u,
  );
  assert.equal(writes.length, before);
  broken.productExperience.trustedAttestation.currentSourceDigest = "0".repeat(64);
  await assert.rejects(
    sealExceptionQualification({ ...options, decision: broken }),
    /FINAL_CURRENT_ATTESTATION_CHANGED/u,
  );
  assert.equal(writes.length, before);
  await sealExceptionQualification(options);
  assert.deepEqual((await store.read("qualified")).binding, exceptionBinding(f.plan));
  await assert.rejects(sealExceptionQualification(options), /SLOT_CONSUMED/u);
  assert.equal(writes.filter((endpoint) => endpoint === "git/refs").length, 2);
});

test("current predecessors retain spent custody and every immutable remote identity without granting retries", async (t) => {
  const record = fixtureRecord(t);
  const payload = {
    binding: { exception: { id: CURRENT_LEGACY.id, recordDigest: CURRENT_LEGACY.recordDigest } },
    run: { runId: CURRENT_LEGACY.runId },
  };
  record.predecessor.qualifyPayloadDigest = hash(payload);
  const responses = new Map(
    record.currentSourceAdmission.historicalRuns.map((run) => [
      `actions/runs/${run.id}`,
      {
        id: run.id,
        run_attempt: run.runAttempt,
        workflow_id: run.workflowId,
        event: run.event,
        head_sha: run.headSha,
        head_branch: run.headBranch,
        actor: { login: run.actor },
        triggering_actor: { login: run.triggeringActor },
        head_repository: { full_name: run.repository },
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.createdAt,
        display_title: run.displayTitle,
        check_suite_id: run.checkSuiteId,
      },
    ]),
  );
  responses.set("actions/artifacts/91", {
    id: 91,
    expired: false,
    size_in_bytes: 100,
    digest: `sha256:${"9".repeat(64)}`,
    workflow_run: { id: CURRENT_LEGACY.runId },
  });
  let qualified = null;
  const options = {
    record,
    request: async (endpoint) => {
      assert.ok(responses.has(endpoint), `Unexpected inert predecessor route: ${endpoint}`);
      return responses.get(endpoint);
    },
    storeFor: (value) => {
      assert.equal(value.id, CURRENT_LEGACY.id);
      return {
        read: async (slot) =>
          slot === "qualified" ? qualified : { ...payload, commitSha: CURRENT_LEGACY.qualifyCommit },
      };
    },
  };
  assert.equal((await validateCurrentAdmissionPredecessors(options)).length, 17);
  const original = responses.get("actions/runs/1");
  assert.deepEqual(currentRunIdentity(original), record.currentSourceAdmission.historicalRuns[0]);
  responses.set("actions/runs/1", { ...original, run_attempt: 2 });
  await assert.rejects(validateCurrentAdmissionPredecessors(options), /HISTORICAL_RUN_CHANGED/u);
  responses.set("actions/runs/1", original);
  qualified = { unexpected: "seal" };
  await assert.rejects(validateCurrentAdmissionPredecessors(options), /SPENT_PREDECESSOR_CHANGED/u);
});
test("current observer encrypts fixed private members with current record-bound AAD and rejects tampering", async (t) => {
  const f = loaderFixture(t); // Git/HTTP fixture; observer performs no HTTP.
  f.plan.candidateSha = f.plan.baseSha;
  const observation = createCurrentAdmissionObservation({
    root: f.root,
    plan: f.plan,
    environment: {
      GITHUB_RUN_ID: "444",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_REPOSITORY: f.record.repository,
      GITHUB_JOB: "final-check",
      SOUNDING_LINE_PRIVATE_FAILURE_PUBLICATION_NONCE: "11111111-2222-3333-4444-555555555555",
    },
  });
  observation.executeGitRead(execFileSync, ["rev-parse", "HEAD"], { cwd: f.root, encoding: "utf8" });
  const summary = await observation.finish();
  assert.equal(summary.status, "COMPLETE");
  assert.equal(summary.recordDigest, f.plan.exception.recordDigest);
  const file = path.join(f.root, "artifacts/sounding-line/current-admission-observation.encrypted");
  validateCurrentAdmissionObservationCiphertext({ file, observation: summary });
  assert.throws(
    () =>
      validateCurrentAdmissionObservationCiphertext({
        file,
        observation: { ...summary, recordDigest: "0".repeat(64) },
      }),
    /OBSERVATION_INVALID/u,
  );
  writeFileSync(file, Buffer.concat([readFileSync(file), Buffer.from("tampered")]));
  assert.throws(
    () => validateCurrentAdmissionObservationCiphertext({ file, observation: summary }),
    /OBSERVATION_INVALID/u,
  );
});
