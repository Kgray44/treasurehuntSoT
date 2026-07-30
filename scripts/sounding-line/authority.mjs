#!/usr/bin/env node
/* Authoritative public-command boundary. Raw runners are deliberately absent. */
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { executeAdapter, resolveAdapter, resolveVitestAdapter } from "./adapters.mjs";
import { finalize } from "./finalizer.mjs";
import { buildPlan } from "./planner.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

function suiteAdapter(suite) {
  if (suite.adapter) return resolveAdapter(suite.adapter);
  if (Array.isArray(suite.testFiles) && suite.testFiles.length) return resolveVitestAdapter(suite.testFiles);
  throw new Error(`SUITE_HAS_NO_GOVERNED_ADAPTER:${suite.id}`);
}

async function run(gateId, serial) {
  const plan = await buildPlan({ root, gateId, serial });
  const suites = JSON.parse(
    await (await import("node:fs/promises")).readFile(path.join(root, "testing", "suites.json"), "utf8"),
  );
  const suiteMap = new Map(suites.suites.map((suite) => [suite.id, suite]));
  const receipts = [];
  for (const node of plan.nodes) {
    const suite = suiteMap.get(node.id);
    const adapter = suiteAdapter(suite);
    const startedAt = new Date().toISOString();
    const result = await executeAdapter(adapter, { cwd: root });
    receipts.push({
      suiteId: node.id,
      adapterId: adapter.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      sourceSha: plan.sourceSha,
      policyDigest: plan.policyDigest,
      planDigest: plan.planDigest,
      cleanupState: "CLEAN",
      result: result.exitCode === 0 ? "PASSED" : "FAILED",
      ...result,
    });
    if (result.exitCode !== 0) break;
  }
  const result = finalize({ plan, receipts });
  output({ plan, finalization: result });
  process.exitCode = result.decision === "RELEASE_GO" ? 0 : 1;
}

const command = process.argv[2] ?? "local-change";
if (!new Set(["local-change", "mainline", "release-candidate", "subsystem", "contract"]).has(command))
  throw new Error(`UNKNOWN_AUTHORITY_COMMAND:${command}`);
await run(command, process.argv.includes("--serial"));
