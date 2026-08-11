import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import {
  DRYDOCK_EXPRESSION_MAX_DEPTH,
  DRYDOCK_EXPRESSION_MAX_NODES,
  expressionDepth,
  expressionNodeCount,
} from "@/drydock/expressions";
import type { DrydockGraphAnalysis } from "@/drydock/graph";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";
import type { DrydockVariableDeclaration } from "@/drydock/variables";

export const drydockPerformanceLimits = {
  warningBlockCount: 256,
  warningEdgeCount: 512,
  warningFanOut: 12,
  warningVariableCount: 64,
  warningComplexityProduct: 4096,
  expressionWarningRatio: 0.75,
} as const;

const warning = (
  code: string,
  message: string,
  remediation: string,
  metadata: Record<string, number>,
  block?: CanonicalDrydockBlock,
) =>
  createDrydockIssue({
    code,
    category: "PERFORMANCE",
    severity: "WARNING",
    ruleVersion: 1,
    location: block ? { blockId: block.id, blockType: block.blockType, fieldPath: "configuration.expression" } : {},
    message,
    remediation,
    metadata,
  });

/** Bounded configuration-cost survey; it does not model device, network, or provider runtime behavior. */
export function analyzeDrydockPerformance(input: {
  blocks: readonly CanonicalDrydockBlock[];
  graphAnalysis: DrydockGraphAnalysis;
  declarations: readonly DrydockVariableDeclaration[];
}): readonly DrydockIssue[] {
  const issues: DrydockIssue[] = [];
  const { blocks, graphAnalysis, declarations } = input;
  if (blocks.length >= drydockPerformanceLimits.warningBlockCount)
    issues.push(
      warning(
        "DRYDOCK_PERFORMANCE_BLOCK_COUNT_HIGH",
        "This Chronicle approaches the governed static block-count review threshold.",
        "Split the Chronicle or obtain a governed performance review before increasing authored complexity.",
        { blockCount: blocks.length },
      ),
    );
  if (graphAnalysis.graph.edges.length >= drydockPerformanceLimits.warningEdgeCount)
    issues.push(
      warning(
        "DRYDOCK_PERFORMANCE_EDGE_COUNT_HIGH",
        "This Chronicle approaches the governed static edge-count review threshold.",
        "Reduce graph density or obtain a governed performance review.",
        { edgeCount: graphAnalysis.graph.edges.length },
      ),
    );
  if (declarations.length >= drydockPerformanceLimits.warningVariableCount)
    issues.push(
      warning(
        "DRYDOCK_PERFORMANCE_VARIABLE_COUNT_HIGH",
        "This Chronicle approaches the governed variable-count review threshold.",
        "Consolidate state or obtain a governed performance review.",
        { variableCount: declarations.length },
      ),
    );
  const complexityProduct = blocks.length * declarations.length;
  if (complexityProduct >= drydockPerformanceLimits.warningComplexityProduct)
    issues.push(
      warning(
        "DRYDOCK_PERFORMANCE_STATE_COMPLEXITY_HIGH",
        "The graph and variable catalog create a high bounded-analysis complexity estimate.",
        "Reduce state/graph complexity or request a governed full-analysis review.",
        { blockCount: blocks.length, variableCount: declarations.length, complexityProduct },
      ),
    );
  for (const block of blocks) {
    const fanOut = graphAnalysis.graph.outgoing.get(block.id)?.length ?? 0;
    if (fanOut >= drydockPerformanceLimits.warningFanOut)
      issues.push(
        warning(
          "DRYDOCK_PERFORMANCE_FAN_OUT_HIGH",
          "This Passage has high authored branching fan-out.",
          "Reduce simultaneous branch choices or document why this branching remains usable.",
          { fanOut },
          block,
        ),
      );
    if (!block.expression) continue;
    const depth = expressionDepth(block.expression.root);
    const nodes = expressionNodeCount(block.expression.root);
    if (
      depth >= DRYDOCK_EXPRESSION_MAX_DEPTH * drydockPerformanceLimits.expressionWarningRatio ||
      nodes >= DRYDOCK_EXPRESSION_MAX_NODES * drydockPerformanceLimits.expressionWarningRatio
    )
      issues.push(
        warning(
          "DRYDOCK_PERFORMANCE_EXPRESSION_NEAR_LIMIT",
          "This typed expression approaches a governed complexity limit.",
          "Simplify the expression before it reaches the hard validation limit.",
          { depth, nodes },
          block,
        ),
      );
  }
  return issues;
}
