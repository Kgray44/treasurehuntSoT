import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";

export type DrydockGraphEdge = {
  sourceBlockId: string;
  targetBlockId: string;
  connectionType: string;
  orderIndex: number;
  conditionExpression?: string | null;
};

export type DrydockChronicleGraph = {
  entryBlockId: string | null;
  blocks: ReadonlyMap<string, CanonicalDrydockBlock>;
  edges: readonly DrydockGraphEdge[];
  outgoing: ReadonlyMap<string, readonly DrydockGraphEdge[]>;
  incoming: ReadonlyMap<string, readonly DrydockGraphEdge[]>;
  terminalBlockIds: ReadonlySet<string>;
};

export type DrydockGraphAnalysis = {
  graph: DrydockChronicleGraph;
  proofCompleteness: "COMPLETE" | "INCOMPLETE_PROOF";
  reachableBlockIds: ReadonlySet<string>;
  completionReachableBlockIds: ReadonlySet<string>;
  stronglyConnectedComponents: readonly (readonly string[])[];
  issues: readonly DrydockIssue[];
};

/** Builds the one canonical static graph from accepted BlockConnection authority. */
export function buildDrydockChronicleGraph(blocks: readonly CanonicalDrydockBlock[]): DrydockChronicleGraph {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const edges = blocks.flatMap((block) =>
    block.connections.map((connection, index) => ({
      sourceBlockId: block.id,
      targetBlockId: connection.targetBlockId,
      connectionType: connection.connectionType,
      orderIndex: connection.orderIndex ?? index,
      conditionExpression: connection.conditionExpression,
    })),
  );
  const outgoing = new Map<string, DrydockGraphEdge[]>();
  const incoming = new Map<string, DrydockGraphEdge[]>();
  for (const block of blocks) {
    outgoing.set(block.id, []);
    incoming.set(block.id, []);
  }
  for (const edge of edges) {
    outgoing.get(edge.sourceBlockId)?.push(edge);
    incoming.get(edge.targetBlockId)?.push(edge);
  }
  for (const list of [...outgoing.values(), ...incoming.values()])
    list.sort((a, b) =>
      a.orderIndex - b.orderIndex ||
      a.connectionType.localeCompare(b.connectionType, "en") ||
      a.targetBlockId.localeCompare(b.targetBlockId, "en"),
    );
  return {
    entryBlockId: blocks[0]?.id ?? null,
    blocks: byId,
    edges,
    outgoing,
    incoming,
    terminalBlockIds: new Set(blocks.filter((block) => block.blockType === "taleComplete").map((block) => block.id)),
  };
}

function walk(start: readonly string[], adjacency: ReadonlyMap<string, readonly DrydockGraphEdge[]>, reverse = false) {
  const visited = new Set<string>();
  const queue = [...start];
  while (queue.length) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const edge of adjacency.get(id) ?? []) {
      const next = reverse ? edge.sourceBlockId : edge.targetBlockId;
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

function components(graph: DrydockChronicleGraph): string[][] {
  let index = 0;
  const indexes = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const result: string[][] = [];
  const visit = (id: string) => {
    indexes.set(id, index);
    lowlinks.set(id, index++);
    stack.push(id);
    onStack.add(id);
    for (const edge of graph.outgoing.get(id) ?? []) {
      const target = edge.targetBlockId;
      if (!graph.blocks.has(target)) continue;
      if (!indexes.has(target)) {
        visit(target);
        lowlinks.set(id, Math.min(lowlinks.get(id)!, lowlinks.get(target)!));
      } else if (onStack.has(target)) lowlinks.set(id, Math.min(lowlinks.get(id)!, indexes.get(target)!));
    }
    if (lowlinks.get(id) !== indexes.get(id)) return;
    const component: string[] = [];
    while (true) {
      const member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
      if (member === id) break;
    }
    result.push(component.sort((a, b) => a.localeCompare(b, "en")));
  };
  for (const id of graph.blocks.keys()) if (!indexes.has(id)) visit(id);
  return result;
}

/** Static proof only: it never treats an edge as a feasible state path. State feasibility is a separate bounded Phase 2 rule. */
export function analyzeDrydockGraph(blocks: readonly CanonicalDrydockBlock[]): DrydockGraphAnalysis {
  const graph = buildDrydockChronicleGraph(blocks);
  const reachableBlockIds = graph.entryBlockId ? walk([graph.entryBlockId], graph.outgoing) : new Set<string>();
  const completionReachableBlockIds = walk([...graph.terminalBlockIds], graph.incoming, true);
  const stronglyConnectedComponents = components(graph);
  const issues: DrydockIssue[] = [];
  if (!graph.entryBlockId)
    issues.push(createDrydockIssue({ code: "DRYDOCK_GRAPH_ENTRY_MISSING", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: {}, message: "This Chronicle has no entry Passage.", remediation: "Add an opening Passage before validating the Chronicle." }));
  if (!graph.terminalBlockIds.size)
    issues.push(createDrydockIssue({ code: "DRYDOCK_GRAPH_TERMINAL_MISSING", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: {}, message: "This Chronicle has no Voyage Complete terminal.", remediation: "Add a canonical Voyage Complete Passage." }));
  for (const edge of graph.edges)
    if (edge.conditionExpression?.trim())
      issues.push(createDrydockIssue({
        code: "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN",
        category: "CONTROL_FLOW",
        severity: "WARNING",
        ruleVersion: 1,
        location: { blockId: edge.sourceBlockId, fieldPath: `connections.${edge.orderIndex}.conditionExpression` },
        message: "This legacy edge condition has no typed static-proof adapter.",
        remediation: "Use a typed Condition Passage or obtain governed review before treating this edge as a proven required path.",
      }));
  for (const block of blocks) {
    if (!reachableBlockIds.has(block.id))
      issues.push(createDrydockIssue({ code: "DRYDOCK_GRAPH_UNREACHABLE", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: { blockId: block.id, blockType: block.blockType }, message: "This Passage has no syntactic path from the Chronicle entry.", remediation: "Connect it from a reachable canonical BlockConnection or remove it." }));
    else if (!completionReachableBlockIds.has(block.id))
      issues.push(createDrydockIssue({ code: "DRYDOCK_GRAPH_NO_TERMINAL_PATH", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: { blockId: block.id, blockType: block.blockType }, message: "This reachable Passage has no static path to Voyage Complete.", remediation: "Add an exit toward a canonical terminal or classify the branch as intentionally incomplete proof." }));
  }
  for (const component of stronglyConnectedComponents) {
    const cyclic = component.length > 1 || (graph.outgoing.get(component[0]) ?? []).some((edge) => edge.targetBlockId === component[0]);
    if (!cyclic) continue;
    const members = new Set(component);
    const exits = component.flatMap((id) => graph.outgoing.get(id) ?? []).filter((edge) => !members.has(edge.targetBlockId));
    if (!exits.length)
      issues.push(createDrydockIssue({ code: "DRYDOCK_GRAPH_AUTOMATIC_LOOP", category: "GRAPH", severity: "ERROR", ruleVersion: 1, location: { blockId: component[0] }, message: "A strongly connected Passage group has no static exit.", remediation: "Add a canonical exit or make the bounded state proof explicitly show termination.", metadata: { componentSize: component.length } }));
  }
  return {
    graph,
    proofCompleteness: issues.some((issue) => issue.code === "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN") ? "INCOMPLETE_PROOF" : "COMPLETE",
    reachableBlockIds,
    completionReachableBlockIds,
    stronglyConnectedComponents,
    issues,
  };
}
