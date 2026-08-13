import type { DrydockChronicleGraph } from "@/drydock/graph";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { collectExpressionVariableReferences, evaluateExpression, typeCheckExpression } from "@/drydock/expressions";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";
import {
  createVariableRegistry,
  type DrydockVariableDeclaration,
  type DrydockVariableUsage,
  type DrydockVariableValue,
} from "@/drydock/variables";

export type DrydockStateProofStatus = "PROVEN" | "INCOMPLETE_PROOF";

export type DrydockStateAnalysis = {
  status: DrydockStateProofStatus;
  definitelyInitializedBefore: ReadonlyMap<string, ReadonlySet<string>>;
  issues: readonly DrydockIssue[];
  iterations: number;
};

const writeInitializes = (usage: DrydockVariableUsage) =>
  usage.kind === "WRITE" &&
  !["increment", "decrement", "toggle", "min", "max", "add", "remove"].includes(usage.operation ?? "assign");

const requiresPriorValue = (usage: DrydockVariableUsage) =>
  usage.kind === "EXPRESSION" ||
  (usage.kind === "WRITE" &&
    ["increment", "decrement", "toggle", "min", "max", "add", "remove"].includes(usage.operation ?? ""));

const intersection = (sets: readonly ReadonlySet<string>[]) => {
  if (!sets.length) return new Set<string>();
  const result = new Set(sets[0]);
  for (const set of sets.slice(1)) for (const value of result) if (!set.has(value)) result.delete(value);
  return result;
};

/**
 * Computes facts that are true on every syntactic path. The algorithm is bounded;
 * callers must surface INCOMPLETE_PROOF rather than promote a partial result.
 */
export function analyzeDrydockDefiniteInitialization(input: {
  graph: DrydockChronicleGraph;
  declarations: readonly DrydockVariableDeclaration[];
  usages: readonly DrydockVariableUsage[];
  maximumIterations?: number;
}): DrydockStateAnalysis {
  const maximumIterations = input.maximumIterations ?? Math.max(16, input.graph.blocks.size * 4);
  const defaults = new Set(
    input.declarations
      .filter((declaration) => declaration.defaultValue !== undefined)
      .map((declaration) => declaration.id),
  );
  const usagesByBlock = new Map<string, DrydockVariableUsage[]>();
  for (const usage of input.usages)
    if (usage.blockId) usagesByBlock.set(usage.blockId, [...(usagesByBlock.get(usage.blockId) ?? []), usage]);
  const before = new Map<string, Set<string>>();
  const after = new Map<string, Set<string>>();
  for (const id of input.graph.blocks.keys()) {
    before.set(id, new Set());
    after.set(id, new Set());
  }
  let changed = true;
  let iterations = 0;
  while (changed && iterations++ < maximumIterations) {
    changed = false;
    for (const id of input.graph.blocks.keys()) {
      const predecessors = (input.graph.incoming.get(id) ?? [])
        .map((edge) => edge.sourceBlockId)
        .filter((source) => input.graph.blocks.has(source));
      const incoming =
        id === input.graph.entryBlockId
          ? new Set(defaults)
          : new Set([...defaults, ...intersection(predecessors.map((source) => after.get(source) ?? new Set()))]);
      const outgoing = new Set(incoming);
      for (const usage of usagesByBlock.get(id) ?? []) if (writeInitializes(usage)) outgoing.add(usage.variableId);
      const equal = (left: ReadonlySet<string>, right: ReadonlySet<string>) =>
        left.size === right.size && [...left].every((value) => right.has(value));
      if (!equal(before.get(id)!, incoming) || !equal(after.get(id)!, outgoing)) {
        before.set(id, incoming);
        after.set(id, outgoing);
        changed = true;
      }
    }
  }
  const status: DrydockStateProofStatus = changed ? "INCOMPLETE_PROOF" : "PROVEN";
  const issues: DrydockIssue[] = [];
  if (status === "INCOMPLETE_PROOF")
    issues.push(
      createDrydockIssue({
        code: "DRYDOCK_STATE_PROOF_INCOMPLETE",
        category: "STATE",
        severity: "WARNING",
        ruleVersion: 1,
        location: {},
        message: "Definite-initialization analysis reached its explicit proof bound.",
        remediation: "Reduce the state/graph complexity or request a governed full analysis with a larger bound.",
        metadata: { maximumIterations },
      }),
    );
  for (const [blockId, usages] of usagesByBlock) {
    const initialized = before.get(blockId) ?? new Set<string>();
    for (const usage of usages) {
      if (!requiresPriorValue(usage) || initialized.has(usage.variableId)) continue;
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_VARIABLE_NOT_DEFINITELY_INITIALIZED",
          category: "STATE",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId, variableId: usage.variableId, fieldPath: usage.fieldPath },
          message: "This variable is read or mutated without proof that every path initializes it first.",
          remediation: "Declare a compatible default or initialize the variable on every path before this operation.",
        }),
      );
    }
  }
  for (const declaration of input.declarations) {
    const variableUsages = input.usages.filter((usage) => usage.variableId === declaration.id);
    const read = variableUsages.some(
      (usage) => usage.kind === "READ" || usage.kind === "EXPRESSION" || usage.kind === "OPERATION",
    );
    const write = variableUsages.some((usage) => usage.kind === "WRITE");
    if (!read && !write)
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_VARIABLE_UNUSED",
          category: "STATE",
          severity: "WARNING",
          ruleVersion: 1,
          location: { variableId: declaration.id, fieldPath: `variables.${declaration.id}` },
          message: "This declared variable has no Chronicle read or write.",
          remediation: "Remove the unused declaration or connect it to a governed condition or variable operation.",
        }),
      );
    else if (!read && write)
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_VARIABLE_WRITE_NEVER_READ",
          category: "STATE",
          severity: "WARNING",
          ruleVersion: 1,
          location: { variableId: declaration.id, fieldPath: `variables.${declaration.id}` },
          message: "This variable is written but never read by the static Chronicle model.",
          remediation: "Add the governed read that consumes this state or remove the inert write.",
        }),
      );
  }
  return { status, definitelyInitializedBefore: before, issues, iterations };
}

/**
 * Proves constants only from literal expressions or variables that have defaults and no
 * authored writes anywhere in the Chronicle. All other expressions remain unclassified.
 */
export function analyzeDrydockConditionFeasibility(input: {
  blocks: readonly CanonicalDrydockBlock[];
  declarations: readonly DrydockVariableDeclaration[];
  usages: readonly DrydockVariableUsage[];
}): readonly DrydockIssue[] {
  const registry = createVariableRegistry(input.declarations);
  const written = new Set(input.usages.filter((usage) => usage.kind === "WRITE").map((usage) => usage.variableId));
  const state: Record<string, DrydockVariableValue> = {};
  for (const declaration of input.declarations)
    if (declaration.defaultValue !== undefined && !written.has(declaration.id))
      state[declaration.id] = declaration.defaultValue;
  const issues: DrydockIssue[] = [];
  for (const block of input.blocks) {
    if (block.blockType !== "condition" || !block.expression) continue;
    const checked = typeCheckExpression(block.expression, registry);
    if (checked.type?.kind !== "BOOLEAN") {
      issues.push(
        createDrydockIssue({
          code: "DRYDOCK_CONDITION_EXPRESSION_NOT_BOOLEAN",
          category: "STATE",
          severity: "ERROR",
          ruleVersion: 1,
          location: { blockId: block.id, blockType: block.blockType, fieldPath: "configuration.expression" },
          message: "A Condition Passage requires a Boolean expression.",
          remediation: "Use a typed comparison or logical expression that resolves to Boolean.",
        }),
      );
      continue;
    }
    const references = collectExpressionVariableReferences(block.expression);
    if (references.some((variableId) => !(variableId in state))) continue;
    try {
      const value = evaluateExpression(block.expression, registry, state);
      if (typeof value !== "boolean") continue;
      issues.push(
        createDrydockIssue({
          code: value ? "DRYDOCK_CONDITION_ALWAYS_TRUE" : "DRYDOCK_CONDITION_ALWAYS_FALSE",
          category: "STATE",
          severity: "WARNING",
          ruleVersion: 1,
          location: { blockId: block.id, blockType: block.blockType, fieldPath: "configuration.expression" },
          message: value
            ? "This Condition Passage is statically always true."
            : "This Condition Passage is statically always false.",
          remediation: "Revise the condition or remove the unreachable branch after reviewing Chronicle intent.",
        }),
      );
    } catch {
      // The expression validator remains the authority for malformed or widened expressions.
    }
  }
  return issues;
}
