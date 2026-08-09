import { describe, expect, it } from "vitest";
import {
  DRYDOCK_EXPRESSION_MAX_DEPTH,
  collectExpressionVariableReferences,
  evaluateExpression,
  expressionBuilderMetadata,
  expressionDepth,
  typeCheckExpression,
  type DrydockExpression,
  type DrydockExpressionNode,
} from "@/drydock/expressions";
import { createVariableRegistry, type DrydockVariableDeclaration } from "@/drydock/variables";

const declaration: DrydockVariableDeclaration = {
  schemaVersion: 1,
  id: "var-score",
  name: "score",
  type: { kind: "INTEGER" },
  scope: "SESSION",
  defaultValue: 0,
  allowedOperations: ["assign", "increment", "decrement", "min", "max"],
  privacy: "PLAYER_SAFE",
};
const variables = createVariableRegistry([declaration]);
const expression: DrydockExpression = {
  schemaVersion: 1,
  root: {
    kind: "compare",
    operator: "greaterThanOrEqual",
    left: { kind: "variable", variableId: "var-score" },
    right: { kind: "literal", valueType: "INTEGER", value: 3 },
  },
};

describe("Drydock expression contracts", () => {
  it("type-checks and evaluates deterministically", () => {
    const checked = typeCheckExpression(expression, variables);
    expect(checked.issues).toEqual([]);
    expect(checked.type).toEqual({ kind: "BOOLEAN" });
    expect(evaluateExpression(expression, variables, { "var-score": 3 })).toBe(true);
    expect(evaluateExpression(expression, variables, { "var-score": 2 })).toBe(false);
    expect(collectExpressionVariableReferences(expression)).toEqual(["var-score"]);
  });

  it("rejects unknown variables and incompatible comparisons", () => {
    const unknown = structuredClone(expression);
    (unknown.root as { left: { variableId: string } }).left.variableId = "var-unknown";
    expect(typeCheckExpression(unknown, variables).issues.map((issue) => issue.code)).toContain(
      "DRYDOCK_EXPRESSION_VARIABLE_UNKNOWN",
    );
    const mismatch = structuredClone(expression);
    (mismatch.root as { right: Record<string, unknown> }).right = {
      kind: "literal",
      valueType: "STRING",
      value: "three",
    };
    expect(typeCheckExpression(mismatch, variables).issues.map((issue) => issue.code)).toContain(
      "DRYDOCK_EXPRESSION_COMPARE_TYPE",
    );
  });

  it("enforces bounded nesting", () => {
    let root: DrydockExpressionNode = { kind: "literal", valueType: "BOOLEAN", value: true };
    for (let index = 0; index < DRYDOCK_EXPRESSION_MAX_DEPTH; index += 1) root = { kind: "not", operand: root };
    expect(expressionDepth(root)).toBeGreaterThan(DRYDOCK_EXPRESSION_MAX_DEPTH);
    expect(
      typeCheckExpression({ schemaVersion: 1, root }, createVariableRegistry([])).issues.map((issue) => issue.code),
    ).toContain("DRYDOCK_EXPRESSION_DEPTH_LIMIT");
  });

  it("supports every node family, set count/contains, not, logical short-circuiting, and enum equality", () => {
    const moreVariables = createVariableRegistry([
      declaration,
      {
        ...declaration,
        id: "var-set",
        name: "set",
        type: { kind: "STRING_SET" },
        defaultValue: ["north"],
        allowedOperations: ["add", "remove", "contains", "count"],
      },
      {
        ...declaration,
        id: "var-weather",
        name: "weather",
        type: { kind: "ENUM", domainId: "weather", members: ["calm", "storm"] },
        defaultValue: "calm",
        allowedOperations: ["assign", "compare"],
      },
      {
        ...declaration,
        id: "var-late",
        name: "late",
        type: { kind: "BOOLEAN" },
        defaultValue: false,
        allowedOperations: ["assign", "toggle"],
      },
    ]);
    const setExpression: DrydockExpression = {
      schemaVersion: 1,
      root: {
        kind: "logical",
        operator: "and",
        operands: [
          {
            kind: "contains",
            source: { kind: "variable", variableId: "var-set" },
            value: { kind: "literal", valueType: "STRING", value: "north" },
          },
          {
            kind: "compare",
            operator: "equals",
            left: { kind: "count", source: { kind: "variable", variableId: "var-set" } },
            right: { kind: "literal", valueType: "INTEGER", value: 1 },
          },
          {
            kind: "not",
            operand: {
              kind: "compare",
              operator: "equals",
              left: { kind: "variable", variableId: "var-weather" },
              right: { kind: "literal", valueType: "ENUM", value: "storm", enumDomainId: "weather" },
            },
          },
        ],
      },
    };
    expect(typeCheckExpression(setExpression, moreVariables).issues).toEqual([]);
    expect(evaluateExpression(setExpression, moreVariables, {})).toBe(true);

    const shortCircuit: DrydockExpression = {
      schemaVersion: 1,
      root: {
        kind: "logical",
        operator: "or",
        operands: [
          { kind: "literal", valueType: "BOOLEAN", value: true },
          { kind: "variable", variableId: "var-late" },
        ],
      },
    };
    const state = Object.defineProperty({}, "var-late", {
      get: () => {
        throw new Error("late operand evaluated");
      },
    });
    expect(evaluateExpression(shortCircuit, moreVariables, state)).toBe(true);
  });

  it("enforces node and serialized-size limits and rejects authored executable shapes", () => {
    let level: DrydockExpressionNode[] = Array.from({ length: 128 }, () => ({
      kind: "literal" as const,
      valueType: "BOOLEAN" as const,
      value: true,
    }));
    while (level.length > 1) {
      const next: DrydockExpressionNode[] = [];
      for (let index = 0; index < level.length; index += 2)
        next.push({ kind: "logical", operator: "and", operands: [level[index], level[index + 1]] });
      level = next;
    }
    expect(
      typeCheckExpression({ schemaVersion: 1, root: level[0] }, variables).issues.map((issue) => issue.code),
    ).toContain("DRYDOCK_EXPRESSION_NODE_LIMIT");

    const oversized: DrydockExpression = {
      schemaVersion: 1,
      root: {
        kind: "logical",
        operator: "and",
        operands: Array.from({ length: 10 }, () => ({
          kind: "compare" as const,
          operator: "equals" as const,
          left: { kind: "literal" as const, valueType: "STRING" as const, value: "x".repeat(4000) },
          right: { kind: "literal" as const, valueType: "STRING" as const, value: "x".repeat(4000) },
        })),
      },
    };
    expect(typeCheckExpression(oversized, variables).issues.map((issue) => issue.code)).toContain(
      "DRYDOCK_EXPRESSION_SIZE_LIMIT",
    );
    expect(
      typeCheckExpression(
        { schemaVersion: 1, root: { kind: "call", sourceCode: "Function('return 1')()" } },
        variables,
      ).issues.map((issue) => issue.code),
    ).toContain("DRYDOCK_EXPRESSION_SCHEMA_INVALID");
  });

  it("publishes builder-safe operator and limit metadata", () => {
    const metadata = expressionBuilderMetadata([declaration]);
    expect(metadata.variables[0]).toMatchObject({ id: "var-score", type: { kind: "INTEGER" } });
    expect(metadata.operators.INTEGER).toContain("greaterThan");
    expect(metadata.limits.depth).toBe(DRYDOCK_EXPRESSION_MAX_DEPTH);
  });
});
