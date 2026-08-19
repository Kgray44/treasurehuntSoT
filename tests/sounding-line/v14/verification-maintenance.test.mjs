import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  classifyOrdinaryCandidate,
  classifyVerificationMaintenance,
  createMaintenancePlan,
  finalizeMaintenance,
} from "../../../scripts/sounding-line/verification-maintenance.mjs";
import { buildStaticCommandPlan } from "../../../scripts/sounding-line/static.mjs";

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

test("authority workflows remain authority-changing while unrelated workflows stay out of maintenance scope", async () => {
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
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy,
      changedPaths: [".github/workflows/sounding-line-train-wave.yml"],
    }).classification,
    "MAINTENANCE_AUTHORITY_CHANGE_REJECTED",
  );
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy,
      changedPaths: ["scripts/sounding-line/finalization-evidence.mjs"],
    }).classification,
    "MAINTENANCE_AUTHORITY_CHANGE_REJECTED",
  );
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy,
      changedPaths: ["scripts/sounding-line/record-only-closure.mjs"],
    }).classification,
    "MAINTENANCE_AUTHORITY_CHANGE_REJECTED",
  );
  assert.equal(
    classifyVerificationMaintenance({
      trustedPolicy,
      changedPaths: [".github/workflows/unrelated.yml"],
    }).classification,
    "MAINTENANCE_SCOPE_REJECTED",
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

test("trusted policy classifies the dependency-seed runtime seam as verification maintenance", async () => {
  const trustedPolicy = JSON.parse(
    await readFile(new URL("../../../testing/verification-maintenance-policy.json", import.meta.url), "utf8"),
  );
  const classification = classifyVerificationMaintenance({
    trustedPolicy,
    changedPaths: ["scripts/dev-common.ps1", "tests/sounding-line/authority-cutover.test.mjs"],
  });
  assert.equal(classification.classification, "VERIFICATION_MAINTENANCE");
  assert.deepEqual(classification.errors, []);
});

const readOrdinaryCandidatePolicy = async () =>
  JSON.parse(await readFile(new URL("../../../testing/verification-maintenance-policy.json", import.meta.url), "utf8"));

test("ordinary Bridgewatch workspace source is eligible", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["bridgewatch/src/discovery.ts", "bridgewatch/lib/server.ts", "bridgewatch/public/app.js"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("ordinary Bridgewatch workspace tests are eligible", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["bridgewatch/test/discovery.test.ts", "bridgewatch/test/server.test.ts"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("only bounded Bridgewatch integration, projection, and records are eligible", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: [
      "CHANGELOG.md",
      "Development_Docs/INDEX.md",
      "Development_Docs/Project_Bridgewatch_v1.2_Mission_Control_Realization_Design_Record.md",
      "Development_Docs/Project_Bridgewatch_v1.2_Validation_Record.md",
      "Development_Docs/Project_Bridgewatch_v2_Source_Health_Matrix.json",
      "Development_Docs/README.md",
      "Development_Docs/document-index.json",
      "deploy/nginx.conf",
      "scripts/sounding-line/status-projection.mjs",
      "src/admiralty/bridgewatch-gateway.ts",
    ],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("ordinary candidates still reject actual Sounding Line authority files", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["scripts/sounding-line/planner.mjs"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
  assert.deepEqual(result.errors, ["ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:scripts/sounding-line/planner.mjs"]);
});

test("ordinary candidates reject arbitrary deploy and Sounding Line scripts", async () => {
  const policy = await readOrdinaryCandidatePolicy();
  for (const changedPath of ["deploy/unrelated.conf", "scripts/sounding-line/unrelated-adapter.mjs"]) {
    const result = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(result.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
    assert.deepEqual(result.errors, [`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${changedPath}`]);
  }
});

test("the governed Shipwright journey runner is ordinary-admissible without broadening its directory", async () => {
  const policy = await readOrdinaryCandidatePolicy();
  const admitted = classifyOrdinaryCandidate({
    trustedPolicy: policy,
    changedPaths: ["scripts/shipwright/run-phase2-journeys.mjs"],
  });
  assert.equal(admitted.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(admitted.errors, []);
  for (const changedPath of ["scripts/shipwright/unrelated-runner.mjs", "scripts/shipwright/future/runner.mjs"]) {
    const rejected = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(rejected.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED", changedPath);
    assert.deepEqual(rejected.errors, [`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${changedPath}`], changedPath);
  }
});

test("mixed Bridgewatch and authority-changing diffs remain rejected", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["bridgewatch/src/discovery.ts", "testing/verification-maintenance-policy.json"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
  assert.deepEqual(result.errors, [
    "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:testing/verification-maintenance-policy.json",
  ]);
});

test("ordinary candidates fail closed for unknown paths", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["unowned/bridgewatch-lookalike.ts"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.deepEqual(result.errors, ["ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:unowned/bridgewatch-lookalike.ts"]);
});

test("structurally proven project supplements admit the Tideglass surface without a named policy rule", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: [
      "src/tideglass/core.ts",
      "tests/tideglass/canonicalization.test.ts",
      "Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_4_Validation_Record.md",
      "scripts/tideglass/seed-phase3-fixture.mjs",
      "README.md",
      "Development_Docs/Project_Ledgerlight_Documentation_Migration_Matrix.csv",
    ],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("canonical Deepwater governance and tooling paths are ordinary-admissible without broadening lookalikes", async () => {
  const policy = await readOrdinaryCandidatePolicy();
  const admitted = [
    ".agents/deepwater-capability-impact.md",
    "Development_Docs/Programs/Deepwater/phase-records/Project_Deepwater_Phase_5_Design_Record.md",
    "scripts/deepwater/phase5.mjs",
  ];
  assert.equal(
    classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: admitted }).classification,
    "ORDINARY_CANDIDATE",
  );
  for (const path of [
    ".agents/deepwater-capability-impact-evil.md",
    "Development_Docs/Programs/DeepwaterEvil/record.md",
    "scripts/deepwater-unauthorized/phase5.mjs",
    ".agents/unrelated.md",
    "scripts/unrelated/phase5.mjs",
    "testing/impact-map.json",
  ])
    assert.notEqual(
      classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [path] }).classification,
      "ORDINARY_CANDIDATE",
    );
});

const projectTrimPhaseOnePaths = [
  ".agents/context-workflow.md",
  ".gitignore",
  "AGENTS.md",
  "agent-context-profiles.json",
  "Development_Docs/document-index.json",
  "Development_Docs/Features/FEATURE_CATALOG.md",
  "Development_Docs/Governing/Project_Trim_Codex_Context_and_Inference_Efficiency_Governing_Document_v1.0-R1.pdf",
  "Development_Docs/INDEX.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Context_Profile_and_Schema.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Baseline_Audit.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Governing_Input.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_0_Measurement_Data.json",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Benchmark_and_Dogfood_Record.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Design_and_Implementation_Record.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_1_Validation_Record.md",
  "Development_Docs/Programs/Project_Trim/Project_Trim_Token_Calibration_and_Estimator_v1.md",
  "scripts/agent-context/build-context.mjs",
  "scripts/agent-context/core.mjs",
  "scripts/agent-context/preflight.mjs",
  "scripts/agent-context/record-ledger.mjs",
  "scripts/agent-context/record-usage.mjs",
  "scripts/generate-document-index.mjs",
  "testing/generated/active-test-registry.json",
  "tests/agent-context/project-trim-phase1.test.mjs",
  "tests/fixtures/agent-context/bounded-product.json",
  "tests/fixtures/agent-context/documentation-only.json",
  "tests/fixtures/agent-context/focused-repair.json",
  "tests/fixtures/agent-context/release-closure.json",
];

test("the complete Project Trim Phase 1 candidate is ordinary-admissible", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: projectTrimPhaseOnePaths,
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("Project Trim support and safe future project-document structure are ordinary-admissible", async () => {
  const policy = await readOrdinaryCandidatePolicy();
  const recognized = [
    ".agents/context-workflow.md",
    "agent-context-profiles.json",
    "scripts/agent-context/build-context.mjs",
    "testing/generated/active-test-registry.json",
    "Development_Docs/Programs/Project_Trim/Project_Trim_Phase_2_Design.md",
    "Development_Docs/Governing/Project_Trim_Phase_2_Governing_Baseline.pdf",
    "Development_Docs/Features/FEATURE_CATALOG.md",
    "scripts/generate-document-index.mjs",
    "Development_Docs/Programs/Unrelated/record.md",
  ];
  for (const changedPath of recognized) {
    const result = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(result.classification, "ORDINARY_CANDIDATE", changedPath);
    assert.deepEqual(result.errors, [], changedPath);
  }
  for (const changedPath of [
    ".agents/unrelated-guidance.md",
    "scripts/agent-contextual/not-project-trim.mjs",
    "testing/generated/unowned-registry.json",
    "Development_Docs/Governing/Unrelated_Governing_Baseline.pdf",
  ]) {
    const result = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(result.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED", changedPath);
    assert.deepEqual(result.errors, [`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${changedPath}`], changedPath);
  }
});

test("Project Trim ordinary admission preserves semantic impact, required sentinels, and exhaustive release scope", async () => {
  const [authority, planner] = await Promise.all([
    readOrdinaryCandidatePolicy().then(async () =>
      JSON.parse(await readFile(new URL("../../../testing/sounding-line-authority.json", import.meta.url), "utf8")),
    ),
    readFile(new URL("../../../scripts/sounding-line/planner.mjs", import.meta.url), "utf8"),
  ]);
  const minimumEvidence = authority.ordinaryCandidateQualification.minimumSufficientEvidence;
  assert.equal(minimumEvidence.selectionMode, "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS");
  assert.deepEqual(minimumEvidence.requiredSafetySentinelSuiteIds, ["browser.access-sentinel"]);
  assert.equal(minimumEvidence.unmappedDisposition, "CONSERVATIVE_FALLBACK");
  assert.deepEqual(minimumEvidence.exhaustiveGateIds, ["release-candidate"]);
  assert.match(planner, /generateV14FastChannelPlan/u);
  assert.match(planner, /semanticPlanDigest: semanticPlan\.digest/u);
  assert.match(planner, /selectionContract: semanticPlan\.selectionContract/u);
});

test("Project Trim admission cannot self-authorize a policy change", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["scripts/agent-context/build-context.mjs", "testing/verification-maintenance-policy.json"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
  assert.deepEqual(result.errors, [
    "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:testing/verification-maintenance-policy.json",
  ]);
});

const projectConfluenceC2C7Paths = [
  ".agents/confluence-workers.md",
  "Developer_Journals/README.md",
  "Development_Docs/Features/FEATURE_CATALOG.md",
  "Development_Docs/Governing/Project_Confluence_Governing_Document_v1.0.pdf",
  "Development_Docs/Governing/Project_Confluence_Journal_Design_Specification_v1.0.pdf",
  "Development_Docs/Project_Confluence_C2_C7_Design_and_Implementation_Record.md",
  "Development_Docs/Project_Confluence_Integration_Manifest.md",
  "Development_Docs/Project_Confluence_Operations_Runbook.md",
  "Development_Docs/Project_Confluence_Replay_Guide.md",
  "Development_Docs/Project_Confluence_Test_and_Validation_Record.md",
  "Development_Docs/document-index.json",
  "package.json",
  "scripts/confluence/README.md",
  "scripts/confluence/cli.mjs",
  "scripts/confluence/core.mjs",
  "tests/confluence/core.test.mjs",
];

test("the complete Project Confluence C2-C7 candidate is ordinary-admissible", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: projectConfluenceC2C7Paths,
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("Project Confluence admission preserves bounded paths while future project records use structural discovery", async () => {
  const policy = await readOrdinaryCandidatePolicy();
  const recognized = [
    ".agents/confluence-workers.md",
    "Developer_Journals/2026/2026-W34/Voyagewright_Developer_Journal_2026-W34.pdf",
    "Developer_Journals/2026/2026-W34/Voyagewright_Developer_Journal_2026-W34.docx",
    "Developer_Journals/2026/2026-W34/metadata.json",
    "Development_Docs/Project_Confluence_Future_Validation_Record.md",
    "Development_Docs/Governing/Project_Confluence_Future_Governing_Baseline.pdf",
    "scripts/confluence/future-maintenance.mjs",
    "tests/confluence/future-maintenance.test.mjs",
    "Development_Docs/Governing/Project_ConfluenceX_Governing_Baseline.pdf",
  ];
  for (const changedPath of recognized) {
    const result = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(result.classification, "ORDINARY_CANDIDATE", changedPath);
    assert.deepEqual(result.errors, [], changedPath);
  }
  for (const changedPath of [
    ".agents/confluence-workers-lookalike.md",
    "Developer_Journals_Archive/2026/2026-W34/metadata.json",
    "Development_Docs/Project_ConfluenceX_Validation_Record.md",
    "scripts/confluential/future-maintenance.mjs",
    "test/confluence/future-maintenance.test.mjs",
  ]) {
    const result = classifyOrdinaryCandidate({ trustedPolicy: policy, changedPaths: [changedPath] });
    assert.equal(result.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED", changedPath);
    assert.deepEqual(result.errors, [`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${changedPath}`], changedPath);
  }
});

test("Project Confluence admission preserves semantic impact, required sentinels, and exhaustive release scope", async () => {
  const [authority, planner] = await Promise.all([
    readOrdinaryCandidatePolicy().then(async () =>
      JSON.parse(await readFile(new URL("../../../testing/sounding-line-authority.json", import.meta.url), "utf8")),
    ),
    readFile(new URL("../../../scripts/sounding-line/planner.mjs", import.meta.url), "utf8"),
  ]);
  const minimumEvidence = authority.ordinaryCandidateQualification.minimumSufficientEvidence;
  assert.equal(minimumEvidence.selectionMode, "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS");
  assert.deepEqual(minimumEvidence.requiredSafetySentinelSuiteIds, ["browser.access-sentinel"]);
  assert.equal(minimumEvidence.unmappedDisposition, "CONSERVATIVE_FALLBACK");
  assert.deepEqual(minimumEvidence.exhaustiveGateIds, ["release-candidate"]);
  assert.match(planner, /generateV14FastChannelPlan/u);
  assert.match(planner, /semanticPlanDigest: semanticPlan\.digest/u);
  assert.match(planner, /selectionContract: semanticPlan\.selectionContract/u);
});

test("Project Confluence cannot self-authorize an admission or authority-policy change", async () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: await readOrdinaryCandidatePolicy(),
    changedPaths: ["scripts/confluence/core.mjs", "testing/verification-maintenance-policy.json"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
  assert.deepEqual(result.errors, [
    "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED:testing/verification-maintenance-policy.json",
  ]);
});

test("candidate authority invokes the trusted ordinary classifier rather than inline glob logic", async () => {
  const [workflow, protectedBinding] = await Promise.all([
    readFile(new URL("../../../.github/workflows/sounding-line-authoritative.yml", import.meta.url), "utf8"),
    readFile(new URL("../../../.github/workflows/sounding-line-protected-merge-binding.yml", import.meta.url), "utf8"),
  ]);
  assert.match(
    workflow,
    /git show "\$env:SOUNDING_LINE_BASE_SHA`:scripts\/sounding-line\/verification-maintenance\.mjs" > trusted-verification-maintenance\.mjs/u,
  );
  assert.match(
    workflow,
    /node trusted-verification-maintenance\.mjs ordinary --policy trusted-maintenance-policy\.json --paths ordinary-candidate-changed-paths\.json --trusted-base-sha \$env:SOUNDING_LINE_BASE_SHA --candidate-sha \$env:SOUNDING_LINE_CANDIDATE_SHA --out ordinary-candidate-classification\.json/u,
  );
  assert.match(
    workflow,
    /git show "\$env:SOUNDING_LINE_BASE_SHA`:scripts\/sounding-line\/project-discovery\.mjs" > project-discovery\.mjs/u,
  );
  assert.match(
    protectedBinding,
    /git show "\$env:BASE_SHA`:scripts\/sounding-line\/project-discovery\.mjs" > project-discovery\.mjs/u,
  );
  assert.doesNotMatch(workflow, /function Test-TrustedGlob/u);
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
  assert.match(workflow, /\$projectDiscoveryFile = Join-Path \$maintenanceTemp 'project-discovery\.mjs'/u);
  assert.match(workflow, /MAINTENANCE_TRUSTED_PROJECT_DISCOVERY_UNAVAILABLE/u);
  assert.match(workflow, /\$pathsJson = ConvertTo-Json -InputObject \$paths -Compress/u);
  assert.match(workflow, /\[System\.IO\.File\]::WriteAllText\(\$pathsFile, \$pathsJson, \$utf8NoBom\)/u);
  assert.match(workflow, /--paths \$pathsFile/u);
  assert.match(
    workflow,
    /static\.mjs --paths \$\{\{ steps\.trusted-maintenance\.outputs\.maintenance_temp \}\}\/maintenance-changed-paths\.json/u,
  );
  assert.doesNotMatch(workflow, /Set-Content maintenance-changed-paths\.json/u);
  assert.match(workflow, /\$\{\{ steps\.trusted-maintenance\.outputs\.maintenance_temp \}\}\/maintenance-plan\.json/u);
  assert.match(workflow, /Remove-Item -LiteralPath \$maintenanceTemp -Recurse -Force/u);
});

test("maintenance static proof scopes formatter, lint, and TypeScript closure to declared paths", async () => {
  const plan = await buildStaticCommandPlan({
    root: process.cwd(),
    changedPaths: [
      "tests/sounding-line/v14/verification-maintenance.test.mjs",
      "testing/generated/p34-retirement-ledger.json",
    ],
    fileInfo: async (file) => ({ inferredParser: file.endsWith(".mjs") ? "babel" : null }),
  });
  assert.equal(plan.scoped, true);
  assert.deepEqual(plan.formatterPaths, ["tests/sounding-line/v14/verification-maintenance.test.mjs"]);
  assert.deepEqual(plan.lintPaths, ["tests/sounding-line/v14/verification-maintenance.test.mjs"]);
  assert.deepEqual(plan.commands[0].slice(2), ["--check", "tests/sounding-line/v14/verification-maintenance.test.mjs"]);
  assert.deepEqual(plan.commands[1].slice(2), ["tests/sounding-line/v14/verification-maintenance.test.mjs"]);
  assert.equal(
    plan.commands.some((command) => command.includes("node_modules/typescript/bin/tsc")),
    false,
  );
  const typedPlan = await buildStaticCommandPlan({
    root: process.cwd(),
    changedPaths: ["src/tideglass/core.ts"],
    fileInfo: async () => ({ inferredParser: "typescript" }),
  });
  assert.deepEqual(typedPlan.typecheckPaths, ["src/tideglass/core.ts"]);
  assert.deepEqual(typedPlan.commands[2].slice(1, 3), ["scripts/sounding-line/scoped-typecheck.mjs", "--paths-base64"]);
  assert.equal(
    Buffer.from(typedPlan.commands[2][3], "base64").toString("utf8"),
    JSON.stringify(["src/tideglass/core.ts"]),
  );
  await assert.rejects(
    buildStaticCommandPlan({ root: process.cwd(), changedPaths: ["../outside.ts"] }),
    /STATIC_CHANGED_PATHS_INVALID/u,
  );
});

test("routine maintenance keeps every sealed qualification artifact runner-owned", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/sounding-line-verification-maintenance.yml", import.meta.url),
    "utf8",
  );
  for (const artifact of [
    "trusted-maintenance-policy.json",
    "trusted-verification-maintenance.mjs",
    "maintenance-changed-paths.json",
    "maintenance-plan.json",
    "maintenance-evidence.json",
    "maintenance-finalization.json",
  ]) {
    assert.match(workflow, new RegExp(`Join-Path \\$maintenanceTemp '${artifact.replace(/\./gu, "\\.")}'`, "u"));
  }
  assert.doesNotMatch(workflow, /--out maintenance-plan\.json/u);
  assert.doesNotMatch(workflow, /--out maintenance-finalization\.json/u);
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const productRegistrationPolicy = {
  ...policy,
  ordinaryCandidateEligiblePathGlobs: ["src/**", "tests/**"],
  ordinaryCandidateProductVerificationRegistration: {
    classification: "PRODUCT_WITH_VERIFICATION_REGISTRATION",
    pathGlobs: [
      "testing/contracts.json",
      "testing/impact-map.json",
      "testing/suites.json",
      "testing/file-dispositions.json",
      "testing/generated/active-test-registry.json",
      "playwright*.config.*",
      "scripts/sounding-line/test-registry.mjs",
    ],
    semanticPathGlobs: [
      "testing/contracts.json",
      "testing/impact-map.json",
      "testing/suites.json",
      "testing/file-dispositions.json",
      "playwright*.config.*",
      "scripts/sounding-line/test-registry.mjs",
    ],
    ancillaryPathGlobs: ["Development_Docs/Project_*.md", "Development_Docs/Features/catalog/**"],
    sourceBoundFeatureCatalogReconciliationPathGlobs: ["Development_Docs/Features/branch-complete/*.json"],
    playwrightConfigPathGlobs: ["playwright*.config.*"],
    testRegistrySourcePathGlobs: ["scripts/sounding-line/test-registry.mjs"],
    semanticOwnership: "TRUSTED_OWNERSHIP_OR_TRUSTED_DISCOVERY_DESCRIPTOR",
    monotonicity: "NO_FOREIGN_MUTATION_OR_REMOVAL",
  },
};
const registrationFixture = () => {
  const trustedRegistries = {
    ownership: {
      owners: [
        {
          id: "project-aurora",
          sourcePaths: ["src/aurora/**"],
          testPaths: ["tests/aurora/**"],
          contractIds: ["aurora.base"],
        },
      ],
    },
    contracts: {
      contracts: [{ id: "aurora.base", authority: "project-aurora", owners: ["project-aurora"], critical: true }],
    },
    suites: { suites: [{ id: "unit.aurora", owner: "project-aurora", contracts: ["aurora.base"], tier: 1 }] },
    impactMap: {
      pathMappings: [{ path: "src/aurora/**", suiteIds: ["unit.aurora"], contractIds: ["aurora.base"] }],
      contractMappings: [{ contractId: "aurora.base", suiteIds: ["unit.aurora"] }],
    },
    fileDispositions: { rules: [{ match: "src/other/**", owner: "project-other", suiteId: "unit.other" }] },
    activeTestRegistry: {
      generated: true,
      cases: [
        {
          semanticId: "other-stable",
          id: "other-id",
          owner: "project-other",
          suiteId: "unit.other",
          contracts: ["other.base"],
          browserRequirements: ["NOT_APPLICABLE"],
        },
      ],
    },
    playwrightConfig: 'projects: [{ name: "chromium" }]',
    testRegistrySource: "trusted generator source",
  };
  const candidateRegistries = clone(trustedRegistries);
  candidateRegistries.contracts.contracts.push({
    id: "aurora.detail",
    authority: "project-aurora",
    owners: ["project-aurora"],
    critical: true,
  });
  candidateRegistries.suites.suites[0].contracts.push("aurora.detail");
  candidateRegistries.suites.suites.push({
    id: "browser.aurora",
    owner: "project-aurora",
    contracts: ["aurora.detail"],
    tier: 4,
  });
  candidateRegistries.impactMap.pathMappings[0].suiteIds.push("browser.aurora");
  candidateRegistries.impactMap.pathMappings[0].contractIds.push("aurora.detail");
  candidateRegistries.impactMap.contractMappings.push({
    contractId: "aurora.detail",
    suiteIds: ["unit.aurora", "browser.aurora"],
  });
  candidateRegistries.fileDispositions.rules.push({
    match: "tests/aurora-phase2.spec.ts",
    owner: "project-aurora",
    suiteId: "browser.aurora",
  });
  candidateRegistries.activeTestRegistry.cases.push({
    semanticId: "aurora-detail",
    id: "aurora-id",
    owner: "project-aurora",
    suiteId: "browser.aurora",
    contracts: ["aurora.detail"],
    browserRequirements: ["aurora-chromium"],
  });
  candidateRegistries.playwrightConfig = 'projects: [{ name: "chromium" }, { name: "aurora-chromium" }]';
  candidateRegistries.testRegistrySource = "candidate generator source";
  return { trustedRegistries, candidateRegistries };
};
const productPaths = [
  "src/aurora/detail.ts",
  "tests/aurora/detail.test.ts",
  "testing/contracts.json",
  "testing/impact-map.json",
  "testing/suites.json",
  "testing/file-dispositions.json",
  "testing/generated/active-test-registry.json",
  "playwright.config.ts",
  "scripts/sounding-line/test-registry.mjs",
  "Development_Docs/Project_Aurora_Phase_2.md",
  "Development_Docs/Features/catalog/aurora.json",
];
const featureCatalogReconciliation = ({
  id = "FT-AURORA",
  title = "Aurora verification registration",
  program = "Project Aurora Phase 2",
  evidence = [{ kind: "path", value: "src/aurora/detail.ts" }],
  branch = "codex/project-aurora-phase2",
} = {}) => {
  const trusted = {
    id,
    title,
    program,
    status: "BRANCH_COMPLETE_NOT_MERGED",
    evidence,
    branch,
    commit: "a".repeat(40),
    limitations: ["Branch completion is distinct from protected-main availability."],
    catalogVersion: 1,
  };
  const candidate = clone(trusted);
  candidate.status = "MAINLINE";
  candidate.limitations = ["Protected-main source integration is distinct from deployment acceptance."];
  delete candidate.branch;
  delete candidate.commit;
  return { trusted, candidate };
};
const classifyProductRegistration = (overrides = {}) => {
  const fixture = registrationFixture();
  return classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: productPaths,
    ...fixture,
    ...overrides,
  });
};
const crossOwnedRegistrationFixture = ({
  primaryId = "drydock",
  primaryPath = "src/drydock/new-contract.ts",
  primaryContractId = "drydock.authoring",
  supportingDescriptor = {
    id: "project-shipwright",
    sourcePaths: ["src/app/studio/**"],
    testPaths: [],
    contractIds: [],
    supportingOwnerIds: ["drydock"],
  },
} = {}) => {
  const trustedRegistries = {
    ownership: {
      owners: [
        {
          id: primaryId,
          sourcePaths: [primaryPath.replace(/\/[^/]+$/u, "/**")],
          testPaths: [],
          contractIds: [primaryContractId],
        },
      ],
    },
    contracts: { contracts: [{ id: primaryContractId, authority: primaryId, owners: [primaryId], critical: true }] },
    suites: {
      suites: [
        { id: `unit.${primaryId}`, owner: primaryId, contracts: [primaryContractId], tier: 1 },
        ...(supportingDescriptor
          ? [{ id: "unit.shipwright", owner: supportingDescriptor.id, contracts: [], tier: 1 }]
          : []),
      ],
    },
    impactMap: { pathMappings: [], contractMappings: [] },
    fileDispositions: { rules: [] },
    activeTestRegistry: { generated: true, cases: [] },
    playwrightConfig: "",
    testRegistrySource: "trusted generator source",
  };
  const candidateRegistries = clone(trustedRegistries);
  candidateRegistries.contracts.contracts.push({
    id: `${primaryContractId}.new`,
    authority: primaryId,
    owners: [primaryId],
    critical: true,
  });
  if (supportingDescriptor)
    candidateRegistries.activeTestRegistry.cases.push({
      semanticId: "shipwright-supported-case",
      id: "shipwright-supported-case-id",
      owner: supportingDescriptor.id,
      suiteId: "unit.shipwright",
      contracts: [],
      browserRequirements: ["NOT_APPLICABLE"],
    });
  return {
    trustedRegistries,
    candidateRegistries,
    trustedProjectDescriptors: supportingDescriptor ? [supportingDescriptor] : [],
  };
};
const classifyCrossOwnedRegistration = (overrides = {}) => {
  const fixture = crossOwnedRegistrationFixture();
  return classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: [
      "src/drydock/new-contract.ts",
      "src/app/studio/drydock-panel.ts",
      "testing/contracts.json",
      "testing/generated/active-test-registry.json",
    ],
    ...fixture,
    ...overrides,
  });
};

test("generic product verification registration admits a bounded owned product shape", () => {
  const result = classifyProductRegistration();
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.equal(result.registration.ownerId, "project-aurora");
  assert.deepEqual(result.errors, []);
});

test("product registration admits a generic trusted source-bound branch-complete reconciliation", () => {
  const path = "Development_Docs/Features/branch-complete/project-aurora-phase2.json";
  const result = classifyProductRegistration({
    changedPaths: [...productPaths, path],
    featureCatalogReconciliations: { [path]: featureCatalogReconciliation() },
  });
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.deepEqual(result.errors, []);
});

test("the exact Drydock branch-complete reconciliation can accompany a valid product registration", async () => {
  const path = "Development_Docs/Features/branch-complete/project-drydock-phase3.json";
  const trusted = JSON.parse(
    await readFile(
      new URL("../../../Development_Docs/Features/branch-complete/project-drydock-phase3.json", import.meta.url),
      "utf8",
    ),
  );
  const candidate = clone(trusted);
  candidate.status = "MAINLINE";
  candidate.limitations[0] =
    "Protected-main source integration was accepted through PR #52; deployment and owner acceptance remain separate from source integration.";
  delete candidate.branch;
  delete candidate.commit;
  const fixture = crossOwnedRegistrationFixture();
  const result = classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: [
      "src/drydock/new-contract.ts",
      "src/app/studio/drydock-panel.ts",
      "testing/contracts.json",
      "testing/generated/active-test-registry.json",
      path,
    ],
    ...fixture,
    featureCatalogReconciliations: { [path]: { trusted, candidate } },
  });
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.deepEqual(result.errors, []);
});

test("source-bound branch-complete admission rejects arbitrary JSON and untrusted lookalikes", () => {
  const arbitraryPath = "Development_Docs/Features/unrelated.json";
  const arbitrary = classifyProductRegistration({ changedPaths: [...productPaths, arbitraryPath] });
  assert.equal(arbitrary.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.ok(arbitrary.errors.includes(`ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED:${arbitraryPath}`));

  const untrustedPath = "Development_Docs/Features/branch-complete/project-rogue-phase2.json";
  const untrusted = classifyProductRegistration({
    changedPaths: [...productPaths, untrustedPath],
    featureCatalogReconciliations: {
      [untrustedPath]: featureCatalogReconciliation({
        id: "FT-ROGUE",
        title: "Rogue bypass",
        program: "Project Rogue Phase 2",
        evidence: [{ kind: "path", value: "src/rogue/bypass.ts" }],
        branch: "codex/project-rogue-phase2",
      }),
    },
  });
  assert.equal(untrusted.classification, "PRODUCT_VERIFICATION_REGISTRATION_REJECTED");
  assert.ok(
    untrusted.errors.includes(
      `PRODUCT_VERIFICATION_REGISTRATION_FEATURE_CATALOG_RECONCILIATION_UNTRUSTED:${untrustedPath}`,
    ),
  );
});

test("source-bound reconciliation cannot accompany an ownership mutation", () => {
  const path = "Development_Docs/Features/branch-complete/project-aurora-phase2.json";
  const fixture = registrationFixture();
  fixture.candidateRegistries.ownership.owners.push({
    id: "project-rogue",
    sourcePaths: ["src/rogue/**"],
    testPaths: [],
    contractIds: [],
  });
  const result = classifyProductRegistration({
    ...fixture,
    changedPaths: [...productPaths, path],
    featureCatalogReconciliations: { [path]: featureCatalogReconciliation() },
  });
  assert.equal(result.classification, "PRODUCT_VERIFICATION_REGISTRATION_REJECTED");
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_OWNERSHIP_MUTATION"));
});

test("a sole trusted Drydock contract authority outranks compatible Shipwright Studio support", () => {
  const result = classifyCrossOwnedRegistration();
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.equal(result.registration.ownerId, "drydock");
  assert.deepEqual(result.errors, []);
});

test("a sole trusted Shipwright contract remains primary without a supporting descriptor", () => {
  const fixture = crossOwnedRegistrationFixture({
    primaryId: "project-shipwright",
    primaryPath: "src/app/studio/new-contract.ts",
    primaryContractId: "shipwright.authoring",
    supportingDescriptor: null,
  });
  const result = classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: ["src/app/studio/new-contract.ts", "testing/contracts.json"],
    ...fixture,
  });
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.equal(result.registration.ownerId, "project-shipwright");
});

test("a unique new authority remains fail-closed when it is untrusted, unsupported, unmapped, or self-authorized", () => {
  const untrusted = crossOwnedRegistrationFixture();
  untrusted.candidateRegistries.contracts.contracts.at(-1).authority = "project-rogue";
  untrusted.candidateRegistries.contracts.contracts.at(-1).owners = ["project-rogue"];
  assert.ok(
    classifyCrossOwnedRegistration(untrusted).errors.includes(
      "PRODUCT_VERIFICATION_REGISTRATION_NEW_CONTRACT_AUTHORITY_UNTRUSTED",
    ),
  );

  const unsupported = crossOwnedRegistrationFixture({
    supportingDescriptor: {
      id: "project-shipwright",
      sourcePaths: ["src/app/studio/**"],
      testPaths: [],
      contractIds: [],
      supportingOwnerIds: [],
    },
  });
  assert.ok(
    classifyCrossOwnedRegistration(unsupported).errors.includes(
      "PRODUCT_VERIFICATION_REGISTRATION_SUPPORTING_OWNER_REQUIRED:project-shipwright",
    ),
  );

  const unmapped = classifyCrossOwnedRegistration({
    changedPaths: ["src/drydock/new-contract.ts", "src/unmapped/new-contract.ts", "testing/contracts.json"],
  });
  assert.ok(
    unmapped.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_PATH_UNMAPPED:src/unmapped/new-contract.ts"),
  );

  const selfAuthorized = crossOwnedRegistrationFixture({
    supportingDescriptor: {
      id: "project-shipwright",
      sourcePaths: ["src/app/studio/**"],
      testPaths: [],
      contractIds: [],
      supportingOwnerIds: [],
    },
  });
  selfAuthorized.trustedRegistries.trustedProjectDiscovery = { projects: [] };
  selfAuthorized.candidateRegistries.trustedProjectDiscovery = {
    projects: [{ id: "project-shipwright", supportingOwnerIds: ["drydock"] }],
  };
  assert.ok(
    classifyCrossOwnedRegistration(selfAuthorized).errors.includes(
      "PRODUCT_VERIFICATION_REGISTRATION_TRUSTED_DISCOVERY_MUTATION",
    ),
  );
});

test("competing new contract authorities remain ambiguous", () => {
  const fixture = crossOwnedRegistrationFixture();
  fixture.candidateRegistries.contracts.contracts.push({
    id: "shipwright.competing",
    authority: "project-shipwright",
    owners: ["project-shipwright"],
    critical: true,
  });
  const result = classifyCrossOwnedRegistration(fixture);
  assert.equal(result.classification, "PRODUCT_VERIFICATION_REGISTRATION_REJECTED");
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_AMBIGUOUS"));
});

test("registration-only evidence against an existing trusted contract admits with a unique trusted owner", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.contracts = clone(fixture.trustedRegistries.contracts);
  fixture.candidateRegistries.suites.suites[0].contracts = ["aurora.base"];
  fixture.candidateRegistries.suites.suites[1].contracts = ["aurora.base"];
  fixture.candidateRegistries.impactMap.pathMappings[0].contractIds = ["aurora.base"];
  fixture.candidateRegistries.impactMap.contractMappings = [
    { contractId: "aurora.base", suiteIds: ["unit.aurora", "browser.aurora"] },
  ];
  fixture.candidateRegistries.activeTestRegistry.cases.at(-1).contracts = ["aurora.base"];
  const result = classifyProductRegistration(fixture);
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  assert.equal(result.registration.ownerId, "project-aurora");
});

test("registration-only admission fails closed for conflicting owners, foreign evidence, removed suites, and unowned contracts", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.contracts = clone(fixture.trustedRegistries.contracts);
  fixture.candidateRegistries.suites.suites[0].contracts = ["aurora.base"];
  fixture.candidateRegistries.suites.suites[1].contracts = ["other.base"];
  fixture.candidateRegistries.impactMap.pathMappings[0].contractIds = ["aurora.base"];
  fixture.candidateRegistries.impactMap.contractMappings = [
    { contractId: "aurora.base", suiteIds: ["unit.aurora", "browser.aurora"] },
  ];
  fixture.candidateRegistries.activeTestRegistry.cases.at(-1).contracts = ["other.base"];
  const unowned = classifyProductRegistration(fixture);
  assert.ok(
    unowned.errors.some(
      (entry) => entry.includes("SUITE_CONTRACT_INVALID") || entry.includes("REGISTRY_OWNER_INVALID"),
    ),
  );

  const removed = registrationFixture();
  removed.candidateRegistries.suites.suites = [];
  assert.ok(classifyProductRegistration(removed).errors.some((entry) => entry.includes("SUITE_REMOVED")));

  const conflict = registrationFixture();
  conflict.trustedRegistries.ownership.owners.push({
    id: "project-nebula",
    sourcePaths: ["src/nebula/**"],
    testPaths: [],
    contractIds: ["nebula.base"],
  });
  conflict.candidateRegistries.ownership = clone(conflict.trustedRegistries.ownership);
  conflict.candidateRegistries.contracts = clone(conflict.trustedRegistries.contracts);
  const result = classifyProductRegistration({ ...conflict, changedPaths: [...productPaths, "src/nebula/detail.ts"] });
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_CONFLICT"));
});

test("product registration requires a real owned product source change", () => {
  const result = classifyProductRegistration({
    changedPaths: productPaths.filter((file) => !file.startsWith("src/aurora/")),
  });
  assert.equal(result.classification, "PRODUCT_VERIFICATION_REGISTRATION_REJECTED");
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PRODUCT_OWNER_UNRESOLVED"));
});

test("product registration does not admit authority-changing files", () => {
  const result = classifyProductRegistration({
    changedPaths: [...productPaths, "testing/verification-maintenance-policy.json"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED");
});

test("product registration rejects mutations to existing contracts", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.contracts.contracts[0].critical = false;
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_CONTRACT_MUTATION:aurora.base"));
});

test("product registration permits only owned monotonic suite extensions", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.suites.suites[0].tier = 4;
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_SUITE_MUTATION:unit.aurora"));
});

test("product registration permits an owned suite to add only its affected test paths", () => {
  const fixture = registrationFixture();
  fixture.trustedRegistries.suites.suites[0].affectedPaths = ["src/aurora/**"];
  fixture.candidateRegistries.suites.suites[0].affectedPaths = ["src/aurora/**", "tests/aurora/detail.test.ts"];
  const result = classifyProductRegistration(fixture);
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
});

test("product registration permits only explicitly governed shared documentation suites", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.impactMap.pathMappings.push({
    path: "Development_Docs/Project_Aurora_Phase_2.md",
    suiteIds: ["unit.aurora", "static.core"],
    contractIds: ["aurora.detail"],
  });
  const allowed = classifyProductRegistration({
    ...fixture,
    trustedPolicy: {
      ...productRegistrationPolicy,
      ordinaryCandidateProductVerificationRegistration: {
        ...productRegistrationPolicy.ordinaryCandidateProductVerificationRegistration,
        sharedVerificationSuiteIds: ["static.core"],
      },
    },
  });
  assert.equal(allowed.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
  const denied = classifyProductRegistration(fixture);
  assert.ok(
    denied.errors.includes(
      "PRODUCT_VERIFICATION_REGISTRATION_IMPACT_OWNER_INVALID:pathMappings:Development_Docs/Project_Aurora_Phase_2.md",
    ),
  );
});

test("product registration permits a changed trusted cross-project source to add only its own evidence", () => {
  const fixture = registrationFixture();
  fixture.trustedRegistries.ownership.owners.push({
    id: "project-wayfinder",
    sourcePaths: ["src/wayfinder/**"],
    testPaths: [],
    contractIds: ["wayfinder.history"],
  });
  fixture.trustedRegistries.suites.suites.push({
    id: "unit.wayfinder",
    owner: "project-wayfinder",
    contracts: ["wayfinder.history"],
    tier: 1,
  });
  fixture.candidateRegistries.ownership = clone(fixture.trustedRegistries.ownership);
  fixture.candidateRegistries.suites.suites.push({
    id: "unit.wayfinder",
    owner: "project-wayfinder",
    contracts: ["wayfinder.history"],
    tier: 1,
  });
  fixture.candidateRegistries.activeTestRegistry.cases.push({
    semanticId: "wayfinder-proof",
    id: "wayfinder-id",
    owner: "project-wayfinder",
    suiteId: "unit.wayfinder",
    contracts: ["wayfinder.history"],
    browserRequirements: ["NOT_APPLICABLE"],
  });
  const result = classifyProductRegistration({
    ...fixture,
    changedPaths: [...productPaths, "src/wayfinder/projection.ts"],
  });
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
});

test("product registration rejects impact-map removal or foreign impact coverage", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.impactMap.pathMappings = [];
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_IMPACT_REMOVED:pathMappings:src/aurora/**"));
});

test("product registration rejects foreign generated-registry mutation", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.activeTestRegistry.cases[0].suiteId = "browser.aurora";
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_REGISTRY_MUTATION:other-stable"));
});

test("product registration rejects a generated case owned by another project", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.activeTestRegistry.cases.at(-1).owner = "project-other";
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_REGISTRY_OWNER_INVALID:aurora-detail"));
});

test("product registration binds a new Playwright project to an owned browser case", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.activeTestRegistry.cases.at(-1).browserRequirements = ["NOT_APPLICABLE"];
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_PLAYWRIGHT_PROJECT_UNBOUND"));
});

test("product registration requires a corresponding test-registry source change", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.testRegistrySource = fixture.trustedRegistries.testRegistrySource;
  const result = classifyProductRegistration(fixture);
  assert.ok(result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_TEST_REGISTRY_SOURCE_UNCHANGED"));
});

test("product registration rejects a foreign file-disposition addition", () => {
  const fixture = registrationFixture();
  fixture.candidateRegistries.fileDispositions.rules.at(-1).owner = "project-other";
  const result = classifyProductRegistration(fixture);
  assert.ok(
    result.errors.includes("PRODUCT_VERIFICATION_REGISTRATION_DISPOSITION_OWNER_INVALID:tests/aurora-phase2.spec.ts"),
  );
});

test("ordinary product candidates keep their existing non-registration classification", () => {
  const result = classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: ["src/aurora/detail.ts"],
  });
  assert.equal(result.classification, "ORDINARY_CANDIDATE");
  assert.deepEqual(result.errors, []);
});

test("unknown paths and empty diffs remain fail-closed outside the registration category", () => {
  const unknown = classifyOrdinaryCandidate({
    trustedPolicy: productRegistrationPolicy,
    changedPaths: ["unowned/aurora.ts"],
  });
  const empty = classifyOrdinaryCandidate({ trustedPolicy: productRegistrationPolicy, changedPaths: [] });
  assert.equal(unknown.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
  assert.equal(empty.classification, "ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED");
});

test("a trusted discovery descriptor can supply the same bounded ownership semantics", () => {
  const fixture = registrationFixture();
  fixture.trustedRegistries.ownership.owners = [];
  fixture.candidateRegistries.ownership = clone(fixture.trustedRegistries.ownership);
  const result = classifyProductRegistration({
    ...fixture,
    trustedProjectDescriptor: {
      id: "project-aurora",
      sourcePaths: ["src/aurora/**"],
      testPaths: [],
      contractIds: ["aurora.base"],
    },
  });
  assert.equal(result.classification, "PRODUCT_WITH_VERIFICATION_REGISTRATION");
});

test("candidate and train admission share the same trusted classifier entrypoint", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/sounding-line-mainline-train.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /verification-maintenance\.mjs ordinary --policy testing\/verification-maintenance-policy\.json/u,
  );
  assert.doesNotMatch(workflow, /function Test-TrustedGlob/u);
});
