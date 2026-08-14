import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PROTECTED_MAINLINE_CONTEXT,
  qualifyProtectedMerge,
} from "../../scripts/sounding-line/protected-merge-binding.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const candidate = "a".repeat(40);
const qualifiedBase = "b".repeat(40);
const currentBase = "c".repeat(40);
const merge = "d".repeat(40);

function fixture() {
  const authority = {
    protectedMergeBinding: {
      enabled: true,
      requiredContext: PROTECTED_MAINLINE_CONTEXT,
      semanticCarryForward: {
        unrelatedPathGlobs: ["Development_Docs/Governing/**", "tests/sounding-line/**", "scripts/sounding-line/**"],
        relevantContractPathGlobs: ["Development_Docs/Projects/Project_Helm/**", "src/**", "prisma/**"],
      },
    },
  };
  const unsignedPlan = {
    version: 2,
    authority: "SOUNDING_LINE",
    sourceSha: candidate,
    gate: "mainline",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    authorityDigest: "authority",
    nodes: [{ id: "unit.helm" }, { id: "browser.helm" }],
  };
  const plan = { ...unsignedPlan, planDigest: digest(unsignedPlan) };
  const receipts = plan.nodes.map((node) => ({
    suiteId: node.id,
    sourceSha: candidate,
    policyDigest: plan.policyDigest,
    inventoryDigest: plan.inventoryDigest,
    planDigest: plan.planDigest,
    gate: "mainline",
    cleanupState: "CLEAN",
    result: "PASSED",
    exitCode: 0,
    timedOut: false,
  }));
  const finalization = {
    authority: "SOUNDING_LINE_FINALIZER",
    decision: "RELEASE_GO",
    gate: "mainline",
    planDigest: plan.planDigest,
    receipts,
    evidenceDigest: digest(receipts),
  };
  const qualified = {
    prNumber: 35,
    candidateSha: candidate,
    qualifiedBaseSha: qualifiedBase,
    authoritativeRunId: 31555993275,
    planDigest: plan.planDigest,
    policyDigest: plan.policyDigest,
    inventoryDigest: plan.inventoryDigest,
    authorityDigest: plan.authorityDigest,
    evidenceDigest: finalization.evidenceDigest,
    mandatoryReceiptCount: receipts.length,
  };
  return { authority, qualified, plan, finalization };
}

function bind(overrides = {}) {
  const base = fixture();
  return qualifyProtectedMerge({
    ...base,
    prNumber: 35,
    candidateSha: candidate,
    currentBaseSha: qualifiedBase,
    mergeSha: merge,
    mergeParents: [qualifiedBase, candidate],
    changedPaths: [],
    baseAncestryValid: true,
    authorityRunId: 31555993275,
    ...overrides,
  });
}

test("exact qualified head + base + sealed evidence bind to the synthetic merge", () => {
  const result = bind();
  assert.equal(result.decision, "BINDING_PASS");
  assert.equal(result.protectedContext, PROTECTED_MAINLINE_CONTEXT);
  assert.equal(result.carryForward.status, "EXACT_BASE");
});

test("protected merge binding fails closed for changed head, missing release, digest drift, invalid receipts, and dirty cleanup", () => {
  assert.equal(bind({ candidateSha: "e".repeat(40) }).decision, "BINDING_NO_GO");
  const noGo = fixture();
  noGo.finalization.decision = "RELEASE_NO_GO";
  assert.equal(bind(noGo).decision, "BINDING_NO_GO");
  const digestMismatch = fixture();
  digestMismatch.finalization.evidenceDigest = "0".repeat(64);
  assert.equal(bind(digestMismatch).decision, "BINDING_NO_GO");
  const missingReceipt = fixture();
  missingReceipt.finalization.receipts.pop();
  missingReceipt.finalization.evidenceDigest = digest(missingReceipt.finalization.receipts);
  assert.equal(bind(missingReceipt).decision, "BINDING_NO_GO");
  const dirtyCleanup = fixture();
  dirtyCleanup.finalization.receipts[0].cleanupState = "DIRTY";
  dirtyCleanup.finalization.evidenceDigest = digest(dirtyCleanup.finalization.receipts);
  assert.equal(bind(dirtyCleanup).decision, "BINDING_NO_GO");
});

test("semantic carry-forward preserves only declared unrelated base advances", () => {
  const pass = bind({
    currentBaseSha: currentBase,
    mergeParents: [currentBase, candidate],
    changedPaths: [
      "Development_Docs/Governing/Project_Sounding_Line_Part_III_Governing_Document_v1.3_Amendment_Edition.pdf",
      "tests/sounding-line/authority-cutover.test.mjs",
    ],
  });
  assert.equal(pass.decision, "BINDING_PASS");
  assert.equal(pass.carryForward.status, "SEMANTIC_CARRY_FORWARD");
  const rejected = bind({
    currentBaseSha: currentBase,
    mergeParents: [currentBase, candidate],
    changedPaths: ["src/helm/membership.ts"],
  });
  assert.equal(rejected.decision, "BINDING_NO_GO");
  assert.deepEqual(rejected.carryForward.rejected, ["src/helm/membership.ts"]);
});

test("an unreachable predicted base may rebind only to its exact protected-base tree", () => {
  const tree = "e".repeat(40);
  const rebound = fixture();
  rebound.qualified.qualifiedBaseTreeSha = tree;
  const pass = bind({
    ...rebound,
    currentBaseSha: currentBase,
    currentBaseTree: tree,
    mergeParents: [currentBase, candidate],
    changedPaths: [],
    baseAncestryValid: false,
  });
  assert.equal(pass.decision, "BINDING_PASS");
  assert.equal(pass.carryForward.status, "TREE_EQUIVALENT_PREDICTED_BASE");
  const reject = bind({
    ...rebound,
    currentBaseSha: currentBase,
    currentBaseTree: "f".repeat(40),
    mergeParents: [currentBase, candidate],
    changedPaths: undefined,
    baseAncestryValid: false,
  });
  assert.equal(reject.decision, "BINDING_NO_GO");
});

test("synthetic composition is exact and the bridge never becomes candidate authority", () => {
  const wrongParents = bind({ mergeParents: [qualifiedBase, "f".repeat(40)] });
  assert.equal(wrongParents.decision, "BINDING_NO_GO");
  const absentEvidence = bind({ finalization: null });
  assert.equal(absentEvidence.decision, "BINDING_NO_GO");
  for (const result of [wrongParents, absentEvidence]) assert.notEqual(result.decision, "RELEASE_GO");
});

test("workflow topology retains explicit heavyweight authority and the exact protected context", async () => {
  const [authority, authoritative, bridge] = await Promise.all([
    readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"),
    readFile(path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"), "utf8"),
    readFile(path.join(root, ".github", "workflows", "sounding-line-protected-merge-binding.yml"), "utf8"),
  ]);
  const parsed = JSON.parse(authority);
  assert.equal(parsed.requiredProtectedAuthorityCheck, PROTECTED_MAINLINE_CONTEXT);
  assert.equal(parsed.protectedMergeBinding.requiredContext, PROTECTED_MAINLINE_CONTEXT);
  assert.doesNotMatch(authoritative, /^\s{2}(?:pull_request|push):/mu);
  assert.match(authoritative, /workflow_dispatch:/u);
  assert.match(authoritative, /candidate_sha:/u);
  assert.match(bridge, /pull_request:/u);
  assert.match(bridge, /name: Sounding Line \/ Mainline Decision/u);
  assert.doesNotMatch(bridge, /sounding-line-governed-worker\.yml|authority\.mjs .*--execute-only/u);
  assert.match(bridge, /sounding-line-finalization/u);
  assert.match(bridge, /sounding-line-plan/u);
  assert.match(bridge, /record-only-closure\.mjs/u);
  assert.match(bridge, /Finalize record-only decision/u);
  assert.match(bridge, /sounding-line-mainline-train\.yml/u);
});
