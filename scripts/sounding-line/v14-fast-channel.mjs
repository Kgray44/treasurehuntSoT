/* Create a sealed, nonauthoritative v1.4 fast-channel plan from real Git identities. */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { digest } from "./v14/foundation.mjs";
import { selectV14Mainline } from "./v14/fast-channel.mjs";

const exec = promisify(execFile);
const valueFor = (args, flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const git = async (root, ...args) => (await exec("git", ["-C", root, ...args])).stdout.trim();
const json = async (root, name) => JSON.parse(await readFile(path.join(root, "testing", name), "utf8"));

export async function generateV14FastChannelPlan({ root, baseSha, candidateSha, gateId = "mainline" }) {
  const [gates, suites, impact, debt, contracts, ownership] = await Promise.all([
    json(root, "release-gates.json"),
    json(root, "suites.json"),
    json(root, "impact-map.json"),
    json(root, "v14/contract-map-debt.json"),
    json(root, "contracts.json"),
    json(root, "ownership.json"),
  ]);
  const gate = gates.gates.find((entry) => entry.id === gateId);
  if (!gate) throw new Error(`UNKNOWN_GATE:${gateId}`);
  const changedPaths = (await git(root, "diff", "--name-only", baseSha, candidateSha)).split(/\r?\n/u).filter(Boolean);
  const [candidateTreeSha, qualifiedBaseTreeSha] = await Promise.all([
    git(root, "rev-parse", `${candidateSha}^{tree}`),
    git(root, "rev-parse", `${baseSha}^{tree}`),
  ]);
  return selectV14Mainline({
    changedPaths,
    suites: suites.suites,
    requiredSuiteIds: gate.requiredSuites ?? [],
    conditionalSuiteIds: gate.conditionalSuites ?? [],
    impact,
    mappingDebt: debt.entries,
    identity: {
      gate: gateId,
      candidateSha,
      candidateTreeSha,
      qualifiedBaseSha: baseSha,
      qualifiedBaseTreeSha,
      predictedParentCommitSha: baseSha,
      predictedParentTreeSha: qualifiedBaseTreeSha,
      predictedIntegrationTreeSha: candidateTreeSha,
      mergeStrategyIdentity: "single-candidate-shadow",
    },
    policyDigest: digest(gates),
    inventoryDigest: digest({ contracts, ownership, suites }),
  });
}

async function main() {
  const args = process.argv.slice(2);
  const root = path.resolve(valueFor(args, "--root") ?? process.cwd());
  const baseSha = valueFor(args, "--base");
  const candidateSha = valueFor(args, "--candidate");
  const out = valueFor(args, "--out");
  if (!baseSha || !candidateSha) throw new Error("V14_FAST_CHANNEL_BASE_AND_CANDIDATE_REQUIRED");
  const plan = await generateV14FastChannelPlan({
    root,
    baseSha,
    candidateSha,
    gateId: valueFor(args, "--gate") ?? "mainline",
  });
  const output = `${JSON.stringify(plan, null, 2)}\n`;
  if (out) await writeFile(path.resolve(out), output, "utf8");
  else process.stdout.write(output);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
