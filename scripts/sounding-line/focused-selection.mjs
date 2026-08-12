/* Validate one diagnostic suite against the exact sealed gate plan. */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { deriveWorkerPreparation } from "./worker-preparation.mjs";

export function selectFocusedSuite(plan, suiteId) {
  const matches = Array.isArray(plan?.nodes) ? plan.nodes.filter((node) => node.id === suiteId) : [];
  if (!suiteId || matches.length !== 1) throw new Error(`FOCUSED_SUITE_NOT_REGISTERED:${suiteId ?? "missing"}`);
  const node = matches[0];
  const preparation = deriveWorkerPreparation(node);
  if (preparation.runtimeConformance.result !== "PASSED") {
    const codes = preparation.runtimeConformance.violations.map((entry) => entry.code).join(",");
    throw new Error(`FOCUSED_RESOURCE_SCOPE_VIOLATION:${suiteId}:${codes}`);
  }
  return {
    version: 1,
    authority: "DIAGNOSTIC_EVIDENCE_ONLY",
    releaseAuthority: false,
    gate: plan.gate,
    sourceSha: plan.sourceSha,
    planDigest: plan.planDigest,
    suiteId,
    preparation,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const valueFor = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const planPath = valueFor("--plan");
  const suiteId = valueFor("--suite");
  const outputPath = valueFor("--out");
  if (!planPath || !suiteId || !outputPath) throw new Error("FOCUSED_SELECTION_INPUT_REQUIRED");
  const plan = JSON.parse(await readFile(path.resolve(planPath), "utf8"));
  const selection = selectFocusedSuite(plan, suiteId);
  await writeFile(path.resolve(outputPath), `${JSON.stringify(selection, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(selection)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
