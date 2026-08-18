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
import { deriveV14WorkerPreparation, deriveWorkerPreparation } from "./worker-preparation.mjs";
import { canBatchPhysicalWorker } from "./v14/physical-worker-batching.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const configuredBaselineDatabase = process.env.SOUNDING_LINE_BASELINE_DATABASE;
if (configuredBaselineDatabase && !path.isAbsolute(configuredBaselineDatabase))
  throw new Error("SOUNDING_LINE_BASELINE_DATABASE_MUST_BE_ABSOLUTE");
const baselineDatabase = configuredBaselineDatabase
  ? path.normalize(configuredBaselineDatabase)
  : path.join(root, "prisma", "dev.db");
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const readJson = async (file) => {
  const content = await readFile(file);
  const text = content[0] === 0xff && content[1] === 0xfe ? content.toString("utf16le") : content.toString("utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
};

function suiteAdapter(suite, registry, browserTestIds = undefined) {
  const certifiedBaseline = process.env.SOUNDING_LINE_CERTIFIED_BASELINE === "1";
  const availableDefinitions = registry.cases.filter((entry) => entry.suiteId === suite.id);
  if (
    browserTestIds !== undefined &&
    (!Array.isArray(browserTestIds) ||
      !browserTestIds.length ||
      new Set(browserTestIds).size !== browserTestIds.length ||
      suite.adapter !== "playwright-family")
  )
    throw new Error(`BROWSER_PARTITION_ADAPTER_INVALID:${suite.id}`);
  const selectedTestIds = new Set(browserTestIds ?? []);
  const definitions =
    browserTestIds === undefined
      ? availableDefinitions
      : availableDefinitions.filter((entry) => selectedTestIds.has(entry.id));
  if (browserTestIds !== undefined && definitions.length !== browserTestIds.length)
    throw new Error(`BROWSER_PARTITION_CASE_SELECTION_INVALID:${suite.id}`);
  if (["vitest-family", "vitest-family-serial", "node-test-browser-family"].includes(suite.adapter)) {
    const files = [
      ...new Set(
        definitions.map((entry) => entry.file).filter((file) => /\.(?:test|spec)\.(?:ts|tsx|mjs|js)$/u.test(file)),
      ),
    ];
    if (!files.length) throw new Error(`EMPTY_FAMILY_SELECTION:${suite.id}`);
    if (files.every((file) => file.endsWith(".mjs")))
      return {
        id: suite.adapter === "node-test-browser-family" ? "node-test-browser-family" : "node-test-family",
        command: [process.execPath, "--test", ...files],
        resources:
          suite.adapter === "node-test-browser-family"
            ? ["node-slot", "application-port", "browser-chromium"]
            : ["node-slot"],
        mode: "CERTIFIED",
      };
    return resolveVitestAdapter(files, { serialWithinFamily: suite.adapter === "vitest-family-serial" });
  }
  if (suite.adapter === "playwright-family") {
    const selections = new Map();
    for (const definition of definitions) {
      if (!definition.project || !/^tests\/e2e\/.*\.(?:spec|setup)\.ts$/u.test(definition.file) || !definition.title)
        throw new Error(`INVALID_BROWSER_FAMILY_SELECTION:${suite.id}`);
      const selection = selections.get(definition.project) ?? {
        project: definition.project,
        files: new Set(),
        titles: [],
      };
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
      baselineDatabase,
      suite.id !== "browser.access-sentinel",
      suite.id === "browser.access-sentinel"
        ? {
            skipLegacyProjectionFixture: true,
            parallelSafe: suite.parallelSafe === true,
            browserWorkers: suite.parallelSafe ? 3 : 1,
            certifiedBaseline,
          }
        : undefined,
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
  if (plan.authorityDigest !== digest(await readJson(path.join(root, "testing", "sounding-line-authority.json"))))
    throw new Error("AUTHORITY_INDEX_MISMATCH");
  return plan;
}

async function run(
  gateId,
  { serial, executeOnly = false, receiptPath, suiteId, suiteIds, planPath, browserTestIdsBySuite, browserEngine } = {},
) {
  const plan = await loadSealedPlan(gateId, { serial, planPath });
  const selectedSuiteIds = suiteIds ?? (suiteId ? [suiteId] : null);
  if (
    selectedSuiteIds &&
    (!Array.isArray(selectedSuiteIds) ||
      !selectedSuiteIds.length ||
      new Set(selectedSuiteIds).size !== selectedSuiteIds.length)
  )
    throw new Error("SUITE_BATCH_INVALID");
  if (selectedSuiteIds && selectedSuiteIds.some((id) => !plan.nodes.some((node) => node.id === id)))
    throw new Error("SUITE_BATCH_NOT_SELECTED_BY_PLAN");
  if (browserTestIdsBySuite === undefined && browserEngine && ["chromium", "webkit"].includes(browserEngine)) {
    const automaticPartitions = Object.fromEntries(
      plan.nodes
        .filter((node) => selectedSuiteIds?.includes(node.id))
        .flatMap((node) => {
          const partition = node.browserPartitions?.find((entry) => entry.browserEngine === browserEngine);
          return partition ? [[node.id, partition.testIds]] : [];
        }),
    );
    if (Object.keys(automaticPartitions).length) browserTestIdsBySuite = automaticPartitions;
  }
  if (
    browserTestIdsBySuite !== undefined &&
    (!selectedSuiteIds ||
      !browserEngine ||
      !["chromium", "webkit"].includes(browserEngine) ||
      !browserTestIdsBySuite ||
      typeof browserTestIdsBySuite !== "object" ||
      Array.isArray(browserTestIdsBySuite) ||
      JSON.stringify(Object.keys(browserTestIdsBySuite).sort()) !== JSON.stringify([...selectedSuiteIds].sort()))
  )
    throw new Error("BROWSER_PARTITION_BATCH_INVALID");
  if (selectedSuiteIds?.length > 1) {
    const batchNodes = plan.nodes.filter((node) => selectedSuiteIds.includes(node.id));
    if (!batchNodes.every(canBatchPhysicalWorker) || new Set(batchNodes.map((node) => node.execution.wave)).size !== 1)
      throw new Error("SUITE_BATCH_RESOURCE_CONFLICT");
  }
  const [suites, registry] = await Promise.all([
    readJson(path.join(root, "testing", "suites.json")),
    readJson(path.join(root, "testing", "generated", "active-test-registry.json")),
  ]);
  const suiteMap = new Map(suites.suites.map((suite) => [suite.id, suite]));
  const receipts = [];
  const runtimeConformance = [];
  const runtimeRoot = path.join(root, "artifacts", "sounding-line", "runs", process.env.GITHUB_RUN_ID ?? "local");
  for (const node of plan.nodes.filter((node) => !selectedSuiteIds || selectedSuiteIds.includes(node.id))) {
    const suite = suiteMap.get(node.id);
    const browserTestIds = browserTestIdsBySuite?.[node.id];
    if (browserTestIds !== undefined) {
      const expected =
        node.browserPartitions?.find((partition) => partition.browserEngine === browserEngine)?.testIds ?? [];
      if (
        !Array.isArray(browserTestIds) ||
        JSON.stringify([...browserTestIds].sort()) !== JSON.stringify([...expected].sort())
      )
        throw new Error(`BROWSER_PARTITION_PLAN_MISMATCH:${node.id}`);
    }
    const preparation =
      plan.authorityVersion === "1.4"
        ? deriveV14WorkerPreparation({
            plan,
            node,
            runId: process.env.GITHUB_RUN_ID ?? "local",
            browserEngine: browserTestIds === undefined ? undefined : browserEngine,
          })
        : deriveWorkerPreparation(node, { browserEngine: browserTestIds === undefined ? undefined : browserEngine });
    if (preparation.runtimeConformance.result !== "PASSED")
      throw new Error(
        `RUNTIME_CONFORMANCE_FAILED:${preparation.runtimeConformance.violations.map((entry) => entry.code).join(",")}`,
      );
    runtimeConformance.push({
      suiteId: node.id,
      planDigest: plan.planDigest,
      authorityDigest: plan.authorityDigest,
      ...preparation.runtimeConformance,
      ...(browserTestIds === undefined
        ? {}
        : { browserPartition: { browserEngine, testIds: [...browserTestIds].sort() } }),
    });
    const adapter = suiteAdapter(suite, registry, browserTestIds);
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
      await access(baselineDatabase);
      Object.assign(adapterEnv, { DATABASE_URL: `file:${baselineDatabase.replaceAll("\\", "/")}` });
    }
    if (adapter.id === "harborlight-browser-lanes") {
      await mkdir(runtimeRoot, { recursive: true });
      Object.assign(adapterEnv, {
        SOUNDING_LINE_BASELINE_DATABASE: baselineDatabase,
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
    const adapterWorkingDirectory = adapter.workingDirectory === "bridgewatch" ? path.join(root, "bridgewatch") : root;
    const result = await executeAdapter(adapter, {
      cwd: adapterWorkingDirectory,
      env: adapterEnv,
      timeoutMs: suite.hardBudgetMs,
    });
    const browserCounts =
      suite.adapter === "playwright-family"
        ? {
            registeredCaseCount: browserTestIds?.length ?? node.testIds.length,
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
      ...(browserTestIds === undefined
        ? {}
        : { browserPartition: { browserEngine, testIds: [...browserTestIds].sort() } }),
      ...browserCounts,
      ...result,
    });
  }
  const evidence = { version: 2, plan, receipts, runtimeConformance };
  if (receiptPath) await writeFile(path.resolve(root, receiptPath), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  if (executeOnly) {
    output(evidence);
    if (receipts.some((receipt) => receipt.result !== "PASSED")) process.exitCode = 1;
    return;
  }
  const result = finalize({ plan, receipts, runtimeConformance });
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
const suitesIndex = process.argv.indexOf("--suites-json");
const suiteIds = suitesIndex >= 0 ? JSON.parse(process.argv[suitesIndex + 1] ?? "") : undefined;
const browserTestIdsIndex = process.argv.indexOf("--browser-test-ids-by-suite-json");
let browserTestIdsBySuite =
  browserTestIdsIndex >= 0 ? JSON.parse(process.argv[browserTestIdsIndex + 1] ?? "") : undefined;
const browserEngineIndex = process.argv.indexOf("--browser-engine");
const browserEngine = browserEngineIndex >= 0 ? process.argv[browserEngineIndex + 1] : undefined;
if (suiteId && suiteIds) throw new Error("SUITE_AND_BATCH_ARE_MUTUALLY_EXCLUSIVE");
const planInputIndex = process.argv.indexOf("--plan-in");
const planPath = planInputIndex >= 0 ? process.argv[planInputIndex + 1] : undefined;
if (planInputIndex >= 0 && !planPath) throw new Error("SEALED_PLAN_PATH_REQUIRED");
if ((suiteId || suiteIds) && !process.argv.includes("--execute-only"))
  throw new Error("FOCUSED_SUITE_EXECUTION_IS_NONAUTHORITATIVE");
await run(command, {
  serial: process.argv.includes("--serial"),
  executeOnly: process.argv.includes("--execute-only"),
  receiptPath,
  suiteId,
  suiteIds,
  planPath,
  browserTestIdsBySuite,
  browserEngine,
});
