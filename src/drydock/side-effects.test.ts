import { describe, expect, it } from "vitest";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { analyzeDrydockGraph } from "@/drydock/graph";
import { analyzeDrydockSideEffects } from "@/drydock/side-effects";

const block = (id: string, blockType: string, targets: string[], configuration: Record<string, unknown> = {}, completion: Record<string, unknown> = {}): CanonicalDrydockBlock => ({
  id,
  blockType,
  schemaVersion: 2,
  configuration,
  presentation: {},
  completion,
  connections: targets.map((targetBlockId, orderIndex) => ({ targetBlockId, connectionType: "DEFAULT", orderIndex })),
  nextBlockId: targets[0] ?? null,
});

describe("Drydock Phase 2 authored side-effect analysis", () => {
  it("rejects a collection grant inside a repeatable cycle", () => {
    const blocks = [
      block("entry", "narrative", ["grant"]),
      block("grant", "artifactReveal", ["entry"], { addToCollection: true, artifactId: "artifact-a" }),
    ];
    const issues = analyzeDrydockSideEffects({ blocks, graphAnalysis: analyzeDrydockGraph(blocks) });
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({
      code: "DRYDOCK_SIDE_EFFECT_REPEATS_IN_LOOP",
      location: expect.objectContaining({ blockId: "grant" }),
    })]));
  });

  it("surfaces duplicate authored artifact and completion outcome risk for review", () => {
    const blocks = [
      block("first-grant", "artifactReveal", [], { addToCollection: true, artifactId: "artifact-a" }),
      block("second-grant", "collectionUpdate", [], { artifactId: "artifact-a" }),
      block("first-complete", "chapterComplete", [], { outcomeId: "outcome-a" }),
      block("second-complete", "taleComplete", [], { outcomeId: "outcome-a" }),
    ];
    const codes = analyzeDrydockSideEffects({ blocks, graphAnalysis: analyzeDrydockGraph(blocks) }).map((issue) => issue.code);
    expect(codes).toContain("DRYDOCK_ARTIFACT_GRANT_DUPLICATE_RISK");
    expect(codes).toContain("DRYDOCK_COMPLETION_OUTCOME_DUPLICATE_RISK");
  });
});
