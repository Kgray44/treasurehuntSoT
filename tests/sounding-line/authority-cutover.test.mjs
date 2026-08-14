import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalize } from "../../scripts/sounding-line/finalizer.mjs";
import { buildPlan, resolvePlanAuthority } from "../../scripts/sounding-line/planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const execute = promisify(execFile);
const correctiveV13Candidate = {
  authorityMode: "V13_CUTOVER",
  githubRef: "refs/heads/codex/sounding-line-v14-corrective-activation",
  qualifiedBaseSha: "1ebc702d57de63d74c9f80d82a11051446e7b12e",
};

test("planner is deterministic and rejects archived P34 suites", async () => {
  const first = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha", ...correctiveV13Candidate });
  const second = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha", ...correctiveV13Candidate });
  assert.equal(first.planDigest, second.planDigest);
  assert.ok(first.nodes.every((node) => !node.id.toLowerCase().includes("p34")));
  const mainline = await buildPlan({ root, gateId: "mainline", sourceSha: "test-sha", ...correctiveV13Candidate });
  assert.ok(mainline.nodes.some((node) => node.id === "build.production"));
  assert.ok(mainline.nodes.some((node) => node.id === "browser.access-sentinel"));
  for (const node of mainline.nodes)
    for (const dependency of node.dependencies)
      assert.ok(mainline.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
  assert.equal(mainline.nodes.find((node) => node.id === "database.sqlite").execution.mode, "parallel");
  assert.equal(mainline.nodes.find((node) => node.id === "build.production").execution.mode, "parallel");
  assert.equal(mainline.nodes.find((node) => node.id === "unit.community").execution.mode, "parallel");
  assert.ok(
    mainline.nodes.every(
      (node) => !["browser.auth", "browser.player-journal", "compatibility.browser"].includes(node.id),
    ),
  );
  const releaseCandidate = await buildPlan({
    root,
    gateId: "release-candidate",
    sourceSha: "test-sha",
    ...correctiveV13Candidate,
  });
  const requiredBrowserSuites = [
    "browser.access-sentinel",
    "browser.auth",
    "browser.invitations",
    "browser.player-library",
    "browser.player-journal",
    "browser.passport",
    "browser.artifacts",
    "browser.captain",
    "browser.studio",
    "browser.community",
    "browser.private-operations",
    "browser.navigation",
    "browser.accessibility",
    "browser.responsive",
    "browser.animation-lifecycle",
    "browser.cross-project",
  ];
  for (const suiteId of requiredBrowserSuites) assert.ok(releaseCandidate.nodes.some((node) => node.id === suiteId));
  const registry = JSON.parse(
    await readFile(path.join(root, "testing", "generated", "active-test-registry.json"), "utf8"),
  );
  const sentinelCases = registry.cases.filter((entry) => entry.suiteId === "browser.access-sentinel");
  assert.equal(sentinelCases.length, 3);
  assert.ok(sentinelCases.every((entry) => entry.project === "sounding-line-access-sentinel"));
  assert.equal(registry.cases.filter((entry) => entry.suiteId === "browser.auth").length, 8);
  assert.equal(registry.cases.filter((entry) => entry.suiteId === "browser.navigation").length, 2);
});

test("a corrective v1.4 candidate remains on the broad v1.3 plan only when explicitly dispatched for cutover", async () => {
  const plan = await buildPlan({
    root,
    gateId: "mainline",
    sourceSha: "test-sha",
    qualifiedBaseSha: "1ebc702d57de63d74c9f80d82a11051446e7b12e",
    authorityMode: "V13_CUTOVER",
    githubRef: "refs/heads/codex/sounding-line-v14-corrective-activation",
  });
  assert.equal(plan.version, 2);
  assert.equal(plan.nodes.length, 38);
});

test("corrective activation preserves v1.3 candidate authority and enables v1.4 only on protected main", async () => {
  const authorityIndex = JSON.parse(await readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"));
  const candidateRef = "refs/heads/codex/sounding-line-v14-corrective-activation";
  assert.equal(
    resolvePlanAuthority({
      authorityIndex,
      gateId: "mainline",
      authorityMode: "V13_CUTOVER",
      githubRef: candidateRef,
      qualifiedBaseSha: "1ebc702d57de63d74c9f80d82a11051446e7b12e",
    }),
    "V13_CUTOVER",
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex,
        gateId: "mainline",
        authorityMode: "V13_CUTOVER",
        githubRef: "refs/heads/main",
        qualifiedBaseSha: "1ebc702d57de63d74c9f80d82a11051446e7b12e",
      }),
    /V13_CUTOVER_FORBIDDEN_AFTER_V14_ACTIVATION/u,
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex,
        gateId: "mainline",
        authorityMode: "V13_CUTOVER",
        githubRef: candidateRef,
        qualifiedBaseSha: "0055d012a121a8950b7fa70d371d5eafc6223d10",
      }),
    /V13_CUTOVER_FORBIDDEN_AFTER_V14_ACTIVATION/u,
  );
  assert.throws(
    () =>
      resolvePlanAuthority({ authorityIndex, gateId: "mainline", authorityMode: "CURRENT", githubRef: candidateRef }),
    /V14_CURRENT_AUTHORITY_REQUIRES_PROTECTED_MAIN/u,
  );
  assert.equal(
    resolvePlanAuthority({
      authorityIndex,
      gateId: "mainline",
      authorityMode: "CURRENT",
      githubRef: "refs/heads/main",
    }),
    "V14_CURRENT",
  );
  assert.equal(
    resolvePlanAuthority({
      authorityIndex,
      gateId: "mainline",
      authorityMode: "V14_CANDIDATE",
      githubRef: "refs/heads/main",
      qualifiedBaseSha: "b173b34fdce46c1a6d029c9955e946a1d5156b63",
    }),
    "V14_CANDIDATE",
  );
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex,
        gateId: "mainline",
        authorityMode: "V14_CANDIDATE",
        githubRef: candidateRef,
        qualifiedBaseSha: "b173b34fdce46c1a6d029c9955e946a1d5156b63",
      }),
    /V14_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED/u,
  );
});

test("ordinary V14_CANDIDATE planning uses the impact-selected v1.4 mainline path without claiming CURRENT", async () => {
  const sourceSha = (await execute("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();
  const qualifiedBaseSha = (await execute("git", ["rev-parse", "HEAD^"], { cwd: root })).stdout.trim();
  const authorityIndex = JSON.parse(await readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"));
  const plan = await buildPlan({
    root,
    gateId: "mainline",
    sourceSha,
    qualifiedBaseSha,
    authorityMode: "V14_CANDIDATE",
    githubRef: "refs/heads/main",
  });
  assert.equal(plan.version, 14);
  assert.equal(plan.authorityMode, "V14_CANDIDATE");
  assert.equal(plan.authorityBoundary, "V14_CANDIDATE_QUALIFICATION");
  assert.equal(plan.sourceSha, sourceSha);
  assert.equal(plan.qualifiedBaseSha, qualifiedBaseSha);
  assert.match(plan.candidateTreeSha, /^[0-9a-f]{40}$/u);
  assert.match(plan.qualifiedBaseTreeSha, /^[0-9a-f]{40}$/u);
  assert.match(plan.predictedIntegrationTreeSha, /^[0-9a-f]{40}$/u);
  assert.ok(plan.semanticPlanDigest);
  assert.throws(
    () =>
      resolvePlanAuthority({
        authorityIndex,
        gateId: "mainline",
        authorityMode: "V14_CANDIDATE",
        githubRef: "refs/heads/ordinary-feature",
        qualifiedBaseSha,
      }),
    /V14_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED/u,
  );
});

test("only the finalizer produces an accepted decision from source-bound clean receipts", () => {
  const plan = {
    sourceSha: "abc",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    planDigest: "plan",
    gate: "mainline",
    nodes: [{ id: "static.core" }],
  };
  const accepted = finalize({
    plan,
    receipts: [
      {
        suiteId: "static.core",
        sourceSha: "abc",
        policyDigest: "policy",
        inventoryDigest: "inventory",
        planDigest: "plan",
        gate: "mainline",
        cleanupState: "CLEAN",
        exitCode: 0,
        timedOut: false,
        result: "PASSED",
      },
    ],
  });
  assert.equal(accepted.decision, "RELEASE_GO");
  const invalid = finalize({
    plan,
    receipts: [
      {
        suiteId: "static.core",
        sourceSha: "wrong",
        policyDigest: "policy",
        inventoryDigest: "inventory",
        planDigest: "plan",
        gate: "mainline",
        cleanupState: "CLEAN",
        exitCode: 0,
        timedOut: false,
        result: "PASSED",
      },
    ],
  });
  assert.equal(invalid.decision, "EVIDENCE_INVALID");
  const duplicate = finalize({
    plan,
    receipts: [
      {
        suiteId: "static.core",
        sourceSha: "abc",
        policyDigest: "policy",
        inventoryDigest: "inventory",
        planDigest: "plan",
        gate: "mainline",
        cleanupState: "CLEAN",
        exitCode: 0,
        timedOut: false,
        result: "PASSED",
      },
      {
        suiteId: "static.core",
        sourceSha: "abc",
        policyDigest: "policy",
        inventoryDigest: "inventory",
        planDigest: "plan",
        gate: "mainline",
        cleanupState: "CLEAN",
        exitCode: 0,
        timedOut: false,
        result: "PASSED",
      },
    ],
  });
  assert.equal(duplicate.decision, "EVIDENCE_INVALID");
  const shadow = finalize({
    plan: {
      ...plan,
      authorityVersion: "1.4",
      authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE",
    },
    receipts: accepted.receipts,
  });
  assert.equal(shadow.decision, "EVIDENCE_INVALID");
  assert.deepEqual(shadow.invalidEvidence, ["ORDINARY_RELEASE_AUTHORITY_BOUNDARY_INVALID"]);
});

test("v1.4 acceptance envelopes seal only the exact candidate-qualification boundary", async (t) => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sounding-line-envelope-"));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const planPath = path.join(workspace, "plan.json");
  const finalizationPath = path.join(workspace, "finalization.json");
  const outputPath = path.join(workspace, "envelope.json");
  const plan = {
    authorityVersion: "1.4",
    authorityMode: "V14_CANDIDATE",
    authorityBoundary: "V14_CANDIDATE_QUALIFICATION",
    sourceSha: "a".repeat(40),
    qualifiedBaseTreeSha: "b".repeat(40),
    planDigest: "plan",
  };
  const finalization = {
    authority: "SOUNDING_LINE_FINALIZER",
    decision: "RELEASE_GO",
    planDigest: "plan",
    receipts: [],
  };
  await Promise.all([
    writeFile(planPath, `${JSON.stringify(plan)}\n`, "utf8"),
    writeFile(finalizationPath, `${JSON.stringify(finalization)}\n`, "utf8"),
  ]);
  await execute(
    process.execPath,
    [
      "scripts/sounding-line/create-acceptance-envelope.mjs",
      "--plan",
      planPath,
      "--finalization",
      finalizationPath,
      "--pr-number",
      "113",
      "--base-sha",
      "c".repeat(40),
      "--run-id",
      "1",
      "--out",
      outputPath,
    ],
    { cwd: root },
  );
  assert.equal(JSON.parse(await readFile(outputPath, "utf8")).candidateSha, plan.sourceSha);
  await writeFile(
    planPath,
    `${JSON.stringify({ ...plan, authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE" })}\n`,
    "utf8",
  );
  await assert.rejects(
    execute(
      process.execPath,
      [
        "scripts/sounding-line/create-acceptance-envelope.mjs",
        "--plan",
        planPath,
        "--finalization",
        finalizationPath,
        "--pr-number",
        "113",
        "--base-sha",
        "c".repeat(40),
        "--run-id",
        "1",
        "--out",
        outputPath,
      ],
      { cwd: root },
    ),
    /ACCEPTANCE_ENVELOPE_V14_CANDIDATE_BOUNDARY_REQUIRED/u,
  );
});

test("focused suite execution is evidence-only and cannot invoke authority", async () => {
  await assert.rejects(
    execute(process.execPath, ["scripts/sounding-line/authority.mjs", "mainline", "--suite", "static.core"], {
      cwd: root,
    }),
    /FOCUSED_SUITE_EXECUTION_IS_NONAUTHORITATIVE/u,
  );
});

test("authoritative acceptance is explicit frozen-candidate finalization while focused repair remains evidence-only", async () => {
  const authoritative = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"),
    "utf8",
  );
  const focused = await readFile(path.join(root, ".github", "workflows", "sounding-line-focused-repair.yml"), "utf8");
  assert.doesNotMatch(authoritative, /^\s{2}(?:pull_request|push):/mu, "AUTHORITATIVE_DEBUG_TRIGGER_FORBIDDEN");
  assert.match(authoritative, /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+gate:/u);
  assert.match(authoritative, /options: \[mainline, release-candidate\]/u);
  assert.match(authoritative, /authority_mode:[\s\S]*?options: \[current, candidate, v13-cutover\]/u);
  assert.match(authoritative, /SOUNDING_LINE_V13_CUTOVER_MAINLINE_ONLY/u);
  assert.match(authoritative, /SOUNDING_LINE_AUTHORITY_MODE_INVALID/u);
  assert.match(authoritative, /authorityMode=\$\(if \(\$authorityMode -eq 'v13-cutover'\)/u);
  assert.match(authoritative, /candidate_sha:[\s\S]*?required: true[\s\S]*?type: string/u);
  assert.match(authoritative, /candidate_ref:[\s\S]*?type: string/u);
  assert.match(
    authoritative,
    /group: sounding-line-authoritative-\$\{\{ github\.workflow \}\}-\$\{\{ inputs\.candidate_sha \}\}/u,
  );
  assert.match(authoritative, /SOUNDING_LINE_FROZEN_CANDIDATE_SHA_MISMATCH/u);
  assert.match(authoritative, /SOUNDING_LINE_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED/u);
  assert.match(authoritative, /SOUNDING_LINE_CANDIDATE_REF_HEAD_MISMATCH/u);
  assert.match(authoritative, /SOUNDING_LINE_ORDINARY_CANDIDATE_AUTHORITY_CHANGE_REJECTED/u);
  assert.match(authoritative, /SOUNDING_LINE_ORDINARY_CANDIDATE_UNKNOWN_SCOPE_REJECTED/u);
  assert.match(
    authoritative,
    /if \(\$prNumber -and -not \$baseSha\) \{ throw "SOUNDING_LINE_ACCEPTANCE_ENVELOPE_BASE_REQUIRED" \}/u,
    "CURRENT_PROTECTED_MAIN_MAY_BIND_A_BASE_WITHOUT_A_PR_ENVELOPE",
  );
  assert.doesNotMatch(
    authoritative,
    /SOUNDING_LINE_ACCEPTANCE_ENVELOPE_IDENTITY_PAIR_REQUIRED/u,
    "CURRENT_PROTECTED_MAIN_BASE_MUST_NOT_BE_REJECTED_FOR_LACK_OF_PR",
  );
  assert.match(
    authoritative,
    /if \(\$authorityMode -eq 'v13-cutover' -and \(-not \$prNumber -or -not \$baseSha\)\) \{ throw "SOUNDING_LINE_V13_CUTOVER_ACCEPTANCE_ENVELOPE_REQUIRED" \}/u,
    "V13_CUTOVER_ENVELOPE_REMAINS_REQUIRED",
  );
  assert.match(authoritative, /sourceSha:process\.env\.SOUNDING_LINE_CANDIDATE_SHA/u);
  assert.match(
    authoritative,
    /SOUNDING_LINE_GATE: \$\{\{ steps\.gate\.outputs\.value \}\}\s*\n\s*SOUNDING_LINE_BASE_SHA: \$\{\{ steps\.base\.outputs\.value \}\}/u,
    "V14_CURRENT_AUTHORITY_MUST_FORWARD_RESOLVED_QUALIFIED_BASE",
  );
  assert.match(authoritative, /qualifiedBaseSha:process\.env\.SOUNDING_LINE_BASE_SHA/u);
  assert.match(authoritative, /authorityMode:process\.env\.SOUNDING_LINE_AUTHORITY_MODE/u);
  const planner = await readFile(path.join(root, "scripts", "sounding-line", "planner.mjs"), "utf8");
  assert.match(planner, /V14_CURRENT_AUTHORITY_REQUIRES_PROTECTED_MAIN/u);
  assert.match(planner, /V14_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED/u);
  assert.match(authoritative, /Sounding Line \/ \$\{\{ needs\.plan\.outputs\.gate/u);
  assert.match(authoritative, /gate: \$\{\{ needs\.plan\.outputs\.gate \}\}/u);
  assert.match(focused, /type: string/u);
  assert.match(focused, /focused-selection\.mjs/u);
  assert.match(focused, /uses: \.\/\.github\/workflows\/sounding-line-governed-worker\.yml/u);
  assert.doesNotMatch(focused, /finalize-ci\.mjs|finalizer\.mjs|Sounding Line \/ Mainline Decision|RELEASE_GO/u);
  const binding = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-protected-merge-binding.yml"),
    "utf8",
  );
  assert.match(binding, /V14_CANDIDATE is deliberately dispatched from trusted main/u);
  assert.match(binding, /sounding-line-acceptance-envelope/u);
  assert.match(binding, /sounding-line-train-acceptance-envelope/u);
  assert.match(binding, /sounding-line-mainline-train\.yml/u);
  assert.match(binding, /envelope\.candidateSha -eq \$env:CANDIDATE_SHA/u);
  assert.match(binding, /qualified-base to[\s\S]*?current-base interval itself/u);
});

test("BrowserOnly Harborlight lanes do not repeat independent broad gates", async () => {
  const runtime = await readFile(
    path.join(root, "scripts", "sounding-line", "isolated-validation-runtime.ps1"),
    "utf8",
  );
  assert.match(
    runtime,
    /if \(-not \$BrowserOnly\) \{[\s\S]*Running unit tests[\s\S]*Verifying additive platform backfill[\s\S]*\n    \}\n    \[void\]\(Invoke-IsolationHelper -Arguments @\("checkpoint"/u,
  );
  assert.match(runtime, /SOUNDING_LINE_SUITE_HARD_BUDGET_MS/u);
  assert.match(runtime, /--global-timeout=\$browserGlobalTimeoutMs/u);
  assert.match(runtime, /GOVERNED_BROWSER_DISCOVERY_MISMATCH/u);
  assert.match(runtime, /runner\/console encoded/u);
  assert.match(runtime, /Preparing focused browser legacy playthrough fixture/u);
  assert.match(runtime, /Verifying focused browser legacy playthrough fixture/u);
  assert.match(runtime, /Migrating focused browser legacy compatibility projection/u);
  assert.match(runtime, /BrowserSelectionsBase64/u);
  assert.match(runtime, /\(\?:spec\|setup\)\\\.ts/u);
  assert.match(runtime, /Last identity probe: \$lastIdentityProbe/u);
  assert.match(runtime, /Server stderr tail: \$serverErrorTail/u);
  const authority = await readFile(path.join(root, "scripts", "sounding-line", "authority.mjs"), "utf8");
  assert.match(authority, /definition\.title\.split\("\\u203a"\)\.at\(-1\)\.trim\(\)/u);
  assert.match(authority, /\(\?:spec\|setup\)\\\.ts/u);
  assert.match(authority, /FOREVER_DEPENDENCY_SEED_ROOT: root/u);
  assert.match(authority, /SOUNDING_LINE_SUITE_HARD_BUDGET_MS: String\(suite\.hardBudgetMs\)/u);
  const common = await readFile(path.join(root, "scripts", "dev-common.ps1"), "utf8");
  assert.match(common, /function Copy-ForeverDependencySeed/u);
  assert.match(common, /robocopy \$seedModules \$runtimeModules \/E \/XJ \/COPY:DAT/u);
  assert.match(common, /dir \/a:l \/s \/b/u);
  assert.match(common, /New-Item -ItemType Junction/u);
  assert.match(common, /retainedSourceJunctions/u);
  assert.match(common, /TrimEnd\(\[char\]92, \[char\]47\)/u);
  assert.match(common, /rmdir \/s \/q/u);
  assert.match(common, /junction target escaped the seed root/u);
  assert.match(common, /lockfile does not match the isolated runtime/u);
  assert.match(common, /A physical copy retains Next's runtime-local \.next/u);
});

test("concurrent Harborlight lanes may share only their validation-run parent", async () => {
  const common = await readFile(path.join(root, "scripts", "dev-common.ps1"), "utf8");
  assert.match(common, /New-Item -ItemType Directory -Path \$resolvedParent -Force -ErrorAction Stop/u);
  assert.match(common, /Validation runtime destination already exists and is not owned by this new run/u);
});

test("governed workers consume the sealed plan and fail closed on missing receipts", async () => {
  const worker = await readFile(path.join(root, ".github", "workflows", "sounding-line-governed-worker.yml"), "utf8");
  const adapters = await readFile(path.join(root, "scripts", "sounding-line", "adapters.mjs"), "utf8");
  assert.doesNotMatch(worker, /continue-on-error:\s*true\s*\n\s*run: node scripts\/sounding-line\/authority/u);
  assert.match(worker, /path: \$\{\{ runner\.temp \}\}\/sounding-line-plan/u);
  assert.match(worker, /--plan-in "\$env:SOUNDING_LINE_PLAN"/u);
  assert.match(worker, /GOVERNED_WORKER_RECEIPT_MISSING/u);
  assert.match(worker, /GOVERNED_WORKER_RECEIPT_FAILED/u);
  assert.match(worker, /Prepare only sealed-node resources/u);
  assert.match(worker, /worker-preparation\.mjs/u);
  assert.match(worker, /databaseMigrationMs/u);
  assert.match(worker, /browserRestoreMs/u);
  assert.match(worker, /dependencyRestoreMs/u);
  assert.match(worker, /Bind setup and execution timing to worker evidence/u);
  assert.match(worker, /Add-Member -NotePropertyName suiteExecutionMs/u);
  assert.doesNotMatch(worker, /\$throughput\.suiteExecutionMs =/u);
  assert.doesNotMatch(worker, /SOUNDING_LINE_SUITE -like 'browser\.\*'/u);
  assert.doesNotMatch(worker, /playwright install chromium webkit/u);
  assert.match(worker, /inputs\.gate/u);
  assert.match(worker, /ref: \$\{\{ inputs\.candidate_sha \}\}/u);
  assert.match(worker, /plan_artifact:[\s\S]*?default: sounding-line-plan/u);
  assert.match(worker, /prepared_artifact:[\s\S]*?default: sounding-line-prepared-dependency/u);
  assert.match(worker, /prepared_path:[\s\S]*?Relative prepared dependency-layer path/u);
  assert.match(worker, /receipt_artifact:[\s\S]*?unique artifact name/u);
  assert.match(worker, /execution_sha:[\s\S]*?sealed predicted integration commit/u);
  assert.match(worker, /GOVERNED_INTEGRATION_BUNDLE_FETCH_FAILED/u);
  assert.match(worker, /GOVERNED_WORKER_EXECUTION_CHECKOUT_MISMATCH/u);
  const trainWorkflow = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-mainline-train.yml"),
    "utf8",
  );
  assert.match(trainWorkflow, /name: Sounding Line mainline train/u);
  assert.match(trainWorkflow, /TRAIN_CANDIDATE_REF_HEAD_MISMATCH/u);
  assert.match(trainWorkflow, /issues\?state=open/u);
  assert.match(trainWorkflow, /Where-Object \{ \$null -ne \$_\.pull_request \}/u);
  assert.match(trainWorkflow, /mainline-train-cli\.mjs admit/u);
  assert.match(trainWorkflow, /mainline-train-prepare\.mjs/u);
  assert.match(trainWorkflow, /sounding-line-train-wave\.yml/u);
  assert.match(trainWorkflow, /Finalize exact predicted-tree candidate evidence/u);
  assert.match(trainWorkflow, /merge-train-qualifications\.mjs/u);
  assert.match(trainWorkflow, /Bind the first train head to its current protected merge identity/u);
  const advanceWorkflow = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-mainline-train-advance.yml"),
    "utf8",
  );
  assert.match(advanceWorkflow, /types: \[closed\]/u);
  assert.match(advanceWorkflow, /Compare actual protected-main tree/u);
  assert.match(advanceWorkflow, /Bind retained next head/u);
  assert.match(trainWorkflow, /TRAIN_LIVE_BOUNDARY_REQUIRED/u);
  assert.match(worker, /GOVERNED_WORKER_CANDIDATE_CHECKOUT_MISMATCH/u);
  assert.match(worker, /timeout-minutes: 120/u);
  assert.match(adapters, /taskkill", \["\/pid", String\(child\.pid\), "\/T", "\/F"\]/u);
  assert.match(adapters, /\(\?:spec\|setup\)\\\.ts/u);
});

test("public repository commands route through Sounding Line", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const required = [
    "test",
    "validate",
    "test:changed",
    "test:subsystem",
    "test:contract",
    "test:mainline",
    "test:release",
    "test:status",
    "test:follow",
    "test:cancel",
    "test:resume",
    "test:explain",
    "test:inventory",
    "test:policy",
    "test:new",
  ];
  for (const name of required) assert.match(manifest.scripts[name], /scripts\/sounding-line/u);
  assert.doesNotMatch(manifest.scripts.validate, /test-all\.ps1/u);
});
