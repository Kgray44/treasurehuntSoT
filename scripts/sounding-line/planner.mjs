/* Deterministic, allowlist-only Sounding Line plan builder. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const json = async (root, file) => JSON.parse(await readFile(path.join(root, "testing", file), "utf8"));

export async function buildPlan({ root, gateId, serial = false, sourceSha = process.env.GITHUB_SHA ?? "LOCAL" }) {
  const [manifest, suitesFile, gatesFile, registry] = await Promise.all([
    json(root, "policy-manifest.json"),
    json(root, "suites.json"),
    json(root, "release-gates.json"),
    json(root, "generated/active-test-registry.json"),
  ]);
  if (manifest.authority !== "sounding-line-authoritative") throw new Error("SOUNDING_LINE_AUTHORITY_NOT_ENABLED");
  const gate = gatesFile.gates.find((candidate) => candidate.id === gateId);
  if (!gate) throw new Error(`UNKNOWN_GATE:${gateId}`);
  const suites = new Map(suitesFile.suites.map((suite) => [suite.id, suite]));
  const nodes = [...new Set(gate.requiredSuites)].map((suiteId) => {
    const suite = suites.get(suiteId);
    if (!suite) throw new Error(`UNKNOWN_SUITE:${suiteId}`);
    if (suite.status === "ARCHIVED_HISTORICAL_MATRIX" || suiteId.toLowerCase().includes("p34"))
      throw new Error(`ARCHIVED_SUITE_SELECTED:${suiteId}`);
    if (!suite.adapter && !Array.isArray(suite.testFiles)) throw new Error(`SUITE_HAS_NO_GOVERNED_ADAPTER:${suiteId}`);
    return {
      id: suiteId,
      dependencies: [...(suite.dependencies ?? [])],
      resources: [...(suite.resources ?? [])],
      explanation: "REQUIRED_BY_GATE",
      adapter: suite.adapter ?? "vitest",
      testIds: registry.cases.filter((entry) => entry.suiteId === suiteId).map((entry) => entry.id),
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  for (const node of nodes)
    for (const dependency of node.dependencies)
      if (!ids.has(dependency)) throw new Error(`PLAN_DEPENDENCY_NOT_SELECTED:${node.id}:${dependency}`);
  const plan = {
    version: 1,
    authority: "SOUNDING_LINE",
    sourceSha,
    gate: gateId,
    serial,
    policyDigest: digest(manifest),
    inventoryDigest: digest(registry),
    nodes,
  };
  return { ...plan, planDigest: digest(plan) };
}
