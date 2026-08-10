import { describe, expect, it } from "vitest";
import fixture from "../../tests/fixtures/drydock/current-authoring-v1.json";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { createDrydockGraphSurvey } from "@/drydock/graph-survey";
import { createDrydockIssue } from "@/drydock/issues";

const blocks = () => fixture.blocks
  .map((block) => parseDrydockBlock(block))
  .filter((result) => result.success)
  .map((result) => result.block);

describe("Drydock graph survey", () => {
  it("projects canonical graph facts without exposing authored prose or predicates", () => {
    const source = structuredClone(blocks()).slice(0, 2);
    source[0].connections = [{ targetBlockId: source[1].id, connectionType: "DEFAULT", conditionExpression: "private predicate", orderIndex: 0 }];
    source[1].blockType = "taleComplete";
    const survey = createDrydockGraphSurvey(source, undefined, [
      createDrydockIssue({ code: "DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP", category: "CONTENT", severity: "ERROR", ruleVersion: 1, location: { blockId: source[0].id }, message: "not projected", remediation: "not projected" }),
    ]);

    expect(survey).toMatchObject({ schemaVersion: 1, entryBlockId: source[0].id, proofCompleteness: "INCOMPLETE_PROOF" });
    expect(survey.edges).toEqual(expect.arrayContaining([expect.objectContaining({ hasUnprovenLegacyCondition: true })]));
    expect(JSON.stringify(survey)).not.toContain("private predicate");
    expect(JSON.stringify(survey)).not.toContain("conditionExpression");
    expect(survey.nodes.find((node) => node.id === source[0].id)?.annotations).toEqual([
      { code: "DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP", category: "CONTENT", severity: "ERROR" },
    ]);
  });
});
