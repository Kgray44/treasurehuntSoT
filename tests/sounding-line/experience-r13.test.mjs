import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CROSSDECK_R13,
  R13_OVERLAY_PATHS,
  R13_TEST_CORRECTION,
  R13_FOCUSED,
  validateR13Record,
  validateR13Registry,
  validateR13Bridge,
  validateR13Overlay,
  r13HistoricalEvidencePlan,
  validateR13FinalDecision,
} from "../../scripts/sounding-line/experience-r13.mjs";
import { R8_FORMAT, r8FormatEvidencePlan } from "../../scripts/sounding-line/experience-r8-format.mjs";
import {
  CROSSDECK_R12,
  selectTrustedExceptions,
  validateExceptionRecord,
  recordBinding,
  reserveExceptionStage,
} from "../../scripts/sounding-line/experience-exception.mjs";
import { verificationObligationGroups } from "../../scripts/sounding-line/ordinary.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const installedRegistry = JSON.parse(
  readFileSync(path.join(repo, "testing/product-experience-exceptions.json"), "utf8"),
);
// Historical R13 assertions retain the exact accepted thirteen-row/six-bridge prefix.
const registry = {
  ...installedRegistry,
  exceptions: installedRegistry.exceptions.slice(0, 13),
  reconciliations: installedRegistry.reconciliations.slice(0, 6),
};
const record = registry.exceptions.find((entry) => entry.id === CROSSDECK_R13.id);
const predecessor = registry.exceptions.find((entry) => entry.id === CROSSDECK_R12.id);
const original = JSON.parse(
  readFileSync(
    path.join(
      repo,
      "Development_Docs/Programs/Sounding_Line/evidence/crossdeck-r9-ordinary-only-20261016/r8-custody-read-only.original.raw.txt",
    ),
    "utf8",
  ),
);
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function planFixture() {
  const bridge = {
    version: 1,
    id: CROSSDECK_R13.bridgeId,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R13.id,
    recordDigest: CROSSDECK_R13.recordDigest,
    overlay: R13_OVERLAY_PATHS.map((file) => ({
      path: file,
      oldMode: null,
      oldBlob: null,
      newMode: "100644",
      newBlob: "b".repeat(40),
    })),
  };
  const historicalException = structuredClone(original.custody.qualify.binding.exception);
  delete historicalException.nonExecutingReconciliation;
  const plan = {
    applicable: true,
    baseSha: "a".repeat(40),
    candidateSha: "c".repeat(40),
    sourceDigest: "d".repeat(64),
    contractDigest: R8_FORMAT.contractDigest,
    contextCount: 38,
    exception: recordBinding(record),
  };
  plan.exception.nonExecutingReconciliation = {
    version: 1,
    id: bridge.id,
    recordDigest: hash(bridge),
    originalBaseSha: R8_FORMAT.baseSha,
    originalSourceDigest: R8_FORMAT.sourceDigest,
    originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
    currentBaseSha: plan.baseSha,
    currentSourceDigest: plan.sourceDigest,
    overlay: bridge.overlay,
    candidateTestCorrection: R13_TEST_CORRECTION,
    historicalException,
  };
  return { plan, bridge };
}

test("R13 preserves twelve historical grants and the spent setup without refunding an ordinary", () => {
  validateR13Record(record);
  validateR13Registry(registry);
  assert.deepEqual(selectTrustedExceptions(registry.exceptions), [record]);
  assert.deepEqual(record.immutableHistory.slice(0, 1255), predecessor.immutableHistory);
  assert.equal(predecessor.immutableHistory.length, 1255);
  assert.equal(record.immutableHistory.length, 1307);
  assert.deepEqual(record.remotePredecessor, predecessor.predecessor);
  assert.equal(record.predecessor.recordDigest, CROSSDECK_R12.recordDigest);
  assert.equal(CROSSDECK_R13.requiredR12InstallerMainSha, record.predecessor.baseSha);
  assert.equal(record.predecessor.status, "FAIL");
  assert.equal(record.predecessor.outcome, "EXECUTION_UNKNOWN");
  assert.equal(record.predecessor.invocations, 1);
  assert.equal(record.predecessor.caseExecutions, 0);
  assert.equal(record.predecessor.browserExecutions, 0);
  assert.equal(record.predecessor.mediaCount, 0);
  assert.equal(record.predecessor.cleanupStatus, "PASS");
  assert.equal(record.attemptHistory.priorOrdinaryDispatches, 5);
  assert.equal(record.attemptHistory.priorOrdinaryFailures, 5);
  assert.equal(record.attemptHistory.nextOrdinaryDispatchTotal, 6);
  assert.equal(record.expiresAt, predecessor.expiresAt);
  assert.equal(record.expiresAt, "2026-10-22T23:59:59Z");
  assert.equal(record.predecessor.campaignEpoch, predecessor.predecessor.campaignEpoch);
  assert.notEqual(record.custody.namespace, predecessor.custody.namespace);
  assert.notEqual(
    record.focusedTechnicalDiagnostics.publicationDirectory,
    predecessor.focusedTechnicalDiagnostics.publicationDirectory,
  );
  assert.deepEqual(record.candidateTestCorrection, R13_TEST_CORRECTION);
  assert.equal(record.focusedTechnicalDiagnostics.originalInvocations, 1);
  assert.equal(record.focusedTechnicalDiagnostics.correctedInvocations, 1);
  const readiness = record.focusedTechnicalDiagnostics.readiness;
  assert.equal(readiness.requiredBeforeCaseSlot, true);
  assert.equal(readiness.maximumAttemptsPerStage, 3);
  assert.equal(readiness.maximumAttemptsTotal, 6);
  assert.equal(readiness.browserProbe, "CHROMIUM_LAUNCH_CLOSE_WITHOUT_PAGE");
  assert.equal(readiness.productJourneys, 0);
  assert.equal(readiness.productCaptures, 0);
  assert.equal(readiness.providerCalls, 0);

  for (const [key, value] of Object.entries(record.executionBudget))
    assert.equal(
      value,
      ["ordinaryInvocations", "ordinaryExperienceReplayPasses", "technicalE2EInvocations"].includes(key) ? 1 : 0,
      key,
    );
  const retired = structuredClone(registry.exceptions);
  retired.at(-1).status = "RETIRED";
  assert.deepEqual(selectTrustedExceptions(retired), []);
  assert.throws(() => validateExceptionRecord(record, new Date(record.expiresAt)), /EXPIRED/u);
  for (const change of [
    (r) => r.immutableHistory.pop(),
    (r) => r.executionBudget.reruns++,
    (r) => r.executionBudget.productRepairs++,
    (r) => r.focusedTechnicalDiagnostics.originalInvocations++,
    (r) => r.focusedTechnicalDiagnostics.correctedInvocations++,
    (r) => r.focusedTechnicalDiagnostics.readiness.maximumAttemptsPerStage++,
    (r) => (r.focusedTechnicalDiagnostics.readiness.productJourneys = 1),
    (r) => r.predecessor.caseExecutions++,
    (r) => r.predecessor.invocations--,
    (r) => r.attemptHistory.nextOrdinaryDispatchTotal++,
    (r) => {
      r.remotePredecessor.qualifyPayloadDigest = "changed";
    },
    (r) => {
      r.expiresAt = "2026-10-23T23:59:59Z";
    },
  ]) {
    const changed = structuredClone(record);
    change(changed);
    assert.throws(() => validateR13Record(changed), /R13_RECORD_CHANGED/u);
  }
  const oldChanged = structuredClone(registry);
  oldChanged.exceptions[11].executionBudget.reruns++;
  assert.throws(() => validateR13Registry(oldChanged), /R13_PREDECESSOR_REGISTRY_CHANGED/u);
});

test("R13 historical projection binds the separate exact technical correction and original R8 seals", () => {
  const { plan, bridge } = planFixture();
  validateR13Bridge(bridge);
  const before = structuredClone(plan);
  const historical = r8FormatEvidencePlan(plan);
  assert.equal(historical.baseSha, R8_FORMAT.baseSha);
  assert.equal(historical.sourceDigest, R8_FORMAT.sourceDigest);
  assert.equal(historical.candidateSha, R8_FORMAT.publicationCandidateSha);
  assert.deepEqual(plan, before);
  for (const change of [
    (p) => (p.sourceDigest = "changed"),
    (p) => (p.exception.nonExecutingReconciliation.candidateTestCorrection = undefined),
    (p) =>
      (p.exception.nonExecutingReconciliation.candidateTestCorrection = {
        ...R13_TEST_CORRECTION,
        newBlob: "f".repeat(40),
      }),
    (p) => p.exception.nonExecutingReconciliation.overlay.pop(),
    (p) => (p.exception.nonExecutingReconciliation.historicalException.version = 99),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => r13HistoricalEvidencePlan(changed), /R13_/u);
  }
});

test("R13 permits only its candidate-only test blob and denies base, mode and product substitution", () => {
  const { bridge } = planFixture();
  const originalBase = new Map([[R13_TEST_CORRECTION.path, "100644 blob unchanged-protected-base"]]);
  const acceptedBase = new Map([
    ...originalBase,
    ...bridge.overlay.map((entry) => [entry.path, `100644 blob ${entry.newBlob}`]),
    ["testing/product-experience-exceptions.json", "100644 blob registry"],
  ]);
  const originalSource = new Map([
    ["src/fixture.ts", "100644 blob frozen-product"],
    [R13_TEST_CORRECTION.path, `100644 blob ${R13_TEST_CORRECTION.oldBlob}`],
  ]);
  const candidate = new Map([
    ...acceptedBase,
    ["src/fixture.ts", "100644 blob frozen-product"],
    [R13_TEST_CORRECTION.path, `100644 blob ${R13_TEST_CORRECTION.newBlob}`],
  ]);
  const args = { bridge, originalBase, acceptedBase, originalSource, candidate };
  validateR13Overlay(args);
  for (const [file, metadata] of [
    [R13_TEST_CORRECTION.path, `100644 blob ${R13_TEST_CORRECTION.oldBlob}`],
    [R13_TEST_CORRECTION.path, `120000 blob ${R13_TEST_CORRECTION.newBlob}`],
    ["tests/e2e/unlisted.spec.ts", "100644 blob unlisted"],
    ["src/fixture.ts", "100644 blob product-repair"],
    ["playwright.config.ts", "100644 blob changed-config"],
  ]) {
    const changed = new Map(candidate);
    changed.set(file, metadata);
    assert.throws(() => validateR13Overlay({ ...args, candidate: changed }), /R13_/u);
  }
  const changedBase = new Map(acceptedBase);
  changedBase.set(R13_TEST_CORRECTION.path, `100644 blob ${R13_TEST_CORRECTION.newBlob}`);
  assert.throws(() => validateR13Overlay({ ...args, acceptedBase: changedBase }), /R13_TEST_CORRECTION_CHANGED/u);
  assert(!R13_OVERLAY_PATHS.includes(R13_TEST_CORRECTION.path));
  assert.equal(R13_FOCUSED.original.candidateSha, record.predecessor.candidateSha);
  assert.notEqual(CROSSDECK_R13.reviewedProductSourceReferenceSha, CROSSDECK_R13.frozenReferenceSha);
});

test("R13 rejects forbidden modes and missing published technical proof before custody writes", async () => {
  const { plan } = planFixture();
  const operations = [];
  const store = {
    read: (slot) => operations.push(["read", slot]),
    create: (slot) => operations.push(["create", slot]),
  };
  for (const mode of ["capture", "review", "verify", "local", "prepare"])
    await assert.rejects(() => reserveExceptionStage({ record, plan, mode, store }), /R13_MODE_FORBIDDEN/u);
  await assert.rejects(
    () =>
      reserveExceptionStage({
        root: repo,
        record,
        plan: { ...plan, candidateSha: R13_FOCUSED.original.baseSha },
        mode: "ordinary",
        store,
      }),
    /R13_FOCUSED_PUBLICATION_MISSING/u,
  );
  assert.deepEqual(operations, []);
});

test("R13 finalizer still requires eight complete obligations, fresh technical proof and current replay", () => {
  const { plan } = planFixture();
  const ordinary = {
    mode: "ordinary",
    baseSha: plan.baseSha,
    candidateSha: plan.candidateSha,
    selected: { unitTests: ["src/fixture.test.ts"], browserTests: record.requiredTechnicalBrowserTests },
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
  const decision = {
    ...ordinary,
    decision: "PASS",
    productExperience: {
      ...plan,
      trustedAttestation: {
        status: "PASS",
        exception: plan.exception,
        currentBaseSha: plan.baseSha,
        currentSourceDigest: plan.sourceDigest,
        reviewedBaseSha: R8_FORMAT.baseSha,
        reviewedSourceDigest: R8_FORMAT.sourceDigest,
        captureArtifactId: R8_FORMAT.captureArtifact,
        reviewArtifactId: R8_FORMAT.reviewArtifact,
        exceptionCustody: { prepareReservation: R8_FORMAT.prepareCommit, reviewSeal: R8_FORMAT.reviewSeal },
        nonExecutingReconciliation: plan.exception.nonExecutingReconciliation,
      },
    },
    productExperienceDecision: {
      status: "PASS",
      sourceDigest: plan.sourceDigest,
      reviewedBaseSha: R8_FORMAT.baseSha,
      reviewedSourceDigest: R8_FORMAT.sourceDigest,
      nonExecutingReconciliation: plan.exception.nonExecutingReconciliation,
    },
    productExperienceReplay: { status: "PASS", sourceDigest: plan.sourceDigest },
    timing: { commands: groups.map((group) => ({ obligationId: group.id, status: "PASS" })) },
    evidenceReconciliation: {
      requiredObligations: 8,
      obligations: groups.map((group) => ({ id: group.id, commands: group.commandLabels })),
      reconciliation: groups.map((group) => ({
        obligationId: group.id,
        receiptId: `receipt-${group.id}`,
        disposition: "FRESH",
        freshExecuted: true,
      })),
      finalization: {
        authority: "SOUNDING_LINE_EVIDENCE_FINALIZER",
        decision: "PASS",
        requiredObligations: 8,
        errors: [],
        remainder: [],
        closure: groups.map((group) => ({ obligationId: group.id, receiptId: `receipt-${group.id}`, satisfied: true })),
      },
    },
  };
  validateR13FinalDecision({ plan, ordinary, record, decision, groups });
  for (const mutate of [
    (d) => d.evidenceReconciliation.finalization.closure.pop(),
    (d) => {
      const browser = groups.find((group) => group.kind === "browser");
      d.evidenceReconciliation.reconciliation.find((entry) => entry.obligationId === browser.id).freshExecuted = false;
    },
    (d) => (d.productExperienceReplay.sourceDigest = "historical-source"),
  ]) {
    const changed = structuredClone(decision);
    mutate(changed);
    assert.throws(() => validateR13FinalDecision({ plan, ordinary, record, decision: changed, groups }));
  }
});
