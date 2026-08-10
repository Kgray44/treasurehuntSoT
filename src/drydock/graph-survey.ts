import { analyzeDrydockGraph, type DrydockGraphAnalysis } from "@/drydock/graph";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import type { DrydockIssue } from "@/drydock/issues";

/**
 * Creator-facing, non-prose projection of the canonical Chronicle graph.
 *
 * This intentionally excludes Passage content, connection labels, and free-form
 * predicates. It is suitable for a graph overlay or an equivalent nonvisual
 * survey without creating a second navigation authority.
 */
export type DrydockGraphSurvey = {
  schemaVersion: 1;
  proofCompleteness: DrydockGraphAnalysis["proofCompleteness"];
  entryBlockId: string | null;
  chronicleAnnotations: readonly { code: string; category: string; severity: string }[];
  nodes: readonly {
    id: string;
    blockType: string;
    isEntry: boolean;
    isTerminal: boolean;
    isReachable: boolean;
    canReachTerminal: boolean;
    stronglyConnectedComponent: number | null;
    annotations: readonly { code: string; category: string; severity: string }[];
  }[];
  edges: readonly {
    sourceBlockId: string;
    targetBlockId: string;
    connectionType: string;
    orderIndex: number;
    hasUnprovenLegacyCondition: boolean;
  }[];
};

export function createDrydockGraphSurvey(
  blocks: readonly CanonicalDrydockBlock[],
  analysis = analyzeDrydockGraph(blocks),
  issues: readonly DrydockIssue[] = analysis.issues,
): DrydockGraphSurvey {
  const componentByBlockId = new Map<string, number>();
  analysis.stronglyConnectedComponents.forEach((component, index) => {
    for (const blockId of component) componentByBlockId.set(blockId, index);
  });
  const annotation = (issue: DrydockIssue) => ({ code: issue.code, category: issue.category, severity: issue.severity });
  const annotationsByBlockId = new Map<string, { code: string; category: string; severity: string }[]>();
  for (const issue of issues)
    if (issue.location.blockId)
      annotationsByBlockId.set(issue.location.blockId, [...(annotationsByBlockId.get(issue.location.blockId) ?? []), annotation(issue)]);
  const ordered = (entries: readonly { code: string; category: string; severity: string }[]) =>
    [...entries].sort((a, b) => a.code.localeCompare(b.code, "en") || a.category.localeCompare(b.category, "en"));
  return {
    schemaVersion: 1,
    proofCompleteness: analysis.proofCompleteness,
    entryBlockId: analysis.graph.entryBlockId,
    chronicleAnnotations: ordered(issues.filter((issue) => !issue.location.blockId).map(annotation)),
    nodes: [...analysis.graph.blocks.values()]
      .map((block) => ({
        id: block.id,
        blockType: block.blockType,
        isEntry: block.id === analysis.graph.entryBlockId,
        isTerminal: analysis.graph.terminalBlockIds.has(block.id),
        isReachable: analysis.reachableBlockIds.has(block.id),
        canReachTerminal: analysis.completionReachableBlockIds.has(block.id),
        stronglyConnectedComponent: componentByBlockId.get(block.id) ?? null,
        annotations: ordered(annotationsByBlockId.get(block.id) ?? []),
      }))
      .sort((a, b) => a.id.localeCompare(b.id, "en")),
    edges: [...analysis.graph.edges]
      .map((edge) => ({
        sourceBlockId: edge.sourceBlockId,
        targetBlockId: edge.targetBlockId,
        connectionType: edge.connectionType,
        orderIndex: edge.orderIndex,
        hasUnprovenLegacyCondition: Boolean(edge.conditionExpression?.trim()),
      }))
      .sort((a, b) =>
        a.sourceBlockId.localeCompare(b.sourceBlockId, "en") ||
        a.orderIndex - b.orderIndex ||
        a.targetBlockId.localeCompare(b.targetBlockId, "en")),
  };
}
