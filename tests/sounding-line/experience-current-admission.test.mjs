// Inert source/HTTP fixtures only. None of these records is installed or grants a run.
import "./experience-current-r19.test.mjs";
import "./experience-current-r20.test.mjs";
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
  validateCurrentProductRepair,
  validateCurrentPublicationArtifacts,
  validateCurrentCaptureIdentity,
  validateCurrentAdmissionPredecessors,
  validateCurrentFailedPreparation,
  validateCurrentBlockedReviewPredecessor,
  validateCurrentAdmissionFinalDecision,
  assertCurrentAdmissionCap,
} from "../../scripts/sounding-line/experience-current-admission.mjs";
import {
  trustedExceptions,
  selectTrustedExceptions,
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

import {
  CURRENT_R16,
  CURRENT_R15_FAILED_PREPARATION,
  CURRENT_R15_FAILED_RUN,
} from "../../scripts/sounding-line/experience-current-r16.mjs";
import {
  CURRENT_R17,
  CURRENT_R16_FAILED_PREPARATION,
  CURRENT_R16_FAILED_RUN,
} from "../../scripts/sounding-line/experience-current-r17.mjs";
import {
  CURRENT_R18,
  CURRENT_R17_BLOCKED_CAPTURE,
  CURRENT_R17_SUCCESSFUL_RUN,
} from "../../scripts/sounding-line/experience-current-r18.mjs";

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
// These records are inert in-memory source fixtures. The new record uses synthetic
// source/proof/publication fields and is never written to the repository registry.
let retainedRegistry15;
function registry15Fixture() {
  retainedRegistry15 ??= JSON.parse(
    execFileSync(
      "git",
      ["show", `${CURRENT_R16.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`],
      {
        cwd: sourceRoot,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
    ),
  );
  return structuredClone(retainedRegistry15);
}
function successorFixture(t) {
  const record = fixtureRecord(t);
  const registry = registry15Fixture(),
    previous = registry.exceptions[14];
  record.version = 16;
  record.id = CURRENT_R16.id;
  record.custody.namespace = `sounding-line-exceptions/${record.id}`;
  record.ownerApproval = structuredClone(CURRENT_R16.ownerApproval);
  record.predecessor = structuredClone(CURRENT_R15_FAILED_PREPARATION);
  record.frozenReferenceSha = CURRENT_R16.frozenReferenceSha;
  const a = record.currentSourceAdmission;
  a.protectedBaseAncestorSha = CURRENT_R16.protectedBaseAncestorSha;
  a.preservationRevision = CURRENT_R16.preservationRevision;
  a.cumulativeHistory = structuredClone(CURRENT_R16.cumulativeHistory);
  a.historicalRuns = [
    ...structuredClone(previous.currentSourceAdmission.historicalRuns),
    structuredClone(CURRENT_R15_FAILED_RUN),
  ];
  a.legacyR14History = structuredClone(previous.currentSourceAdmission.legacyR14History);
  registry.exceptions.push(record);
  return { record, registry, previous };
}
function failedPreparationFixture(previous) {
  const p = CURRENT_R15_FAILED_PREPARATION;
  // Reconstitute only the retained, already-spent public R15 preparation. It is
  // not an R16 reservation, and no provider or custody request is performed.
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
      runAttempt: p.runAttempt,
      actor: "Kgray44",
      workflowPath: ".github/workflows/sounding-line-ordinary.yml",
      event: p.event,
      headSha: p.headSha,
      headBranch: p.headBranch,
      createdAt: p.createdAt,
      workflowId: p.workflowId,
      displayTitle: CURRENT_R15_FAILED_RUN.displayTitle,
    },
    candidateSha: p.candidateSha,
    status: "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING",
    independentReviewsCompleted: 7,
    reservedIndependentReviewOrdinal: 8,
  };
}

let retainedRegistry16;
function registry16Fixture() {
  if (!retainedRegistry16) {
    const raw = execFileSync(
      "git",
      ["show", `${CURRENT_R17.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`],
      { cwd: sourceRoot, maxBuffer: 32 * 1024 * 1024 },
    );
    assert.equal(bytesHash(raw), CURRENT_R17.previousRegistryRawSha256);
    retainedRegistry16 = JSON.parse(raw);
  }
  return structuredClone(retainedRegistry16);
}
function generation17Fixture(t) {
  const record = fixtureRecord(t),
    registry = registry16Fixture(),
    previous = registry.exceptions[15];
  record.version = 17;
  record.id = CURRENT_R17.id;
  record.custody.namespace = `sounding-line-exceptions/${record.id}`;
  record.ownerApproval = structuredClone(CURRENT_R17.ownerApproval);
  record.predecessor = structuredClone(CURRENT_R16_FAILED_PREPARATION);
  record.frozenReferenceSha = CURRENT_R17.frozenReferenceSha;
  const a = record.currentSourceAdmission;
  a.protectedBaseAncestorSha = CURRENT_R17.protectedBaseAncestorSha;
  a.preservationRevision = CURRENT_R17.preservationRevision;
  a.cumulativeHistory = structuredClone(CURRENT_R17.cumulativeHistory);
  a.requiredReviewIterations = CURRENT_R17.requiredReviewIterations;
  a.historicalRuns = [
    ...structuredClone(previous.currentSourceAdmission.historicalRuns),
    structuredClone(CURRENT_R16_FAILED_RUN),
  ];
  a.legacyR14History = structuredClone(previous.currentSourceAdmission.legacyR14History);
  a.publicationFiles = structuredClone(previous.currentSourceAdmission.publicationFiles);
  a.observation.id = "FIXTURE-GENERATION17-OBSERVATION-NOT-INSTALLED";
  registry.exceptions.push(record);
  return { record, registry, previous };
}
function failedR16PreparationFixture(previous) {
  const p = CURRENT_R16_FAILED_PREPARATION;
  // A local HTTP-shaped fixture of the already spent original preparation,
  // never a reservation for this synthetic successor or any future execution.
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
      runAttempt: p.runAttempt,
      actor: "Kgray44",
      workflowPath: ".github/workflows/sounding-line-ordinary.yml",
      event: p.event,
      headSha: p.headSha,
      headBranch: p.headBranch,
      createdAt: p.createdAt,
      workflowId: p.workflowId,
      displayTitle: CURRENT_R16_FAILED_RUN.displayTitle,
    },
    candidateSha: p.candidateSha,
    status: "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING",
    independentReviewsCompleted: 7,
    reservedIndependentReviewOrdinal: 8,
  };
}

// These helpers retain the real public seventeen-row prefix. All newly appended
// fields are inert source fixtures, never installed or submitted. Positive R18
// admission tests remain explicitly pending while actual repair bindings are null.
let retainedRegistry17;
function registry17Fixture() {
  if (!retainedRegistry17) {
    const raw = execFileSync(
      "git",
      ["show", `${CURRENT_R18.protectedBaseAncestorSha}:testing/product-experience-exceptions.json`],
      { cwd: sourceRoot, maxBuffer: 32 * 1024 * 1024 },
    );
    assert.equal(bytesHash(raw), CURRENT_R18.previousRegistryRawSha256);
    retainedRegistry17 = JSON.parse(raw);
  }
  return structuredClone(retainedRegistry17);
}
function generation18Fixture(t) {
  const record = fixtureRecord(t),
    registry = registry17Fixture(),
    previous = registry.exceptions[16];
  record.version = 18;
  record.id = CURRENT_R18.id;
  record.custody.namespace = `sounding-line-exceptions/${record.id}`;
  record.ownerApproval = structuredClone(CURRENT_R18.ownerApproval);
  record.predecessor = structuredClone(CURRENT_R17_BLOCKED_CAPTURE);
  record.frozenReferenceSha = CURRENT_R18.frozenReferenceSha;
  record.remainingIndependentReviewOrdinal = CURRENT_R18.remainingIndependentReviewOrdinal;
  const a = record.currentSourceAdmission;
  a.protectedBaseAncestorSha = CURRENT_R18.protectedBaseAncestorSha;
  a.preservationRevision = CURRENT_R18.preservationRevision;
  a.cumulativeHistory = structuredClone(CURRENT_R18.cumulativeHistory);
  a.requiredReviewIterations = CURRENT_R18.requiredReviewIterations;
  a.historicalRuns = [
    ...structuredClone(previous.currentSourceAdmission.historicalRuns),
    structuredClone(CURRENT_R17_SUCCESSFUL_RUN),
  ];
  a.legacyR14History = structuredClone(previous.currentSourceAdmission.legacyR14History);
  a.publicationFiles = structuredClone(previous.currentSourceAdmission.publicationFiles);
  a.observation.id = "FIXTURE-GENERATION18-OBSERVATION-NOT-INSTALLED";
  registry.exceptions.push(record);
  return { record, registry, previous };
}
const pendingR18Repair =
  CURRENT_R18.frozenReferenceSha === null || CURRENT_R18.repairedProductFiles === null
    ? "Actual independently reviewed repair SHA and old/new blobs are not frozen"
    : false;
function successfulR17PreparationFixture(previous) {
  const p = CURRENT_R17_BLOCKED_CAPTURE;
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
      runAttempt: p.runAttempt,
      actor: "Kgray44",
      workflowPath: ".github/workflows/sounding-line-ordinary.yml",
      event: p.event,
      headSha: p.headSha,
      headBranch: p.headBranch,
      createdAt: p.createdAt,
      workflowId: p.workflowId,
      displayTitle: CURRENT_R17_SUCCESSFUL_RUN.displayTitle,
    },
    candidateSha: p.candidateSha,
    status: "PREPARE_AND_REVIEW8_RESERVED_VALIDATION_PENDING",
    independentReviewsCompleted: 7,
    reservedIndependentReviewOrdinal: 8,
  };
}
function providerRun(identity) {
  return {
    id: identity.id,
    run_attempt: identity.runAttempt,
    workflow_id: identity.workflowId,
    event: identity.event,
    head_sha: identity.headSha,
    head_branch: identity.headBranch,
    actor: { login: identity.actor },
    triggering_actor: { login: identity.triggeringActor },
    head_repository: { full_name: identity.repository },
    status: identity.status,
    conclusion: identity.conclusion,
    created_at: identity.createdAt,
    display_title: identity.displayTitle,
    check_suite_id: identity.checkSuiteId,
  };
}

test("generation18 source keeps successful R17 capture and blocked raw review8 truthful without refunding counters", (t) => {
  const { record, registry, previous } = generation18Fixture(t),
    prior = registry17Fixture();
  assert.equal(hash(prior), CURRENT_R18.previousRegistryDigest);
  assert.equal(hash(prior.exceptions), CURRENT_R18.previousRecordsDigest);
  assert.equal(hash(previous), CURRENT_R18.previousRecordDigest);
  assert.equal(hash(previous.currentSourceAdmission.historicalRuns), CURRENT_R18.previousRunsDigest);
  assert.deepEqual(registry.exceptions.slice(0, 17), prior.exceptions);
  assert.deepEqual(registry.reconciliations, prior.reconciliations);
  assert.equal(CURRENT_R18.repairReferenceSha, "3aabd9b029ed6378372b73992bae3ac68561ea72");
  assert.deepEqual(CURRENT_R18.repairPaths, [
    "src/components/player/journal/ChronicleJournalSession.tsx",
    "src/styles/chronicle.css",
    "tests/e2e/crossdeck-experience-refit.spec.ts",
    "tests/e2e/crossdeck-refit-recovery.spec.ts",
    "tests/e2e/fixtures/journal-layout.ts",
    "tests/e2e/fixtures/landfall-closure.ts",
  ]);
  assert.equal(record.predecessor.kind, "SUCCESSFUL_CURRENT_CAPTURE_BLOCKED_RAW_REVIEW_1");
  assert.equal(record.predecessor.conclusion, "success");
  assert.equal(record.predecessor.runId, 39167709214);
  assert.equal(record.predecessor.blockedReview.verdict, "REWORK_REQUIRED");
  assert.equal(record.predecessor.blockedReview.authenticatedSubmission, false);
  assert.equal(record.predecessor.blockedReview.rawBytes, 315555);
  assert.equal(
    record.predecessor.blockedReview.rawSha256,
    "eefdb991ea9c4b210834a88ab0af05f2f20816fcb9f39b75bcd579e16a536a3d",
  );
  assert.deepEqual(
    record.predecessor.blockedReview.blockingFindings.map(({ id }) => id),
    ["R17-R8-B1", "R17-R8-B2"],
  );
  assert.deepEqual(record.predecessor.blockedReview.nonblockingFindingIds, ["R17-R8-N1", "R17-R8-N2"]);
  assert.deepEqual(record.currentSourceAdmission.cumulativeHistory, {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 21,
    currentPreparationOrdinal: 22,
    completedIndependentReviews: 8,
  });
  assert.equal(record.currentSourceAdmission.requiredReviewIterations, 13);
  assert.equal(record.remainingIndependentReviewOrdinal, 9);
  assert.deepEqual(previous.currentSourceAdmission.cumulativeHistory, CURRENT_R17.cumulativeHistory);
  assert.equal(previous.currentSourceAdmission.requiredReviewIterations, 12);
  assert.equal(previous.remainingIndependentReviewOrdinal, 8);
  assert.equal(hash(successfulR17PreparationFixture(previous)), record.predecessor.preparePayloadDigest);
  assert.deepEqual(record.currentSourceAdmission.historicalRuns.at(-1), CURRENT_R17_SUCCESSFUL_RUN);
  if (pendingR18Repair) {
    assert.throws(() => validateCurrentAdmissionRegistry(registry), /CURRENT_ADMISSION_SOURCE_POLICY_INVALID/u);
    assert.throws(() => selectTrustedExceptions(registry.exceptions), /CURRENT_ADMISSION_SOURCE_POLICY_INVALID/u);
  } else {
    assert.equal(validateCurrentAdmissionRegistry(registry), record);
    assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  }
});

test(
  "fixed generation18 rejects changed prefix, spent success, review history, or repair bindings",
  { skip: pendingR18Repair },
  (t) => {
    const { record, registry } = generation18Fixture(t);
    assert.equal(
      validateCurrentAdmissionRegistry(registry, undefined, {
        requiredVersion: 18,
      }),
      record,
    );
    for (const mutate of [
      (r) => {
        r.exceptions[0].id = "CHANGED-OLD-ROW";
      },
      (r) => {
        r.reconciliations[0].id = "CHANGED-OLD-BRIDGE";
      },
      (r) => {
        r.exceptions[16].currentSourceAdmission.caps.capture = 0;
      },
      (r) => {
        [r.exceptions[16], r.exceptions[17]] = [r.exceptions[17], r.exceptions[16]];
      },
      (r) => {
        r.exceptions.push(structuredClone(record));
      },
      (r) => {
        r.exceptions[17].predecessor.conclusion = "failure";
      },
      (r) => {
        r.exceptions[17].predecessor.blockedReview.rawSha256 = "0".repeat(64);
      },
      (r) => {
        r.exceptions[17].predecessor.blockedReview.authenticatedSubmission = true;
      },
      (r) => {
        r.exceptions[17].predecessor.blockedReview.blockingFindings.pop();
      },
      (r) => {
        r.exceptions[17].predecessor.artifacts[0].sha256 = "0".repeat(64);
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.historicalRuns.at(-1).conclusion = "failure";
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 20;
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.cumulativeHistory.currentPreparationOrdinal = 21;
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.cumulativeHistory.completedIndependentReviews = 7;
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.requiredReviewIterations = 12;
      },
      (r) => {
        r.exceptions[17].remainingIndependentReviewOrdinal = 8;
      },
      (r) => {
        r.exceptions[17].frozenReferenceSha = null;
      },
      (r) => {
        r.exceptions[17].frozenReferenceSha = sha(99);
      },
      (r) => {
        r.exceptions[17].currentSourceAdmission.protectedOverlay[0].path = "src/escaped.ts";
      },
    ]) {
      const changed = structuredClone(registry);
      mutate(changed);
      assert.throws(
        () =>
          validateCurrentAdmissionRegistry(changed, undefined, {
            requiredVersion: 18,
          }),
        /CURRENT_ADMISSION_/u,
      );
    }
  },
);

for (const [label, file, expectedBlob] of [
  [
    "historical repair ledger",
    "Development_Docs/Testing/Product_Experience/evidence/crossdeck-refit-b53291133625/repair-ledger.json",
    "16a58def6f5c63af155af67e4f06d615b055ae36",
  ],
  [
    "canonical candidate review",
    "Development_Docs/Testing/Product_Experience/candidate-review.json",
    "7131e22305cac75317ab1d6f48a9ed807f8da9bc",
  ],
])
  test(`generation18 immutable history overlay forbids ${label}`, { skip: pendingR18Repair }, (t) => {
    const { record } = generation18Fixture(t);
    validateCurrentAdmissionRecord(record);
    const entry = record.immutableHistory.find(({ path }) => path === file);
    assert.equal(entry?.blob, expectedBlob);
    assert.equal(entry.mode ?? "100644", "100644");
    if (label === "canonical candidate review")
      assert.ok(
        record.currentSourceAdmission.publicationFiles.includes(file),
        "canonical current publication stays legitimate and separate from protected authority overlay",
      );
    record.currentSourceAdmission.protectedOverlay.push({
      path: file,
      oldMode: "100644",
      oldBlob: entry.blob,
      newMode: "100644",
      newBlob: sha(901),
      candidateMode: "100644",
      candidateBlob: sha(901),
    });
    assert.throws(() => validateCurrentAdmissionRecord(record), {
      message: "PRODUCT_EXPERIENCE_CURRENT_ADMISSION_R18_IMMUTABLE_HISTORY_OVERLAY_FORBIDDEN",
    });
  });

test("generation18 provisional null product bindings fail closed in the exact-file comparator", () => {
  if (pendingR18Repair)
    assert.throws(
      () =>
        validateCurrentProductRepair({
          priorRepair: new Map(),
          reference: new Map(),
          candidate: new Map(),
          actualRepairPaths: CURRENT_R18.repairPaths,
        }),
      /R18_REPAIR_SCOPE_CHANGED/u,
    );
});

test(
  "generation18 product repair accepts only its six pinned old/new modes and blobs",
  { skip: pendingR18Repair },
  () => {
    const priorRepair = new Map(
      CURRENT_R18.repairedProductFiles
        .filter((e) => e.oldMode !== null)
        .map((e) => [e.path, `${e.oldMode} blob ${e.oldBlob}`]),
    );
    const reference = new Map(CURRENT_R18.repairedProductFiles.map((e) => [e.path, `${e.newMode} blob ${e.newBlob}`]));
    const candidate = new Map(reference),
      options = {
        priorRepair,
        reference,
        candidate,
        actualRepairPaths: [...CURRENT_R18.repairPaths],
      };
    assert.deepEqual([...validateCurrentProductRepair(options).keys()].sort(), [...CURRENT_R18.repairPaths].sort());
    for (const actualRepairPaths of [
      CURRENT_R18.repairPaths.slice(1),
      [...CURRENT_R18.repairPaths, "src/unapproved.ts"],
      [...CURRENT_R18.repairPaths.slice(1), "tests/e2e/unapproved.spec.ts"],
    ])
      assert.throws(() => validateCurrentProductRepair({ ...options, actualRepairPaths }), /R18_REPAIR_SCOPE_CHANGED/u);
    for (const entry of CURRENT_R18.repairedProductFiles)
      for (const field of ["priorRepair", "reference", "candidate"])
        for (const wrong of [
          undefined,
          `100755 blob ${entry.newBlob}`,
          `120000 blob ${entry.newBlob}`,
          `100644 blob ${sha(99)}`,
        ]) {
          if (wrong === undefined && field === "priorRepair" && entry.oldMode === null) continue;
          const changed = new Map(options[field]);
          if (wrong === undefined) changed.delete(entry.path);
          else changed.set(entry.path, wrong);
          assert.throws(
            () => validateCurrentProductRepair({ ...options, [field]: changed }),
            /R18_REPAIR_SOURCE_CHANGED/u,
          );
        }
  },
);

test("installed generation18 sentinel rejects absent or provisional authority without falling back to R17", (t) => {
  fixtureRecord(t);
  const root = mkdtempSync(path.join(tmpdir(), "generation18-inert-source-only-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Inert generation18 unit fixture");
  git("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(root, "testing"));
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts/sounding-line/experience-current-r18.mjs"),
    "// inert source-presence fixture\n",
  );
  const commit = (registry) => {
    writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(registry));
    git("add", ".");
    git("commit", "--quiet", "-m", "inert source-only generation18 fixture");
    return git("rev-parse", "HEAD");
  };
  assert.throws(() => trustedExceptions(root, commit(registry17Fixture())), /R18_REGISTRY_INVALID/u);
  const { registry } = generation18Fixture(t);
  if (pendingR18Repair) {
    assert.throws(() => trustedExceptions(root, commit(registry)), /CURRENT_ADMISSION_SOURCE_POLICY_INVALID/u);
  } else {
    assert.equal(trustedExceptions(root, commit(registry))[0].id, CURRENT_R18.id);
    for (const mutate of [
      (r) => {
        r.exceptions.pop();
      },
      (r) => {
        r.exceptions[17].status = "RETIRED";
      },
      (r) => {
        r.exceptions[17].status = "INACTIVE";
      },
      (r) => {
        r.exceptions[17].id = "WRONG-GENERATION18";
      },
      (r) => {
        r.exceptions[17].version = 17;
      },
      (r) => {
        r.exceptions[17].expiresAt = "2026-10-17T23:59:59Z";
      },
    ]) {
      const changed = structuredClone(registry);
      mutate(changed);
      assert.throws(() => trustedExceptions(root, commit(changed)), /CURRENT_ADMISSION_/u);
    }
    const installed = commit(registry);
    t.mock.timers.tick(Date.parse(CURRENT_R18.expiresAt) - Date.now());
    assert.throws(() => trustedExceptions(root, installed), /RECORD_INVALID/u);
  }
});

test(
  "generation18 successful R17 custody validates exact provider success and raw-blocked history separately",
  { skip: pendingR18Repair },
  async (t) => {
    const { record, previous } = generation18Fixture(t),
      p = CURRENT_R17_BLOCKED_CAPTURE,
      payload = successfulR17PreparationFixture(previous);
    assert.equal(hash(payload), p.preparePayloadDigest);
    let preparation = { ...payload, commitSha: p.prepareCommit },
      occupied = null,
      run = providerRun(CURRENT_R17_SUCCESSFUL_RUN),
      tree = p.candidateTree;
    const artifactResponses = new Map(
      p.artifacts.map((a) => [
        a.id,
        {
          id: a.id,
          expired: false,
          size_in_bytes: a.bytes,
          digest: `sha256:${a.sha256}`,
          workflow_run: { id: p.runId },
        },
      ]),
    );
    const calls = [],
      slots = [],
      options = {
        record,
        storeFor: (value) => {
          assert.equal(value.id, CURRENT_R17.id);
          assert.equal(value.custody.namespace, `sounding-line-exceptions/${CURRENT_R17.id}`);
          return {
            read: async (slot) => {
              slots.push(slot);
              return slot === "prepare" ? preparation : slot === occupied ? { occupied: true } : null;
            },
          };
        },
        request: async (endpoint) => {
          calls.push(endpoint);
          if (endpoint === `actions/runs/${p.runId}`) return run;
          if (endpoint === `git/commits/${p.candidateSha}`) return { tree: { sha: tree } };
          const match = /^actions\/artifacts\/(\d+)$/u.exec(endpoint);
          assert.ok(match && artifactResponses.has(Number(match[1])), `Unexpected inert R17 route: ${endpoint}`);
          return artifactResponses.get(Number(match[1]));
        },
      };
    await validateCurrentBlockedReviewPredecessor(options);
    assert.deepEqual(slots, ["prepare", ...p.absentSlots]);
    assert.deepEqual(calls, [
      `actions/runs/${p.runId}`,
      `git/commits/${p.candidateSha}`,
      ...p.artifacts.map(({ id }) => `actions/artifacts/${id}`),
    ]);
    calls.length = 0;
    await validateCurrentBlockedReviewPredecessor({
      ...options,
      observedRun: run,
    });
    assert.ok(!calls.includes(`actions/runs/${p.runId}`), "already observed R17 history is not fetched twice");
    for (occupied of p.absentSlots)
      await assert.rejects(validateCurrentBlockedReviewPredecessor(options), /R17_UNEXPECTED_SUCCESS_SLOT/u);
    occupied = null;
    for (const mutate of [
      (v) => {
        v.commitSha = sha(99);
      },
      (v) => {
        v.run.runAttempt = 2;
      },
      (v) => {
        v.status = "PASS";
      },
      (v) => {
        v.independentReviewsCompleted = 8;
      },
      (v) => {
        v.reservedIndependentReviewOrdinal = 9;
      },
    ]) {
      preparation = structuredClone({ ...payload, commitSha: p.prepareCommit });
      mutate(preparation);
      await assert.rejects(validateCurrentBlockedReviewPredecessor(options), /R17_SPENT_PREPARATION_CHANGED/u);
    }
    preparation = { ...payload, commitSha: p.prepareCommit };
    run = { ...run, conclusion: "failure" };
    await assert.rejects(validateCurrentBlockedReviewPredecessor(options), /R17_SUCCESSFUL_CAPTURE_CHANGED/u);
    run = providerRun(CURRENT_R17_SUCCESSFUL_RUN);
    tree = sha(99);
    await assert.rejects(validateCurrentBlockedReviewPredecessor(options), /R17_CANDIDATE_TREE_CHANGED/u);
    tree = p.candidateTree;
    for (const change of [
      { expired: true },
      { digest: `sha256:${"0".repeat(64)}` },
      { size_in_bytes: p.artifacts[0].bytes + 1 },
      { workflow_run: { id: 1 } },
    ]) {
      const a = p.artifacts[0],
        original = artifactResponses.get(a.id);
      artifactResponses.set(a.id, { ...original, ...change });
      await assert.rejects(
        validateCurrentBlockedReviewPredecessor(options),
        /R17_SUCCESSFUL_CAPTURE_ARTIFACT_CHANGED/u,
      );
      artifactResponses.set(a.id, original);
    }
  },
);

test("fixed generation17 retains the literal sixteen-row prefix, bridges and failed R16 history without refunds", (t) => {
  const { record, registry, previous } = generation17Fixture(t),
    prior = registry16Fixture();
  assert.equal(validateCurrentAdmissionRegistry(registry), record);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  assert.equal(JSON.stringify(registry.exceptions.slice(0, 16)), JSON.stringify(prior.exceptions));
  assert.deepEqual(registry.reconciliations, prior.reconciliations);
  assert.equal(hash(previous), CURRENT_R17.previousRecordDigest);
  assert.equal(record.predecessor.prepareCommit, "9273d5951bbe20198b97bf87edb9532e7e216c1f");
  assert.equal(record.predecessor.runId, 39125943388);
  assert.deepEqual(record.predecessor.artifacts, CURRENT_R16_FAILED_PREPARATION.artifacts);
  assert.deepEqual(
    record.currentSourceAdmission.historicalRuns.slice(0, 18),
    previous.currentSourceAdmission.historicalRuns,
  );
  assert.deepEqual(record.currentSourceAdmission.historicalRuns[18], CURRENT_R16_FAILED_RUN);
  assert.deepEqual(record.currentSourceAdmission.cumulativeHistory, {
    legacyRepairRecaptureAttempts: 11,
    completedPreparationAttempts: 20,
    currentPreparationOrdinal: 21,
    completedIndependentReviews: 7,
  });
  assert.equal(record.currentSourceAdmission.requiredReviewIterations, 12);
  assert.equal(record.remainingIndependentReviewOrdinal, 8);
  for (const mutate of [
    (r) => {
      r.exceptions[15].currentSourceAdmission.caps.capture = 0;
    },
    (r) => {
      r.exceptions[0].id = "CHANGED-OLD-ROW";
    },
    (r) => {
      r.reconciliations[0].id = "CHANGED-OLD-BRIDGE";
    },
    (r) => {
      [r.exceptions[15], r.exceptions[16]] = [r.exceptions[16], r.exceptions[15]];
    },
    (r) => {
      r.exceptions.push(structuredClone(record));
    },
    (r) => {
      r.exceptions[16].version = 18;
    },
    (r) => {
      r.exceptions[16].predecessor.prepareCommit = sha(99);
    },
    (r) => {
      r.exceptions[16].predecessor.artifacts[0].sha256 = "0".repeat(64);
    },
    (r) => {
      r.exceptions[16].currentSourceAdmission.historicalRuns[18].runAttempt = 2;
    },
    (r) => {
      r.exceptions[16].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 19;
    },
    (r) => {
      r.exceptions[16].currentSourceAdmission.cumulativeHistory.currentPreparationOrdinal = 20;
    },
    (r) => {
      r.exceptions[16].currentSourceAdmission.requiredReviewIterations = 13;
    },
    (r) => {
      r.exceptions[16].remainingIndependentReviewOrdinal = 9;
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(
      () => validateCurrentAdmissionRegistry(changed, undefined, { requiredVersion: 17 }),
      /CURRENT_ADMISSION_/u,
    );
  }
  const changedRecords = structuredClone(registry.exceptions);
  changedRecords[15].currentSourceAdmission.caps.capture = 0;
  assert.throws(() => selectTrustedExceptions(changedRecords), /CURRENT_R17_PREDECESSOR_REGISTRY_CHANGED/u);
});

test("installed generation17 reader never falls back to R16 on absent, invalid, retired or expired successor", (t) => {
  const { registry } = generation17Fixture(t),
    root = mkdtempSync(path.join(tmpdir(), "generation17-inert-source-only-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Inert generation17 unit fixture");
  git("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(root, "testing"));
  const writeRegistry = (value) =>
    writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(value));
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "-m", "inert source-only generation17 fixture");
    return git("rev-parse", "HEAD");
  };
  writeRegistry(registry16Fixture());
  assert.equal(trustedExceptions(root, commit())[0].id, CURRENT_R17.previousId);
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts/sounding-line/experience-current-r17.mjs"),
    "// inert source-presence guard fixture\n",
  );
  assert.throws(() => trustedExceptions(root, commit()), /R17_REGISTRY_INVALID/u);
  writeRegistry(registry);
  const installed = commit();
  const oldTrace = process.env.GIT_TRACE,
    trace = path.join(root, "registry-read.private.trace");
  process.env.GIT_TRACE = trace;
  try {
    assert.equal(trustedExceptions(root, installed)[0].id, CURRENT_R17.id);
  } finally {
    if (oldTrace === undefined) delete process.env.GIT_TRACE;
    else process.env.GIT_TRACE = oldTrace;
  }
  const registryReads = readFileSync(trace, "utf8")
    .split("\n")
    .filter(
      (line) => line.includes("built-in: git show ") && line.includes(":testing/product-experience-exceptions.json"),
    );
  assert.equal(registryReads.length, 1, "the fixed17 reader must reuse its one protected registry read");
  rmSync(trace);
  for (const mutate of [
    (r) => {
      r.exceptions.pop();
    },
    (r) => {
      r.exceptions[16].status = "RETIRED";
    },
    (r) => {
      r.exceptions[16].status = "INACTIVE";
    },
    (r) => {
      r.exceptions[16].id = "WRONG-GENERATION17";
    },
    (r) => {
      r.exceptions[16].version = 18;
    },
    (r) => {
      r.exceptions[16].expiresAt = "2026-10-17T23:59:59Z";
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    writeRegistry(changed);
    assert.throws(() => trustedExceptions(root, commit()), /CURRENT_ADMISSION_/u);
  }
  writeRegistry(registry);
  const final = commit();
  t.mock.timers.tick(Date.parse(CURRENT_R17.expiresAt) - Date.now());
  assert.throws(() => trustedExceptions(root, final), /RECORD_INVALID/u);
});

test("generation17 consumes exact failed R16 preparation while every success slot remains absent", async (t) => {
  const { record, previous } = generation17Fixture(t),
    payload = failedR16PreparationFixture(previous);
  assert.equal(hash(payload), CURRENT_R16_FAILED_PREPARATION.preparePayloadDigest);
  const oldPayload = failedPreparationFixture(registry15Fixture().exceptions[14]);
  assert.equal(hash(oldPayload), CURRENT_R15_FAILED_PREPARATION.preparePayloadDigest);
  let oldPreparation = { ...oldPayload, commitSha: CURRENT_R15_FAILED_PREPARATION.prepareCommit };
  let preparation = { ...payload, commitSha: record.predecessor.prepareCommit },
    occupied = null,
    tree = record.predecessor.candidateTree;
  const slots = [],
    options = {
      record,
      storeFor: (value) => {
        assert([CURRENT_R17.previousId, CURRENT_R15_FAILED_PREPARATION.id].includes(value.id));
        assert.equal(value.custody.namespace, `sounding-line-exceptions/${value.id}`);
        return {
          read: async (slot) => {
            slots.push(`${value.id}/${slot}`);
            if (value.id === CURRENT_R15_FAILED_PREPARATION.id) return slot === "prepare" ? oldPreparation : null;
            return slot === "prepare" ? preparation : slot === occupied ? { occupied: true } : null;
          },
        };
      },
      request: async (endpoint) => {
        if (endpoint === `git/commits/${CURRENT_R15_FAILED_PREPARATION.candidateSha}`)
          return { tree: { sha: CURRENT_R15_FAILED_PREPARATION.candidateTree } };
        assert.equal(endpoint, `git/commits/${record.predecessor.candidateSha}`);
        return { tree: { sha: tree } };
      },
    };
  await validateCurrentFailedPreparation(options);
  assert.deepEqual(
    slots,
    [CURRENT_R15_FAILED_PREPARATION.id, CURRENT_R17.previousId].flatMap((id) =>
      ["prepare", "capture", "review-submit", "review8", "qualify", "qualified"].map((slot) => `${id}/${slot}`),
    ),
  );
  oldPreparation = { ...oldPreparation, status: "PASS" };
  slots.length = 0;
  await assert.rejects(validateCurrentFailedPreparation(options), /R15_SPENT_PREPARATION_CHANGED/u);
  assert.deepEqual(slots, [`${CURRENT_R15_FAILED_PREPARATION.id}/prepare`]);
  oldPreparation = { ...oldPayload, commitSha: CURRENT_R15_FAILED_PREPARATION.prepareCommit };
  for (occupied of ["capture", "review-submit", "review8", "qualify", "qualified"])
    await assert.rejects(validateCurrentFailedPreparation(options), /R16_UNEXPECTED_SUCCESS_SLOT/u);
  occupied = null;
  for (const mutate of [
    (p) => {
      p.commitSha = sha(99);
    },
    (p) => {
      p.run.runAttempt = 2;
    },
    (p) => {
      p.binding.sourceDigest = "a".repeat(64);
    },
    (p) => {
      p.status = "PASS";
    },
    (p) => {
      p.independentReviewsCompleted = 8;
    },
    (p) => {
      p.reservedIndependentReviewOrdinal = 9;
    },
  ]) {
    preparation = structuredClone({ ...payload, commitSha: record.predecessor.prepareCommit });
    mutate(preparation);
    await assert.rejects(validateCurrentFailedPreparation(options), /R16_SPENT_PREPARATION_CHANGED/u);
  }
  preparation = { ...payload, commitSha: record.predecessor.prepareCommit };
  tree = sha(99);
  await assert.rejects(validateCurrentFailedPreparation(options), /R16_CANDIDATE_TREE_CHANGED/u);
});
test("fixed generation16 preserves the literal fifteen-row prefix and selects only its successor", (t) => {
  const { record, registry } = successorFixture(t);
  assert.equal(validateCurrentAdmissionRegistry(registry), record);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  for (const mutate of [
    (r) => {
      r.exceptions[14].currentSourceAdmission.caps.capture = 0;
    },
    (r) => {
      r.exceptions[0].id = "CHANGED-OLD-ROW";
    },
    (r) => {
      r.reconciliations[0].id = "CHANGED-OLD-BRIDGE";
    },
    (r) => {
      [r.exceptions[14], r.exceptions[15]] = [r.exceptions[15], r.exceptions[14]];
    },
    (r) => {
      r.exceptions.push(structuredClone(record));
    },
    (r) => {
      r.exceptions[15].version = 17;
    },
    (r) => {
      r.exceptions[15].status = "RETIRED";
    },
    (r) => {
      r.exceptions[15].expiresAt = "2026-10-17T23:59:59Z";
    },
    (r) => {
      r.exceptions[15].predecessor.preparePayloadDigest = "0".repeat(64);
    },
    (r) => {
      r.exceptions[15].currentSourceAdmission.cumulativeHistory.completedPreparationAttempts = 18;
    },
    (r) => {
      r.exceptions[15].currentSourceAdmission.requiredReviewIterations = 13;
    },
    (r) => {
      r.exceptions[15].currentSourceAdmission.preservationRevision = CURRENT_R16.frozenReferenceSha;
    },
    (r) => {
      r.exceptions[15].currentSourceAdmission.historicalRuns[17].runAttempt = 2;
    },
    (r) => {
      r.exceptions[15].immutableHistory[0].blob = sha(100);
    },
  ]) {
    const changed = structuredClone(registry);
    mutate(changed);
    assert.throws(() => validateCurrentAdmissionRegistry(changed), /CURRENT_ADMISSION_/u);
  }
  const changedRecords = structuredClone(registry.exceptions);
  changedRecords[14].currentSourceAdmission.caps.capture = 0;
  assert.throws(() => selectTrustedExceptions(changedRecords), /CURRENT_R16_PREDECESSOR_REGISTRY_CHANGED/u);
});
test("installed generation16 reader denies removal, inactivity and expiry without falling back to R15", (t) => {
  const { registry } = successorFixture(t);
  const root = mkdtempSync(path.join(tmpdir(), "generation16-inert-source-only-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Inert generation16 unit fixture");
  git("config", "user.email", "fixture@example.invalid");
  mkdirSync(path.join(root, "testing"));
  const writeRegistry = (value) =>
    writeFileSync(path.join(root, "testing/product-experience-exceptions.json"), JSON.stringify(value));
  const commit = () => {
    git("add", ".");
    git("commit", "--quiet", "-m", "inert source-only unit fixture");
    return git("rev-parse", "HEAD");
  };
  const prior = registry15Fixture();
  writeRegistry(prior);
  assert.equal(trustedExceptions(root, commit())[0].id, CURRENT_R16.previousId);
  mkdirSync(path.join(root, "scripts/sounding-line"), { recursive: true });
  writeFileSync(
    path.join(root, "scripts/sounding-line/experience-current-r16.mjs"),
    "// inert presence guard fixture\n",
  );
  assert.throws(() => trustedExceptions(root, commit()), /R16_REGISTRY_INVALID/u);
  writeRegistry(registry);
  assert.equal(trustedExceptions(root, commit())[0].id, CURRENT_R16.id);
  for (const status of ["RETIRED", "INACTIVE"]) {
    const changed = structuredClone(registry);
    changed.exceptions[15].status = status;
    writeRegistry(changed);
    assert.throws(() => trustedExceptions(root, commit()), /RECORD_INVALID/u);
  }
  writeRegistry(registry);
  const installed = commit();
  t.mock.timers.tick(Date.parse(CURRENT_R16.expiresAt) - Date.now());
  assert.throws(() => trustedExceptions(root, installed), /RECORD_INVALID/u);
});
test("generation16 consumes exact failed R15 preparation and requires every success slot absent", async (t) => {
  const { record, previous } = successorFixture(t);
  const payload = failedPreparationFixture(previous);
  assert.equal(hash(payload), CURRENT_R15_FAILED_PREPARATION.preparePayloadDigest);
  let preparation = { ...payload, commitSha: record.predecessor.prepareCommit };
  let occupied = null;
  let tree = record.predecessor.candidateTree;
  const slots = [];
  const options = {
    record,
    storeFor: (value) => {
      assert.equal(value.id, CURRENT_R16.previousId);
      assert.equal(value.custody.namespace, `sounding-line-exceptions/${value.id}`);
      return {
        read: async (slot) => {
          slots.push(slot);
          return slot === "prepare" ? preparation : slot === occupied ? { occupied: true } : null;
        },
      };
    },
    request: async (endpoint) => {
      assert.equal(endpoint, `git/commits/${record.predecessor.candidateSha}`);
      return { tree: { sha: tree } };
    },
  };
  await validateCurrentFailedPreparation(options);
  assert.deepEqual(slots, ["prepare", "capture", "review-submit", "review8", "qualify", "qualified"]);
  for (occupied of ["capture", "review-submit", "review8", "qualify", "qualified"])
    await assert.rejects(validateCurrentFailedPreparation(options), /R15_UNEXPECTED_SUCCESS_SLOT/u);
  occupied = null;
  for (const mutate of [
    (p) => {
      p.commitSha = sha(99);
    },
    (p) => {
      p.run.runAttempt = 2;
    },
    (p) => {
      p.binding.sourceDigest = "a".repeat(64);
    },
    (p) => {
      p.status = "PASS";
    },
    (p) => {
      p.independentReviewsCompleted = 8;
    },
  ]) {
    preparation = structuredClone({
      ...payload,
      commitSha: record.predecessor.prepareCommit,
    });
    mutate(preparation);
    await assert.rejects(validateCurrentFailedPreparation(options), /R15_SPENT_PREPARATION_CHANGED/u);
  }
  preparation = { ...payload, commitSha: record.predecessor.prepareCommit };
  tree = sha(99);
  await assert.rejects(validateCurrentFailedPreparation(options), /R15_CANDIDATE_TREE_CHANGED/u);
});
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
test("generation18 evidence requires both blocked findings resolved per affected contract with current repair evidence", (t) => {
  const record = fixtureRecord(t),
    plan = planFor(record);
  plan.exception.version = 18;
  plan.exception.independentReviewOrdinal = CURRENT_R18.remainingIndependentReviewOrdinal;
  const a = plan.exception.currentSourceAdmission;
  a.cumulativeHistory = structuredClone(CURRENT_R18.cumulativeHistory);
  a.requiredReviewIterations = CURRENT_R18.requiredReviewIterations;
  const artifacts = contracts.map((contractId, index) => ({
    ...artifact(),
    id: `fixture-current-repair-${index}`,
    path: `Development_Docs/Testing/Product_Experience/evidence/fixture-repair-${index}.png`,
    contractId,
  }));
  const evidence = {
    exception: plan.exception,
    artifacts,
    reviews: contracts.map((contractId, index) => ({
      contractId,
      iterations: 13,
      independentReviewOrdinal: 9,
      cumulativeHistory: structuredClone(a.cumulativeHistory),
      findings: CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings
        .filter((finding) => finding.contractIds.includes(contractId))
        .map(({ id, classification }) => ({
          id,
          classification,
          contractId,
          disposition: "RESOLVED",
          resolution: "Synthetic current repair evidence fixture only; no actual product judgment.",
          repairEvidenceIds: [artifacts[index].id],
        })),
    })),
  };
  validateCurrentAdmissionEvidence(plan, evidence);
  const fresh = () => structuredClone(evidence);
  for (const finding of CURRENT_R17_BLOCKED_CAPTURE.blockedReview.blockingFindings)
    for (const contractId of finding.contractIds)
      for (const mutate of [
        (review) => {
          review.findings = review.findings.filter(({ id }) => id !== finding.id);
        },
        (review) => {
          review.findings.push(structuredClone(review.findings.find(({ id }) => id === finding.id)));
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).classification = "MINOR_POLISH";
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).disposition = "UNRESOLVED";
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).resolution = "too short";
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).repairEvidenceIds = [];
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).repairEvidenceIds = ["old-r17-artifact"];
        },
        (review) => {
          review.findings.find(({ id }) => id === finding.id).repairEvidenceIds = [
            artifacts.find((v) => v.contractId !== contractId).id,
          ];
        },
      ]) {
        const changed = fresh(),
          review = changed.reviews.find((entry) => entry.contractId === contractId);
        mutate(review);
        assert.throws(
          () => validateCurrentAdmissionEvidence(plan, changed),
          /REVIEW_HISTORY_CHANGED|R18_BLOCKING_FINDING_NOT_RESOLVED/u,
        );
      }
  for (const change of [
    { iterations: 12 },
    { independentReviewOrdinal: 8 },
    { cumulativeHistory: CURRENT_R17.cumulativeHistory },
  ]) {
    const changed = fresh();
    Object.assign(changed.reviews[0], change);
    assert.throws(() => validateCurrentAdmissionEvidence(plan, changed), /REVIEW_HISTORY_CHANGED/u);
  }
  const captureOnly = fresh();
  delete captureOnly.reviews;
  validateCurrentAdmissionEvidence(plan, captureOnly, true);
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

function finalFixture(t, identity = {}, options = {}) {
  const record = options.record ?? fixtureRecord(t),
    a = record.currentSourceAdmission,
    run = { runId: 444 },
    publicationNonce = "11111111-2222-3333-4444-555555555555";
  const ordinary = {
    mode: "ordinary",
    baseSha: sha(30),
    candidateSha: sha(31),
    ...identity,
    selected: { unitTests: options.unitTests ?? ["src/fixture.test.ts"], browserTests: browsers },
    safetyPaths: options.safetyPaths ?? ["prisma/seed.ts"],
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
test("generation17 modeled whole closure binds seven contracts,32+6 contexts,216 inert unit paths,eight browsers and all eight groups", (t) => {
  const { record } = generation17Fixture(t);
  // Explicit command-generation fixtures only. These nonexistent unit paths are
  // never executed and make no assertion about the future real source selection.
  const unitTests = Array.from({ length: 216 }, (_, index) => `tests/sounding-line/inert-fixture-${index}.test.mjs`);
  const f = finalFixture(
    t,
    {},
    { record, unitTests, safetyPaths: [...record.currentSourceAdmission.publicationFiles, "prisma/seed.ts"] },
  );
  assert.equal(f.record.contractIds.length, 7);
  assert.equal(f.record.contexts, 32);
  assert.equal(f.plan.contextCount, 38);
  assert.equal(f.record.currentSourceAdmission.pairedBrowserContexts, 6);
  assert.equal(f.record.currentSourceAdmission.publicationFiles.length, 26);
  assert.equal(f.ordinary.selected.unitTests.length, 216);
  assert.deepEqual(f.ordinary.selected.browserTests, browsers);
  assert.equal(browsers.length, 8);
  assert.equal(f.groups.length, 8);
  assert.equal(f.record.currentSourceAdmission.requiredReviewIterations, 12);
  assert.equal(validateCurrentAdmissionFinalDecision(f).status, "PASS");
  for (const ordinary of [
    { ...f.ordinary, selected: { ...f.ordinary.selected, unitTests: unitTests.slice(1) } },
    { ...f.ordinary, selected: { ...f.ordinary.selected, browserTests: browsers.slice(1) } },
    { ...f.ordinary, safetyPaths: f.ordinary.safetyPaths.slice(1) },
  ])
    assert.throws(
      () => validateCurrentAdmissionFinalDecision({ ...f, ordinary, groups: verificationObligationGroups(ordinary) }),
      /CURRENT_ADMISSION_/u,
    );
  for (const mutate of [
    (decision) => {
      decision.evidenceReconciliation.finalization.closure.pop();
    },
    (decision) => {
      decision.evidenceReconciliation.finalization.remainder.push("unclosed");
    },
    (decision) => {
      decision.evidenceReconciliation.reconciliation.find(({ obligationId }) =>
        obligationId.startsWith("browser."),
      ).freshExecuted = false;
    },
  ]) {
    const decision = structuredClone(f.decision);
    mutate(decision);
    assert.throws(() => validateCurrentAdmissionFinalDecision({ ...f, decision }), /CURRENT_ADMISSION_/u);
  }
});

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
