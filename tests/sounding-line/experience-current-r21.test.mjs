// Exact historical source plus synthetic review/provider fixtures; no execution allowance is consumed.
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R20_SCOPE } from "../../scripts/sounding-line/experience-current-r20.mjs";
import { CURRENT_R17_BLOCKED_CAPTURE } from "../../scripts/sounding-line/experience-current-r18.mjs";
import {
  CURRENT_R21,
  R21_BASE_ADOPTION,
  R21_PRESERVED_PROOFS,
  CURRENT_R20_NONQUALIFYING_CAPTURE,
  CURRENT_R20_SUCCESSFUL_RUN,
} from "../../scripts/sounding-line/experience-current-r21.mjs";
import {
  currentAdmissionBinding,
  validateCurrentAdmissionRegistry,
  validateCurrentAdmissionEvidence,
  validateCurrentR21AcceptedBaseAdoption,
  validateCurrentR20NonqualifyingCapture,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import { trustedExceptions, selectTrustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
import { mediaFirstFixture } from "./experience-media-first-r21.test.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: root, maxBuffer: 128 * 1024 * 1024 });
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const raw = git("show", `${CURRENT_R21.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`);
const installed = JSON.parse(raw);
function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-20T14:40:00Z") });
  const registry = structuredClone(installed),
    previous = registry.exceptions[19],
    record = structuredClone(previous);
  Object.assign(record, {
    version: 21,
    id: CURRENT_R21.id,
    ownerApproval: structuredClone(CURRENT_R21.ownerApproval),
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R21.id}` },
    predecessor: structuredClone(CURRENT_R20_NONQUALIFYING_CAPTURE),
    frozenReferenceSha: CURRENT_R21.frozenReferenceSha,
    remainingIndependentReviewOrdinal: 11,
  });
  Object.assign(record.currentSourceAdmission, {
    protectedBaseAncestorSha: CURRENT_R21.protectedBaseAncestorSha,
    sourceDigest: "b".repeat(64),
    cumulativeHistory: structuredClone(CURRENT_R21.cumulativeHistory),
    requiredReviewIterations: 15,
    historicalRuns: [...previous.currentSourceAdmission.historicalRuns, structuredClone(CURRENT_R20_SUCCESSFUL_RUN)],
    reviewProtocol: structuredClone(CURRENT_R21.reviewProtocol),
    acceptedBaseAdoption: structuredClone(R21_BASE_ADOPTION),
    preservedR20Proofs: structuredClone(R21_PRESERVED_PROOFS),
    protectedOverlay: [
      {
        path: "scripts/sounding-line/experience-current-r21.mjs",
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
export { fixture as r21RegistryFixture };
test("generation21 preserves twenty literal records, seven reconciliations, review10 auxiliary truth and honest next ordinals", (t) => {
  const { registry, record } = fixture(t);
  assert.equal(createHash("sha256").update(raw).digest("hex"), CURRENT_R21.previousRegistryRawSha256);
  assert.equal(hash(installed), CURRENT_R21.previousRegistryDigest);
  assert.equal(hash(installed.exceptions), CURRENT_R21.previousRecordsDigest);
  assert.equal(registry.reconciliations.length, 7);
  assert.equal(validateCurrentAdmissionRegistry(registry).id, CURRENT_R21.id);
  assert.equal(selectTrustedExceptions(registry.exceptions)[0].version, 21);
  assert.equal(record.predecessor.conclusion, "success");
  assert.equal(record.predecessor.auxiliaryReview.qualifying, false);
  for (const mutate of [
    (r) => {
      r.exceptions[19].predecessor.blockedReview.verdict = "PASS";
    },
    (r) => {
      r.reconciliations.pop();
    },
    (r) => {
      delete r.exceptions[20].ownerApproval.humanMessageId;
    },
    (r) => {
      r.exceptions[20].predecessor.auxiliaryReview.sourcePhaseBeforeMedia = false;
    },
    (r) => {
      r.exceptions[20].predecessor.auxiliaryReview.sevenExplicitCanonicalAcceptedJudgments = true;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 23;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 9;
    },
    (r) => {
      r.exceptions[20].remainingIndependentReviewOrdinal = 10;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.requiredReviewIterations = 14;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.historicalRuns.pop();
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.caps.capture = 2;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.caps.review = 0;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.preservedR20Proofs.pop();
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.acceptedBaseAdoption.paths.pop();
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.scopeAdjudication.historicalCaptureReuse = true;
    },
    (r) => {
      r.exceptions[20].currentSourceAdmission.protectedOverlay[0].path = R21_PRESERVED_PROOFS[0].path;
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_/u);
  }
});

test("generation21 fixed sentinel cannot fall back to the spent20 prefix after removal, retirement or expiry", (t) => {
  const { registry } = fixture(t),
    directory = mkdtempSync(path.join(tmpdir(), "r21-fixed-reader-"));
  assert(directory.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: directory });
  mkdirSync(path.join(directory, "scripts/sounding-line"), { recursive: true });
  mkdirSync(path.join(directory, "testing"));
  writeFileSync(path.join(directory, "scripts/sounding-line/experience-current-r21.mjs"), "// inert fixed sentinel\n");
  const commit = (value) => {
    writeFileSync(path.join(directory, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    execFileSync("git", ["add", "."], { cwd: directory });
    const tree = execFileSync("git", ["write-tree"], { cwd: directory }).toString().trim();
    return execFileSync("git", ["commit-tree", tree, "-m", "inert R21 fixture"], {
      cwd: directory,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.invalid",
        GIT_COMMITTER_NAME: "Fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      },
    })
      .toString()
      .trim();
  };
  assert.equal(trustedExceptions(directory, commit(registry))[0].version, 21);
  assert.throws(() => trustedExceptions(directory, commit(installed)), /R21_REGISTRY_INVALID/u);
  for (const change of [{ status: "RETIRED" }, { version: 20 }, { currentSourceAdmission: {} }]) {
    const value = structuredClone(registry);
    Object.assign(value.exceptions[20], change);
    assert.throws(() => trustedExceptions(directory, commit(value)), /CURRENT_ADMISSION_/u);
  }
  t.mock.timers.setTime(Date.parse("2026-10-20T13:25:00Z"));
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /R21_SCOPE_OR_SPENT_HISTORY_CHANGED/u);
  t.mock.timers.setTime(Date.parse(CURRENT_R21.expiresAt));
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /RECORD_INVALID/u);
});

test("generation21 accepts only exact accepted-base inheritance and keeps product/contracts/E2E frozen", () => {
  const inventory = (ref) =>
    new Map(
      git("ls-tree", "-rz", ref)
        .toString()
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const [metadata, file] = row.split("\t");
          return [file, metadata];
        }),
    );
  const original = inventory(R21_BASE_ADOPTION.originalCandidateSha),
    reference = inventory(CURRENT_R21.frozenReferenceSha),
    actualPaths = git("diff", "--name-only", R21_BASE_ADOPTION.originalCandidateSha, CURRENT_R21.frozenReferenceSha)
      .toString()
      .trim()
      .split(/\r?\n/u);
  assert.equal(actualPaths.length, 19);
  assert(
    actualPaths.every((p) => !p.startsWith("src/") && !p.startsWith("tests/e2e/") && p !== "testing/contracts.json"),
  );
  validateCurrentR21AcceptedBaseAdoption({ original, reference, actualPaths });
  for (const file of ["testing/contracts.json", "src/unapproved.ts", R21_BASE_ADOPTION.paths[0].path]) {
    const changed = new Map(reference);
    changed.set(file, "100644 blob " + "0".repeat(40));
    assert.throws(
      () => validateCurrentR21AcceptedBaseAdoption({ original, reference: changed, actualPaths }),
      /R21_ACCEPTED_BASE_ADOPTION_CHANGED/u,
    );
  }
  assert.throws(
    () => validateCurrentR21AcceptedBaseAdoption({ original, reference, actualPaths: actualPaths.slice(1) }),
    /R21_ACCEPTED_BASE_ADOPTION_CHANGED/u,
  );
});

export function integratedEvidence(record, f = mediaFirstFixture()) {
  f.plan.exception = currentAdmissionBinding(record);
  f.plan.sourceDigest = record.currentSourceAdmission.sourceDigest;
  f.first.sourceDigest = f.plan.sourceDigest;
  f.evidence.exception = f.plan.exception;
  for (const [index, artifact] of f.evidence.artifacts.entries())
    Object.assign(artifact, {
      path: `Development_Docs/Testing/Product_Experience/evidence/inert-r21-${index}.${{ screenshot: "png", recording: "webm", trace: "zip" }[artifact.type]}`,
      sha256: "f".repeat(64),
      origin: "ACTUAL_APPLICATION",
      role: "PLAYER",
      motionMode: "NORMAL",
    });
  for (const review of f.evidence.reviews) {
    Object.assign(review, {
      iterations: record.currentSourceAdmission.requiredReviewIterations,
      independentReviewOrdinal: record.remainingIndependentReviewOrdinal,
      cumulativeHistory: structuredClone(record.currentSourceAdmission.cumulativeHistory),
    });
    review.findings = CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings
      .filter((p) => p.contractIds.includes(review.contractId))
      .map((previous) => {
        const evidenceId = f.evidence.artifacts.find((a) => a.contractId === review.contractId).id;
        const finding = {
          id: previous.id,
          classification: previous.classification,
          contractId: review.contractId,
          disposition: "RESOLVED",
          resolution: "Synthetic current functional repair observation; no product acceptance.",
          repairEvidenceIds: [evidenceId],
        };
        if (previous.id === "R17-R8-B1") {
          const transfer = R20_SCOPE.transfers.find((v) => v.contractId === review.contractId);
          Object.assign(finding, {
            disposition: R20_SCOPE.disposition,
            functionalResolution: {
              status: "RESOLVED",
              observation: "Synthetic currently readable and operable functional component.",
              evidenceIds: [evidenceId],
            },
            editorialDeferral: {
              adjudicationId: R20_SCOPE.id,
              adjudicationDigest: hash(R20_SCOPE),
              component: "EDITORIAL_FIRST_VIEWPORT_HIERARCHY",
              refitAreaId: R20_SCOPE.refit.areaId,
              designPacket: R20_SCOPE.refit.designPacket,
              ledgerEntryId: transfer.ledgerEntryId,
              originalReview9Sha256: R20_SCOPE.originalReview9Sha256,
              originalClosureSha256: R20_SCOPE.originalClosureSha256,
              ownerAcceptance: "OUTSTANDING",
            },
          });
        }
        return finding;
      });
  }
  f.seal();
  return f;
}
test("generation21 integrates media-first provenance with unchanged functional B1 and full B2 gates", (t) => {
  const { record } = fixture(t),
    f = integratedEvidence(record);
  validateCurrentAdmissionEvidence(f.plan, f.evidence);
  const b1 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B1");
  b1.functionalResolution.status = "UNRESOLVED";
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /UNRESOLVED_FUNCTIONAL_COMPONENT/u);
  b1.functionalResolution.status = "RESOLVED";
  const b2 = f.evidence.reviews.flatMap((r) => r.findings).find((v) => v.id === "R17-R8-B2");
  b2.disposition = R20_SCOPE.disposition;
  assert.throws(() => validateCurrentAdmissionEvidence(f.plan, f.evidence), /R18_BLOCKING_FINDING_NOT_RESOLVED/u);
  b2.disposition = "RESOLVED";
  f.first.exposureBeforeFreeze.source = true;
  f.seal();
  assert.throws(
    () => validateCurrentAdmissionEvidence(f.plan, f.evidence),
    /R21_MEDIA_FIRST_FIRST_PASS_IDENTITY_OR_EXPOSURE_CHANGED/u,
  );
});

test("generation21 reads exact spent R20 prepare/capture metadata without fabricating review10 or writing custody", async (t) => {
  const { record } = fixture(t),
    p = CURRENT_R20_NONQUALIFYING_CAPTURE;
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
    display_title: CURRENT_R20_SUCCESSFUL_RUN.displayTitle,
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
      return await validateCurrentR20NonqualifyingCapture({ record, request, storeFor });
    } finally {
      assert.equal(writes, 0);
    }
  };
  assert.equal((await invoke()).independentReviewsCompleted, 9);
  for (const change of [
    {
      prepare: (q) => {
        q.independentReviewsCompleted = 10;
      },
    },
    {
      prepare: (q) => {
        q.binding.sourceDigest = "0".repeat(64);
      },
    },
    { slot: "review10" },
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
    await assert.rejects(() => invoke(change), /CURRENT_ADMISSION_R20_/u);
});
