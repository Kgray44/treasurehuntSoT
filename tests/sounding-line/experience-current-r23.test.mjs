// Inert exact-history/provider fixtures; no consumer grant, capture or native send.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  CURRENT_R23,
  R23_BASE_ADOPTION,
  R23_PRESERVED_PROOFS,
  R23_CHECKOUT_RECOVERY,
  CURRENT_R22_FAILED_PREPARATION,
  CURRENT_R22_FAILED_RUN,
} from "../../scripts/sounding-line/experience-current-r23.mjs";
import {
  validateCurrentAdmissionRegistry,
  validateCurrentR22FailedPreparation,
  validateCurrentAdmissionEvidence,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import { selectTrustedExceptions, trustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
import { sourceGateFixture } from "./experience-review-source-gate.test.mjs";
import { integratedEvidence } from "./experience-current-r21.test.mjs";
import { mediaFirstDigest } from "../../scripts/sounding-line/experience-media-first-shared.mjs";
import { R20_SCOPE } from "../../scripts/sounding-line/experience-current-r20.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hash = (value) => sha(JSON.stringify(value));
const raw = git("show", `${CURRENT_R23.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`);
const installed = JSON.parse(raw);
export function r23RegistryFixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T23:50:00Z") });
  const registry = structuredClone(installed),
    previous = registry.exceptions[21],
    record = structuredClone(previous);
  Object.assign(record, {
    version: 23,
    id: CURRENT_R23.id,
    ownerApproval: structuredClone(CURRENT_R23.ownerApproval),
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R23.id}` },
    predecessor: structuredClone(CURRENT_R22_FAILED_PREPARATION),
    frozenReferenceSha: CURRENT_R23.frozenReferenceSha,
    remainingIndependentReviewOrdinal: 12,
  });
  Object.assign(record.currentSourceAdmission, {
    protectedBaseAncestorSha: CURRENT_R23.protectedBaseAncestorSha,
    sourceDigest: "b".repeat(64),
    cumulativeHistory: structuredClone(CURRENT_R23.cumulativeHistory),
    requiredReviewIterations: 16,
    historicalRuns: [...previous.currentSourceAdmission.historicalRuns, structuredClone(CURRENT_R22_FAILED_RUN)],
    frozenInputAdoption: structuredClone(R23_BASE_ADOPTION),
    preservedR22Proofs: structuredClone(R23_PRESERVED_PROOFS),
    checkoutRecovery: structuredClone(R23_CHECKOUT_RECOVERY),
    protectedOverlay: [
      {
        path: "scripts/sounding-line/experience-current-r23.mjs",
        oldMode: null,
        oldBlob: null,
        newMode: "100644",
        newBlob: "a".repeat(40),
        candidateMode: "100644",
        candidateBlob: "a".repeat(40),
      },
    ],
  });
  registry.exceptions.push(record);
  return { registry, record };
}

test("generation23 preserves22 raw predecessor records and spent26 while leaving review12 unperformed", (t) => {
  const { registry, record } = r23RegistryFixture(t);
  assert.equal(sha(raw), CURRENT_R23.previousRegistryRawSha256);
  assert.equal(hash(installed), CURRENT_R23.previousRegistryDigest);
  assert.equal(hash(installed.exceptions), CURRENT_R23.previousRecordsDigest);
  assert.equal(validateCurrentAdmissionRegistry(registry).id, CURRENT_R23.id);
  assert.equal(selectTrustedExceptions(registry.exceptions)[0].version, 23);
  assert.deepEqual(record.currentSourceAdmission.cumulativeHistory, {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 26,
    currentPreparationOrdinal: 27,
    completedIndependentReviews: 11,
  });
  assert.equal(record.remainingIndependentReviewOrdinal, 12);
  assert.equal(record.predecessor.independentReviewPerformed, false);
  const ledger = JSON.parse(
    readFileSync(
      path.join(
        root,
        "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-checkout-recovery-20261020-r23/historical-ledger.json",
      ),
      "utf8",
    ),
  );
  const previousLedger = JSON.parse(
    git(
      "show",
      `${CURRENT_R23.protectedBaseAncestorSha}:Development_Docs/Programs/Sounding_Line/evidence/crossdeck-pre-source-byte-gate-20261020-r22/historical-ledger.json`,
    ),
  );
  for (const key of [
    "consumedR17",
    "consumedR18",
    "consumedR19",
    "consumedR20",
    "consumedR21",
    "acceptedBaseAdoption",
    "preservedR20Proofs",
    "preservedR21Proofs",
  ])
    assert.deepEqual(ledger[key], previousLedger[key], `inherited ${key} strings and identities remain exact`);
  for (const mutate of [
    (r) => {
      r.exceptions[0].id = "ALTERED";
    },
    (r) => {
      r.exceptions[22].predecessor.conclusion = "success";
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 25;
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 12;
    },
    (r) => {
      r.exceptions[22].remainingIndependentReviewOrdinal = 13;
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.requiredReviewIterations = 17;
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.checkoutRecovery.checkoutStepTimeoutMinutes = 40;
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.checkoutRecovery.candidateFetchDepth = 1;
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.caps.capture = 2;
    },
    (r) => {
      r.exceptions[22].ownerApproval.basis = "NATIVE_BODY_REREAD";
    },
    (r) => {
      r.exceptions[22].expiresAt = "2026-10-23T00:00:00Z";
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_/u);
  }
});

test("generation23 marker cannot revive R22 by deletion, retirement, disguise or premature approval", (t) => {
  const { registry } = r23RegistryFixture(t),
    folder = mkdtempSync(path.join(tmpdir(), "r23-registry-"));
  assert(folder.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const run = (...args) =>
    execFileSync("git", args, { cwd: folder, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  run("init", "-q");
  run("config", "user.name", "Inert R23");
  run("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(folder, "scripts/sounding-line"), { recursive: true });
  mkdirSync(path.join(folder, "testing"));
  writeFileSync(path.join(folder, "scripts/sounding-line/experience-current-r23.mjs"), "// inert protected sentinel\n");
  const commit = (value) => {
    writeFileSync(path.join(folder, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    run("add", ".");
    run("commit", "-qm", "inert registry");
    return run("rev-parse", "HEAD");
  };
  assert.equal(trustedExceptions(folder, commit(registry))[0].version, 23);
  for (const change of [
    (r) => r.exceptions.pop(),
    (r) => {
      r.exceptions[22].status = "RETIRED";
    },
    (r) => {
      r.exceptions[22].currentSourceAdmission.kind = "DISGUISED";
    },
  ]) {
    const altered = structuredClone(registry);
    change(altered);
    assert.throws(() => trustedExceptions(folder, commit(altered)), /CURRENT_ADMISSION_/u);
  }
  assert.throws(() => validateCurrentAdmissionRegistry(registry, new Date("2026-10-20T23:15:32Z")), /R23_SCOPE/u);
  assert.throws(() => validateCurrentAdmissionRegistry(registry, new Date(CURRENT_R23.expiresAt)), /RECORD_INVALID/u);
});

test("generation23 frozen input is the exact accepted R22 merge with product/contracts/E2E unchanged", () => {
  assert.equal(
    git("rev-parse", `${CURRENT_R23.frozenReferenceSha}^{tree}`).toString().trim(),
    CURRENT_R23.frozenReferenceTree,
  );
  assert.equal(
    git("show", "-s", "--format=%P", CURRENT_R23.frozenReferenceSha).toString().trim(),
    R23_BASE_ADOPTION.parents.join(" "),
  );
  assert.equal(
    git(
      "diff",
      "--name-only",
      R23_BASE_ADOPTION.priorFrozenReferenceSha,
      CURRENT_R23.frozenReferenceSha,
      "--",
      "src",
      "testing/contracts.json",
      "tests/e2e",
    ).toString(),
    "",
  );
  assert.equal(
    git("merge-tree", "--write-tree", ...R23_BASE_ADOPTION.parents)
      .toString()
      .trim()
      .split(/\r?\n/u)[0],
    CURRENT_R23.frozenReferenceTree,
  );
});

test("generation23 authenticates original failed26, exact checkout boundary, empty artifacts and absent review12 with GET-only custody", async (t) => {
  const { record } = r23RegistryFixture(t),
    p = CURRENT_R22_FAILED_PREPARATION;
  const bytes = git("show", `${p.prepareCommit}:.sounding-line-exception-reservation.json`);
  assert.equal(bytes.length, p.preparePayloadBytes);
  assert.equal(sha(bytes), p.preparePayloadDigest);
  const original = JSON.parse(bytes),
    expected = CURRENT_R22_FAILED_RUN;
  const invoke = async (change = {}) => {
    const payload = structuredClone(original);
    change.prepare?.(payload);
    const run = {
      id: expected.id,
      run_attempt: 1,
      workflow_id: expected.workflowId,
      event: expected.event,
      head_sha: expected.headSha,
      head_branch: expected.headBranch,
      actor: { login: "Kgray44" },
      triggering_actor: { login: "Kgray44" },
      repository: { full_name: expected.repository },
      head_repository: { full_name: expected.repository },
      status: expected.status,
      conclusion: expected.conclusion,
      created_at: expected.createdAt,
      display_title: expected.displayTitle,
      check_suite_id: expected.checkSuiteId,
    };
    change.run?.(run);
    const jobs = {
      total_count: p.jobs.length,
      jobs: p.jobs.map((j) => ({
        ...j,
        steps:
          j.id === p.checkout.jobId
            ? [
                {
                  number: 2,
                  name: "Run actions/checkout@v4",
                  status: "completed",
                  conclusion: p.checkout.conclusion,
                  started_at: p.checkout.startedAt,
                  completed_at: p.checkout.completedAt,
                },
                ...Array.from({ length: 11 }, (_, n) => ({ number: n + 3, conclusion: "skipped" })),
              ]
            : [],
      })),
    };
    change.jobs?.(jobs);
    const artifacts = { total_count: 0, artifacts: [] };
    change.artifacts?.(artifacts);
    const slots = [];
    const result = await validateCurrentR22FailedPreparation({
      record,
      storeFor: (value) => {
        assert.equal(value.id, p.id);
        return {
          read: async (slot) => {
            slots.push(slot);
            return slot === "prepare"
              ? { ...payload, commitSha: p.prepareCommit }
              : slot === change.slot
                ? { occupied: true }
                : null;
          },
          create: () => {
            throw Error("Unexpected write");
          },
        };
      },
      request: async (endpoint, method = "GET") => {
        assert.equal(method, "GET");
        if (endpoint === `actions/runs/${p.runId}`) return run;
        if (endpoint === `git/commits/${p.candidateSha}`) return { tree: { sha: change.tree ?? p.candidateTree } };
        if (endpoint === `actions/runs/${p.runId}/jobs?per_page=100`) return jobs;
        if (endpoint === `actions/runs/${p.runId}/artifacts?per_page=100`) return artifacts;
        throw Error("Unexpected endpoint:" + endpoint);
      },
    });
    assert.deepEqual(slots, ["prepare", ...p.absentSlots]);
    return result;
  };
  assert.equal((await invoke()).reservedIndependentReviewOrdinal, 12);
  for (const change of [
    {
      prepare: (q) => {
        q.independentReviewsCompleted = 12;
      },
    },
    { slot: "review12" },
    { slot: "capture" },
    {
      run: (q) => {
        q.conclusion = "failure";
      },
    },
    { tree: "0".repeat(40) },
    {
      jobs: (q) => {
        q.total_count++;
      },
    },
    {
      jobs: (q) => {
        q.jobs.find((j) => j.id === p.checkout.jobId).steps[0].started_at = "2026-10-20T20:18:45Z";
      },
    },
    {
      jobs: (q) => {
        q.jobs.find((j) => j.id === p.checkout.jobId).steps[2].conclusion = "success";
      },
    },
    {
      artifacts: (q) => {
        q.artifacts.push({ id: 1 });
      },
    },
  ])
    await assert.rejects(invoke(change), /CURRENT_ADMISSION_R22_/u);
});

test("generation23 requires current PASS/stage/native disclosure and preserves functional B1/full B2", async (t) => {
  const { record } = r23RegistryFixture(t),
    f = integratedEvidence(record, sourceGateFixture(t, 23));
  f.capture.sourceDigest = f.plan.sourceDigest;
  f.capture.exception = f.plan.exception;
  const stage = await f.stage(),
    protocol = f.evidence.mediaFirstReview;
  Object.assign(protocol, { preSourceAdmission: stage.preSourceAdmission, sourcePacketStage: stage.sourcePacketStage });
  protocol.sourceDisclosure = {
    kind: "CROSSDECK_NATIVE_SOURCE_DISCLOSURE_1",
    status: "DELIVERED",
    preSourceAdmissionDigest: mediaFirstDigest(stage.preSourceAdmission),
    sourcePacketStageDigest: mediaFirstDigest(stage.sourcePacketStage),
    reviewerContext: protocol.reviewerContext,
    verifiedByContext: protocol.builderContext,
    nativeMessageId: "synthetic-native-disclosure-only",
    sourcePacketSha256: stage.sourcePacketStage.packet.sha256,
    startedAtUtc: protocol.sourceInspectionStartedAt,
    completedAtUtc: "2026-10-20T23:25:01Z",
  };
  validateCurrentAdmissionEvidence(f.plan, f.evidence);
  const saved = structuredClone(protocol);
  protocol.preSourceAdmission.binding.recordDigest = CURRENT_R23.previousRecordDigest;
  protocol.sourcePacketStage.preSourceAdmissionDigest = mediaFirstDigest(protocol.preSourceAdmission);
  protocol.sourceDisclosure.preSourceAdmissionDigest = mediaFirstDigest(protocol.preSourceAdmission);
  protocol.sourceDisclosure.sourcePacketStageDigest = mediaFirstDigest(protocol.sourcePacketStage);
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /PASS_RECEIPT_REQUIRED/u);
  Object.assign(protocol, saved);
  const b1 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B1");
  b1.functionalResolution.status = "UNRESOLVED";
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /UNRESOLVED_FUNCTIONAL_COMPONENT/u);
  b1.functionalResolution.status = "RESOLVED";
  const b2 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B2");
  b2.disposition = R20_SCOPE.disposition;
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /R18_BLOCKING_FINDING_NOT_RESOLVED/u);
});
