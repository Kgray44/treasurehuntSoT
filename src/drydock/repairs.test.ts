import { describe, expect, it } from "vitest";
import type { CanonicalDrydockBlock } from "@/drydock/contracts/model";
import { applyDrydockRepair, previewCanonicalTargetRepair } from "@/drydock/repairs";

describe("Drydock safe repair preview", () => {
  const block: CanonicalDrydockBlock = { id: "choice", blockType: "choice", schemaVersion: 2, configuration: { choices: [{ id: "a", label: "A", targetBlockId: "wrong" }, { id: "b", label: "B", targetBlockId: "wrong" }] }, presentation: {}, completion: { mode: "playerConfirmation" }, connections: [{ targetBlockId: "one", connectionType: "CHOICE", orderIndex: 0 }, { targetBlockId: "two", connectionType: "CHOICE", orderIndex: 1 }], nextBlockId: "wrong" };
  it("applies only canonical target mirrors and supplies a reversible inverse", () => {
    const preview = previewCanonicalTargetRepair(block);
    expect(preview).toMatchObject({ classification: "SAFE_AUTOMATIC", issueCode: "DRYDOCK_LEGACY_NEXT_TARGET_CONFLICT", expectedIssueChanges: { introduced: [] } });
    const applied = applyDrydockRepair(block, preview);
    expect(applied.block.nextBlockId).toBe("one");
    expect((applied.block.configuration.choices as Array<{ targetBlockId: string }>).map((choice) => choice.targetBlockId)).toEqual(["one", "two"]);
    expect(applyDrydockRepair(applied.block, applied.undo).block).toEqual(block);
  });
  it("rejects a stale repair preview", () => expect(() => applyDrydockRepair({ ...block, nextBlockId: "changed" }, previewCanonicalTargetRepair(block))).toThrow("stale"));
});
