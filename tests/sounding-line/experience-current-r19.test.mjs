// Inert source and HTTP-shaped fixtures. No installed grant or provider writes.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCurrentAdmissionCap,
  currentAdmissionBinding,
  validateCurrentAdmissionRecord,
  validateCurrentAdmissionRegistry,
  validateCurrentAdmissionEvidence,
  validateCurrentR18FailedPreparation,
  validateCurrentR19ProductRepair,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import { selectTrustedExceptions, trustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
import { CURRENT_R18, CURRENT_R17_BLOCKED_CAPTURE } from "../../scripts/sounding-line/experience-current-r18.mjs";
import {
  CURRENT_R19,
  CURRENT_R18_FAILED_PREPARATION,
  CURRENT_R18_FAILED_RUN,
} from "../../scripts/sounding-line/experience-current-r19.mjs";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const raw = execFileSync(
  "git",
  ["show", `${CURRENT_R19.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`],
  {
    cwd: sourceRoot,
    maxBuffer: 32 * 1024 * 1024,
  },
);
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
const installedR18 = JSON.parse(raw);
const sha = (n) => String(n).padStart(40, "0");

function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-19T04:00:00Z") });
  const registry = structuredClone(installedR18),
    previous = registry.exceptions[17];
  const record = structuredClone(previous);
  Object.assign(record, {
    version: 19,
    id: CURRENT_R19.id,
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R19.id}` },
    predecessor: structuredClone(CURRENT_R18_FAILED_PREPARATION),
    frozenReferenceSha: CURRENT_R19.frozenReferenceSha,
    remainingIndependentReviewOrdinal: CURRENT_R19.remainingIndependentReviewOrdinal,
  });
  Object.assign(record.currentSourceAdmission, {
    protectedBaseAncestorSha: CURRENT_R19.protectedBaseAncestorSha,
    sourceDigest: "b".repeat(64),
    cumulativeHistory: structuredClone(CURRENT_R19.cumulativeHistory),
    requiredReviewIterations: CURRENT_R19.requiredReviewIterations,
    historicalRuns: [
      ...structuredClone(previous.currentSourceAdmission.historicalRuns),
      structuredClone(CURRENT_R18_FAILED_RUN),
    ],
    observation: { ...previous.currentSourceAdmission.observation, id: "FIXTURE-R19-NOT-INSTALLED" },
  });
  registry.exceptions.push(record);
  return { registry, record, previous };
}

test("generation19 preserves the literal eighteen-row registry, seven bridges and spent counters", (t) => {
  const { registry, record, previous } = fixture(t);
  assert.equal(createHash("sha256").update(raw).digest("hex"), CURRENT_R19.previousRegistryRawSha256);
  assert.equal(hash(installedR18), CURRENT_R19.previousRegistryDigest);
  assert.equal(hash(previous), CURRENT_R19.previousRecordDigest);
  assert.equal(registry.reconciliations.length, 7);
  assert.equal(record.immutableHistory.length, 1360);
  assert.equal(validateCurrentAdmissionRegistry(registry), record);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  assert.deepEqual(registry.exceptions.slice(0, 18), installedR18.exceptions);
  assert.deepEqual(registry.reconciliations, installedR18.reconciliations);
  for (const mutate of [
    (r) => {
      r.exceptions.shift();
    },
    (r) => {
      [r.exceptions[0], r.exceptions[1]] = [r.exceptions[1], r.exceptions[0]];
    },
    (r) => {
      r.exceptions[17].currentSourceAdmission.caps.capture = 0;
    },
    (r) => {
      r.reconciliations.pop();
    },
    (r) => {
      r.exceptions[18].immutableHistory[0].blob = sha(99);
    },
    (r) => {
      r.exceptions[18].predecessor.preparePayloadDigest = "0".repeat(64);
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.historicalRuns.pop();
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.historicalRuns[20].conclusion = "success";
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.historicalRuns.push({ ...CURRENT_R18_FAILED_RUN, id: 999 });
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 21;
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 9;
    },
    (r) => {
      r.exceptions[18].remainingIndependentReviewOrdinal = 8;
    },
    (r) => {
      r.exceptions[18].currentSourceAdmission.requiredReviewIterations = 12;
    },
    (r) => {
      r.exceptions[18].frozenReferenceSha = CURRENT_R19.repairReferenceSha;
    },
    (r) => {
      r.exceptions[18].ownerApproval.approvedAtUtcMinute = "2026-10-19T04:00Z";
    },
    (r) => {
      r.exceptions[18].expiresAt = "2026-10-23T00:00:00Z";
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_/u);
  }
  for (const field of ["reruns", "refunds", "paidProviderCalls"]) {
    const changed = structuredClone(record);
    changed.currentSourceAdmission[field] = 1;
    assert.throws(() => validateCurrentAdmissionRecord(changed), /CAP_OR_OBSERVATION_INVALID/u);
  }
  for (const stage of ["capture", "review", "ordinary", "technical", "replay"]) {
    const changed = structuredClone(record);
    changed.currentSourceAdmission.caps[stage] = 2;
    assert.throws(() => validateCurrentAdmissionRecord(changed), /CAP_OR_OBSERVATION_INVALID/u);
    changed.currentSourceAdmission.caps[stage] = 0;
    assert.throws(() => assertCurrentAdmissionCap(changed, stage), /STAGE_NOT_AUTHORIZED/u);
  }
  const changed = structuredClone(record);
  changed.currentSourceAdmission.protectedOverlay.push({
    path: record.immutableHistory[0].path,
    oldMode: "100644",
    oldBlob: record.immutableHistory[0].blob,
    newMode: "100644",
    newBlob: sha(99),
    candidateMode: "100644",
    candidateBlob: sha(99),
  });
  assert.throws(() => validateCurrentAdmissionRecord(changed), /R19_IMMUTABLE_HISTORY_OVERLAY_FORBIDDEN/u);
});

test("generation19 installed sentinel forbids absent, retired, expired or disguised row fallback", (t) => {
  const { registry } = fixture(t);
  const root = mkdtempSync(path.join(tmpdir(), "r19-inert-source-fixture-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Inert R19 fixture");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "core.longpaths", "true");
  mkdirSync(path.join(root, "testing"));
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  writeFileSync(path.join(root, "scripts/sounding-line/experience-current-r19.mjs"), "// inert presence guard only\n");
  const commit = (value) => {
    writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    git("add", ".");
    git("commit", "--quiet", "--allow-empty", "-m", "inert source fixture");
    return git("rev-parse", "HEAD");
  };
  assert.throws(() => trustedExceptions(root, commit(installedR18)), /R19_REGISTRY_INVALID/u);
  assert.equal(trustedExceptions(root, commit(registry))[0].id, CURRENT_R19.id);
  for (const change of [
    { status: "INACTIVE" },
    { status: "RETIRED" },
    { version: 18 },
    { currentSourceAdmission: {} },
    { expiresAt: "2026-10-18T23:59:59Z" },
  ]) {
    const changed = structuredClone(registry);
    Object.assign(changed.exceptions[18], change);
    assert.throws(() => trustedExceptions(root, commit(changed)), /CURRENT_ADMISSION_/u);
  }
  const head = commit(registry);
  t.mock.timers.tick(Date.parse(CURRENT_R19.expiresAt) - Date.now());
  assert.throws(() => trustedExceptions(root, head), /RECORD_INVALID/u);
});

test("generation19 two-file delta preserves the other four R18 product bindings and exact modes", () => {
  const priorRepair = new Map(CURRENT_R18.repairedProductFiles.map((e) => [e.path, `${e.newMode} blob ${e.newBlob}`]));
  const reference = new Map(priorRepair);
  for (const e of CURRENT_R19.repairedProductFiles) reference.set(e.path, `${e.newMode} blob ${e.newBlob}`);
  const options = {
    priorRepair,
    reference,
    candidate: new Map(reference),
    actualRepairPaths: [...CURRENT_R19.repairPaths],
  };
  assert.deepEqual([...validateCurrentR19ProductRepair(options).keys()].sort(), [...CURRENT_R18.repairPaths].sort());
  for (const actualRepairPaths of [
    [],
    CURRENT_R19.repairPaths.slice(1),
    [...CURRENT_R19.repairPaths, "src/unapproved.ts"],
  ])
    assert.throws(
      () => validateCurrentR19ProductRepair({ ...options, actualRepairPaths }),
      /R19_REPAIR_SCOPE_CHANGED/u,
    );
  for (const entry of CURRENT_R18.repairedProductFiles)
    for (const field of ["priorRepair", "reference", "candidate"])
      for (const wrong of [undefined, `100755 blob ${sha(99)}`, `120000 blob ${sha(99)}`, `100644 blob ${sha(99)}`]) {
        const changed = new Map(options[field]);
        if (wrong === undefined) changed.delete(entry.path);
        else changed.set(entry.path, wrong);
        assert.throws(
          () => validateCurrentR19ProductRepair({ ...options, [field]: changed }),
          /R19_(?:PRIOR_REPAIR|REPAIR_SOURCE)_CHANGED/u,
        );
      }
});

function providerRun(p) {
  return {
    id: p.id,
    run_attempt: p.runAttempt,
    workflow_id: p.workflowId,
    event: p.event,
    head_sha: p.headSha,
    head_branch: p.headBranch,
    actor: { login: p.actor },
    triggering_actor: { login: p.triggeringActor },
    head_repository: { full_name: p.repository },
    status: p.status,
    conclusion: p.conclusion,
    created_at: p.createdAt,
    display_title: p.displayTitle,
    check_suite_id: p.checkSuiteId,
  };
}
function spentPayload(previous) {
  const p = CURRENT_R18_FAILED_PREPARATION;
  return {
    version: 1,
    exceptionId: previous.id,
    binding: {
      exception: currentAdmissionBinding(previous),
      baseSha: p.baseSha,
      sourceDigest: p.sourceDigest,
      contractDigest: p.contractDigest,
    },
    run: {
      runId: p.runId,
      runAttempt: 1,
      actor: "Kgray44",
      workflowPath: ".github/workflows/sounding-line-ordinary.yml",
      event: p.event,
      headSha: p.headSha,
      headBranch: p.headBranch,
      createdAt: p.createdAt,
      workflowId: p.workflowId,
      displayTitle: CURRENT_R18_FAILED_RUN.displayTitle,
    },
    candidateSha: p.candidateSha,
    status: "PREPARE_AND_REVIEW9_RESERVED_VALIDATION_PENDING",
    independentReviewsCompleted: 8,
    reservedIndependentReviewOrdinal: 9,
  };
}

test("generation19 consumes exact R18 failure without inventing a completed ninth review or success custody", async (t) => {
  const { record, previous } = fixture(t),
    p = CURRENT_R18_FAILED_PREPARATION;
  const payload = spentPayload(previous);
  assert.equal(hash(payload), p.preparePayloadDigest);
  let preparation = { ...payload, commitSha: p.prepareCommit },
    occupied = null,
    tree = p.candidateTree;
  let run = providerRun(CURRENT_R18_FAILED_RUN);
  const slots = [],
    requests = [];
  const artifacts = new Map(
    p.artifacts.map((a) => [
      a.id,
      {
        id: a.id,
        expired: false,
        size_in_bytes: a.bytes,
        digest: `sha256:${a.sha256}`,
        workflow_run: { id: p.runId, head_sha: p.headSha },
      },
    ]),
  );
  const options = {
    record,
    storeFor: (value) => {
      assert.deepEqual(value, { id: p.id, custody: { namespace: `sounding-line-exceptions/${p.id}` } });
      return {
        read: async (slot) => {
          slots.push(slot);
          return slot === "prepare" ? preparation : slot === occupied ? { occupied: true } : null;
        },
      };
    },
    request: async (endpoint) => {
      requests.push(endpoint);
      if (endpoint === `git/commits/${p.candidateSha}`) return { tree: { sha: tree } };
      if (endpoint === `actions/runs/${p.runId}`) return run;
      const id = Number(endpoint.match(/^actions\/artifacts\/(\d+)$/u)?.[1]);
      assert.ok(artifacts.has(id), `unexpected endpoint: ${endpoint}`);
      return artifacts.get(id);
    },
  };
  await validateCurrentR18FailedPreparation(options);
  assert.deepEqual(slots, ["prepare", ...p.absentSlots]);
  assert.equal(requests.length, 5);
  requests.length = 0;
  await validateCurrentR18FailedPreparation({ ...options, observedRun: run });
  assert.equal(requests.length, 4);
  assert.ok(!requests.includes(`actions/runs/${p.runId}`));
  for (occupied of p.absentSlots)
    await assert.rejects(validateCurrentR18FailedPreparation(options), /R18_UNEXPECTED_SUCCESS_SLOT/u);
  occupied = null;
  for (const mutate of [
    (v) => {
      v.commitSha = sha(99);
    },
    (v) => {
      v.run.runAttempt = 2;
    },
    (v) => {
      v.binding.sourceDigest = "0".repeat(64);
    },
    (v) => {
      v.binding.exception.version = 17;
    },
    (v) => {
      v.status = "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING";
    },
    (v) => {
      v.independentReviewsCompleted = 9;
    },
    (v) => {
      v.reservedIndependentReviewOrdinal = 8;
    },
  ]) {
    preparation = structuredClone({ ...payload, commitSha: p.prepareCommit });
    mutate(preparation);
    await assert.rejects(validateCurrentR18FailedPreparation(options), /R18_SPENT_PREPARATION_CHANGED/u);
  }
  preparation = { ...payload, commitSha: p.prepareCommit };
  tree = sha(99);
  await assert.rejects(validateCurrentR18FailedPreparation(options), /R18_CANDIDATE_TREE_CHANGED/u);
  tree = p.candidateTree;
  for (const change of [
    { conclusion: "success" },
    { run_attempt: 2 },
    { actor: { login: "other" } },
    { head_sha: sha(99) },
  ]) {
    run = { ...providerRun(CURRENT_R18_FAILED_RUN), ...change };
    await assert.rejects(validateCurrentR18FailedPreparation(options), /R18_FAILED_CAPTURE_CHANGED/u);
  }
  run = providerRun(CURRENT_R18_FAILED_RUN);
  for (const expected of p.artifacts) {
    const original = artifacts.get(expected.id);
    for (const change of [
      { id: 1 },
      { expired: true },
      { size_in_bytes: expected.bytes + 1 },
      { digest: `sha256:${"0".repeat(64)}` },
      { workflow_run: { id: 1, head_sha: p.headSha } },
      { workflow_run: { id: p.runId, head_sha: sha(99) } },
    ]) {
      artifacts.set(expected.id, { ...original, ...change });
      await assert.rejects(validateCurrentR18FailedPreparation(options), /R18_FAILED_CAPTURE_ARTIFACT_CHANGED/u);
    }
    artifacts.set(expected.id, original);
  }
});

test("generation19 retains R17 blocking findings and requires current contract-matched repair evidence", (t) => {
  const { record } = fixture(t),
    contracts = record.contractIds;
  const plan = {
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
  const artifacts = contracts.map((contractId, i) => ({
    id: `fixture-r19-${i}`,
    type: "screenshot",
    origin: "ACTUAL_APPLICATION",
    path: `Development_Docs/Testing/Product_Experience/evidence/fixture-r19-${i}.png`,
    sha256: "f".repeat(64),
    contractId,
    state: "READY",
    device: "DESKTOP",
    role: "PLAYER",
    motionMode: "NORMAL",
  }));
  const evidence = {
    exception: plan.exception,
    artifacts,
    reviews: contracts.map((contractId, i) => ({
      contractId,
      iterations: 13,
      independentReviewOrdinal: 9,
      cumulativeHistory: structuredClone(CURRENT_R19.cumulativeHistory),
      findings: CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings
        .filter((f) => f.contractIds.includes(contractId))
        .map(({ id, classification }) => ({
          id,
          classification,
          contractId,
          disposition: "RESOLVED",
          resolution: "Synthetic current repair fixture only; this is not an actual product judgment.",
          repairEvidenceIds: [artifacts[i].id],
        })),
    })),
  };
  validateCurrentAdmissionEvidence(plan, evidence);
  for (const f of CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings)
    for (const contractId of f.contractIds)
      for (const mutate of [
        (r) => {
          r.findings = r.findings.filter((v) => v.id !== f.id);
        },
        (r) => {
          r.findings.find((v) => v.id === f.id).disposition = "UNRESOLVED";
        },
        (r) => {
          r.findings.find((v) => v.id === f.id).classification = "MINOR_POLISH";
        },
        (r) => {
          r.findings.find((v) => v.id === f.id).repairEvidenceIds = ["stale-r17-image"];
        },
        (r) => {
          r.findings.find((v) => v.id === f.id).repairEvidenceIds = [
            artifacts.find((v) => v.contractId !== contractId).id,
          ];
        },
      ]) {
        const changed = structuredClone(evidence);
        mutate(changed.reviews.find((r) => r.contractId === contractId));
        assert.throws(
          () => validateCurrentAdmissionEvidence(plan, changed),
          /REVIEW_HISTORY_CHANGED|R18_BLOCKING_FINDING_NOT_RESOLVED/u,
        );
      }
  for (const change of [
    { iterations: 12 },
    { independentReviewOrdinal: 8 },
    { cumulativeHistory: CURRENT_R18.cumulativeHistory },
  ]) {
    const changed = structuredClone(evidence);
    Object.assign(changed.reviews[0], change);
    assert.throws(() => validateCurrentAdmissionEvidence(plan, changed), /REVIEW_HISTORY_CHANGED/u);
  }
});
