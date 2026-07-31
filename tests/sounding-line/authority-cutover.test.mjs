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
  assert.equal(mainline.nodes.find((node) => node.id === "database.sqlite").execution.mode, "exclusive");
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
  const registry = JSON.parse(await readFile(path.join(root, "testing", "generated", "active-test-registry.json"), "utf8"));
  const sentinelCases = registry.cases.filter((entry) => entry.suiteId === "browser.access-sentinel");
  assert.equal(sentinelCases.length, 3);
  assert.ok(sentinelCases.every((entry) => entry.project === "sounding-line-access-sentinel"));
  assert.equal(registry.cases.filter((entry) => entry.suiteId === "browser.auth").length, 8);
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

test("the protected main PR emits the stable authority decision while focused repair remains evidence-only", async () => {
  const authoritative = await readFile(
    path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"),
    "utf8",
  );
  const focused = await readFile(path.join(root, ".github", "workflows", "sounding-line-focused-repair.yml"), "utf8");
  const pullRequestBranches = authoritative.match(
    /pull_request:\s*\n\s+branches:\s*\n(?<branches>(?:\s+-\s+[^\n]+\n)+)/u,
  )?.groups?.branches;

  assert.ok(pullRequestBranches, "authoritative workflow must run for pull requests");
  assert.deepEqual(
    [...pullRequestBranches.matchAll(/^\s+-\s+([^\s#]+).*$/gmu)].map((match) => match[1]),
    ["main"],
    "only pull requests targeting main may trigger authority",
  );
  assert.match(authoritative, /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+gate:/u);
  assert.match(authoritative, /options: \[mainline, release-candidate\]/u);
  assert.match(authoritative, /Sounding Line \/ \$\{\{ needs\.plan\.outputs\.gate/u);
  assert.match(authoritative, /gate: \$\{\{ needs\.plan\.outputs\.gate \}\}/u);
  assert.match(focused, /--execute-only/u);
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
  assert.match(runtime, /if \(\$isSoundingLineLane\) \{[\s\S]*--global-timeout=420000/u);
  assert.match(runtime, /GOVERNED_BROWSER_DISCOVERY_MISMATCH/u);
  assert.match(runtime, /runner\/console encoded/u);
  assert.match(runtime, /BrowserSelectionsBase64/u);
  const authority = await readFile(path.join(root, "scripts", "sounding-line", "authority.mjs"), "utf8");
  assert.match(authority, /definition\.title\.split\("\\u203a"\)\.at\(-1\)\.trim\(\)/u);
});

test("concurrent Harborlight lanes may share only their validation-run parent", async () => {
  const common = await readFile(path.join(root, "scripts", "dev-common.ps1"), "utf8");
  assert.match(common, /New-Item -ItemType Directory -Path \$resolvedParent -Force -ErrorAction Stop/u);
  assert.match(common, /Validation runtime destination already exists and is not owned by this new run/u);
});

test("governed workers consume the sealed plan and fail closed on missing receipts", async () => {
  const worker = await readFile(path.join(root, ".github", "workflows", "sounding-line-governed-worker.yml"), "utf8");
  assert.doesNotMatch(worker, /continue-on-error:\s*true\s*\n\s*run: node scripts\/sounding-line\/authority/u);
  assert.match(worker, /path: \$\{\{ runner\.temp \}\}\/sounding-line-plan/u);
  assert.match(worker, /--plan-in "\$env:SOUNDING_LINE_PLAN"/u);
  assert.match(worker, /GOVERNED_WORKER_RECEIPT_MISSING/u);
  assert.match(worker, /GOVERNED_WORKER_RECEIPT_FAILED/u);
  assert.match(worker, /inputs\.gate/u);
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
