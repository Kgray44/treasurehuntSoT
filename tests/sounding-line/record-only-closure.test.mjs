import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  classifyRecordOnlyDiff,
  RECORD_ONLY_EVIDENCE_IDS,
  RECORD_ONLY_PROTECTED_CONTEXT,
  RECORD_ONLY_SUITE_ID,
  validatePriorImplementationAuthority,
} from "../../scripts/sounding-line/record-only-closure.mjs";
import {
  PROTECTED_MAINLINE_CONTEXT,
  qualifyProtectedMerge,
} from "../../scripts/sounding-line/protected-merge-binding.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const candidate = "a".repeat(40);
const base = "b".repeat(40);
const merge = "c".repeat(40);
const implementationCandidate = "d".repeat(40);
const implementationMerge = "e".repeat(40);

function priorAuthorityFixture(valid = true) {
  const authority = {
    valid,
    errors: valid ? [] : ["PRIOR_IMPLEMENTATION_PROTECTED_CONTEXT_INVALID"],
    prNumber: 35,
    authorityRunId: 31579218676,
    implementationCandidateSha: implementationCandidate,
    implementationMergeSha: implementationMerge,
    protectedContext: RECORD_ONLY_PROTECTED_CONTEXT,
  };
  const unsignedPlan = {
    version: 2,
    authority: "SOUNDING_LINE",
    sourceSha: implementationCandidate,
    gate: "mainline",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    authorityDigest: "authority",
    runtimeConformanceRequired: true,
    nodes: [{ id: "build.production" }, { id: "unit.helm" }],
  };
  const plan = { ...unsignedPlan, planDigest: digest(unsignedPlan) };
  const receipts = plan.nodes.map((node) => ({
    suiteId: node.id,
    sourceSha: plan.sourceSha,
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
    missingMandatorySuites: [],
    duplicateSuiteReceipts: [],
    unknownSuiteReceipts: [],
    invalidEvidence: [],
    missingRuntimeConformance: [],
    invalidRuntimeConformance: [],
  };
  return { authority, plan, finalization };
}

function recordOnlyBindingFixture() {
  const changedPaths = [
    "CHANGELOG.md",
    "Development_Docs/Projects/Project_Helm/Project_Helm_Phase_2_Completion_Receipt.md",
    "docs/product/current-status.md",
  ];
  const unsignedPlan = {
    version: 3,
    authority: "SOUNDING_LINE",
    sourceSha: candidate,
    gate: "mainline",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    authorityDigest: "authority",
    runtimeConformanceRequired: true,
    runtimeConformanceSuiteId: RECORD_ONLY_SUITE_ID,
    nodes: [
      {
        id: RECORD_ONLY_SUITE_ID,
        resources: ["node-slot"],
        adapter: "record-only-static",
      },
    ],
    recordOnly: {
      version: 1,
      mode: "FAIL_CLOSED_RECORD_ONLY",
      candidateSha: candidate,
      currentBaseSha: base,
      mergeSha: merge,
      candidateMergeBaseSha: implementationMerge,
      changedPaths,
      priorAuthority: {
        prNumber: 35,
        authorityRunId: 31579218676,
        implementationCandidateSha: implementationCandidate,
        implementationMergeSha: implementationMerge,
        protectedContext: PROTECTED_MAINLINE_CONTEXT,
      },
      evidence: RECORD_ONLY_EVIDENCE_IDS.map((id) => ({ id, result: "PASSED" })),
    },
  };
  const plan = { ...unsignedPlan, planDigest: digest(unsignedPlan) };
  const receipts = [
    {
      suiteId: RECORD_ONLY_SUITE_ID,
      sourceSha: candidate,
      policyDigest: "policy",
      inventoryDigest: "inventory",
      planDigest: plan.planDigest,
      gate: "mainline",
      cleanupState: "CLEAN",
      result: "PASSED",
      exitCode: 0,
      timedOut: false,
    },
  ];
  const finalization = {
    authority: "SOUNDING_LINE_FINALIZER",
    decision: "RELEASE_GO",
    gate: "mainline",
    planDigest: plan.planDigest,
    receipts,
    evidenceDigest: digest(receipts),
  };
  const qualified = {
    prNumber: 99,
    candidateSha: candidate,
    qualifiedBaseSha: base,
    authoritativeRunId: 999,
    planDigest: plan.planDigest,
    policyDigest: "policy",
    inventoryDigest: "inventory",
    authorityDigest: "authority",
    evidenceDigest: finalization.evidenceDigest,
    mandatoryReceiptCount: 1,
  };
  return { changedPaths, plan, finalization, qualified };
}

test("true documentation and catalog closure is record-only eligible and binds with minimum evidence", () => {
  const classification = classifyRecordOnlyDiff([
    { status: "M", path: "CHANGELOG.md" },
    { status: "A", path: "Development_Docs/Features/catalog/captain.json" },
    { status: "M", path: "Development_Docs/Features/FEATURE_CATALOG.md" },
    { status: "M", path: "Development_Docs/document-index.json" },
    { status: "M", path: "docs/reference/feature-status.md" },
  ]);
  assert.equal(classification.eligible, true);
  const fixture = recordOnlyBindingFixture();
  const result = qualifyProtectedMerge({
    authority: {
      protectedMergeBinding: { enabled: true, requiredContext: PROTECTED_MAINLINE_CONTEXT },
    },
    ...fixture,
    prNumber: 99,
    candidateSha: candidate,
    currentBaseSha: base,
    mergeSha: merge,
    mergeParents: [base, candidate],
    changedPaths: [],
    baseAncestryValid: false,
    authorityRunId: 999,
    recordOnlyChangedPaths: fixture.changedPaths,
    recordOnlyAncestryValid: true,
  });
  assert.equal(result.decision, "BINDING_PASS");
  assert.equal(result.carryForward.status, "RECORD_ONLY_EXACT_CANDIDATE_DIFF");
  assert.deepEqual(
    fixture.plan.recordOnly.evidence.map((entry) => entry.id),
    RECORD_ONLY_EVIDENCE_IDS,
  );
});

test("record-only classification refuses a product source file", () => {
  const result = classifyRecordOnlyDiff([{ status: "A", path: "src/app/captain/page.tsx" }]);
  assert.equal(result.eligible, false);
  assert.match(result.errors.join("\n"), /RECORD_ONLY_PATH_NOT_ALLOWLISTED/u);
});

test("record-only classification refuses schema, migration, dependency, workflow, and test changes", () => {
  for (const relativePath of [
    "prisma/schema.prisma",
    "prisma/migrations/20260812_add_presence/migration.sql",
    "package.json",
    "package-lock.json",
    ".github/workflows/sounding-line-authoritative.yml",
    "tests/e2e/helm.spec.ts",
    "tests/sounding-line/runtime-conformance.test.mjs",
  ]) {
    const result = classifyRecordOnlyDiff([{ status: "M", path: relativePath }]);
    assert.equal(result.eligible, false, relativePath);
  }
});

test("record-only evidence refuses a missing or invalid prior implementation authority", () => {
  const valid = priorAuthorityFixture(true);
  assert.deepEqual(
    validatePriorImplementationAuthority({
      authority: valid.authority,
      plan: valid.plan,
      finalization: valid.finalization,
    }),
    [],
  );
  const invalid = priorAuthorityFixture(false);
  assert.match(
    validatePriorImplementationAuthority({
      authority: invalid.authority,
      plan: invalid.plan,
      finalization: invalid.finalization,
    }).join("\n"),
    /PRIOR_IMPLEMENTATION_PROTECTED_CONTEXT_INVALID/u,
  );
});

test("the protected Mainline Decision context remains exact", async () => {
  const [authoritySource, workflow] = await Promise.all([
    readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"),
    readFile(path.join(root, ".github", "workflows", "sounding-line-protected-merge-binding.yml"), "utf8"),
  ]);
  const authority = JSON.parse(authoritySource);
  assert.equal(PROTECTED_MAINLINE_CONTEXT, "Sounding Line / Mainline Decision");
  assert.equal(authority.requiredProtectedAuthorityCheck, PROTECTED_MAINLINE_CONTEXT);
  assert.match(workflow, /name: Sounding Line \/ Mainline Decision/u);
});
