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

test("candidate authority invokes the trusted ordinary classifier rather than inline glob logic", async () => {
  const workflow = await readFile(
    new URL("../../../.github/workflows/sounding-line-authoritative.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    workflow,
    /git show "\$env:SOUNDING_LINE_BASE_SHA`:scripts\/sounding-line\/verification-maintenance\.mjs" > trusted-verification-maintenance\.mjs/u,
  );
  assert.match(
    workflow,
    /node trusted-verification-maintenance\.mjs ordinary --policy trusted-maintenance-policy\.json --paths ordinary-candidate-changed-paths\.json --out ordinary-candidate-classification\.json/u,
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
