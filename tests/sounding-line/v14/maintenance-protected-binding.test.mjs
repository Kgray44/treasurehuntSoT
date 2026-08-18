import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
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
const execFileAsync = promisify(execFile);
const root = path.resolve();
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

test("the protected binding treats only authority-plus-scope maintenance rejection as expected", async () => {
  const workflow = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-protected-merge-binding.yml"),
    "utf8",
  );
  assert.match(workflow, /\$authorityAndScopeOnly = \$errors\.Count -gt 0/);
  assert.match(workflow, /\^\(MAINTENANCE_AUTHORITY_CHANGE_REJECTED\|MAINTENANCE_SCOPE_REJECTED\):/);
  assert.match(workflow, /\^MAINTENANCE_AUTHORITY_CHANGE_REJECTED:/);
  const authorityBinding = workflow.slice(workflow.indexOf("bind-authority-maintenance:"));
  assert.match(authorityBinding, /actions\/runs\?event=workflow_dispatch&per_page=100/);
  assert.doesNotMatch(authorityBinding, /head_sha=\$env:BASE_SHA/);
});

test("a renamed trusted authority classifier still emits the sealed plan and finalization", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sounding-line-authority-maintenance-"));
  try {
    const classifier = path.join(directory, "trusted-classifier.mjs");
    const policyPath = path.join(directory, "policy.json");
    const pathsPath = path.join(directory, "paths.json");
    const planPath = path.join(directory, "plan.json");
    const evidencePath = path.join(directory, "evidence.json");
    const finalizationPath = path.join(directory, "finalization.json");
    const authorityPolicy = {
      authority: "SOUNDING_LINE_AUTHORITY_MAINTENANCE",
      disposition: "AUTHORITY_MAINTENANCE_GO",
      workflowDispatchOnly: true,
      trustedMainOnly: true,
      eligiblePathGlobs: ["tests/sounding-line/**"],
      requiredEvidence: ["FOCUSED_REGRESSION"],
    };
    await copyFile(path.resolve("scripts/sounding-line/authority-maintenance.mjs"), classifier);
    await writeFile(policyPath, JSON.stringify(authorityPolicy));
    await writeFile(pathsPath, JSON.stringify(["tests/sounding-line/v14/example.test.mjs"]));
    await execFileAsync(process.execPath, [
      classifier,
      "plan",
      "--policy",
      policyPath,
      "--paths",
      pathsPath,
      "--trusted-main-sha",
      sha("a"),
      "--candidate-sha",
      sha("b"),
      "--candidate-tree",
      sha("c"),
      "--base-sha",
      sha("a"),
      "--owner-authorized",
      "true",
      "--out",
      planPath,
    ]);
    await writeFile(
      evidencePath,
      JSON.stringify([{ id: "FOCUSED_REGRESSION", result: "PASSED", candidateSha: sha("b") }]),
    );
    await execFileAsync(process.execPath, [
      classifier,
      "finalize",
      "--plan",
      planPath,
      "--evidence",
      evidencePath,
      "--candidate-sha",
      sha("b"),
      "--trusted-main-sha",
      sha("a"),
      "--out",
      finalizationPath,
    ]);
    assert.equal(JSON.parse(await readFile(planPath, "utf8")).disposition, "AUTHORITY_MAINTENANCE_GO");
    assert.equal(JSON.parse(await readFile(finalizationPath, "utf8")).decision, "AUTHORITY_MAINTENANCE_GO");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
