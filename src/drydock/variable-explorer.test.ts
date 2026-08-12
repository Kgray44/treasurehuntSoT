import { describe, expect, it } from "vitest";
import { analyzeDrydockGraph } from "@/drydock/graph";
import { createDrydockIssue } from "@/drydock/issues";
import { analyzeDrydockDefiniteInitialization } from "@/drydock/state";
import { createDrydockVariableExplorer } from "@/drydock/variable-explorer";
import { createVariableUsageIndex, type DrydockVariableDeclaration } from "@/drydock/variables";

describe("Drydock variable explorer", () => {
  it("projects Creator-private variable analysis with reachable navigation facts", () => {
    const blocks = [
      {
        id: "entry",
        blockType: "taleComplete",
        schemaVersion: 1,
        configuration: {},
        presentation: {},
        completion: {},
        connections: [],
        nextBlockId: null,
      },
    ];
    const declaration: DrydockVariableDeclaration = {
      schemaVersion: 1,
      id: "key",
      name: "Secret Key",
      type: { kind: "BOOLEAN" },
      scope: "SESSION",
      defaultValue: false,
      allowedOperations: ["assign", "toggle"],
      privacy: "CREATOR_PRIVATE",
    };
    const graphAnalysis = analyzeDrydockGraph(blocks);
    const usageIndex = createVariableUsageIndex([
      {
        variableId: "key",
        kind: "READ",
        blockId: "entry",
        fieldPath: "configuration.expression",
        privacy: "CREATOR_PRIVATE",
      },
    ]);
    const stateAnalysis = analyzeDrydockDefiniteInitialization({
      graph: graphAnalysis.graph,
      declarations: [declaration],
      usages: usageIndex.usages,
    });
    const explorer = createDrydockVariableExplorer({
      declarations: [declaration],
      usageIndex,
      graphAnalysis,
      stateAnalysis,
      issues: [
        createDrydockIssue({
          code: "DRYDOCK_VARIABLE_NOT_DEFINITELY_INITIALIZED",
          category: "STATE",
          severity: "ERROR",
          ruleVersion: 1,
          location: { variableId: "key", blockId: "entry", fieldPath: "configuration.expression" },
          message: "safe",
          remediation: "safe",
        }),
      ],
    });
    expect(explorer.variables).toEqual([
      expect.objectContaining({
        id: "key",
        privacy: "CREATOR_PRIVATE",
        unusedState: "USED",
        readers: [expect.objectContaining({ blockId: "entry", reachable: true })],
      }),
    ]);
    expect(explorer.variables[0].initialization.potentiallyUninitializedReferences).toEqual([
      { blockId: "entry", fieldPath: "configuration.expression" },
    ]);
  });
});
