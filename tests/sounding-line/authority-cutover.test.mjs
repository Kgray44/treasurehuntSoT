import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalize } from "../../scripts/sounding-line/finalizer.mjs";
import { buildPlan } from "../../scripts/sounding-line/planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("planner is deterministic and rejects archived P34 suites", async () => {
  const first = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha" });
  const second = await buildPlan({ root, gateId: "local-change", sourceSha: "test-sha" });
  assert.equal(first.planDigest, second.planDigest);
  assert.ok(first.nodes.every((node) => !node.id.toLowerCase().includes("p34")));
  const mainline = await buildPlan({ root, gateId: "mainline", sourceSha: "test-sha" });
  assert.ok(mainline.nodes.some((node) => node.id === "build.production"));
  assert.ok(mainline.nodes.some((node) => node.id === "browser.auth"));
  assert.ok(mainline.nodes.some((node) => node.id === "browser.player-journal"));
});

test("only the finalizer produces an accepted decision from source-bound clean receipts", () => {
  const plan = {
    sourceSha: "abc",
    policyDigest: "policy",
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
        planDigest: "plan",
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
        planDigest: "plan",
        cleanupState: "CLEAN",
        result: "PASSED",
      },
    ],
  });
  assert.equal(invalid.decision, "EVIDENCE_INVALID");
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
