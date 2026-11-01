import { canonicalJson, digest } from "./evidence.mjs";

export const ARTIFACT_GRAPH_VERSION = 2;
export const DEPENDENCY_TYPES = Object.freeze([
  "SOURCE",
  "ROUTE",
  "PROJECTION",
  "STYLE",
  "TOKEN",
  "FONT",
  "ASSET",
  "CONTRACT",
  "FIXTURE",
  "SCHEMA",
  "TEST",
  "LOCK",
  "BROWSER",
  "TOOLCHAIN",
  "ENVIRONMENT",
  "POLICY",
  "CONTEXT",
  "ARTIFACT",
  "REVIEW_DIMENSION",
]);
const types = new Set(DEPENDENCY_TYPES);
const sha256 = /^[a-f0-9]{64}$/u;
const need = (condition, code) => {
  if (!condition) throw new Error(`SOUNDING_LINE_ARTIFACT_GRAPH_${code}`);
};
const identifier = (value) =>
  typeof value === "string" && value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/u.test(value);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// This structure describes dependencies, never authority. Only a protected
// source reader may construct the graph used to admit inherited evidence.
export function createArtifactDependencyGraph(input) {
  need(Array.isArray(input) && input.length <= 100000, "NODE_BOUND");
  const ids = new Set();
  let edges = 0;
  const nodes = input
    .map((node) => {
      need(node && identifier(node.id) && !ids.has(node.id), "NODE_IDENTITY");
      ids.add(node.id);
      need(types.has(node.type) && sha256.test(node.digest ?? ""), "NODE_TYPE_OR_DIGEST");
      need(Array.isArray(node.dependencies) && node.dependencies.length <= 100000, "EDGE_BOUND");
      edges += node.dependencies.length;
      need(edges <= 1000000, "TOTAL_EDGE_BOUND");
      need(
        node.dependencies.every(identifier) && new Set(node.dependencies).size === node.dependencies.length,
        "EDGE_IDENTITY",
      );
      need(node.unknown === undefined || typeof node.unknown === "boolean", "UNKNOWN_INPUT_FLAG");
      return {
        id: node.id,
        type: node.type,
        digest: node.digest,
        dependencies: [...node.dependencies].sort(compare),
        unknown: node.unknown === true,
      };
    })
    .sort((a, b) => compare(a.id, b.id));
  for (const node of nodes) for (const dependency of node.dependencies) need(ids.has(dependency), "DANGLING_EDGE");
  const value = { version: ARTIFACT_GRAPH_VERSION, nodes };
  return { ...value, graphDigest: digest(value) };
}

function checkedGraph(graph) {
  need(graph?.version === ARTIFACT_GRAPH_VERSION, "VERSION");
  const checked = createArtifactDependencyGraph(graph.nodes);
  need(checked.graphDigest === graph.graphDigest, "INTEGRITY");
  return new Map(checked.nodes.map((node) => [node.id, node]));
}

function reachable(graphs, roots) {
  need(Array.isArray(roots) && roots.length > 0 && roots.every(identifier), "ROOTS");
  const found = new Set(),
    queue = [...new Set(roots)];
  let unknown = false;
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index];
    if (found.has(id)) continue;
    found.add(id);
    const entries = graphs.map((graph) => graph.get(id)).filter(Boolean);
    if (!entries.length) unknown = true;
    for (const node of entries) {
      unknown ||= node.unknown;
      for (const dependency of node.dependencies) if (!found.has(dependency)) queue.push(dependency);
    }
    need(found.size <= 100000 && queue.length <= 2000000, "CLOSURE_BOUND");
  }
  return { ids: [...found].sort(compare), unknown };
}

function closureFromNodes(nodes, roots) {
  const closure = reachable([nodes], roots);
  const members = closure.ids.map((id) => nodes.get(id) ?? { id, missing: true });
  return { ...closure, closureDigest: digest(members) };
}
export function artifactDependencyClosure(graph, roots) {
  return closureFromNodes(checkedGraph(graph), roots);
}

// The union is essential: a deleted node or removed edge remains visible from
// the base graph and cannot make its former consumer appear unaffected.
export function reconcileArtifactDependencyGraphs({ base, candidate, roots }) {
  const prior = checkedGraph(base),
    current = checkedGraph(candidate);
  return reconcileCompiled({ base, candidate, roots, prior, current });
}
function reconcileCompiled({ base, candidate, roots, prior, current }) {
  const union = reachable([prior, current], roots);
  const changed = union.ids.filter(
    (id) => canonicalJson(prior.get(id) ?? null) !== canonicalJson(current.get(id) ?? null),
  );
  const before = closureFromNodes(prior, roots),
    after = closureFromNodes(current, roots);
  const unknown = union.unknown || before.unknown || after.unknown;
  return {
    disposition: unknown ? "CONSERVATIVE_FRESH" : changed.length ? "INVALIDATED" : "UNCHANGED_COMPLETE_CLOSURE",
    reasonCodes: unknown
      ? ["UNKNOWN_DEPENDENCY_OR_RUNTIME_INPUT"]
      : changed.length
        ? ["DEPENDENCY_INTERVAL_CHANGED"]
        : ["EXACT_BYTE_AND_EDGE_IDENTITY"],
    baseGraphDigest: base.graphDigest,
    candidateGraphDigest: candidate.graphDigest,
    unionMembers: union.ids,
    changed,
    originalClosureDigest: before.closureDigest,
    currentClosureDigest: after.closureDigest,
    qualification: false,
  };
}

export function planArtifactInvalidation({ base, candidate, contexts }) {
  need(Array.isArray(contexts) && contexts.length <= 10000, "CONTEXT_BOUND");
  const seen = new Set();
  const prior = checkedGraph(base),
    current = checkedGraph(candidate);
  const outcomes = contexts.map((context) => {
    need(identifier(context.id) && !seen.has(context.id), "CONTEXT_IDENTITY");
    seen.add(context.id);
    return { id: context.id, ...reconcileCompiled({ base, candidate, roots: context.dependencies, prior, current }) };
  });
  return {
    version: ARTIFACT_GRAPH_VERSION,
    outcomes,
    freshContextIds: outcomes
      .filter((value) => value.disposition !== "UNCHANGED_COMPLETE_CLOSURE")
      .map((value) => value.id),
    unchangedContextIds: outcomes
      .filter((value) => value.disposition === "UNCHANGED_COMPLETE_CLOSURE")
      .map((value) => value.id),
    qualification: false,
  };
}
