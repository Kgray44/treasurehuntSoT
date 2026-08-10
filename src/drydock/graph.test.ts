import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { analyzeDrydockGraph } from "@/drydock/graph";
import { parseDrydockBlock } from "@/drydock/contracts/parser";

const parseFixture = () =>
  fixture.blocks
    .map((block) => parseDrydockBlock(block))
    .filter((result) => result.success)
    .map((result) => result.block);

describe("Drydock Phase 2 canonical graph analysis", () => {
  it("proves the complete synthetic Chronicle has one canonical reachable terminal flow", () => {
    const blocks = structuredClone(parseFixture());
    for (let index = 0; index < blocks.length - 1; index++)
      blocks[index].connections = [{ targetBlockId: blocks[index + 1].id, connectionType: "DEFAULT", orderIndex: 0 }];
    blocks.at(-1)!.blockType = "taleComplete";
    blocks.at(-1)!.connections = [];
    const result = analyzeDrydockGraph(blocks);
    expect(result.issues).toEqual([]);
    expect(result.reachableBlockIds.size).toBe(23);
    expect(result.completionReachableBlockIds.size).toBe(23);
  });

  it("reports an unreachable Passage and a reachable branch with no terminal path", () => {
    const blocks = structuredClone(parseFixture());
    blocks[0].connections = [];
    const result = analyzeDrydockGraph(blocks);
    expect(result.issues.map((issue) => issue.code)).toContain("DRYDOCK_GRAPH_UNREACHABLE");
    expect(result.issues.map((issue) => issue.code)).toContain("DRYDOCK_GRAPH_NO_TERMINAL_PATH");
  });

  it("reports a closed strongly connected component as an automatic-loop risk", () => {
    const blocks = structuredClone(parseFixture()).slice(0, 2);
    blocks[0].connections = [{ targetBlockId: blocks[1].id, connectionType: "DEFAULT", orderIndex: 0 }];
    blocks[1].connections = [{ targetBlockId: blocks[0].id, connectionType: "DEFAULT", orderIndex: 0 }];
    const result = analyzeDrydockGraph(blocks);
    expect(result.issues.map((issue) => issue.code)).toContain("DRYDOCK_GRAPH_AUTOMATIC_LOOP");
    expect(result.issues.map((issue) => issue.code)).toContain("DRYDOCK_GRAPH_LOOP_PROGRESS_UNPROVEN");
  });

  it("does not call a cycle unproven when it contains an authored progress write", () => {
    const blocks = structuredClone(parseFixture()).slice(0, 4);
    blocks[0].connections = [{ targetBlockId: blocks[1].id, connectionType: "DEFAULT", orderIndex: 0 }];
    blocks[1].blockType = "setVariable";
    blocks[1].connections = [{ targetBlockId: blocks[2].id, connectionType: "DEFAULT", orderIndex: 0 }];
    blocks[2].connections = [
      { targetBlockId: blocks[1].id, connectionType: "DEFAULT", orderIndex: 0 },
      { targetBlockId: blocks[3].id, connectionType: "DEFAULT", orderIndex: 1 },
    ];
    blocks[3].blockType = "taleComplete";
    blocks[3].connections = [];
    const codes = analyzeDrydockGraph(blocks).issues.map((issue) => issue.code);
    expect(codes).not.toContain("DRYDOCK_GRAPH_LOOP_PROGRESS_UNPROVEN");
  });

  it("does not pretend a free-form legacy edge condition is statically proven", () => {
    const blocks = structuredClone(parseFixture()).slice(0, 2);
    blocks[0].connections = [
      {
        targetBlockId: blocks[1].id,
        connectionType: "DEFAULT",
        conditionExpression: "legacy predicate",
        orderIndex: 0,
      },
    ];
    const result = analyzeDrydockGraph(blocks);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "DRYDOCK_CONTROL_FLOW_EDGE_CONDITION_UNPROVEN",
          location: expect.objectContaining({ fieldPath: "connections.0.conditionExpression" }),
        }),
      ]),
    );
  });
});
