/* Run a non-authoritative v1.4 shadow comparison. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { buildPlan } from "./planner.mjs";
import { buildShadowPlan } from "./v14/foundation.mjs";

const exec = promisify(execFile);
const valueFor = (args, flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const json = async (root, name) => JSON.parse(await readFile(path.join(root, "testing", name), "utf8"));

export async function generateShadowPlan({
  root,
  baseSha,
  candidateSha,
  gateId = "mainline",
  priorEvidence = {},
  alwaysFreshSpine = [],
}) {
  const [gatesFile, impactMap, mappingDebt] = await Promise.all([
    json(root, "release-gates.json"),
    json(root, "impact-map.json"),
    JSON.parse(await readFile(path.join(root, "testing", "v14", "contract-map-debt.json"), "utf8")),
  ]);
  const gate = gatesFile.gates.find((entry) => entry.id === gateId);
  if (!gate) throw new Error(`UNKNOWN_GATE:${gateId}`);
  const { stdout } = await exec("git", ["-C", root, "diff", "--name-only", baseSha, candidateSha]);
  const changedPaths = stdout.split(/\r?\n/u).filter(Boolean);
  const currentPlan = await buildPlan({ root, gateId, sourceSha: candidateSha });
  return buildShadowPlan({
    currentPlan,
    gate,
    impactMap,
    mappingDebt: mappingDebt.entries,
    changedPaths,
    priorEvidence,
    alwaysFreshSpine,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(valueFor(args, "--root") ?? process.cwd());
  const baseSha = valueFor(args, "--base");
  const candidateSha = valueFor(args, "--candidate");
  const gateId = valueFor(args, "--gate") ?? "mainline";
  const out = valueFor(args, "--out");
  const priorPath = valueFor(args, "--prior-evidence");
  if (!baseSha || !candidateSha) throw new Error("V14_SHADOW_PLAN_BASE_AND_CANDIDATE_REQUIRED");
  const priorEvidence = priorPath ? JSON.parse(await readFile(path.resolve(priorPath), "utf8")) : {};
  const plan = await generateShadowPlan({ root, baseSha, candidateSha, gateId, priorEvidence });
  const output = `${JSON.stringify(plan, null, 2)}\n`;
  if (out) {
    const outputPath = path.resolve(out);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, output, "utf8");
  }
  process.stdout.write(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
