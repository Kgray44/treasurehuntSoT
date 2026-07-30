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
  assert.equal(mainline.nodes.find((node) => node.id === "harborlight.phase4.unit").execution.mode, "parallel");
  assert.ok(
    mainline.nodes.every(
      (node) => !["browser.auth", "browser.player-journal", "compatibility.browser"].includes(node.id),
    ),
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
});

test("concurrent Harborlight lanes may share only their validation-run parent", async () => {
  const common = await readFile(path.join(root, "scripts", "dev-common.ps1"), "utf8");
  assert.match(common, /New-Item -ItemType Directory -Path \$resolvedParent -Force -ErrorAction Stop/u);
  assert.match(common, /Validation runtime destination already exists and is not owned by this new run/u);
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
