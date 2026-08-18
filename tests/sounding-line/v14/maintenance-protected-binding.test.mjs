import assert from "node:assert/strict";
import test from "node:test";
import {
  createMaintenancePlan,
  finalizeMaintenance,
} from "../../../scripts/sounding-line/verification-maintenance.mjs";
import { qualifyMaintenanceProtectedMerge } from "../../../scripts/sounding-line/maintenance-protected-binding.mjs";
import { selectSealedMaintenanceAuthority } from "../../../scripts/sounding-line/maintenance-authority-selection.mjs";
import { finalize } from "../../../scripts/sounding-line/finalizer.mjs";
import {
  classifyAuthorityMaintenance,
  createAuthorityMaintenancePlan,
  finalizeAuthorityMaintenance,
} from "../../../scripts/sounding-line/authority-maintenance.mjs";
import { qualifyAuthorityMaintenanceProtectedMerge } from "../../../scripts/sounding-line/authority-maintenance-protected-binding.mjs";
import { selectSealedAuthorityMaintenance } from "../../../scripts/sounding-line/authority-maintenance-selection.mjs";

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

const trustedRun = (overrides = {}) => ({
  id: 42,
  name: "Sounding Line verification maintenance",
  path: ".github/workflows/sounding-line-verification-maintenance.yml",
  event: "workflow_dispatch",
  status: "completed",
  conclusion: "success",
  headSha: sha("a"),
  plan,
  finalization,
  ...overrides,
});

const select = (runs) =>
  selectSealedMaintenanceAuthority({
    runs,
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
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

test("trusted-main dispatch selects one matching sealed MAINTENANCE_GO even though Actions head is the base", () => {
  const result = select([trustedRun()]);
  assert.equal(result.decision, "MAINTENANCE_AUTHORITY_SELECTED");
  assert.equal(result.selectedRunId, 42);
});

test("maintenance authority selection fails closed for invalid identity, disposition, trust, or uniqueness", () => {
  assert.equal(select([trustedRun({ headSha: sha("b") })]).decision, "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE");
  assert.equal(
    select([trustedRun({ plan: { ...plan, candidateSha: sha("d") } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    select([trustedRun({ plan: { ...plan, qualifiedBaseSha: sha("d") } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    select([trustedRun({ plan: { ...plan, candidateTree: sha("d") } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(select([trustedRun({ conclusion: "failure" })]).decision, "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE");
  assert.equal(
    select([trustedRun({ plan: { ...plan, disposition: "RELEASE_GO" } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    select([trustedRun({ finalization: { ...finalization, decision: "MAINTENANCE_NO_GO" } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    select([trustedRun({ finalization: { ...finalization, decision: "RELEASE_GO" } })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(
    select([trustedRun({ path: ".github/workflows/untrusted.yml" })]).decision,
    "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE",
  );
  assert.equal(select([trustedRun(), trustedRun({ id: 43 })]).decision, "SEALED_MAINTENANCE_AUTHORITY_NOT_UNIQUE");
});

test("authority maintenance is a distinct owner-authorized, exact-identity lane", () => {
  const authorityPolicy = {
    authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
    disposition: "AUTHORITY_MAINTENANCE_GO",
    workflowDispatchOnly: true,
    trustedMainOnly: true,
    eligiblePathGlobs: ["scripts/sounding-line/authority-maintenance.mjs", "tests/sounding-line/**"],
    requiredEvidence: ["FOCUSED_REGRESSION", "ANTI_SELF_AUTHORIZATION"],
  };
  const changedPaths = ["scripts/sounding-line/authority-maintenance.mjs", "tests/sounding-line/v14/example.test.mjs"];
  assert.equal(
    classifyAuthorityMaintenance({ trustedPolicy: authorityPolicy, changedPaths, ownerAuthorized: false })
      .classification,
    "AUTHORITY_MAINTENANCE_REJECTED",
  );
  assert.equal(
    classifyAuthorityMaintenance({
      trustedPolicy: authorityPolicy,
      changedPaths: ["src/app/page.tsx"],
      ownerAuthorized: true,
    }).errors[0],
    "AUTHORITY_MAINTENANCE_SCOPE_REJECTED:src/app/page.tsx",
  );
  const authorityPlan = createAuthorityMaintenancePlan({
    trustedPolicy: authorityPolicy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    changedPaths,
    ownerAuthorized: true,
  });
  assert.equal(authorityPlan.disposition, "AUTHORITY_MAINTENANCE_GO");
  assert.notEqual(authorityPlan.disposition, "RELEASE_GO");
  const authorityFinalization = finalizeAuthorityMaintenance({
    plan: authorityPlan,
    evidence: authorityPolicy.requiredEvidence.map((id) => ({ id, result: "PASSED", candidateSha: sha("b") })),
    observedCandidateSha: sha("b"),
    observedTrustedMainSha: sha("a"),
  });
  assert.equal(authorityFinalization.decision, "AUTHORITY_MAINTENANCE_GO");
  const run = {
    id: 43,
    name: "Sounding Line authority maintenance",
    path: ".github/workflows/sounding-line-authority-maintenance.yml",
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    headSha: sha("a"),
    plan: authorityPlan,
    finalization: authorityFinalization,
  };
  assert.equal(
    selectSealedAuthorityMaintenance({
      runs: [run],
      candidateSha: sha("b"),
      candidateTree: sha("c"),
      qualifiedBaseSha: sha("a"),
    }).decision,
    "AUTHORITY_MAINTENANCE_AUTHORITY_SELECTED",
  );
  assert.equal(
    qualifyAuthorityMaintenanceProtectedMerge({
      plan: authorityPlan,
      finalization: authorityFinalization,
      candidateSha: sha("b"),
      currentBaseSha: sha("a"),
      mergeSha: sha("d"),
      mergeTree: sha("c"),
      mergeParents: [sha("a"), sha("b")],
    }).decision,
    "BINDING_PASS",
  );
});
