import { describe, expect, it } from "vitest";
import {
  applyVariableOperation,
  createVariableRegistry,
  createVariableUsageIndex,
  permittedOperations,
  renameVariableInDraft,
  type DrydockVariableDeclaration,
} from "@/drydock/variables";

const flag: DrydockVariableDeclaration = {
  schemaVersion: 1,
  id: "var-flag",
  name: "flag",
  type: { kind: "BOOLEAN" },
  scope: "SESSION",
  defaultValue: false,
  allowedOperations: ["assign", "toggle"],
  privacy: "PLAYER_SAFE",
};

describe("Drydock typed variables", () => {
  it("governs operations by type and rejects invalid declarations", () => {
    expect(permittedOperations({ kind: "BOOLEAN" })).toEqual(["assign", "toggle"]);
    expect(permittedOperations({ kind: "INTEGER" })).toContain("increment");
    expect(permittedOperations({ kind: "STRING_SET" })).toEqual(["add", "remove", "contains", "count"]);
    const registry = createVariableRegistry([flag, { ...flag, id: "var-other" }]);
    expect(registry.issues.some((issue) => issue.code === "DRYDOCK_VARIABLE_DUPLICATE")).toBe(true);
    expect(
      createVariableRegistry([{ ...flag, scope: "GLOBAL_UNGOVERNED" }]).issues.some(
        (issue) => issue.code === "DRYDOCK_VARIABLE_DECLARATION_INVALID",
      ),
    ).toBe(true);
  });

  it("applies bounded deterministic mutations", () => {
    expect(applyVariableOperation(flag, false, "toggle")).toBe(true);
    const score: DrydockVariableDeclaration = {
      ...flag,
      id: "var-score",
      name: "score",
      type: { kind: "INTEGER" },
      defaultValue: 0,
      allowedOperations: ["assign", "increment", "decrement", "min", "max"],
    };
    expect(applyVariableOperation(score, 2, "increment", 3)).toBe(5);
    expect(() => applyVariableOperation(score, 2, "toggle")).toThrow("DRYDOCK_VARIABLE_OPERATION_NOT_PERMITTED");
  });

  it("validates every core type and its query or mutation operations", () => {
    const declarations: DrydockVariableDeclaration[] = [
      flag,
      {
        ...flag,
        id: "integer",
        name: "integer",
        type: { kind: "INTEGER" },
        defaultValue: 1,
        allowedOperations: permittedOperations({ kind: "INTEGER" }),
      },
      {
        ...flag,
        id: "number",
        name: "number",
        type: { kind: "NUMBER" },
        defaultValue: 1.5,
        allowedOperations: permittedOperations({ kind: "NUMBER" }),
      },
      {
        ...flag,
        id: "string",
        name: "string",
        type: { kind: "STRING" },
        defaultValue: "a",
        allowedOperations: permittedOperations({ kind: "STRING" }),
      },
      {
        ...flag,
        id: "enum",
        name: "enum",
        type: { kind: "ENUM", domainId: "weather", members: ["calm", "storm"] },
        defaultValue: "calm",
        allowedOperations: permittedOperations({ kind: "ENUM", domainId: "weather", members: ["calm", "storm"] }),
      },
      {
        ...flag,
        id: "set",
        name: "set",
        type: { kind: "STRING_SET" },
        defaultValue: ["north"],
        allowedOperations: permittedOperations({ kind: "STRING_SET" }),
      },
      {
        ...flag,
        id: "reference",
        name: "reference",
        type: { kind: "IDENTIFIER_REFERENCE", entityType: "artifact" },
        defaultValue: "artifact-1",
        allowedOperations: permittedOperations({ kind: "IDENTIFIER_REFERENCE", entityType: "artifact" }),
      },
    ];
    expect(createVariableRegistry(declarations).issues).toEqual([]);
    expect(applyVariableOperation(declarations[3], "a", "compare", "a")).toBe(true);
    expect(applyVariableOperation(declarations[4], "calm", "compare", "storm")).toBe(false);
    expect(applyVariableOperation(declarations[5], ["north"], "add", "east")).toEqual(["east", "north"]);
    expect(applyVariableOperation(declarations[5], ["east", "north"], "remove", "east")).toEqual(["north"]);
    expect(applyVariableOperation(declarations[5], ["north"], "contains", "north")).toBe(true);
    expect(applyVariableOperation(declarations[5], ["north"], "count")).toBe(1);
    expect(applyVariableOperation(declarations[6], "artifact-1", "clear")).toBeNull();
    expect(createVariableRegistry([{ ...declarations[4], defaultValue: "fog" }]).issues).not.toEqual([]);
    expect(
      createVariableRegistry([
        { ...declarations[4], type: { kind: "ENUM", domainId: "weather", members: ["calm", "calm"] } },
      ]).issues,
    ).not.toEqual([]);
  });

  it("renames only governed references and preserves matching prose", () => {
    const renamed = renameVariableInDraft(
      {
        variables: [flag],
        chapters: [
          {
            blocks: [
              {
                id: "condition-1",
                blockType: "condition",
                configuration: { variable: "flag", prose: "Do not rename flag inside prose." },
              },
              {
                id: "set-1",
                blockType: "setVariable",
                configuration: { variableId: "var-flag", variableName: "flag", variable: "flag" },
              },
            ],
          },
        ],
      },
      "var-flag",
      "signalFlag",
    );
    expect(renamed.variables[0].name).toBe("signalFlag");
    expect(renamed.chapters[0].blocks[0].configuration.variable).toBe("signalFlag");
    expect(renamed.chapters[0].blocks[0].configuration.prose).toBe("Do not rename flag inside prose.");
    expect(renamed.chapters[0].blocks[1].configuration.variableName).toBe("signalFlag");
  });

  it("builds a stable usage index", () => {
    const input = [
      { variableId: "var-flag", kind: "WRITE" as const, blockId: "b", fieldPath: "z", privacy: "PLAYER_SAFE" as const },
      { variableId: "var-flag", kind: "READ" as const, blockId: "a", fieldPath: "a", privacy: "PLAYER_SAFE" as const },
    ];
    expect(createVariableUsageIndex(input).usages.map((usage) => usage.blockId)).toEqual(["a", "b"]);
  });
});
