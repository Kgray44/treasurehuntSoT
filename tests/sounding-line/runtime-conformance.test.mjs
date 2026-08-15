import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildPlan } from "../../scripts/sounding-line/planner.mjs";
import { finalize } from "../../scripts/sounding-line/finalizer.mjs";
import { selectFocusedSuite } from "../../scripts/sounding-line/focused-selection.mjs";
import { CONFORMANCE_CODES, deriveWorkerPreparation } from "../../scripts/sounding-line/worker-preparation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const correctiveV13Candidate = {
  authorityMode: "V13_CUTOVER",
  githubRef: "refs/heads/codex/sounding-line-v14-corrective-activation",
  qualifiedBaseSha: "1ebc702d57de63d74c9f80d82a11051446e7b12e",
};

function workflowTriggers(source) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^on:\s*/u.test(line));
  assert.notEqual(start, -1, "WORKFLOW_TRIGGER_BLOCK_MISSING");
  const triggers = [lines[start]];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[^\s#]/u.test(line)) break;
    triggers.push(line);
  }
  return triggers.join("\n");
}

function hasOrdinaryDevelopmentTrigger(triggers) {
  if (/\bpull_request\b/u.test(triggers)) return true;
  const push = triggers.match(/(?:^|\n)\s{2}push:\s*([^\n]*)([\s\S]*?)(?=\n\s{2}[\w-]+:|$)/u);
  if (!push) return /^on:\s*(?:push|\[[^\]]*\bpush\b[^\]]*\])/mu.test(triggers);
  if (push[1].trim()) return true;
  const pushOptions = push[2];
  const hasBranchFilter = /^\s{4}branches(?:-ignore)?:/mu.test(pushOptions);
  const hasTagFilter = /^\s{4}tags(?:-ignore)?:/mu.test(pushOptions);
  return hasBranchFilter || !hasTagFilter;
}

function isHeavyweightRepositoryClosure(source) {
  if (/record-only-closure\.mjs/u.test(source) && /Record-only classification/u.test(source)) return false;
  if (/^name:\s*.*(?:authoritative|final closure|full closure|finalization)\s*$/imu.test(source)) return true;
  if (/finalize-ci\.mjs|finalizer\.mjs/u.test(source)) return true;
  const broadClosureSignals = [
    /\bnpm test\b/u,
    /\bnpm run test:policy\b/u,
    /\bnpm run test:inventory\b/u,
    /\bnpm run typecheck\b/u,
    /\bnpm run format:check\b/u,
    /\bnpm run lint\b/u,
    /\bnpm run docs:validate\b/u,
    /\bnpm run features:validate\b/u,
    /\bnpm run architecture:validate\b/u,
    /\bnpm run private-content:scan\b/u,
    /\bnpm run build\b/u,
  ];
  return broadClosureSignals.filter((signal) => signal.test(source)).length >= 5;
}

test("effective authority and the development/finalization boundary are discoverable and policy-owned", async () => {
  const authority = JSON.parse(await readFile(path.join(root, "testing", "sounding-line-authority.json"), "utf8"));
  assert.equal(authority.authority, "SOUNDING_LINE");
  assert.equal(authority.currentAuthorityVersion, "1.4");
  assert.deepEqual(authority.effectiveAmendments, { partI: "1.2", partII: "1.2", partIII: "1.3", crossPart: "1.4" });
  assert.equal(authority.pendingV14, undefined);
  assert.deepEqual(authority.effectiveV14, {
    documentId: "CS-SL-XP-001 v1.4-R1",
    documentSha256: "4D9DE559A24A7A2A8427171EAB679CCD423A1E9BE94FA104CF10B3D14AA31211",
    activation: "OWNER_AUTHORIZED_CORRECTIVE_PROTECTED_MAINLINE_MERGE",
    historicalAtomicCutoverRequirement: "NOT_SATISFIED_HISTORICALLY",
    protectedHistory: "PRESERVED",
  });
  assert.equal(authority.requiredProtectedAuthorityCheck, "Sounding Line / Mainline Decision");
  assert.equal(authority.runtimeConformance.required, true);
  assert.deepEqual(authority.developmentValidation, {
    incrementalVerificationRequired: true,
    authoritativeDebuggingForbidden: true,
    focusedRepairRequiredBeforeReacceptance: true,
    authoritativeInvocation: "EXPLICIT_FROZEN_CANDIDATE_ONLY",
  });
  assert.equal(authority.futureProjectInheritance, true);
});

test("active agent guidance requires the testing workflow contract", async () => {
  for (const relativePath of ["AGENTS.md", path.join(".agents", "README.md")]) {
    const guidance = await readFile(path.join(root, relativePath), "utf8");
    assert.match(
      guidance,
      /\.agents\/testing-workflow\.md|testing-workflow\.md/u,
      "DEVELOPMENT_TESTING_CONTRACT_MISSING",
    );
  }
  const contract = await readFile(path.join(root, ".agents", "testing-workflow.md"), "utf8");
  for (const heading of ["Development verification", "Candidate qualification", "Authoritative acceptance"])
    assert.match(contract, new RegExp(`## [A-C]\\. ${heading}`, "u"), "DEVELOPMENT_TESTING_CONTRACT_MISSING");
});

test("focused selection accepts every sealed node and rejects unknown suites", async () => {
  for (const gateId of ["mainline", "release-candidate"]) {
    const plan = await buildPlan({ root, gateId, sourceSha: "focused-selection-test", ...correctiveV13Candidate });
    for (const node of plan.nodes) assert.equal(selectFocusedSuite(plan, node.id).suiteId, node.id);
  }
  const projectPlan = {
    gate: "mainline",
    sourceSha: "wakebook-source",
    planDigest: "wakebook-plan",
    nodes: [
      {
        id: "browser.wakebook",
        adapter: "playwright-family",
        resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
      },
    ],
  };
  assert.equal(selectFocusedSuite(projectPlan, "browser.wakebook").suiteId, "browser.wakebook");
  assert.throws(
    () => selectFocusedSuite(projectPlan, "browser.unknown"),
    /FOCUSED_SUITE_NOT_REGISTERED/u,
    "FOCUSED_SUITE_NOT_REGISTERED",
  );
});

test("focused selection fails closed when sealed-node resources are invalid", () => {
  const invalidPlan = {
    gate: "mainline",
    sourceSha: "invalid-source",
    planDigest: "invalid-plan",
    nodes: [{ id: "browser.invalid", adapter: "playwright-family", resources: ["application-port"] }],
  };
  assert.throws(
    () => selectFocusedSuite(invalidPlan, "browser.invalid"),
    /FOCUSED_RESOURCE_SCOPE_VIOLATION/u,
    "FOCUSED_RESOURCE_SCOPE_VIOLATION",
  );
});

test("focused hosted execution delegates resource preparation and has no release authority", async () => {
  const focused = await readFile(path.join(root, ".github", "workflows", "sounding-line-focused-repair.yml"), "utf8");
  assert.match(focused, /uses: \.\/\.github\/workflows\/sounding-line-governed-worker\.yml/u);
  assert.doesNotMatch(
    focused,
    /prisma migrate|db:seed|playwright install|finalize-ci\.mjs|finalizer\.mjs|RELEASE_GO/u,
    "FOCUSED_RELEASE_AUTHORITY_FORBIDDEN",
  );
  assert.match(focused, /focused-selection\.mjs/u);
  assert.match(focused, /type: string/u);
  assert.doesNotMatch(focused, /type: choice[\s\S]*?browser\.access-sentinel/u);
});

test("heavyweight repository closure and finalization workflows require explicit dispatch", async () => {
  const workflowDirectory = path.join(root, ".github", "workflows");
  const workflowFiles = (await readdir(workflowDirectory)).filter((file) => /\.ya?ml$/u.test(file));
  const violations = [];
  let heavyweightCount = 0;

  for (const file of workflowFiles) {
    const source = await readFile(path.join(workflowDirectory, file), "utf8");
    if (!isHeavyweightRepositoryClosure(source)) continue;
    heavyweightCount += 1;
    const triggers = workflowTriggers(source);
    if (!/\bworkflow_dispatch\b/u.test(triggers)) violations.push(`${file}:EXPLICIT_DISPATCH_MISSING`);
    if (hasOrdinaryDevelopmentTrigger(triggers)) violations.push(`${file}:ORDINARY_DEVELOPMENT_TRIGGER_FORBIDDEN`);
  }

  assert.ok(heavyweightCount > 0, "HEAVYWEIGHT_WORKFLOW_POLICY_UNEXERCISED");
  assert.deepEqual(violations, [], "HEAVYWEIGHT_WORKFLOW_MUST_BE_EXPLICIT_DISPATCH_ONLY");
});

test("resource-aware preparation eliminates universal database and browser setup", async () => {
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

  const suites = JSON.parse(await readFile(path.join(root, "testing", "suites.json"), "utf8")).suites;
  const tideglass = suites.find((suite) => suite.id === "unit.tideglass");
  assert.ok(tideglass?.resources.includes("prisma-sqlite-client"));
  assert.equal(deriveWorkerPreparation(tideglass).actions.prismaGenerate, true);

  const admiralty = suites.find((suite) => suite.id === "browser.admiralty");
  assert.equal(deriveWorkerPreparation(admiralty).runtimeConformance.result, "PASSED");
  assert.deepEqual(deriveWorkerPreparation(admiralty).actions.browserEngines, ["chromium"]);
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
  const plan = await buildPlan({ root, gateId: "mainline", sourceSha: "conformance-test", ...correctiveV13Candidate });
  assert.equal(plan.runtimeConformanceRequired, true);
  assert.equal(plan.nodes.find((node) => node.id === "database.sqlite").execution.mode, "parallel");
  assert.equal(plan.nodes.find((node) => node.id === "build.production").execution.mode, "parallel");
  for (const node of plan.nodes)
    for (const dependency of node.dependencies)
      assert.ok(plan.nodes.find((candidate) => candidate.id === dependency).execution.wave < node.execution.wave);
});

test("empty exclusive matrices retain dependency-ready hosted work without skipped callers", async () => {
  const workflow = await readFile(path.join(root, ".github", "workflows", "sounding-line-authoritative.yml"), "utf8");
  assert.match(
    workflow,
    /wave-0-complete:[\s\S]*?EXCLUSIVE_MATRIX:[\s\S]*?exclusiveIntentionallyEmpty[\s\S]*?SOUNDING_LINE_WAVE_0_PREREQUISITES_INVALID/u,
  );
  assert.match(
    workflow,
    /governed-exclusive-wave-0:[\s\S]*?matrix: \$\{\{ fromJSON\(needs\.plan\.outputs\.exclusive0\) \}\}/u,
  );
  assert.match(workflow, /governed-parallel-wave-1:[\s\S]*?needs: \[plan, wave-0-complete\]/u);
  assert.match(
    workflow,
    /wave-1-complete:[\s\S]*?EXCLUSIVE_MATRIX:[\s\S]*?exclusiveIntentionallyEmpty[\s\S]*?SOUNDING_LINE_WAVE_1_PREREQUISITES_INVALID/u,
  );
  assert.match(
    workflow,
    /governed-exclusive-wave-1:[\s\S]*?matrix: \$\{\{ fromJSON\(needs\.plan\.outputs\.exclusive1\) \}\}/u,
  );
  assert.match(workflow, /governed-parallel-wave-2:[\s\S]*?needs: \[plan, wave-1-complete\]/u);
  assert.match(
    workflow,
    /governed-exclusive-wave-2:[\s\S]*?matrix: \$\{\{ fromJSON\(needs\.plan\.outputs\.exclusive2\) \}\}/u,
  );
  assert.doesNotMatch(workflow, /exclusive[0-5]Present == 'true'/u);
  assert.doesNotMatch(workflow, /needs\.\*\.result/u);
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
