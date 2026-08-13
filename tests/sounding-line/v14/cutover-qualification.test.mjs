import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_SHADOW_CASES,
  evaluatePausedFleetAdoption,
  evaluateRollbackDrill,
  qualifyShadowCorpus,
} from "../../../scripts/sounding-line/v14/cutover-qualification.mjs";

const sha = (value) => value.repeat(40);
const conservativeCases = new Set(["unmapped-path", "contract-map-debt"]);
const corruptionCases = new Set([
  "corrupt-evidence-receipt",
  "prepared-layer-corruption",
  "prepared-layer-revocation-expiry",
  "missing-cleanup-receipt",
  "surviving-mutable-resource",
  "actual-tree-mismatch",
]);
const baseCase = (id, overrides = {}) => ({
  id,
  candidateIdentity: { candidateSha: sha("a") },
  changedInterval: { changedPaths: ["Development_Docs/example.md"] },
  closureConfidence: conservativeCases.has(id) ? "UNKNOWN" : "EXACT",
  reasonLedger: [],
  v13: { decision: "RELEASE_GO" },
  v14: {
    decision: corruptionCases.has(id) ? "REJECT" : "QUALIFIED",
    freshObligations: ["static.core"],
    preservedObligations: [],
    reboundObligations: [],
    fallbackObligations: conservativeCases.has(id) ? ["all-governed-suites"] : [],
    omittedObligations: [],
    exhaustive: id === "exhaustive-release-candidate",
  },
  ...overrides,
});

const qualified = (cases) =>
  qualifyShadowCorpus({
    cases,
    candidateSha: sha("a"),
    qualifiedBaseSha: sha("b"),
    policyDigest: "policy",
    authorityDigest: "authority",
  });

test("Prompt 5 corpus requires every mandated scenario and seals a safe dual-decision report", () => {
  const report = qualified(REQUIRED_SHADOW_CASES.map((id) => baseCase(id)));
  assert.equal(report.decision, "V14_SHADOW_QUALIFIED");
  assert.equal(report.counts.corpusCases, 35);
  assert.equal(report.counts.unsafe, 0);
});

test("unknown mapping and contract debt require conservative fallback rather than narrowed proof", () => {
  const cases = REQUIRED_SHADOW_CASES.map((id) => baseCase(id));
  for (const id of ["unmapped-path", "contract-map-debt"]) {
    const index = cases.findIndex((entry) => entry.id === id);
    cases[index] = baseCase(id, {
      closureConfidence: "UNKNOWN",
      v14: { ...cases[index].v14, fallbackObligations: ["all-governed-suites"], decision: "V14_QUALIFIED" },
    });
  }
  const report = qualified(cases);
  assert.equal(report.decision, "V14_SHADOW_QUALIFIED");
  assert.equal(report.counts.conservativeFallback, 2);
});

test("unexplained preservation and any corruption-positive decision fail the corpus", () => {
  const cases = REQUIRED_SHADOW_CASES.map((id) => baseCase(id));
  cases[0] = baseCase("record-only-documentation", {
    v14: { ...cases[0].v14, omittedObligations: [{ obligationId: "browser.auth", reason: "PRESERVED" }] },
  });
  const corrupted = cases.findIndex((entry) => entry.id === "corrupt-evidence-receipt");
  cases[corrupted] = baseCase("corrupt-evidence-receipt", { v14: { ...cases[corrupted].v14, decision: "RELEASE_GO" } });
  const report = qualified(cases);
  assert.equal(report.decision, "V14_SHADOW_NO_GO");
  assert.equal(report.counts.unsafe, 2);
});

test("rollback drill requires every fail-closed safety observation", () => {
  const observations = {
    v14Disabled: true,
    serialCurrentBaseFailClosed: true,
    v13RejectsV14Evidence: true,
    staleV13RejectedForV14: true,
    branchProtectionEnforced: true,
    noForcePush: true,
    historyUnrewritten: true,
    receiptsRetained: true,
    partialCarsBlocked: true,
    v13RejectsV14PreparedLayers: true,
  };
  assert.equal(
    evaluateRollbackDrill({ candidateSha: sha("a"), qualifiedBaseSha: sha("b"), observations }).decision,
    "ROLLBACK_DRILL_PASS",
  );
  const failed = evaluateRollbackDrill({
    candidateSha: sha("a"),
    qualifiedBaseSha: sha("b"),
    observations: { ...observations, noForcePush: false, receiptsRetained: false },
  });
  assert.equal(failed.decision, "ROLLBACK_DRILL_NO_GO");
  assert.deepEqual(failed.failures, ["FORCE_PUSH_DETECTED", "ROLLBACK_RECEIPTS_MISSING"]);
});

test("paused fleet evidence is preserved only with exact reconstructed identity and compatible main impact", () => {
  const candidate = {
    project: "harborlight",
    branch: "codex/project-harborlight-phase2-open-the-exchange",
    head: sha("c"),
    evidenceAvailable: true,
    obligations: [
      {
        id: "unit.harborlight",
        disposition: "PRESERVED",
        immutableIdentity: {
          candidateSha: sha("c"),
          policyDigest: "policy",
          authorityDigest: "authority",
          testDefinitionDigest: "test-definition",
          fingerprintDigest: "fingerprint",
        },
        currentMainImpact: { compatible: true },
      },
      {
        id: "browser.harborlight",
        disposition: "PRESERVED",
        immutableIdentity: {},
        currentMainImpact: { compatible: false },
      },
    ],
  };
  const report = evaluatePausedFleetAdoption({
    candidates: [candidate],
    policyDigest: "policy",
    authorityDigest: "authority",
  });
  assert.equal(report.decision, "FLEET_ADOPTION_PARTIAL");
  assert.deepEqual(report.projects[0].preservedObligations, ["unit.harborlight"]);
  assert.deepEqual(report.projects[0].fallbackObligations, ["browser.harborlight"]);
  assert.match(report.projects[0].blockingReason, /UNRECONSTRUCTABLE_PRESERVED/u);
});
