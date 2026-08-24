/* Create a sealed, nonauthoritative v1.4 fast-channel plan from real Git identities. */
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { digest } from "./v14/foundation.mjs";
import { selectV14Mainline } from "./v14/fast-channel.mjs";
import { discoverProjects, projectDiscoverySummary } from "./project-discovery.mjs";

const exec = promisify(execFile);
const valueFor = (args, flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const git = async (root, ...args) => (await exec("git", ["-C", root, ...args])).stdout.trim();
const json = async (root, name) => JSON.parse(await readFile(path.join(root, "testing", name), "utf8"));
const trustedJson = async (root, trustedBaseSha, name) =>
  JSON.parse(await git(root, "show", `${trustedBaseSha}:testing/${name}`));
const featureCatalog = async (root, trustedBaseSha) => {
  const catalogRoot = "Development_Docs/Features/catalog";
  const files = (await git(root, "ls-tree", "-r", "--name-only", trustedBaseSha, "--", catalogRoot))
    .split(/\r?\n/u)
    .filter((name) => name.endsWith(".json"));
  return (
    await Promise.all(files.map(async (name) => JSON.parse(await git(root, "show", `${trustedBaseSha}:${name}`))))
  ).flat();
};

export async function generateV14FastChannelPlan({
  root,
  baseSha,
  candidateSha,
  gateId = "mainline",
  predictedIdentity = {},
  conservativeFallbackReason = null,
}) {
  const [
    gates,
    suites,
    impact,
    debt,
    contracts,
    ownership,
    fingerprintPolicy,
    preparedArtifacts,
    trainPolicy,
    authority,
    catalog,
    trustedSuites,
    trustedContracts,
    trustedOwnership,
    trustedMaintenancePolicy,
  ] = await Promise.all([
    json(root, "release-gates.json"),
    json(root, "suites.json"),
    json(root, "impact-map.json"),
    json(root, "v14/contract-map-debt.json"),
    json(root, "contracts.json"),
    json(root, "ownership.json"),
    json(root, "evidence-fingerprint-policy.json"),
    json(root, "prepared-artifacts.json"),
    json(root, "mainline-train-policy.json"),
    json(root, "sounding-line-authority.json"),
    // Catalog records are optional corroboration, never candidate evidence.
    // Load them from the qualified base tree rather than this checkout.
    featureCatalog(root, baseSha),
    trustedJson(root, baseSha, "suites.json"),
    trustedJson(root, baseSha, "contracts.json"),
    trustedJson(root, baseSha, "ownership.json"),
    trustedJson(root, baseSha, "verification-maintenance-policy.json"),
  ]);
  const gate = gates.gates.find((entry) => entry.id === gateId);
  if (!gate) throw new Error(`UNKNOWN_GATE:${gateId}`);
  const selection = authority.ordinaryCandidateQualification?.minimumSufficientEvidence;
  if (!selection || selection.selectionMode !== "EXACT_SEMANTIC_IMPACT_WITH_REQUIRED_SENTINELS")
    throw new Error("V14_MSES_SELECTION_POLICY_INVALID");
  if (!Array.isArray(selection.requiredSafetySentinelSuiteIds) || !selection.requiredSafetySentinelSuiteIds.length)
    throw new Error("V14_MSES_SENTINEL_POLICY_INVALID");
  if (!Array.isArray(selection.exhaustiveGateIds) || !selection.exhaustiveGateIds.includes("release-candidate"))
    throw new Error("V14_MSES_EXHAUSTIVE_POLICY_INVALID");
  const exhaustive = selection.exhaustiveGateIds.includes(gateId);
  const changedPaths = (await git(root, "diff", "--name-only", baseSha, candidateSha)).split(/\r?\n/u).filter(Boolean);
  // A tree-name scan is bounded, deterministic metadata. It never reads
  // candidate content as trusted evidence: candidate paths only create a
  // provisional descriptor, while base-tree paths may promote a later one.
  const trustedPaths = (await git(root, "ls-tree", "-r", "--name-only", baseSha)).split(/\r?\n/u).filter(Boolean);
  const [candidateTreeSha, qualifiedBaseTreeSha] = await Promise.all([
    git(root, "rev-parse", `${candidateSha}^{tree}`),
    git(root, "rev-parse", `${baseSha}^{tree}`),
  ]);
  const projectDiscovery = discoverProjects({
    candidatePaths: changedPaths,
    trustedPaths,
    trustedMainSha: baseSha,
    candidateSha,
    // Only trusted-base descriptors may narrow selection. Candidate inventory
    // remains available to ordinary registration checks, but cannot make a
    // project look known merely by naming its own suite or owner.
    suites: trustedSuites.suites.map((entry) => ({ ...entry, trusted: true })),
    contracts: trustedContracts.contracts.map((entry) => ({ ...entry, trusted: true })),
    owners: trustedOwnership.owners.map((entry) => ({ ...entry, trusted: true })),
    featureCatalog: catalog.map((entry) => ({ ...entry, trusted: true })),
  });
  return selectV14Mainline({
    changedPaths,
    suites: suites.suites,
    // Mainline candidates use exact semantic impact plus the authority-owned
    // safety sentinel set. The historical required-suite matrix remains the
    // exhaustive release-candidate contract; it is not a hidden mainline
    // freshness floor.
    requiredSuiteIds: exhaustive
      ? [...(gate.requiredSuites ?? []), ...(gate.conditionalSuites ?? [])]
      : selection.requiredSafetySentinelSuiteIds,
    // The ledger is the complete evidence-disposition contract. It must cover
    // every executable node as well as preserved obligations; a partial gate
    // list could otherwise let a risk-floor node bypass its own FRESH/
    // PRESERVED declaration when a train builds worker matrices.
    ledgerSuiteIds: suites.suites.map((suite) => suite.id),
    impact,
    mappingDebt: debt.entries,
    projectDiscovery,
    governanceDocumentation: trustedMaintenancePolicy.ordinaryCandidateGovernanceDocumentation,
    identity: {
      gate: gateId,
      candidateSha,
      candidateTreeSha,
      qualifiedBaseSha: baseSha,
      qualifiedBaseTreeSha,
      predictedParentCommitSha: predictedIdentity.predictedParentCommitSha ?? baseSha,
      predictedParentTreeSha: predictedIdentity.predictedParentTreeSha ?? qualifiedBaseTreeSha,
      predictedIntegrationTreeSha: predictedIdentity.predictedIntegrationTreeSha ?? candidateTreeSha,
      mergeStrategyIdentity: "single-candidate-shadow",
      fingerprintPolicyDigest: digest(fingerprintPolicy),
      preparedArtifactPolicyDigest: digest(preparedArtifacts),
      trainPolicyDigest: digest(trainPolicy),
    },
    policyDigest: digest(gates),
    inventoryDigest: digest({ contracts, ownership, suites }),
    selectionContract: {
      selectionMode: selection.selectionMode,
      requiredSafetySentinelSuiteIds: selection.requiredSafetySentinelSuiteIds,
      exhaustive,
      performanceObjectiveMs: selection.performanceObjectiveMs,
      performanceCeilingMs: selection.performanceCeilingMs,
    },
    projectDiscoverySummary: projectDiscoverySummary(projectDiscovery),
    conservativeFallbackReason,
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
