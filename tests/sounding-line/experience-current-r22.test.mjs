import { integratedEvidence } from "./experience-current-r21.test.mjs";
import { sourceGateFixture } from "./experience-review-source-gate.test.mjs";
import { mediaFirstDigest } from "../../scripts/sounding-line/experience-media-first-shared.mjs";
import { validateCurrentAdmissionEvidence } from "../../scripts/sounding-line/experience-current-admission.mjs";
import { R20_SCOPE } from "../../scripts/sounding-line/experience-current-r20.mjs";
// Fixed historical bytes plus inert records/provider responses; no grant is installed.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  CURRENT_R22,
  R22_BASE_ADOPTION,
  R22_PRESERVED_PROOFS,
  CURRENT_R21_NONQUALIFYING_CAPTURE,
  CURRENT_R21_SUCCESSFUL_RUN,
} from "../../scripts/sounding-line/experience-current-r22.mjs";
import {
  validateCurrentAdmissionRegistry,
  validateCurrentR21NonqualifyingCapture,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import { trustedExceptions, selectTrustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const raw = git("show", `${CURRENT_R22.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`);
const installed = JSON.parse(raw);
export function r22RegistryFixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T18:50:00Z") });
  const registry = structuredClone(installed),
    previous = registry.exceptions[20],
    record = structuredClone(previous);
  Object.assign(record, {
    version: 22,
    id: CURRENT_R22.id,
    ownerApproval: structuredClone(CURRENT_R22.ownerApproval),
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R22.id}` },
    predecessor: structuredClone(CURRENT_R21_NONQUALIFYING_CAPTURE),
    frozenReferenceSha: CURRENT_R22.frozenReferenceSha,
    remainingIndependentReviewOrdinal: 12,
  });
  Object.assign(record.currentSourceAdmission, {
    protectedBaseAncestorSha: CURRENT_R22.protectedBaseAncestorSha,
    sourceDigest: "b".repeat(64),
    cumulativeHistory: structuredClone(CURRENT_R22.cumulativeHistory),
    requiredReviewIterations: 16,
    historicalRuns: [...previous.currentSourceAdmission.historicalRuns, structuredClone(CURRENT_R21_SUCCESSFUL_RUN)],
    reviewProtocol: structuredClone(CURRENT_R22.reviewProtocol),
    frozenInputAdoption: structuredClone(R22_BASE_ADOPTION),
    preservedR21Proofs: structuredClone(R22_PRESERVED_PROOFS),
    protectedOverlay: [
      {
        path: "scripts/sounding-line/experience-current-r22.mjs",
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
test("generation22 preserves all21 records and spent malformed review11 without refunds or fallback", (t) => {
  const { registry, record } = r22RegistryFixture(t);
  assert.equal(createHash("sha256").update(raw).digest("hex"), CURRENT_R22.previousRegistryRawSha256);
  assert.equal(hash(installed), CURRENT_R22.previousRegistryDigest);
  assert.equal(hash(installed.exceptions), CURRENT_R22.previousRecordsDigest);
  assert.equal(registry.reconciliations.length, 7);
  assert.equal(validateCurrentAdmissionRegistry(registry).id, CURRENT_R22.id);
  assert.equal(selectTrustedExceptions(registry.exceptions)[0].version, 22);
  assert.equal(record.predecessor.auxiliaryReview.preSourceSchemaAdmitted, false);
  assert.equal(record.predecessor.auxiliaryReview.sourceDisclosed, true);
  assert.equal(record.predecessor.auxiliaryReview.qualifying, false);
  for (const mutate of [
    (r) => {
      r.exceptions[20].predecessor.auxiliaryReview.qualifying = true;
    },
    (r) => {
      r.exceptions[21].predecessor.auxiliaryReview.preSourceSchemaAdmitted = true;
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 10;
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 24;
    },
    (r) => {
      r.exceptions[21].remainingIndependentReviewOrdinal = 11;
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.caps.capture = 2;
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.reviewProtocol.preSourceAdmissionRequired = false;
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.frozenInputAdoption.parents.reverse();
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.preservedR21Proofs.pop();
    },
    (r) => {
      r.exceptions[21].ownerApproval.humanMessageId = "not-authorized";
    },
    (r) => {
      r.exceptions[21].currentSourceAdmission.protectedOverlay[0].path = R22_PRESERVED_PROOFS[0].path;
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_/u);
  }
});

test("generation22 fixed sentinel rejects deletion, retirement, stale approval and expiry", (t) => {
  const { registry } = r22RegistryFixture(t),
    directory = mkdtempSync(path.join(tmpdir(), "r22-fixed-reader-"));
  assert(directory.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const invoke = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  invoke("init", "-q");
  invoke("config", "user.name", "Inert fixed reader");
  invoke("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(directory, "scripts/sounding-line"), { recursive: true });
  mkdirSync(path.join(directory, "testing"));
  writeFileSync(path.join(directory, "scripts/sounding-line/experience-current-r22.mjs"), "// fixed marker\n");
  const commit = (value) => {
    writeFileSync(path.join(directory, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    invoke("add", ".");
    return invoke("commit-tree", invoke("write-tree"), "-m", "inert marker fixture");
  };
  assert.equal(trustedExceptions(directory, commit(registry))[0].version, 22);
  assert.throws(() => trustedExceptions(directory, commit(installed)), /R22_REGISTRY_INVALID/u);
  for (const change of [{ status: "RETIRED" }, { version: 21 }, { currentSourceAdmission: {} }]) {
    const value = structuredClone(registry);
    Object.assign(value.exceptions[21], change);
    assert.throws(() => trustedExceptions(directory, commit(value)), /CURRENT_ADMISSION_/u);
  }
  t.mock.timers.setTime(Date.parse("2026-10-20T18:17:00Z"));
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /R22_SCOPE_OR_SPENT_HISTORY_CHANGED/u);
  t.mock.timers.setTime(Date.parse(CURRENT_R22.expiresAt));
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /RECORD_INVALID/u);
});

test("generation22 frozen input is the exact normal accepted-base merge with conserved product/contracts/E2E", () => {
  assert.equal(
    git("rev-list", "--parents", "-n", "1", CURRENT_R22.frozenReferenceSha).toString().trim(),
    [CURRENT_R22.frozenReferenceSha, ...R22_BASE_ADOPTION.parents].join(" "),
  );
  assert.equal(
    git("rev-parse", `${CURRENT_R22.frozenReferenceSha}^{tree}`).toString().trim(),
    CURRENT_R22.frozenReferenceTree,
  );
  for (const file of ["src", "testing/contracts.json", "tests/e2e"])
    assert.equal(
      git("rev-parse", `${CURRENT_R22.frozenReferenceSha}:${file}`).toString(),
      git("rev-parse", `${R22_BASE_ADOPTION.priorFrozenReferenceSha}:${file}`).toString(),
    );
});

test("generation22 reads exact spent R21 prepare/capture metadata without fabricating review11 or writing custody", async (t) => {
  const { record } = r22RegistryFixture(t),
    p = CURRENT_R21_NONQUALIFYING_CAPTURE;
  const original = JSON.parse(git("show", `${p.prepareCommit}:.sounding-line-exception-reservation.json`));
  const apiRun = {
    id: p.runId,
    run_attempt: 1,
    workflow_id: p.workflowId,
    check_suite_id: p.checkSuiteId,
    event: p.event,
    head_sha: p.headSha,
    head_branch: p.headBranch,
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    head_repository: { full_name: "Kgray44/treasurehuntSoT" },
    status: "completed",
    conclusion: "success",
    created_at: p.createdAt,
    display_title: CURRENT_R21_SUCCESSFUL_RUN.displayTitle,
  };
  const invoke = async (change = {}) => {
    let writes = 0;
    const slots = new Map([["prepare", { ...structuredClone(original), commitSha: p.prepareCommit }]]);
    change.prepare?.(slots.get("prepare"));
    if (change.slot) slots.set(change.slot, { fabricated: true });
    const request = async (route) => {
      if (route === `actions/runs/${p.runId}`) {
        const run = structuredClone(apiRun);
        change.run?.(run);
        return run;
      }
      if (route === `git/commits/${p.candidateSha}`) return { tree: { sha: p.candidateTree } };
      const expected = p.artifacts.find((a) => route === `actions/artifacts/${a.id}`);
      assert(expected);
      const artifact = {
        id: expected.id,
        expired: false,
        size_in_bytes: expected.bytes,
        digest: `sha256:${expected.sha256}`,
        workflow_run: { id: p.runId, head_sha: p.headSha },
      };
      change.artifact?.(artifact);
      return artifact;
    };
    const storeFor = () => ({
      read: async (slot) => slots.get(slot) ?? null,
      create: async () => {
        writes++;
        throw Error("NO_CUSTODY_WRITES");
      },
    });
    try {
      return await validateCurrentR21NonqualifyingCapture({ record, request, storeFor });
    } finally {
      assert.equal(writes, 0);
    }
  };
  assert.equal((await invoke()).independentReviewsCompleted, 10);
  for (const change of [
    {
      prepare: (q) => {
        q.independentReviewsCompleted = 11;
      },
    },
    {
      prepare: (q) => {
        q.binding.sourceDigest = "0".repeat(64);
      },
    },
    { slot: "review11" },
    { slot: "capture" },
    {
      run: (q) => {
        q.head_sha = p.candidateSha;
      },
    },
    {
      artifact: (q) => {
        q.expired = true;
      },
    },
    {
      artifact: (q) => {
        q.size_in_bytes++;
      },
    },
    {
      artifact: (q) => {
        q.workflow_run.head_sha = p.candidateSha;
      },
    },
  ])
    await assert.rejects(() => invoke(change), /CURRENT_ADMISSION_R21_/u);
});

test("generation22 gates canonical review on original pre-source receipts while retaining functional B1/full B2", async (t) => {
  const { record } = r22RegistryFixture(t),
    source = sourceGateFixture(t),
    f = integratedEvidence(record, source);
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
    completedAtUtc: "2026-10-20T18:30:01Z",
  };
  validateCurrentAdmissionEvidence(f.plan, f.evidence);
  const saved = protocol.preSourceAdmission;
  delete protocol.preSourceAdmission;
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /PASS_RECEIPT_REQUIRED/u);
  protocol.preSourceAdmission = saved;
  const b1 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B1");
  b1.functionalResolution.status = "UNRESOLVED";
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /UNRESOLVED_FUNCTIONAL_COMPONENT/u);
  b1.functionalResolution.status = "RESOLVED";
  const b2 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B2");
  b2.disposition = R20_SCOPE.disposition;
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /R18_BLOCKING_FINDING_NOT_RESOLVED/u);
});
