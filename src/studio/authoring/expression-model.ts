import type { DrydockVariableType, DrydockVariableValue } from "@/drydock/variables";

/**
 * Browser-safe projection of Drydock's expression AST.  Runtime parsing,
 * canonicalization, and validation remain in `src/drydock/expressions.ts` on
 * the server; the Studio needs only these serializable shapes to construct a
 * candidate AST for the canonical draft mutation path.
 */
export type ShipwrightExpressionLiteral = {
  kind: "literal";
  valueType: "BOOLEAN" | "INTEGER" | "NUMBER" | "STRING" | "ENUM" | "STRING_SET" | "IDENTIFIER_REFERENCE";
  value: DrydockVariableValue;
  enumDomainId?: string;
  identifierEntityType?: string;
};
export type ShipwrightExpressionVariable = { kind: "variable"; variableId: string };
export type ShipwrightExpressionCompare = {
  kind: "compare";
  operator: "equals" | "notEquals" | "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual";
  left: ShipwrightExpressionNode;
  right: ShipwrightExpressionNode;
};
export type ShipwrightExpressionLogical = {
  kind: "logical";
  operator: "and" | "or";
  operands: ShipwrightExpressionNode[];
};
export type ShipwrightExpressionNot = { kind: "not"; operand: ShipwrightExpressionNode };
export type ShipwrightExpressionContains = {
  kind: "contains";
  source: ShipwrightExpressionNode;
  value: ShipwrightExpressionNode;
};
export type ShipwrightExpressionCount = { kind: "count"; source: ShipwrightExpressionNode };
export type ShipwrightExpressionNode =
  | ShipwrightExpressionLiteral
  | ShipwrightExpressionVariable
  | ShipwrightExpressionCompare
  | ShipwrightExpressionLogical
  | ShipwrightExpressionNot
  | ShipwrightExpressionContains
  | ShipwrightExpressionCount;
export type ShipwrightExpression = { schemaVersion: 1; root: ShipwrightExpressionNode };

export type ShipwrightExpressionDiagnostic = { code: string; message: string };

const numeric = (type: DrydockVariableType | null) => type?.kind === "INTEGER" || type?.kind === "NUMBER";
const sameType = (left: DrydockVariableType | null, right: DrydockVariableType | null) => {
  if (!left || !right) return false;
  if (numeric(left) && numeric(right)) return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === "ENUM" && right.kind === "ENUM") return left.domainId === right.domainId;
  if (left.kind === "IDENTIFIER_REFERENCE" && right.kind === "IDENTIFIER_REFERENCE")
    return left.entityType === right.entityType;
  return true;
};

function literalType(node: ShipwrightExpressionLiteral): DrydockVariableType | null {
  if (node.valueType === "BOOLEAN" && typeof node.value === "boolean") return { kind: "BOOLEAN" };
  if (node.valueType === "INTEGER" && typeof node.value === "number" && Number.isSafeInteger(node.value))
    return { kind: "INTEGER" };
  if (node.valueType === "NUMBER" && typeof node.value === "number" && Number.isFinite(node.value))
    return { kind: "NUMBER" };
  if (node.valueType === "STRING" && typeof node.value === "string") return { kind: "STRING" };
  if (node.valueType === "ENUM" && typeof node.value === "string" && node.enumDomainId)
    return { kind: "ENUM", domainId: node.enumDomainId, members: [node.value] };
  if (
    node.valueType === "STRING_SET" &&
    Array.isArray(node.value) &&
    node.value.every((item) => typeof item === "string")
  )
    return { kind: "STRING_SET" };
  if (
    node.valueType === "IDENTIFIER_REFERENCE" &&
    (node.value === null || typeof node.value === "string") &&
    node.identifierEntityType
  )
    return { kind: "IDENTIFIER_REFERENCE", entityType: node.identifierEntityType };
  return null;
}

export function inspectExpressionCandidate(
  expression: ShipwrightExpression,
  variables: ReadonlyMap<string, DrydockVariableType>,
): ShipwrightExpressionDiagnostic[] {
  const diagnostics: ShipwrightExpressionDiagnostic[] = [];
  const visit = (node: ShipwrightExpressionNode): DrydockVariableType | null => {
    if (node.kind === "literal") return literalType(node);
    if (node.kind === "variable") {
      const type = variables.get(node.variableId) ?? null;
      if (!type)
        diagnostics.push({
          code: "DRYDOCK_EXPRESSION_VARIABLE_UNKNOWN",
          message: "Expression references an undeclared variable.",
        });
      return type;
    }
    if (node.kind === "compare") {
      const left = visit(node.left);
      const right = visit(node.right);
      if (!sameType(left, right))
        diagnostics.push({
          code: "DRYDOCK_EXPRESSION_COMPARE_TYPE",
          message: "Comparison operands have incompatible types.",
        });
      if (!["equals", "notEquals"].includes(node.operator) && !(numeric(left) && numeric(right)))
        diagnostics.push({
          code: "DRYDOCK_EXPRESSION_ORDER_TYPE",
          message: "Ordered comparison requires numeric operands.",
        });
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "logical") {
      for (const operand of node.operands)
        if (visit(operand)?.kind !== "BOOLEAN")
          diagnostics.push({ code: "DRYDOCK_EXPRESSION_LOGICAL_TYPE", message: "Logical operands must be Boolean." });
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "not") {
      if (visit(node.operand)?.kind !== "BOOLEAN")
        diagnostics.push({ code: "DRYDOCK_EXPRESSION_NOT_TYPE", message: "NOT requires a Boolean operand." });
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "contains") {
      const source = visit(node.source);
      const value = visit(node.value);
      if (source?.kind !== "STRING_SET" || value?.kind !== "STRING")
        diagnostics.push({
          code: "DRYDOCK_EXPRESSION_CONTAINS_TYPE",
          message: "Contains requires a String Set and a String.",
        });
      return { kind: "BOOLEAN" };
    }
    if (visit(node.source)?.kind !== "STRING_SET")
      diagnostics.push({ code: "DRYDOCK_EXPRESSION_COUNT_TYPE", message: "Count requires a String Set." });
    return { kind: "INTEGER" };
  };
  visit(expression.root);
  return diagnostics;
}
