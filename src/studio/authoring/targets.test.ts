import { describe, expect, it } from "vitest";
import type { Block } from "@/components/studio/studio-types";
import { applyCanonicalTargetSelection } from "@/studio/authoring/targets";

const choice = (): Block => ({
  id: "choice-1",
  blockType: "choice",
  title: "Choose",
  configuration: {
    choices: [
      { id: "a", label: "A", targetBlockId: "old" },
      { id: "b", label: "B", targetBlockId: "old" },
    ],
  },
  presentation: {},
  completion: {},
  isEnabled: true,
  schemaVersion: 1,
  nextBlockId: "old",
  connections: [],
});

describe("Shipwright canonical target selection", () => {
  it("writes only canonical BlockConnection edges in the browser", () => {
    const block = choice();
    applyCanonicalTargetSelection(block, [
      { targetBlockId: "chapter-2-block", connectionType: "CHOICE", label: "A", orderIndex: 0 },
      { targetBlockId: "finale", connectionType: "CHOICE", label: "B", orderIndex: 1 },
    ]);

    expect(block.nextBlockId).toBe("old");
    expect(block.connections).toEqual([
      { targetBlockId: "chapter-2-block", connectionType: "CHOICE", label: "A", orderIndex: 0 },
      { targetBlockId: "finale", connectionType: "CHOICE", label: "B", orderIndex: 1 },
    ]);
    expect(block.configuration.choices).toEqual([
      { id: "a", label: "A", targetBlockId: "old" },
      { id: "b", label: "B", targetBlockId: "old" },
    ]);
  });

  it("does not manually dual-write condition compatibility mirrors", () => {
    const block: Block = {
      ...choice(),
      blockType: "condition",
      configuration: { successTargetBlockId: "old-success", failureTargetBlockId: "old-failure" },
    };
    applyCanonicalTargetSelection(block, [
      { targetBlockId: "pass", connectionType: "SUCCESS", orderIndex: 0 },
      { targetBlockId: "fail", connectionType: "FAILURE", orderIndex: 1 },
    ]);

    expect(block.nextBlockId).toBe("old");
    expect(block.configuration.successTargetBlockId).toBe("old-success");
    expect(block.configuration.failureTargetBlockId).toBe("old-failure");
    expect(block.connections).toEqual([
      { targetBlockId: "pass", connectionType: "SUCCESS", orderIndex: 0 },
      { targetBlockId: "fail", connectionType: "FAILURE", orderIndex: 1 },
    ]);
  });
});
