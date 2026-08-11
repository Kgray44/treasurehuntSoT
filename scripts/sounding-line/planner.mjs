/* Deterministic, allowlist-only Sounding Line plan builder. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const json = async (root, file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));
const hostedSharedResources = new Set(["restart-host", "external-provider"]);

export async function buildPlan({ root, gateId, serial = false, sourceSha = process.env.GITHUB_SHA ?? "LOCAL" }) {
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
    !["partI", "partII", "partIII"].every((part) => authorityIndex.effectiveAmendments?.[part] === "1.2")
  )
    throw new Error("AUTHORITY_INDEX_MISMATCH");
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
