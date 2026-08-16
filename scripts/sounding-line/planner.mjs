/* Deterministic, allowlist-only Sounding Line plan builder. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateV14FastChannelPlan } from "./v14-fast-channel.mjs";

const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const json = async (root, file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));
const hostedSharedResources = new Set(["restart-host", "external-provider"]);
const supportedBrowserEngines = new Set(["chromium", "webkit"]);

function browserPartitionsFor(node, cases) {
  if (node.adapter !== "playwright-family") return [];
  const partitions = new Map();
  for (const entry of cases) {
    const engines = [
      ...new Set(
        (entry.resources ?? [])
          .filter((resource) => resource.startsWith("browser-"))
          .map((resource) => resource.slice(8)),
      ),
    ];
    if (engines.length !== 1 || !supportedBrowserEngines.has(engines[0]))
      throw new Error(`HOSTED_BROWSER_PARTITION_INVALID:${node.id}:${entry.id}`);
    partitions.set(engines[0], [...(partitions.get(engines[0]) ?? []), entry.id]);
  }
  if (!partitions.size) throw new Error(`HOSTED_BROWSER_PARTITION_MISSING:${node.id}`);
  return [...partitions.entries()]
    .map(([browserEngine, testIds]) => ({ browserEngine, testIds: [...testIds].sort() }))
    .sort((left, right) => left.browserEngine.localeCompare(right.browserEngine));
}

export function resolvePlanAuthority({ authorityIndex, gateId, authorityMode, githubRef, qualifiedBaseSha }) {
  if (authorityMode !== "CURRENT" && authorityMode !== "V13_CUTOVER" && authorityMode !== "V14_CANDIDATE")
    throw new Error(`UNKNOWN_AUTHORITY_MODE:${authorityMode}`);
  if (authorityMode === "V13_CUTOVER") {
    if (authorityIndex.currentAuthorityVersion === "1.4") {
      // A corrective candidate must carry the authority state it will make
      // effective on protected main, but that candidate is accepted only by
      // the current v1.3 authority. The exception is unavailable on main.
      if (
        authorityIndex.correctiveActivation?.baseAuthorityVersion !== "1.3" ||
        authorityIndex.correctiveActivation?.candidateValidation !== "V13_CUTOVER_NON_MAIN_REF_ONLY" ||
        !githubRef ||
        githubRef !== authorityIndex.correctiveActivation?.candidateRef ||
        qualifiedBaseSha !== authorityIndex.correctiveActivation?.qualifiedBaseSha
      )
        throw new Error("V13_CUTOVER_FORBIDDEN_AFTER_V14_ACTIVATION");
    }
    return "V13_CUTOVER";
  }
  if (authorityIndex.currentAuthorityVersion === "1.4") {
    if (gateId !== "mainline") throw new Error("V14_AUTHORITY_MAINLINE_ONLY");
    if (authorityMode === "V14_CANDIDATE") {
      // Candidate qualification is dispatched from trusted protected main, but
      // plans and evidence bind an unmerged frozen PR head. It is deliberately
      // distinct from CURRENT, which remains accepted protected-main truth.
      if (githubRef !== "refs/heads/main") throw new Error("V14_CANDIDATE_TRUSTED_MAIN_WORKFLOW_REQUIRED");
      if (!/^[0-9a-f]{40}$/u.test(qualifiedBaseSha ?? "")) throw new Error("V14_CANDIDATE_QUALIFIED_BASE_REQUIRED");
      return "V14_CANDIDATE";
    }
    // A candidate can contain the future authority index while it is still
    // subject to v1.3 acceptance. Only the protected-main ref may exercise it.
    if (githubRef !== "refs/heads/main") throw new Error("V14_CURRENT_AUTHORITY_REQUIRES_PROTECTED_MAIN");
    return "V14_CURRENT";
  }
  return "V13_CURRENT";
}

export async function buildV14HostedPlan({
  root,
  gateId,
  serial,
  sourceSha,
  qualifiedBaseSha,
  manifest,
  registry,
  authorityIndex,
  authorityMode,
  predictedIdentity,
}) {
  if (!qualifiedBaseSha || !/^[0-9a-f]{40}$/u.test(qualifiedBaseSha)) throw new Error("V14_QUALIFIED_BASE_REQUIRED");
  const semanticPlan = await generateV14FastChannelPlan({
    root,
    baseSha: qualifiedBaseSha,
    candidateSha: sourceSha,
    gateId,
    predictedIdentity,
  });
  const plan = {
    version: 14,
    authority: "SOUNDING_LINE",
    authorityVersion: "1.4",
    authorityBoundary: authorityMode === "V14_CANDIDATE" ? "V14_CANDIDATE_QUALIFICATION" : "CURRENT_AUTHORITATIVE_V14",
    authorityMode,
    sourceSha,
    qualifiedBaseSha,
    candidateTreeSha: semanticPlan.candidateTreeSha,
    qualifiedBaseTreeSha: semanticPlan.qualifiedBaseTreeSha,
    predictedParentCommitSha: semanticPlan.predictedParentCommitSha,
    predictedParentTreeSha: semanticPlan.predictedParentTreeSha,
    predictedIntegrationTreeSha: semanticPlan.predictedIntegrationTreeSha,
    mergeStrategyIdentity: semanticPlan.mergeStrategyIdentity,
    gate: gateId,
    serial,
    policyDigest: digest(manifest),
    inventoryDigest: digest(registry),
    authorityDigest: digest(authorityIndex),
    semanticPlanDigest: semanticPlan.digest,
    selectionContract: semanticPlan.selectionContract,
    changedInterval: semanticPlan.changedInterval,
    selectionLedger: semanticPlan.ledger,
    evidenceDispositionCounts: semanticPlan.evidenceDispositionCounts,
    semanticFallback: semanticPlan.fallback,
    runtimeConformanceRequired: authorityIndex.runtimeConformance?.required === true,
    runtimeConformanceSuiteId: authorityIndex.runtimeConformance?.suiteId ?? null,
    nodes: semanticPlan.nodes.map((node) => {
      const cases = registry.cases.filter((entry) => entry.suiteId === node.id);
      const browserPartitions = browserPartitionsFor(node, cases);
      return {
        ...node,
        // Registry-selected browser-family cases execute in physically
        // partitioned workers. Retain every exact engine in the sealed logical
        // node so finalization can prove the lossless case cover. Other
        // adapter families retain their declared execution resources.
        resources: [
          ...new Set([
            ...node.resources,
            ...(browserPartitions.length ? cases.flatMap((entry) => entry.resources ?? []) : []),
          ]),
        ].sort(),
        testIds: cases.map((entry) => entry.id).sort(),
        ...(browserPartitions.length ? { browserPartitions } : {}),
      };
    }),
  };
  return { ...plan, planDigest: digest(plan) };
}

export async function buildPlan({
  root,
  gateId,
  serial = false,
  sourceSha = process.env.GITHUB_SHA ?? "LOCAL",
  qualifiedBaseSha = process.env.SOUNDING_LINE_BASE_SHA,
  authorityMode = process.env.SOUNDING_LINE_AUTHORITY_MODE ?? "CURRENT",
  githubRef = process.env.GITHUB_REF,
  predictedIdentity = undefined,
}) {
  const [manifest, suitesFile, gatesFile, registry, authorityIndex] = await Promise.all([
    json(root, "policy-manifest.json"),
    json(root, "suites.json"),
    json(root, "release-gates.json"),
    json(root, "generated/active-test-registry.json"),
    json(root, "sounding-line-authority.json"),
  ]);
  if (manifest.authority !== "sounding-line-authoritative") throw new Error("SOUNDING_LINE_AUTHORITY_NOT_ENABLED");
  if (
    authorityIndex.authority !== "SOUNDING_LINE" ||
    authorityIndex.effectiveAmendments?.partI !== "1.2" ||
    authorityIndex.effectiveAmendments?.partII !== "1.2" ||
    authorityIndex.effectiveAmendments?.partIII !== "1.3"
  )
    throw new Error("AUTHORITY_INDEX_MISMATCH");
  const resolvedAuthority = resolvePlanAuthority({
    authorityIndex,
    gateId,
    authorityMode,
    githubRef,
    qualifiedBaseSha,
  });
  if (resolvedAuthority === "V14_CURRENT" || resolvedAuthority === "V14_CANDIDATE") {
    return buildV14HostedPlan({
      root,
      gateId,
      serial,
      sourceSha,
      qualifiedBaseSha,
      manifest,
      registry,
      authorityIndex,
      authorityMode: resolvedAuthority,
      predictedIdentity,
    });
  }
  const gate = gatesFile.gates.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`UNKNOWN_GATE:${gateId}`);
  const suites = new Map(suitesFile.suites.map((suite) => [suite.id, suite]));
  const selected = new Set(gate.requiredSuites);
  // The access sentinel is a distinct, fast mainline safety net. Keeping the
  // invariant here prevents a catalog edit from accidentally dropping it.
  if (gateId === "mainline" && suites.has("browser.access-sentinel")) selected.add("browser.access-sentinel");
  if (gateId === "mainline") {
    selected.delete("browser.auth");
    selected.delete("browser.player-journal");
  }
  const visiting = new Set();
  const resolved = new Set();
  const includeDependencies = (suiteId) => {
    if (resolved.has(suiteId)) return;
    if (visiting.has(suiteId)) throw new Error(`SUITE_DEPENDENCY_CYCLE:${suiteId}`);
    visiting.add(suiteId);
    const suite = suites.get(suiteId);
    if (!suite) throw new Error(`UNKNOWN_SUITE:${suiteId}`);
    if (suite.status === "ARCHIVED_HISTORICAL_MATRIX" || suiteId.toLowerCase().includes("p34"))
      throw new Error(`ARCHIVED_SUITE_SELECTED:${suiteId}`);
    if (!suite.adapter && !Array.isArray(suite.testFiles)) throw new Error(`SUITE_HAS_NO_GOVERNED_ADAPTER:${suiteId}`);
    for (const dependency of suite.dependencies ?? []) {
      if (!selected.has(dependency)) selected.add(dependency);
      includeDependencies(dependency);
    }
    visiting.delete(suiteId);
    resolved.add(suiteId);
  };
  for (const suiteId of [...selected]) includeDependencies(suiteId);
  const nodes = [...selected].sort().map((suiteId) => {
    const suite = suites.get(suiteId);
    return {
      id: suiteId,
      dependencies: [...(suite.dependencies ?? [])],
      resources: [...(suite.resources ?? [])],
      explanation: "REQUIRED_BY_GATE",
      adapter: suite.adapter ?? "vitest",
      // GitHub-hosted jobs have independent local filesystems, ports, browser
      // processes, and build directories. Serialize only an actual declared
      // external/shared resource; the legacy broad parallelSafe flag cannot
      // create a host-global mutex.
      execution: {
        mode: suite.resources.some((resource) => hostedSharedResources.has(resource)) ? "exclusive" : "parallel",
        wave: 0,
      },
      testIds: registry.cases.filter((entry) => entry.suiteId === suiteId).map((entry) => entry.id),
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes)
    for (const dependency of node.dependencies)
      if (!ids.has(dependency)) throw new Error(`PLAN_DEPENDENCY_NOT_SELECTED:${node.id}:${dependency}`);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const waveFor = (node, visiting = new Set()) => {
    if (node.execution.wave) return node.execution.wave;
    if (visiting.has(node.id)) throw new Error(`PLAN_DEPENDENCY_CYCLE:${node.id}`);
    visiting.add(node.id);
    node.execution.wave = node.dependencies.length
      ? Math.max(...node.dependencies.map((dependency) => waveFor(nodesById.get(dependency), visiting))) + 1
      : 0;
    visiting.delete(node.id);
    return node.execution.wave;
  };
  for (const node of nodes) waveFor(node);
  const plan = {
    version: 2,
    authority: "SOUNDING_LINE",
    sourceSha,
    gate: gateId,
    serial,
    policyDigest: digest(manifest),
    inventoryDigest: digest(registry),
    authorityDigest: digest(authorityIndex),
    runtimeConformanceRequired: authorityIndex.runtimeConformance?.required === true,
    runtimeConformanceSuiteId: authorityIndex.runtimeConformance?.suiteId ?? null,
    nodes,
  };
  return { ...plan, planDigest: digest(plan) };
}
