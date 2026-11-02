// Bounded counterfactual on a genuinely qualified, still-open candidate. The
// installed switch remains SHADOW and this manual job cannot qualify a PR.
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { selectedCheckout } from "./experience-selected-checkout.mjs";
import { ordinaryCheckoutProfile, NONCAMPAIGN_CUSTODY_CHECKOUT_MODE } from "./ordinary-checkout.mjs";
import { certifiedNoncampaignCustodyReadSet, CERTIFIED_CUSTODY_PROFILE } from "./noncampaign-custody-read-set.mjs";
import { custodyProbeEnvironment } from "./ordinary-custody-probe.mjs";
import {
  custodyShadowPreload,
  readCustodyPilotSource,
  retainCustodyProofFrame,
} from "./noncampaign-custody-proof-files.mjs";
import { custodyProofFilesystem } from "./noncampaign-custody-negative-probe.mjs";

const hash = (b) => createHash("sha256").update(b).digest("hex");
const need = (ok, code) => {
  if (!ok) throw Error(`CUSTODY_MATCHED_PILOT_${code}`);
};

export function baselineToolchainObservations(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const unique = (expression) => [...new Set([...text.matchAll(expression)].map((match) => match[1]))];
  return Object.freeze({
    nodeVersions: unique(/\b(v24\.[0-9]+\.[0-9]+)\b/gu),
    gitVersions: unique(/git version ([0-9]+\.[0-9]+\.[0-9]+(?:\.[A-Za-z0-9.-]+)?)/gu),
    imageVersions: unique(/Version: ([0-9]{8}\.[0-9.]+)/gu),
    kernel: "NOT_RECORDED_BY_ORIGINAL_JOB",
    originalLogSha256: hash(bytes),
    equalityOrIsolationCertified: false,
  });
}

export async function runMatchedCustodyAdapter({
  directory,
  current,
  binding,
  baseline,
  prNumber,
  git,
  execute,
  record,
  environment,
  baselineJobLog,
}) {
  need(
    current.source === binding.baseSha && NONCAMPAIGN_CUSTODY_CHECKOUT_MODE === "SHADOW",
    "INSTALLED_SHADOW_REQUIRED",
  );
  const event = {
    pull_request: {
      number: prNumber,
      base: { sha: binding.baseSha, repo: { full_name: "Kgray44/treasurehuntSoT" } },
      head: { sha: binding.candidateSha, repo: { full_name: "Kgray44/treasurehuntSoT" } },
    },
  };
  const profile = ordinaryCheckoutProfile({
    baseSha: binding.baseSha,
    candidateSha: binding.candidateSha,
    purpose: "campaign-custody",
    event,
    env: {
      GITHUB_REPOSITORY: "Kgray44/treasurehuntSoT",
      GITHUB_SHA: binding.baseSha,
      GITHUB_REF: "refs/heads/main",
      GITHUB_EVENT_NAME: "pull_request_target",
      GITHUB_JOB: "campaign-custody",
    },
  });
  const roots = [...new Set([binding.baseSha, binding.candidateSha, ...profile.roots])];
  need(JSON.stringify(roots) === JSON.stringify(baseline.roots), "EXACT_BASELINE_ROOTS");
  const selected = path.join(directory, "selected-adapter");
  const result = await selectedCheckout({
    ...profile,
    root: selected,
    baseSha: binding.baseSha,
    candidateSha: binding.candidateSha,
    remote: "https://github.com/Kgray44/treasurehuntSoT.git",
    budgetMs: 120000,
    stallBudgetMs: 120000,
    progress: true,
    selectReadSet: async (context) => {
      const value = await certifiedNoncampaignCustodyReadSet({ ...context, prNumber });
      // Production keeps FULL on uncertainty. This 512MiB experiment cannot
      // admit a FULL debug checkout and must stop before its hydration begins.
      need(value.applied === true, "FULL_FALLBACK_NOT_ADMITTED_IN_METADATA_EXPERIMENT");
      return value;
    },
  });
  need(
    result.status === "PASS" &&
      result.readSet.applied === true &&
      result.readSet.profile === CERTIFIED_CUSTODY_PROFILE &&
      result.compiled.snapshots === 0 &&
      result.compiled.readerSnapshots === 2 &&
      result.verified.completeCommitTreeAncestry === true &&
      result.lateGitTransport === "DISABLED",
    "CERTIFIED_SELECTED_RESULT",
  );
  record("matched-selected.checkout.original.json", result);
  const output = path.join(directory, "matched-reserve-output.original.txt"),
    counters = path.join(directory, "matched-reserve-network.original.json"),
    preload = path.join(directory, "matched-deny.cjs"),
    eventFile = path.join(directory, "matched-event.original.json");
  record("matched-event.original.json", event);
  retainCustodyProofFrame(preload, Buffer.from(custodyShadowPreload(counters, "/usr/bin/git")));
  const sandbox = custodyProbeEnvironment(environment, "/usr/bin/git"),
    before = custodyProofFilesystem(selected),
    began = performance.now();
  execute(
    process.execPath,
    [
      "--require",
      preload,
      fileURLToPath(new URL("./experience-exception.mjs", import.meta.url)),
      "--operation",
      "reserve",
      "--workspace",
      selected,
      "--base",
      binding.baseSha,
      "--candidate",
      binding.candidateSha,
      "--evidence",
      path.join(selected, ".git/forbidden-matched-phase"),
    ],
    {
      environment: { ...sandbox, GITHUB_EVENT_PATH: eventFile, GITHUB_SHA: binding.baseSha, GITHUB_OUTPUT: output },
      timeout: 45000,
    },
  );
  const reserveMs = performance.now() - began,
    observed = JSON.parse(readCustodyPilotSource(counters)),
    bytes = readCustodyPilotSource(output);
  need(
    bytes.equals(Buffer.from("campaign=false\n")) &&
      observed.fetchAttempts === 0 &&
      observed.networkAttempts === 0 &&
      observed.nonGitProcessAttempts === 0 &&
      custodyProofFilesystem(selected) === before,
    "POST_MATERIALIZATION_NEGATIVE_ROUTE",
  );
  const inventory = git(selected, [
    "cat-file",
    "--batch-all-objects",
    "--batch-check=%(objectname) %(objecttype) %(objectsize)",
  ]);
  retainCustodyProofFrame(path.join(directory, "matched-object-inventory.original.txt"), inventory);
  return {
    status: "PASS_SHADOW_CERTIFIED_ADAPTER_SAME_SOURCE_PAIR",
    context: current,
    binding,
    prNumber,
    roots,
    baseline: {
      elapsedMs: baseline.elapsedMs,
      requiredBlobs: baseline.verified.requiredBlobs,
      requiredBlobBytes: baseline.verified.requiredBlobBytes,
      toolchainObservations: baselineToolchainObservations(baselineJobLog),
    },
    selected: {
      elapsedMs: result.elapsedMs,
      requiredBlobs: result.verified.requiredBlobs,
      requiredBlobBytes: result.verified.requiredBlobBytes,
      compiled: result.compiled,
      verified: result.verified,
      certificateReaders: result.readSet.certificateReaders,
      transportSourceProof: result.readSet.transportSourceProof,
    },
    reserveMs,
    reserveOutputSha256: hash(bytes),
    networkObservation: observed,
    selectedFilesystemDigest: before,
    toolchain: {
      node: process.version,
      git: git(selected, ["--version"]).toString().trim(),
      os: os.release(),
      imageOS: process.env.ImageOS,
      imageVersion: process.env.ImageVersion,
    },
    performanceScope: "EXACT_INSTALLED_BYTES_BASE_CANDIDATE_AND_ROOTS_DIFFERENT_HOSTED_INSTANCES",
    wholeRunPerformanceCertified: false,
    installedOrdinaryMode: NONCAMPAIGN_CUSTODY_CHECKOUT_MODE,
    ordinaryProductionProfile: "FULL_SNAPSHOT",
    qualification: false,
    certificate: "NOT_ISSUED",
    activation: false,
  };
}
