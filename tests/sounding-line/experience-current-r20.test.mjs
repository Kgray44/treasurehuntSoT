// Synthetic policy/source/provider fixtures only. No grant installation or writes.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  currentAdmissionBinding,
  validateCurrentAdmissionRegistry,
  validateCurrentAdmissionEvidence,
  validateCurrentR19BlockedCapture,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import { trustedExceptions, selectTrustedExceptions } from "../../scripts/sounding-line/experience-exception.mjs";
import {
  CURRENT_R20,
  R20_SCOPE,
  CURRENT_R19_BLOCKED_CAPTURE,
  CURRENT_R19_SUCCESSFUL_RUN,
} from "../../scripts/sounding-line/experience-current-r20.mjs";
import { CURRENT_R17_BLOCKED_CAPTURE } from "../../scripts/sounding-line/experience-current-r18.mjs";
import {
  R20_DEFERRED_DISPOSITION,
  validateR20ContractDelta,
  validateR20ContractSource,
  validateR20TransferDocuments,
  validateScopedR20Finding,
} from "../../scripts/sounding-line/experience-scope-adjudication.mjs";
import { experienceDigest, mergeExperienceContracts } from "../../scripts/sounding-line/product-experience.mjs";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: sourceRoot, maxBuffer: 128 * 1024 * 1024 });
const raw = git("show", `${CURRENT_R20.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`);
const installed = JSON.parse(raw);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function fixture(t) {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-19T19:10:00Z") });
  const registry = structuredClone(installed),
    previous = registry.exceptions[18],
    record = structuredClone(previous);
  Object.assign(record, {
    version: 20,
    id: CURRENT_R20.id,
    ownerApproval: structuredClone(CURRENT_R20.ownerApproval),
    custody: { namespace: `sounding-line-exceptions/${CURRENT_R20.id}` },
    predecessor: structuredClone(CURRENT_R19_BLOCKED_CAPTURE),
    frozenReferenceSha: CURRENT_R20.frozenReferenceSha,
    contractDigest: R20_SCOPE.approvedContractDigest,
    remainingIndependentReviewOrdinal: 10,
  });
  Object.assign(record.currentSourceAdmission, {
    protectedBaseAncestorSha: CURRENT_R20.protectedBaseAncestorSha,
    sourceDigest: "b".repeat(64),
    cumulativeHistory: structuredClone(CURRENT_R20.cumulativeHistory),
    requiredReviewIterations: 14,
    historicalRuns: [...previous.currentSourceAdmission.historicalRuns, structuredClone(CURRENT_R19_SUCCESSFUL_RUN)],
    scopeAdjudication: structuredClone(R20_SCOPE),
    adjudication: structuredClone(CURRENT_R20.adjudication),
    observation: { ...previous.currentSourceAdmission.observation, id: "FIXTURE-R20-NOT-INSTALLED" },
  });
  registry.exceptions.push(record);
  return { registry, record, previous };
}

test("generation20 retains nineteen literal rows, seven reconciliations, original capture success and blocked review9", (t) => {
  const { registry, record, previous } = fixture(t);
  assert.equal(createHash("sha256").update(raw).digest("hex"), CURRENT_R20.previousRegistryRawSha256);
  assert.equal(hash(installed), CURRENT_R20.previousRegistryDigest);
  assert.equal(hash(previous), CURRENT_R20.previousRecordDigest);
  assert.equal(registry.reconciliations.length, 7);
  assert.equal(validateCurrentAdmissionRegistry(registry).id, CURRENT_R20.id);
  assert.equal(selectTrustedExceptions(registry.exceptions)[0].version, 20);
  assert.equal(record.predecessor.conclusion, "success");
  assert.equal(record.predecessor.blockedReview.verdict, "REWORK_REQUIRED");
  for (const mutate of [
    (r) => {
      r.exceptions[0].status = "RETIRED";
    },
    (r) => {
      r.reconciliations.pop();
    },
    (r) => {
      delete r.exceptions[19].ownerApproval.humanMessageId;
    },
    (r) => {
      delete r.exceptions[19].currentSourceAdmission.scopeAdjudication.approval;
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.scopeAdjudication.historicalCaptureReuse = true;
    },
    (r) => {
      r.exceptions[19].predecessor.blockedReview.verdict = "PASS";
    },
    (r) => {
      r.exceptions[19].predecessor.preparePayloadDigest = "0".repeat(64);
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.historicalRuns.pop();
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 22;
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 8;
    },
    (r) => {
      r.exceptions[19].remainingIndependentReviewOrdinal = 9;
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.caps.capture = 2;
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.caps.capture = 0;
    },
    (r) => {
      r.exceptions[19].currentSourceAdmission.contextCount = 37;
    },
    (r) => {
      r.exceptions[19].requiredTechnicalBrowserTests.pop();
    },
    (r) => {
      r.exceptions[19].immutableHistory[0].blob = "0".repeat(40);
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_|R20_ADJUDICATION_/u);
  }
});

test("generation20 fixed sentinel denies missing, retired, disguised, premature and expired rows without fallback", (t) => {
  const { registry } = fixture(t),
    root = mkdtempSync(path.join(tmpdir(), "r20-fixed-reader-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "-q"], { cwd: root });
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  mkdirSync(path.join(root, "testing"));
  writeFileSync(path.join(root, "scripts/sounding-line/experience-current-r20.mjs"), "// fixed sentinel\n");
  const commit = (value) => {
    writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(value));
    execFileSync("git", ["add", "."], { cwd: root });
    const tree = execFileSync("git", ["write-tree"], { cwd: root }).toString().trim();
    return execFileSync("git", ["commit-tree", tree, "-m", "inert R20 fixture"], {
      cwd: root,
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
  assert.equal(trustedExceptions(root, commit(registry))[0].version, 20);
  assert.throws(() => trustedExceptions(root, commit(installed)), /R20_REGISTRY_INVALID/u);
  for (const change of [{ status: "RETIRED" }, { version: 19 }, { currentSourceAdmission: {} }]) {
    const changed = structuredClone(registry);
    Object.assign(changed.exceptions[19], change);
    assert.throws(() => trustedExceptions(root, commit(changed)), /CURRENT_ADMISSION_|R20_ADJUDICATION_/u);
  }
  t.mock.timers.tick(Date.parse(CURRENT_R20.expiresAt) - Date.now());
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /RECORD_INVALID/u);
  t.mock.timers.setTime(Date.parse("2026-10-19T19:05:00Z"));
  assert.throws(() => validateCurrentAdmissionRegistry(registry), /R20_SCOPE_OR_SPENT_HISTORY_CHANGED/u);
});

test("generation20 existing contract planning derives the exact approved digest while retaining every functional field", (t) => {
  const { record } = fixture(t);
  const original = JSON.parse(git("show", `${CURRENT_R20.protectedBaseAncestorSha}:testing/contracts.json`));
  const amended = JSON.parse(git("show", `${CURRENT_R20.frozenReferenceSha}:testing/contracts.json`));
  const trusted = original.contracts.filter((contract) => contract.experience);
  const merged = mergeExperienceContracts(trusted, amended.contracts);
  const selected = merged.filter((contract) => CURRENT_R20.contractIds.includes(contract.id));
  assert.equal(experienceDigest(selected), record.contractDigest);
  const before = JSON.parse(git("show", `${R20_SCOPE.originalCandidateSha}:testing/contracts.json`));
  const prior = mergeExperienceContracts(trusted, before.contracts).filter((contract) =>
    CURRENT_R20.contractIds.includes(contract.id),
  );
  const normalized = structuredClone(selected);
  for (const change of R20_SCOPE.contractChanges)
    normalized.find((contract) => contract.id === change.contractId).experience.designTarget = change.oldValue;
  assert.deepEqual(normalized, prior);
  assert.equal(experienceDigest(prior), "befbdf5fa900b58f2a706c94a80861bb1819fbb045c17bb00756fa83b9b4af3d");
});

test("generation20 accepts only the approved three contract strings and rejects runtime, mode or functional deltas", () => {
  const inventory = (revision) =>
    new Map(
      git("ls-tree", "-rz", revision)
        .toString()
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const [metadata, file] = row.split("\t");
          return [file, metadata];
        }),
    );
  const original = JSON.parse(git("show", `${R20_SCOPE.originalCandidateSha}:testing/contracts.json`));
  const amended = JSON.parse(git("show", `${CURRENT_R20.frozenReferenceSha}:testing/contracts.json`));
  const options = {
    original,
    amended,
    before: inventory(R20_SCOPE.originalCandidateSha),
    after: inventory(CURRENT_R20.frozenReferenceSha),
    actualPaths: ["testing/contracts.json"],
  };
  assert.equal(validateR20ContractSource(options), true);
  for (const mutate of [
    (j) => {
      j.contracts.find((c) => c.id === R20_SCOPE.contractChanges[0].contractId).experience.designTarget = "unapproved";
    },
    (j) => {
      j.contracts.find((c) => c.id === R20_SCOPE.contractChanges[0].contractId).experience.motion = false;
    },
    (j) => {
      j.contracts.find((c) => c.id === R20_SCOPE.contractChanges[1].contractId).experience.journeys[0].steps.pop();
    },
    (j) => {
      j.contracts.find((c) => c.id === R20_SCOPE.contractChanges[2].contractId).critical = false;
    },
  ]) {
    const changed = structuredClone(amended);
    mutate(changed);
    assert.throws(() => validateR20ContractDelta({ original, amended: changed }), /CONTRACT_/u);
  }
  for (const wrong of [
    "100755 blob " + R20_SCOPE.approvedContractBlob,
    "120000 blob " + R20_SCOPE.approvedContractBlob,
    "100644 blob " + "0".repeat(40),
    undefined,
  ]) {
    const after = new Map(options.after);
    if (wrong) after.set("testing/contracts.json", wrong);
    else after.delete("testing/contracts.json");
    assert.throws(() => validateR20ContractSource({ ...options, after }), /CONTRACT_SOURCE_CHANGED/u);
  }
  const after = new Map(options.after);
  after.set("src/unapproved.ts", "100644 blob " + "0".repeat(40));
  assert.throws(() => validateR20ContractSource({ ...options, after }), /PRODUCT_RUNTIME_CHANGED/u);
  assert.throws(
    () => validateR20ContractSource({ ...options, actualPaths: ["testing/contracts.json", "src/unapproved.ts"] }),
    /CONTRACT_SOURCE_CHANGED/u,
  );
});

function scopedEvidence(record) {
  const plan = {
    applicable: true,
    sourceDigest: record.currentSourceAdmission.sourceDigest,
    contractDigest: record.contractDigest,
    contractIds: record.contractIds,
    contextCount: 38,
    paired: { browserContexts: 6 },
    exception: currentAdmissionBinding(record),
  };
  const artifacts = record.contractIds.map((contractId, index) => ({
    id: `inert-r20-${index}`,
    type: "screenshot",
    origin: "ACTUAL_APPLICATION",
    path: `Development_Docs/Testing/Product_Experience/evidence/inert-r20-${index}.png`,
    sha256: "f".repeat(64),
    contractId,
    state: "READY",
    device: "MOBILE",
    role: "PLAYER",
    motionMode: "REDUCED",
  }));
  const finding = (contractId) => {
    const artifact = artifacts.find((a) => a.contractId === contractId),
      transfer = R20_SCOPE.transfers.find((v) => v.contractId === contractId);
    return {
      id: "R17-R8-B1",
      classification: "MAJOR_EXPERIENCE_DEFECT",
      contractId,
      disposition: R20_DEFERRED_DISPOSITION,
      resolution: "Synthetic functional component resolution; no product acceptance is claimed.",
      repairEvidenceIds: [artifact.id],
      functionalResolution: {
        status: "RESOLVED",
        observation: "Synthetic retained functionality with contract-bound evidence only.",
        evidenceIds: [artifact.id],
      },
      editorialDeferral: {
        adjudicationId: R20_SCOPE.id,
        adjudicationDigest: hash(R20_SCOPE),
        component: "EDITORIAL_FIRST_VIEWPORT_HIERARCHY",
        refitAreaId: "player-journal-crossdeck",
        designPacket: R20_SCOPE.refit.designPacket,
        ledgerEntryId: transfer.ledgerEntryId,
        originalReview9Sha256: R20_SCOPE.originalReview9Sha256,
        originalClosureSha256: R20_SCOPE.originalClosureSha256,
        ownerAcceptance: "OUTSTANDING",
      },
    };
  };
  const evidence = {
    exception: plan.exception,
    artifacts,
    reviews: record.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: "inert-independent-reviewer",
      iterations: 14,
      independentReviewOrdinal: 10,
      cumulativeHistory: structuredClone(CURRENT_R20.cumulativeHistory),
      findings: CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings
        .filter((f) => f.contractIds.includes(contractId))
        .map((f) =>
          f.id === "R17-R8-B1"
            ? finding(contractId)
            : {
                id: f.id,
                classification: f.classification,
                contractId,
                disposition: "RESOLVED",
                resolution: "Synthetic fully resolved B2 with same-contract repair evidence.",
                repairEvidenceIds: [artifacts.find((a) => a.contractId === contractId).id],
              },
        ),
    })),
  };
  return { plan, artifacts, evidence, finding };
}

test("generation20 narrowly accepts the three approved B1 component splits while retaining all B2 gates", (t) => {
  const { record } = fixture(t),
    { plan, artifacts, evidence, finding } = scopedEvidence(record);
  validateCurrentAdmissionEvidence(plan, evidence);
  for (const { contractId } of R20_SCOPE.transfers) {
    const value = finding(contractId);
    validateScopedR20Finding({ plan, finding: value, contractId, artifacts });
    for (const mutate of [
      (v) => {
        v.id = "R17-R8-B2";
      },
      (v) => {
        v.classification = "MINOR_POLISH";
      },
      (v) => {
        v.disposition = "RESOLVED";
      },
      (v) => {
        v.functionalResolution.status = "UNRESOLVED";
      },
      (v) => {
        v.functionalResolution.evidenceIds = [];
      },
      (v) => {
        v.repairEvidenceIds = ["stale-image"];
      },
      (v) => {
        v.editorialDeferral.designPacket = null;
      },
      (v) => {
        v.editorialDeferral.ledgerEntryId = "missing";
      },
      (v) => {
        v.editorialDeferral.originalClosureSha256 = "0".repeat(64);
      },
      (v) => {
        v.editorialDeferral.ownerAcceptance = "ACCEPTED";
      },
    ]) {
      const changed = structuredClone(value);
      mutate(changed);
      assert.throws(
        () => validateScopedR20Finding({ plan, finding: changed, contractId, artifacts }),
        /R20_ADJUDICATION_/u,
      );
    }
  }
  for (const mutate of [
    (p) => {
      p.sourceDigest = "0".repeat(64);
    },
    (p) => {
      delete p.exception.currentSourceAdmission.scopeAdjudication.approval;
    },
    (p) => {
      p.exception.version = 19;
    },
    (p) => {
      p.contextCount = 37;
    },
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    const contractId = R20_SCOPE.transfers[0].contractId;
    assert.throws(
      () => validateScopedR20Finding({ plan: changed, finding: finding(contractId), contractId, artifacts }),
      /TRUSTED_SCOPE_REQUIRED/u,
    );
  }
  for (const contractId of ["crossdeck.phase2.continuity", "crossdeck.refit.companion"]) {
    const changed = structuredClone(evidence),
      review = changed.reviews.find((r) => r.contractId === contractId);
    review.findings.find((f) => f.id === "R17-R8-B2").disposition = R20_DEFERRED_DISPOSITION;
    assert.throws(() => validateCurrentAdmissionEvidence(plan, changed), /R18_BLOCKING_FINDING_NOT_RESOLVED/u);
  }
});

test("generation20 requires a real Refit packet and three transfers while preserving the prior registry and ledger", () => {
  const options = {
    registry: JSON.parse(git("show", ":" + R20_SCOPE.refit.registryProof.path)),
    previousRegistry: JSON.parse(
      git("show", CURRENT_R20.protectedBaseAncestorSha + ":" + R20_SCOPE.refit.registryProof.path),
    ),
    packet: git("show", ":" + R20_SCOPE.refit.packetProof.path).toString(),
    ledger: git("show", ":" + R20_SCOPE.refit.ledgerProof.path).toString(),
    previousLedger: git(
      "show",
      CURRENT_R20.protectedBaseAncestorSha + ":" + R20_SCOPE.refit.ledgerProof.path,
    ).toString(),
  };
  validateR20TransferDocuments(options);
  for (const mutate of [
    (o) => {
      o.registry.areas = o.registry.areas.filter((a) => a.id !== "player-journal-crossdeck");
    },
    (o) => {
      o.registry.areas.find((a) => a.id === "player-journal-crossdeck").ownerAccepted = true;
    },
    (o) => {
      o.registry.areas[0].name = "unapproved prior edit";
    },
    (o) => {
      o.packet = "missing real packet";
    },
    (o) => {
      o.ledger = o.ledger.replace("HP-NC-CD-B1-01", "missing");
    },
    (o) => {
      o.ledger = o.ledger.replace("HP-NC-001", "changed-history");
    },
  ]) {
    const changed = structuredClone(options);
    mutate(changed);
    assert.throws(() => validateR20TransferDocuments(changed), /R20_ADJUDICATION_/u);
  }
});

test("generation20 consumes the exact successful R19 capture and blocked raw review without inventing success seals", async (t) => {
  const { record, previous } = fixture(t),
    p = CURRENT_R19_BLOCKED_CAPTURE;
  const payload = {
    version: 1,
    exceptionId: p.id,
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
      displayTitle: CURRENT_R19_SUCCESSFUL_RUN.displayTitle,
    },
    candidateSha: p.candidateSha,
    status: "PREPARE_AND_REVIEW9_RESERVED_VALIDATION_PENDING",
    independentReviewsCompleted: 8,
    reservedIndependentReviewOrdinal: 9,
  };
  assert.equal(hash(payload), p.preparePayloadDigest);
  const provider = {
    id: p.runId,
    run_attempt: 1,
    workflow_id: p.workflowId,
    event: p.event,
    head_sha: p.headSha,
    head_branch: p.headBranch,
    actor: { login: "Kgray44" },
    triggering_actor: { login: "Kgray44" },
    head_repository: { full_name: "Kgray44/treasurehuntSoT" },
    status: "completed",
    conclusion: "success",
    created_at: p.createdAt,
    display_title: CURRENT_R19_SUCCESSFUL_RUN.displayTitle,
    check_suite_id: p.checkSuiteId,
  };
  let writes = 0;
  const run = async ({ changedPayload = payload, changedRun = provider, unexpectedSlot, mutateArtifact } = {}) => {
    const reads = [];
    const result = await validateCurrentR19BlockedCapture({
      record,
      storeFor: (value) => {
        assert.equal(value.id, p.id);
        return {
          read: async (slot) => {
            reads.push(slot);
            return slot === "prepare"
              ? { ...structuredClone(changedPayload), commitSha: p.prepareCommit }
              : slot === unexpectedSlot
                ? {}
                : null;
          },
          create: async () => {
            writes++;
            throw new Error("NO_WRITES_ALLOWED");
          },
        };
      },
      request: async (endpoint) => {
        if (endpoint === `actions/runs/${p.runId}`) return structuredClone(changedRun);
        if (endpoint === `git/commits/${p.candidateSha}`) return { tree: { sha: p.candidateTree } };
        const expected = p.artifacts.find((a) => endpoint === `actions/artifacts/${a.id}`);
        assert.ok(expected);
        const artifact = {
          id: expected.id,
          expired: false,
          size_in_bytes: expected.bytes,
          digest: `sha256:${expected.sha256}`,
          workflow_run: { id: p.runId, head_sha: p.headSha },
        };
        mutateArtifact?.(artifact);
        return artifact;
      },
    });
    assert.deepEqual(reads, ["prepare", ...p.absentSlots]);
    return result;
  };
  assert.equal((await run()).commitSha, p.prepareCommit);
  const changedPayload = structuredClone(payload);
  changedPayload.reservedIndependentReviewOrdinal = 10;
  await assert.rejects(run({ changedPayload }), /R19_SPENT_PREPARATION_CHANGED/u);
  await assert.rejects(run({ changedRun: { ...provider, conclusion: "failure" } }), /R19_SUCCESSFUL_CAPTURE_CHANGED/u);
  await assert.rejects(run({ changedRun: { ...provider, run_attempt: 2 } }), /R19_SUCCESSFUL_CAPTURE_CHANGED/u);
  await assert.rejects(run({ unexpectedSlot: "review9" }), /R19_UNEXPECTED_SUCCESS_SLOT/u);
  await assert.rejects(
    run({
      mutateArtifact: (artifact) => {
        artifact.expired = true;
      },
    }),
    /R19_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED/u,
  );
  await assert.rejects(
    run({
      mutateArtifact: (artifact) => {
        artifact.workflow_run.head_sha = "0".repeat(40);
      },
    }),
    /R19_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED/u,
  );
  assert.equal(writes, 0);
});
