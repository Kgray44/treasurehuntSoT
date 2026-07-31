#!/usr/bin/env node
/* Authoritative public-command boundary. Raw runners are deliberately absent. */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import {
  executeAdapter,
  resolveAdapter,
  resolveIsolatedBrowserFamilyAdapter,
  resolveVitestAdapter,
} from "./adapters.mjs";
import { finalize } from "./finalizer.mjs";
import { buildPlan } from "./planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const readJson = async (file) => {
  const content = await readFile(file);
  const text = content[0] === 0xff && content[1] === 0xfe ? content.toString("utf16le") : content.toString("utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
};

function suiteAdapter(suite, registry) {
  const definitions = registry.cases.filter((entry) => entry.suiteId === suite.id);
  if (suite.adapter === "vitest-family") {
    const files = [
      ...new Set(
        definitions.map((entry) => entry.file).filter((file) => /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/u.test(file)),
      ),
    ];
    if (!files.length) throw new Error(`EMPTY_FAMILY_SELECTION:${suite.id}`);
    if (files.every((file) => file.endsWith(".mjs")))
      return {
        id: "node-test-family",
        command: [process.execPath, "--test", ...files],
        resources: ["node-slot"],
        mode: "CERTIFIED",
      };
    return resolveVitestAdapter(files);
  }
  if (suite.adapter === "playwright-family") {
    const selections = new Map();
    for (const definition of definitions) {
      if (!definition.project || !/^tests\/e2e\/.*\.(?:spec|setup)\.ts$/u.test(definition.file) || !definition.title)
        throw new Error(`INVALID_BROWSER_FAMILY_SELECTION:${suite.id}`);
      const selection = selections.get(definition.project) ?? { project: definition.project, files: new Set(), titles: [] };
      selection.files.add(definition.file);
      // The registry records the readable full title path. Playwright's grep
      // evaluates that path with a runner-owned separator, so select the
      // exact leaf title while retaining the registry-selected spec files.
      selection.titles.push(definition.title.split("\u203a").at(-1).trim());
      selections.set(definition.project, selection);
    }
    if (!selections.size) throw new Error(`INVALID_BROWSER_FAMILY_SELECTION:${suite.id}`);
    const exactSelections = [...selections.values()].map((selection) => ({
      project: selection.project,
      files: [...selection.files].sort(),
      // Playwright matches the complete title path (including project and
      // describe ancestry). A suffix anchor selects the registered leaf title
      // exactly without discarding that immutable prefix.
      grep: `(?:${selection.titles.map(escapeRegex).join("|")})$`,
      caseCount: selection.titles.length,
    }));
    return resolveIsolatedBrowserFamilyAdapter(
      exactSelections,
      path.join(root, "prisma", "dev.db"),
      suite.id !== "browser.access-sentinel",
    );
  }
  if (suite.adapter === "powershell-family")
    throw new Error(`POWERSHELL_FAMILY_REQUIRES_OWNED_VALIDATION_ADAPTER:${suite.id}`);
  if (suite.adapter) return resolveAdapter(suite.adapter);
  if (Array.isArray(suite.testFiles) && suite.testFiles.length) return resolveVitestAdapter(suite.testFiles);
  throw new Error(`SUITE_HAS_NO_GOVERNED_ADAPTER:${suite.id}`);
}

async function loadSealedPlan(gateId, { serial, planPath } = {}) {
  if (!planPath) return buildPlan({ root, gateId, serial });
  const plan = await readJson(path.resolve(root, planPath));
  const { planDigest, ...unsignedPlan } = plan;
  if (!planDigest || planDigest !== digest(unsignedPlan)) throw new Error("SEALED_PLAN_DIGEST_MISMATCH");
  if (plan.authority !== "SOUNDING_LINE" || plan.gate !== gateId || plan.serial !== serial)
    throw new Error("SEALED_PLAN_BOUNDARY_MISMATCH");
  if (process.env.GITHUB_SHA && plan.sourceSha !== process.env.GITHUB_SHA)
    throw new Error("SEALED_PLAN_SOURCE_MISMATCH");
  // The plan job is the sole producer of generated inventory state. Workers
  // consume that sealed artifact and must not regenerate a divergent plan.
  // Policy remains source-bound at execution time; source SHA, plan digest,
  // inventory digest, and every receipt are checked by the finalizer.
  if (plan.policyDigest !== digest(await readJson(path.join(root, "testing", "policy-manifest.json"))))
    throw new Error("SEALED_PLAN_POLICY_MISMATCH");
  return plan;
}

async function run(gateId, { serial, executeOnly = false, receiptPath, suiteId, planPath } = {}) {
  const plan = await loadSealedPlan(gateId, { serial, planPath });
  if (suiteId && !plan.nodes.some((node) => node.id === suiteId))
    throw new Error(`SUITE_NOT_SELECTED_BY_PLAN:${suiteId}`);
  const [suites, registry] = await Promise.all([
    readJson(path.join(root, "testing", "suites.json")),
    readJson(path.join(root, "testing", "generated", "active-test-registry.json")),
  ]);
  const suiteMap = new Map(suites.suites.map((suite) => [suite.id, suite]));
  const receipts = [];
  const runtimeRoot = path.join(root, "artifacts", "sounding-line", "runs", process.env.GITHUB_RUN_ID ?? "local");
  for (const node of plan.nodes.filter((node) => !suiteId || node.id === suiteId)) {
    const suite = suiteMap.get(node.id);
    const adapter = suiteAdapter(suite, registry);
    const startedAt = new Date().toISOString();
    const adapterEnv = {};
    if (
      new Set([
        "sqlite-validate",
        "harborlight-sqlite",
        "playwright-access-sentinel",
        "playwright-family",
        "harborlight-browser-lanes",
        "build",
      ]).has(adapter.id)
    ) {
      const baseline = path.join(root, "prisma", "dev.db");
      await access(baseline);
      Object.assign(adapterEnv, { DATABASE_URL: `file:${baseline.replaceAll("\\", "/")}` });
    }
    if (adapter.id === "harborlight-browser-lanes") {
      const baseline = path.join(root, "prisma", "dev.db");
      await mkdir(runtimeRoot, { recursive: true });
      Object.assign(adapterEnv, {
        SOUNDING_LINE_BASELINE_DATABASE: baseline,
        SOUNDING_LINE_RUN_ROOT: runtimeRoot,
      });
    }
    if (adapter.id === "isolated-playwright-family") {
      Object.assign(adapterEnv, {
        SOUNDING_LINE_INTERNAL_RUNTIME: "1",
        FOREVER_DEPENDENCY_SEED_ROOT: root,
        SOUNDING_LINE_SUITE_HARD_BUDGET_MS: String(suite.hardBudgetMs),
      });
    }
    const result = await executeAdapter(adapter, { cwd: root, env: adapterEnv, timeoutMs: suite.hardBudgetMs });
    const browserCounts = suite.adapter === "playwright-family"
      ? {
          registeredCaseCount: node.testIds.length,
          discoveredCaseCount: adapter.caseCount,
          executedCaseCount: result.exitCode === 0 && !result.timedOut ? adapter.caseCount : null,
          passedCaseCount: result.exitCode === 0 && !result.timedOut ? adapter.caseCount : 0,
          failedCaseCount: result.exitCode === 0 && !result.timedOut ? 0 : null,
          skippedCaseCount: 0,
        }
      : {};
    receipts.push({
      suiteId: node.id,
      adapterId: adapter.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.parse(new Date().toISOString()) - Date.parse(startedAt),
      sourceSha: plan.sourceSha,
      policyDigest: plan.policyDigest,
      inventoryDigest: plan.inventoryDigest,
      planDigest: plan.planDigest,
      gate: plan.gate,
      cleanupState: "CLEAN",
      result: result.exitCode === 0 && !result.timedOut ? "PASSED" : "FAILED",
      ...browserCounts,
      ...result,
    });
  }
  const evidence = { version: 1, plan, receipts };
  if (receiptPath) await writeFile(path.resolve(root, receiptPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (executeOnly) {
    output(evidence);
    if (receipts.some((receipt) => receipt.result !== "PASSED")) process.exitCode = 1;
    return;
  }
  const result = finalize({ plan, receipts });
  output({ plan, finalization: result });
  process.exitCode = result.decision === "RELEASE_GO" ? 0 : 1;
}

const command = process.argv[2] ?? "local-change";
if (!new Set(["local-change", "mainline", "release-candidate", "subsystem", "contract"]).has(command))
  throw new Error(`UNKNOWN_AUTHORITY_COMMAND:${command}`);
const receiptIndex = process.argv.indexOf("--receipt-out");
const receiptPath = receiptIndex >= 0 ? process.argv[receiptIndex + 1] : undefined;
if (receiptIndex >= 0 && !receiptPath) throw new Error("RECEIPT_OUTPUT_PATH_REQUIRED");
const suiteIndex = process.argv.indexOf("--suite");
const suiteId = suiteIndex >= 0 ? process.argv[suiteIndex + 1] : undefined;
if (suiteIndex >= 0 && !suiteId) throw new Error("SUITE_ID_REQUIRED");
const planInputIndex = process.argv.indexOf("--plan-in");
const planPath = planInputIndex >= 0 ? process.argv[planInputIndex + 1] : undefined;
if (planInputIndex >= 0 && !planPath) throw new Error("SEALED_PLAN_PATH_REQUIRED");
if (suiteId && !process.argv.includes("--execute-only")) throw new Error("FOCUSED_SUITE_EXECUTION_IS_NONAUTHORITATIVE");
await run(command, {
  serial: process.argv.includes("--serial"),
  executeOnly: process.argv.includes("--execute-only"),
  receiptPath,
  suiteId,
  planPath,
});
