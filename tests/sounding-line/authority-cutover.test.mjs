import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalize } from "../../scripts/sounding-line/finalizer.mjs";
import { buildPlan } from "../../scripts/sounding-line/planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const execute = promisify(execFile);

test("planner is deterministic and rejects archived P34 suites", async () => {
  const first = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha" });
  const second = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha" });
  assert.equal(first.planDigest, second.planDigest);
  assert.ok(first.nodes.every((node) => !node.id.toLowerCase().includes("p34")));
  const mainline = await buildPlan({ root, gateId: "mainline", sourceSha: "test-sha" });
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
  const releaseCandidate = await buildPlan({ root, gateId: "release-candidate", sourceSha: "test-sha" });
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
  assert.match(authoritative, /authority_mode:[\s\S]*?options: \[current, v13-cutover\]/u);
  assert.match(authoritative, /SOUNDING_LINE_V13_CUTOVER_MAINLINE_ONLY/u);
  assert.match(authoritative, /SOUNDING_LINE_AUTHORITY_MODE_INVALID/u);
  assert.match(authoritative, /authorityMode=\$\(if \(\$authorityMode -eq 'v13-cutover'\)/u);
  assert.match(authoritative, /candidate_sha:[\s\S]*?required: true[\s\S]*?type: string/u);
  assert.match(authoritative, /SOUNDING_LINE_FROZEN_CANDIDATE_SHA_MISMATCH/u);
  assert.match(authoritative, /sourceSha:process\.env\.GITHUB_SHA/u);
  assert.match(authoritative, /qualifiedBaseSha:process\.env\.SOUNDING_LINE_BASE_SHA/u);
  assert.match(authoritative, /authorityMode:process\.env\.SOUNDING_LINE_AUTHORITY_MODE/u);
  assert.match(authoritative, /Sounding Line \/ \$\{\{ needs\.plan\.outputs\.gate/u);
  assert.match(authoritative, /gate: \$\{\{ needs\.plan\.outputs\.gate \}\}/u);
  assert.match(focused, /type: string/u);
  assert.match(focused, /focused-selection\.mjs/u);
  assert.match(focused, /uses: \.\/\.github\/workflows\/sounding-line-governed-worker\.yml/u);
  assert.doesNotMatch(focused, /finalize-ci\.mjs|finalizer\.mjs|Sounding Line \/ Mainline Decision|RELEASE_GO/u);
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
