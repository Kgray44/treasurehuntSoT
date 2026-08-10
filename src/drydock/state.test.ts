import { describe, expect, it } from "vitest";
import { buildDrydockChronicleGraph } from "@/drydock/graph";
import { analyzeDrydockConditionFeasibility, analyzeDrydockDefiniteInitialization } from "@/drydock/state";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import type { DrydockVariableDeclaration, DrydockVariableUsage } from "@/drydock/variables";

const block = (id: string, targets: string[]): CanonicalDrydockBlock => ({ id, blockType: "narrative", schemaVersion: 2, configuration: {}, presentation: {}, completion: {}, connections: targets.map((targetBlockId, orderIndex) => ({ targetBlockId, connectionType: "DEFAULT", orderIndex })), nextBlockId: targets[0] ?? null });
const declaration: DrydockVariableDeclaration = { schemaVersion: 1, id: "lantern", name: "Lantern", type: { kind: "BOOLEAN" }, scope: "SESSION", allowedOperations: ["assign", "toggle"], privacy: "PLAYER_SAFE" };

describe("Drydock definite-initialization analysis", () => {
  it("requires a write on every predecessor path before a read", () => {
    const graph = buildDrydockChronicleGraph([block("entry", ["left", "right"]), block("left", ["read"]), block("right", ["read"]), block("read", [])]);
    const usages: DrydockVariableUsage[] = [{ variableId: "lantern", kind: "WRITE", blockId: "left", fieldPath: "configuration.value", operation: "assign", privacy: "PLAYER_SAFE" }, { variableId: "lantern", kind: "EXPRESSION", blockId: "read", fieldPath: "configuration.expression", privacy: "PLAYER_SAFE" }];
    expect(analyzeDrydockDefiniteInitialization({ graph, declarations: [declaration], usages }).issues.map((issue) => issue.code)).toContain("DRYDOCK_VARIABLE_NOT_DEFINITELY_INITIALIZED");
  });

  it("accepts a declared default as definite initialization at the entry", () => {
    const graph = buildDrydockChronicleGraph([block("entry", [])]);
    const usages: DrydockVariableUsage[] = [{ variableId: "lantern", kind: "EXPRESSION", blockId: "entry", fieldPath: "configuration.expression", privacy: "PLAYER_SAFE" }];
    expect(analyzeDrydockDefiniteInitialization({ graph, declarations: [{ ...declaration, defaultValue: false }], usages }).issues).toEqual([]);
  });

  it("reports state declared or written without any consumer", () => {
    const graph = buildDrydockChronicleGraph([block("entry", [])]);
    expect(analyzeDrydockDefiniteInitialization({ graph, declarations: [declaration], usages: [] }).issues.map((issue) => issue.code)).toContain("DRYDOCK_VARIABLE_UNUSED");
    const usages: DrydockVariableUsage[] = [{ variableId: "lantern", kind: "WRITE", blockId: "entry", fieldPath: "configuration.value", operation: "assign", privacy: "PLAYER_SAFE" }];
    expect(analyzeDrydockDefiniteInitialization({ graph, declarations: [declaration], usages }).issues.map((issue) => issue.code)).toContain("DRYDOCK_VARIABLE_WRITE_NEVER_READ");
  });

  it("only classifies a condition constant when no writer can alter its default", () => {
    const condition: CanonicalDrydockBlock = {
      id: "condition",
      blockType: "condition",
      schemaVersion: 2,
      configuration: {},
      presentation: {},
      completion: {},
      connections: [],
      nextBlockId: null,
      expression: { schemaVersion: 1, root: { kind: "variable", variableId: "lantern" } },
    };
    expect(analyzeDrydockConditionFeasibility({ blocks: [condition], declarations: [{ ...declaration, defaultValue: true }], usages: [] }).map((issue) => issue.code)).toContain("DRYDOCK_CONDITION_ALWAYS_TRUE");
    const writes: DrydockVariableUsage[] = [{ variableId: "lantern", kind: "WRITE", blockId: "condition", fieldPath: "configuration.value", operation: "assign", privacy: "PLAYER_SAFE" }];
    expect(analyzeDrydockConditionFeasibility({ blocks: [condition], declarations: [{ ...declaration, defaultValue: true }], usages: writes })).toEqual([]);
  });
});
