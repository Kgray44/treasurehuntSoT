import assert from "node:assert/strict";
import test from "node:test";
import {
  createMaintenancePlan,
  finalizeMaintenance,
} from "../../../scripts/sounding-line/verification-maintenance.mjs";
import { qualifyMaintenanceProtectedMerge } from "../../../scripts/sounding-line/maintenance-protected-binding.mjs";
import { finalize } from "../../../scripts/sounding-line/finalizer.mjs";

const sha = (character) => character.repeat(40);
const policy = {
  authority: "SOUNDING_LINE_VERIFICATION_MAINTENANCE",
  trustedMainOnly: true,
  eligiblePathGlobs: ["tests/sounding-line/**"],
  authorityChangePathGlobs: [],
  requiredEvidence: ["FOCUSED_REGRESSION"],
};
const plan = createMaintenancePlan({
  trustedPolicy: policy,
  trustedMainSha: sha("a"),
  candidateSha: sha("b"),
  candidateTree: sha("c"),
  qualifiedBaseSha: sha("a"),
  changedPaths: ["tests/sounding-line/v14/example.test.mjs"],
});
const finalization = finalizeMaintenance({
  plan,
  evidence: [{ id: "FOCUSED_REGRESSION", result: "PASSED", candidateSha: sha("b") }],
  observedCandidateSha: sha("b"),
  observedTrustedMainSha: sha("a"),
});

test("maintenance binding accepts only the exact trusted base, candidate, and landed tree", () => {
  const result = qualifyMaintenanceProtectedMerge({
    plan,
    finalization,
    candidateSha: sha("b"),
    currentBaseSha: sha("a"),
    mergeSha: sha("d"),
    mergeTree: sha("c"),
    mergeParents: [sha("a"), sha("b")],
  });
  assert.equal(result.decision, "BINDING_PASS");
  assert.equal(
    qualifyMaintenanceProtectedMerge({
      plan,
      finalization,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("e"),
      mergeTree: sha("c"),
      mergeParents: [sha("b"), sha("a")],
    }).decision,
    "BINDING_PASS",
  );
  assert.equal(
    qualifyMaintenanceProtectedMerge({
      plan,
      finalization,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("d"),
      mergeTree: sha("d"),
      mergeParents: [sha("a"), sha("b")],
    }).decision,
    "BINDING_NO_GO",
  );
});

test("ordinary release finalization cannot consume maintenance evidence", () => {
  const result = finalize({ plan, receipts: [] });
  assert.equal(result.decision, "EVIDENCE_INVALID");
  assert.deepEqual(result.invalidEvidence, ["ORDINARY_RELEASE_CANNOT_CONSUME_MAINTENANCE_EVIDENCE"]);
});
