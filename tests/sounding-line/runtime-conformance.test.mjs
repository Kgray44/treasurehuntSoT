import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPlan } from "../../scripts/sounding-line/planner.mjs";
import { finalize } from "../../scripts/sounding-line/finalizer.mjs";
import { CONFORMANCE_CODES, deriveWorkerPreparation } from "../../scripts/sounding-line/worker-preparation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("effective v1.2 authority is discoverable and policy-owned", async () => {
  const authority = JSON.parse(await readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"));
  assert.equal(authority.authority, "SOUNDING_LINE");
  assert.deepEqual(authority.effectiveAmendments, { partI: "1.2", partII: "1.2", partIII: "1.2" });
  assert.equal(authority.requiredProtectedAuthorityCheck, "Sounding Line / Mainline Decision");
  assert.equal(authority.runtimeConformance.required, true);
  assert.equal(authority.futureProjectInheritance, true);
});

test("resource-aware preparation eliminates universal database and browser setup", () => {
  const pure = deriveWorkerPreparation({ id: "static.core", adapter: "static", resources: ["node-slot"] });
  assert.equal(pure.runtimeConformance.result, "PASSED");
  assert.equal(pure.actions.prismaGenerate, false);
  assert.equal(pure.actions.databaseMigration, false);
  assert.equal(pure.actions.databaseSeed, false);
  assert.deepEqual(pure.actions.browserEngines, []);

  const database = deriveWorkerPreparation({
    id: "database.sqlite",
    adapter: "sqlite-validate",
    resources: ["sqlite-clone", "prisma-sqlite-client"],
  });
  assert.equal(database.actions.prismaGenerate, true);
  assert.equal(database.actions.databaseMigration, true);
  assert.equal(database.actions.databaseSeed, true);

  const chromium = deriveWorkerPreparation({
    id: "browser.chromium-only",
    adapter: "playwright-family",
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
  });
  assert.deepEqual(chromium.actions.browserEngines, ["chromium"]);
  const webkit = deriveWorkerPreparation({
    id: "browser.webkit-only",
    adapter: "playwright-family",
    resources: ["application-port", "sqlite-clone", "browser-webkit", "trace-root"],
  });
  assert.deepEqual(webkit.actions.browserEngines, ["webkit"]);

  const nodeBrowser = deriveWorkerPreparation({
    id: "unit.sounding-line",
    adapter: "node-test-browser-family",
    resources: ["node-slot", "application-port", "browser-chromium"],
  });
  assert.equal(nodeBrowser.runtimeConformance.result, "PASSED");
  assert.deepEqual(nodeBrowser.actions.browserEngines, ["chromium"]);
});

test("conformance fails closed for missing adapter resources and undeclared browser engines", () => {
  const missingDatabase = deriveWorkerPreparation({
    id: "invalid-db",
    adapter: "sqlite-validate",
    resources: ["node-slot"],
  });
  assert.equal(missingDatabase.runtimeConformance.result, "FAILED");
  assert.equal(missingDatabase.runtimeConformance.violations[0].code, CONFORMANCE_CODES.resourceScope);
  const overprovisioned = deriveWorkerPreparation({
    id: "invalid-static",
    adapter: "static",
    resources: ["node-slot", "browser-chromium"],
  });
  assert.equal(overprovisioned.runtimeConformance.result, "FAILED");
  assert.equal(overprovisioned.runtimeConformance.violations[0].code, CONFORMANCE_CODES.overprovisioning);
});

test("hosted planning serializes only actual shared resources while retaining dependencies", async () => {
  const plan = await buildPlan({ root, gateId: "mainline", sourceSha: "conformance-test" });
  assert.equal(plan.runtimeConformanceRequired, true);
  assert.equal(plan.nodes.find((node) => node.id === "database.sqlite").execution.mode, "parallel");
  assert.equal(plan.nodes.find((node) => node.id === "build.production").execution.mode, "parallel");
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(plan.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
});

test("finalizer rejects missing or invalid runtime-conformance evidence", () => {
  const plan = {
    sourceSha: "source",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    planDigest: "plan",
    authorityDigest: "authority",
    gate: "mainline",
    runtimeConformanceRequired: true,
    nodes: [{ id: "static.core" }],
  };
  const receipt = {
    suiteId: "static.core",
    sourceSha: "source",
    policyDigest: "policy",
    inventoryDigest: "inventory",
    planDigest: "plan",
    gate: "mainline",
    cleanupState: "CLEAN",
    exitCode: 0,
    timedOut: false,
    result: "PASSED",
  };
  assert.equal(finalize({ plan, receipts: [receipt] }).decision, "EVIDENCE_INVALID");
  assert.equal(
    finalize({
      plan,
      receipts: [receipt],
      runtimeConformance: [
        { suiteId: "static.core", planDigest: "plan", authorityDigest: "authority", result: "PASSED" },
      ],
    }).decision,
    "RELEASE_GO",
  );
});
