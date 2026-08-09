import { z } from "zod";
import { canonicalJson, DRYDOCK_MAX_CANONICAL_BYTES } from "@/drydock/canonical";
import { createDrydockIssue, type DrydockIssue } from "@/drydock/issues";
import type {
  DrydockVariableDeclaration,
  DrydockVariableRegistry,
  DrydockVariableType,
  DrydockVariableValue,
} from "@/drydock/variables";

export const DRYDOCK_EXPRESSION_VERSION = 1 as const;
export const DRYDOCK_EXPRESSION_MAX_DEPTH = 16;
export const DRYDOCK_EXPRESSION_MAX_NODES = 128;
export const DRYDOCK_EXPRESSION_MAX_LOGICAL_OPERANDS = 16;
export const DRYDOCK_EXPRESSION_MAX_SET_MEMBERS = 128;

export type DrydockLiteralExpression = {
  kind: "literal";
  valueType: "BOOLEAN" | "INTEGER" | "NUMBER" | "STRING" | "ENUM" | "STRING_SET" | "IDENTIFIER_REFERENCE";
  value: DrydockVariableValue;
  enumDomainId?: string;
  identifierEntityType?: string;
};
export type DrydockVariableExpression = { kind: "variable"; variableId: string };
export type DrydockCompareExpression = {
  kind: "compare";
  operator: "equals" | "notEquals" | "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual";
  left: DrydockExpressionNode;
  right: DrydockExpressionNode;
};
export type DrydockLogicalExpression = {
  kind: "logical";
  operator: "and" | "or";
  operands: DrydockExpressionNode[];
};
export type DrydockNotExpression = { kind: "not"; operand: DrydockExpressionNode };
export type DrydockContainsExpression = {
  kind: "contains";
  source: DrydockExpressionNode;
  value: DrydockExpressionNode;
};
export type DrydockCountExpression = { kind: "count"; source: DrydockExpressionNode };
export type DrydockExpressionNode =
  | DrydockLiteralExpression
  | DrydockVariableExpression
  | DrydockCompareExpression
  | DrydockLogicalExpression
  | DrydockNotExpression
  | DrydockContainsExpression
  | DrydockCountExpression;
export type DrydockExpression = { schemaVersion: 1; root: DrydockExpressionNode };

const nodeSchema: z.ZodType<DrydockExpressionNode> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("literal"),
        valueType: z.enum(["BOOLEAN", "INTEGER", "NUMBER", "STRING", "ENUM", "STRING_SET", "IDENTIFIER_REFERENCE"]),
        value: z.union([
          z.boolean(),
          z.number().finite(),
          z.string().max(4000),
          z.array(z.string().max(4000)).max(DRYDOCK_EXPRESSION_MAX_SET_MEMBERS),
          z.null(),
        ]),
        enumDomainId: z.string().min(1).max(128).optional(),
        identifierEntityType: z.string().min(1).max(128).optional(),
      })
      .strict(),
    z.object({ kind: z.literal("variable"), variableId: z.string().min(1).max(128) }).strict(),
    z
      .object({
        kind: z.literal("compare"),
        operator: z.enum(["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"]),
        left: nodeSchema,
        right: nodeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("logical"),
        operator: z.enum(["and", "or"]),
        operands: z.array(nodeSchema).min(2).max(DRYDOCK_EXPRESSION_MAX_LOGICAL_OPERANDS),
      })
      .strict(),
    z.object({ kind: z.literal("not"), operand: nodeSchema }).strict(),
    z.object({ kind: z.literal("contains"), source: nodeSchema, value: nodeSchema }).strict(),
    z.object({ kind: z.literal("count"), source: nodeSchema }).strict(),
  ]),
);

export const drydockExpressionSchema: z.ZodType<DrydockExpression> = z
  .object({ schemaVersion: z.literal(DRYDOCK_EXPRESSION_VERSION), root: nodeSchema })
  .strict();

function literalType(node: DrydockLiteralExpression): DrydockVariableType | null {
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

export function expressionNodeCount(node: DrydockExpressionNode): number {
  if (node.kind === "literal" || node.kind === "variable") return 1;
  if (node.kind === "compare") return 1 + expressionNodeCount(node.left) + expressionNodeCount(node.right);
  if (node.kind === "logical")
    return 1 + node.operands.reduce((count, operand) => count + expressionNodeCount(operand), 0);
  if (node.kind === "not") return 1 + expressionNodeCount(node.operand);
  if (node.kind === "contains") return 1 + expressionNodeCount(node.source) + expressionNodeCount(node.value);
  return 1 + expressionNodeCount(node.source);
}

export function expressionDepth(node: DrydockExpressionNode): number {
  if (node.kind === "literal" || node.kind === "variable") return 1;
  if (node.kind === "compare") return 1 + Math.max(expressionDepth(node.left), expressionDepth(node.right));
  if (node.kind === "logical") return 1 + Math.max(...node.operands.map(expressionDepth));
  if (node.kind === "not") return 1 + expressionDepth(node.operand);
  if (node.kind === "contains") return 1 + Math.max(expressionDepth(node.source), expressionDepth(node.value));
  return 1 + expressionDepth(node.source);
}

function issue(code: string, path: string, message: string, variableId?: string): DrydockIssue {
  return createDrydockIssue({
    code,
    category: "EXPRESSION",
    severity: "ERROR",
    ruleVersion: 1,
    location: { expressionPath: path, variableId },
    message,
    remediation: "Use compatible typed operands in the canonical expression builder.",
  });
}

export function typeCheckExpression(
  expression: unknown,
  variables: DrydockVariableRegistry,
): { type: DrydockVariableType | null; issues: DrydockIssue[]; expression?: DrydockExpression } {
  const parsed = drydockExpressionSchema.safeParse(expression);
  if (!parsed.success)
    return {
      type: null,
      issues: parsed.error.issues.map((item) =>
        issue("DRYDOCK_EXPRESSION_SCHEMA_INVALID", item.path.join("."), item.message),
      ),
    };
  const issues: DrydockIssue[] = [];
  const expressionValue = parsed.data;
  if (expressionDepth(expressionValue.root) > DRYDOCK_EXPRESSION_MAX_DEPTH)
    issues.push(issue("DRYDOCK_EXPRESSION_DEPTH_LIMIT", "root", "Expression nesting exceeds the governed limit."));
  if (expressionNodeCount(expressionValue.root) > DRYDOCK_EXPRESSION_MAX_NODES)
    issues.push(issue("DRYDOCK_EXPRESSION_NODE_LIMIT", "root", "Expression node count exceeds the governed limit."));
  try {
    canonicalJson(expressionValue, DRYDOCK_MAX_CANONICAL_BYTES);
  } catch {
    issues.push(issue("DRYDOCK_EXPRESSION_SIZE_LIMIT", "root", "Expression serialization exceeds the governed limit."));
  }
  const visit = (node: DrydockExpressionNode, path: string): DrydockVariableType | null => {
    if (node.kind === "literal") {
      const type = literalType(node);
      if (!type)
        issues.push(issue("DRYDOCK_EXPRESSION_LITERAL_TYPE", path, "Literal value does not match its declared type."));
      return type;
    }
    if (node.kind === "variable") {
      const declaration = variables.byId.get(node.variableId);
      if (!declaration)
        issues.push(
          issue(
            "DRYDOCK_EXPRESSION_VARIABLE_UNKNOWN",
            path,
            "Expression references an undeclared variable.",
            node.variableId,
          ),
        );
      return declaration?.type ?? null;
    }
    if (node.kind === "compare") {
      const left = visit(node.left, `${path}.left`);
      const right = visit(node.right, `${path}.right`);
      if (!sameType(left, right))
        issues.push(issue("DRYDOCK_EXPRESSION_COMPARE_TYPE", path, "Comparison operands have incompatible types."));
      if (!["equals", "notEquals"].includes(node.operator) && !(numeric(left) && numeric(right)))
        issues.push(issue("DRYDOCK_EXPRESSION_ORDER_TYPE", path, "Ordered comparison requires numeric operands."));
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "logical") {
      for (let index = 0; index < node.operands.length; index += 1) {
        const operand = visit(node.operands[index], `${path}.operands.${index}`);
        if (operand?.kind !== "BOOLEAN")
          issues.push(
            issue("DRYDOCK_EXPRESSION_LOGICAL_TYPE", `${path}.operands.${index}`, "Logical operands must be Boolean."),
          );
      }
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "not") {
      if (visit(node.operand, `${path}.operand`)?.kind !== "BOOLEAN")
        issues.push(issue("DRYDOCK_EXPRESSION_NOT_TYPE", path, "NOT requires a Boolean operand."));
      return { kind: "BOOLEAN" };
    }
    if (node.kind === "contains") {
      const source = visit(node.source, `${path}.source`);
      const value = visit(node.value, `${path}.value`);
      if (source?.kind !== "STRING_SET" || value?.kind !== "STRING")
        issues.push(issue("DRYDOCK_EXPRESSION_CONTAINS_TYPE", path, "Contains requires a String Set and a String."));
      return { kind: "BOOLEAN" };
    }
    if (visit(node.source, `${path}.source`)?.kind !== "STRING_SET")
      issues.push(issue("DRYDOCK_EXPRESSION_COUNT_TYPE", path, "Count requires a String Set."));
    return { kind: "INTEGER" };
  };
  const type = visit(expressionValue.root, "root");
  return { type, issues: [...variables.issues, ...issues], expression: expressionValue };
}

export type DrydockExpressionState = Readonly<Record<string, DrydockVariableValue>>;

export function evaluateExpression(
  expression: DrydockExpression,
  variables: DrydockVariableRegistry,
  state: DrydockExpressionState,
): DrydockVariableValue {
  const checked = typeCheckExpression(expression, variables);
  if (checked.issues.some((candidate) => candidate.severity === "ERROR")) throw new Error("DRYDOCK_EXPRESSION_INVALID");
  const evaluate = (node: DrydockExpressionNode): DrydockVariableValue => {
    if (node.kind === "literal") return node.value;
    if (node.kind === "variable") {
      const declaration = variables.byId.get(node.variableId)!;
      return state[node.variableId] ?? declaration.defaultValue ?? null;
    }
    if (node.kind === "compare") {
      const left = evaluate(node.left);
      const right = evaluate(node.right);
      if (node.operator === "equals") return left === right;
      if (node.operator === "notEquals") return left !== right;
      if (typeof left !== "number" || typeof right !== "number") throw new Error("DRYDOCK_EXPRESSION_INVALID");
      if (node.operator === "greaterThan") return left > right;
      if (node.operator === "greaterThanOrEqual") return left >= right;
      if (node.operator === "lessThan") return left < right;
      return left <= right;
    }
    if (node.kind === "logical") {
      if (node.operator === "and") {
        for (const operand of node.operands) if (evaluate(operand) !== true) return false;
        return true;
      }
      for (const operand of node.operands) if (evaluate(operand) === true) return true;
      return false;
    }
    if (node.kind === "not") return evaluate(node.operand) !== true;
    if (node.kind === "contains") {
      const source = evaluate(node.source);
      const value = evaluate(node.value);
      return Array.isArray(source) && typeof value === "string" && source.includes(value);
    }
    const source = evaluate(node.source);
    return Array.isArray(source) ? source.length : 0;
  };
  return evaluate(expression.root);
}

export function collectExpressionVariableReferences(expression: DrydockExpression): string[] {
  const references = new Set<string>();
  const visit = (node: DrydockExpressionNode) => {
    if (node.kind === "variable") references.add(node.variableId);
    else if (node.kind === "compare") {
      visit(node.left);
      visit(node.right);
    } else if (node.kind === "logical") node.operands.forEach(visit);
    else if (node.kind === "not") visit(node.operand);
    else if (node.kind === "contains") {
      visit(node.source);
      visit(node.value);
    } else if (node.kind === "count") visit(node.source);
  };
  visit(expression.root);
  return [...references].sort();
}

export function expressionBuilderMetadata(declarations: readonly DrydockVariableDeclaration[]) {
  return {
    schemaVersion: 1,
    variables: declarations.map((declaration) => ({
      id: declaration.id,
      name: declaration.name,
      type: declaration.type,
      privacy: declaration.privacy,
    })),
    operators: {
      BOOLEAN: ["equals", "notEquals", "and", "or", "not"],
      INTEGER: ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"],
      NUMBER: ["equals", "notEquals", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"],
      STRING: ["equals", "notEquals"],
      ENUM: ["equals", "notEquals"],
      STRING_SET: ["contains", "count"],
      IDENTIFIER_REFERENCE: ["equals", "notEquals"],
    },
    limits: {
      depth: DRYDOCK_EXPRESSION_MAX_DEPTH,
      nodes: DRYDOCK_EXPRESSION_MAX_NODES,
      logicalOperands: DRYDOCK_EXPRESSION_MAX_LOGICAL_OPERANDS,
      setMembers: DRYDOCK_EXPRESSION_MAX_SET_MEMBERS,
      serializedBytes: DRYDOCK_MAX_CANONICAL_BYTES,
    },
  };
}
