import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyVerificationMaintenance,
  createMaintenancePlan,
  finalizeMaintenance,
} from "../../../scripts/sounding-line/verification-maintenance.mjs";

const sha = (character) => character.repeat(40);
const policy = {
  authority: "SOUNDING_LINE_VERIFICATION_MAINTENANCE",
  trustedMainOnly: true,
  eligiblePathGlobs: ["tests/sounding-line/**", "testing/generated/**"],
  authorityChangePathGlobs: [
    "testing/verification-maintenance-policy.json",
    "scripts/sounding-line/verification-maintenance.mjs",
  ],
  requiredEvidence: ["FOCUSED_REGRESSION", "POLICY"],
};
const planFor = (paths = ["tests/sounding-line/v14/example.test.mjs"]) =>
  createMaintenancePlan({
    trustedPolicy: policy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    changedPaths: paths,
  });
const evidenceFor = () => policy.requiredEvidence.map((id) => ({ id, result: "PASSED", candidateSha: sha("b") }));

test("maintenance-only candidate is eligible and finalizes distinctly from release authority", () => {
  const plan = planFor();
  assert.equal(plan.classification.classification, "VERIFICATION_MAINTENANCE");
  assert.deepEqual(plan.errors, []);
  const result = finalizeMaintenance({
    plan,
    evidence: evidenceFor(),
    observedCandidateSha: sha("b"),
    observedTrustedMainSha: sha("a"),
  });
  assert.equal(result.decision, "MAINTENANCE_GO");
  assert.notEqual(result.decision, "RELEASE_GO");
});

test("product, mixed, unknown, and authority-changing candidates fail closed", () => {
  assert.match(
    classifyVerificationMaintenance({ trustedPolicy: policy, changedPaths: ["src/app/page.tsx"] }).classification,
    /SCOPE_REJECTED/,
  );
  assert.match(
    classifyVerificationMaintenance({
      trustedPolicy: policy,
      changedPaths: ["tests/sounding-line/x.test.mjs", "src/app/page.tsx"],
    }).classification,
    /SCOPE_REJECTED/,
  );
  assert.match(
    classifyVerificationMaintenance({ trustedPolicy: policy, changedPaths: ["unknown/ownership.txt"] }).classification,
    /SCOPE_REJECTED/,
  );
  assert.match(
    classifyVerificationMaintenance({
      trustedPolicy: policy,
      changedPaths: ["testing/verification-maintenance-policy.json"],
    }).classification,
    /AUTHORITY_CHANGE_REJECTED/,
  );
});

test("the verification-maintenance workflow remains an authority-changing candidate path", async () => {
  const trustedPolicy = JSON.parse(
    await readFile(new URL("../../../testing/verification-maintenance-policy.json", import.meta.url), "utf8"),
  );
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy,
      changedPaths: [".github/workflows/sounding-line-verification-maintenance.yml"],
    }).classification,
    "MAINTENANCE_AUTHORITY_CHANGE_REJECTED",
  );
});

test("trusted main, frozen candidate, and landed tree are all bound", () => {
  const plan = planFor();
  assert.match(
    finalizeMaintenance({
      plan,
      evidence: evidenceFor(),
      observedCandidateSha: sha("d"),
      observedTrustedMainSha: sha("a"),
    }).errors.join("\n"),
    /CANDIDATE_CHANGED/,
  );
  assert.match(
    finalizeMaintenance({
      plan,
      evidence: evidenceFor(),
      observedCandidateSha: sha("b"),
      observedTrustedMainSha: sha("d"),
    }).errors.join("\n"),
    /TRUSTED_MAIN_STALE/,
  );
  assert.match(
    finalizeMaintenance({
      plan,
      evidence: evidenceFor(),
      observedCandidateSha: sha("b"),
      observedTrustedMainSha: sha("a"),
      observedLandedTree: sha("d"),
    }).errors.join("\n"),
    /LANDED_TREE_MISMATCH/,
  );
});

test("trusted policy wins over a candidate attempt to broaden maintenance eligibility", () => {
  const forgedCandidatePolicy = { ...policy, eligiblePathGlobs: ["**"] };
  assert.equal(forgedCandidatePolicy.eligiblePathGlobs[0], "**");
  const result = createMaintenancePlan({
    trustedPolicy: policy,
    trustedMainSha: sha("a"),
    candidateSha: sha("b"),
    candidateTree: sha("c"),
    qualifiedBaseSha: sha("a"),
    changedPaths: ["src/app/page.tsx"],
  });
  assert.match(result.errors.join("\n"), /MAINTENANCE_SCOPE_REJECTED/);
});

test("known v1.4 repair classes remain maintenance while unknown ownership rejects", () => {
  const expanded = {
    ...policy,
    eligiblePathGlobs: [...policy.eligiblePathGlobs, "tests/e2e/**", "scripts/sounding-line/worker-preparation.mjs"],
  };
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy: expanded,
      changedPaths: ["tests/e2e/project-true-north.spec.ts"],
    }).classification,
    "VERIFICATION_MAINTENANCE",
  );
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy: expanded,
      changedPaths: ["scripts/sounding-line/worker-preparation.mjs"],
    }).classification,
    "VERIFICATION_MAINTENANCE",
  );
  assert.match(
    classifyVerificationMaintenance({ trustedPolicy: expanded, changedPaths: ["scripts/unknown-adapter.mjs"] })
      .classification,
    /SCOPE_REJECTED/,
  );
});

test("maintenance qualification keeps the static-safe changed-path proof outside the checkout", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/sounding-line-verification-maintenance.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /id: trusted-maintenance/u);
  assert.match(
    workflow,
    /\$maintenanceTemp = Join-Path \$env:RUNNER_TEMP "sounding-line-maintenance-\$env:GITHUB_RUN_ID-\$env:GITHUB_RUN_ATTEMPT"/u,
  );
  assert.match(workflow, /\$pathsFile = Join-Path \$maintenanceTemp 'maintenance-changed-paths\.json'/u);
  assert.match(workflow, /\$pathsJson = ConvertTo-Json -InputObject \$paths -Compress/u);
  assert.match(workflow, /\[System\.IO\.File\]::WriteAllText\(\$pathsFile, \$pathsJson, \$utf8NoBom\)/u);
  assert.match(workflow, /--paths \$pathsFile/u);
  assert.doesNotMatch(workflow, /Set-Content maintenance-changed-paths\.json/u);
  assert.match(workflow, /\$\{\{ steps\.trusted-maintenance\.outputs\.maintenance_temp \}\}\/maintenance-plan\.json/u);
  assert.match(workflow, /Remove-Item -LiteralPath \$maintenanceTemp -Recurse -Force/u);
});
