#!/usr/bin/env node
/* Authoritative public-command boundary. Raw runners are deliberately absent. */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { executeAdapter, resolveAdapter, resolveVitestAdapter } from "./adapters.mjs";
import { finalize } from "./finalizer.mjs";
import { buildPlan } from "./planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const readJson = async (file) => {
  const content = await readFile(file);
  const text = content[0] === 0xff && content[1] === 0xfe ? content.toString("utf16le") : content.toString("utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
};

function suiteAdapter(suite) {
  if (suite.adapter) return resolveAdapter(suite.adapter);
  if (Array.isArray(suite.testFiles) && suite.testFiles.length) return resolveVitestAdapter(suite.testFiles);
  throw new Error(`SUITE_HAS_NO_GOVERNED_ADAPTER:${suite.id}`);
}

async function loadSealedPlan(gateId, { serial, planPath } = {}) {
  if (!planPath) return buildPlan({ root, gateId, serial });
  const plan = await readJson(path.resolve(root, planPath));
  const { planDigest, ...unsignedPlan } = plan;
  if (!planDigest || planDigest !== digest(unsignedPlan)) throw new Error("SEALED_PLAN_DIGEST_MISMATCH");
  if (planDigest !== (await buildPlan({ root, gateId, serial, sourceSha: plan.sourceSha })).planDigest)
    throw new Error("SEALED_PLAN_CURRENT_SOURCE_MISMATCH");
  if (plan.authority !== "SOUNDING_LINE" || plan.gate !== gateId || plan.serial !== serial)
    throw new Error("SEALED_PLAN_BOUNDARY_MISMATCH");
  if (process.env.GITHUB_SHA && plan.sourceSha !== process.env.GITHUB_SHA)
    throw new Error("SEALED_PLAN_SOURCE_MISMATCH");
  return plan;
}

async function run(gateId, { serial, executeOnly = false, receiptPath, suiteId, planPath } = {}) {
  const plan = await loadSealedPlan(gateId, { serial, planPath });
  if (suiteId && !plan.nodes.some((node) => node.id === suiteId))
    throw new Error(`SUITE_NOT_SELECTED_BY_PLAN:${suiteId}`);
  const suites = JSON.parse(await readFile(path.join(root, "testing", "suites.json"), "utf8"));
  const suiteMap = new Map(suites.suites.map((suite) => [suite.id, suite]));
  const receipts = [];
  const runtimeRoot = path.join(root, "artifacts", "sounding-line", "runs", process.env.GITHUB_RUN_ID ?? "local");
  for (const node of plan.nodes.filter((node) => !suiteId || node.id === suiteId)) {
    const suite = suiteMap.get(node.id);
    const adapter = suiteAdapter(suite);
    const startedAt = new Date().toISOString();
    const adapterEnv = {};
    if (
      new Set([
        "sqlite-validate",
        "harborlight-sqlite",
        "playwright-access-sentinel",
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
    const result = await executeAdapter(adapter, { cwd: root, env: adapterEnv });
    receipts.push({
      suiteId: node.id,
      adapterId: adapter.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceSha: plan.sourceSha,
      policyDigest: plan.policyDigest,
      inventoryDigest: plan.inventoryDigest,
      planDigest: plan.planDigest,
      gate: plan.gate,
      cleanupState: "CLEAN",
      result: result.exitCode === 0 ? "PASSED" : "FAILED",
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
