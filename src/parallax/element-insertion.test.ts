import { describe, expect, it } from "vitest";
import { createSpatialDraft, changeHistory, previewEntityTransform, undo } from "./authoring";
import { insertSpatialElementInEnvironment } from "./element-insertion";
import { simulationEnvironments } from "./studio-validation";
import { identityTransform } from "./contracts";

const bedroom = simulationEnvironments[0];
function empty() {
  const draft = createSpatialDraft("room-insertion");
  draft.content.entities = [];
  draft.content.anchors = [];
  draft.content.studio!.layers = [];
  return draft;
}
describe("Studio room-aware element insertion", () => {
  it("commits an in-room physical model as one undoable edit without changing the source", () => {
    const source = empty();
    const before = structuredClone(source);
    const next = insertSpatialElementInEnvironment(source, "sofa", "sofa", bedroom);
    const pose = previewEntityTransform(next.content, "sofa", bedroom.id, bedroom);
    expect(Math.abs(pose.position.z) + 0.86).toBeLessThan(2);
    expect(next.content.entities).toHaveLength(1);
    expect(source).toEqual(before);
    const changed = changeHistory({ past: [], present: source, future: [] }, { type: "REPLACE", draft: next });
    expect(changed.past).toHaveLength(1);
    expect(undo(changed).present).toEqual(source);
  });

  it("places a physical composition as one root without separating its children", () => {
    const next = insertSpatialElementInEnvironment(empty(), "haunted-treasure", "haunted", bedroom);
    const chest = next.content.entities.find((entity) => entity.element?.kind === "PHYSICAL_ASSET")!;
    expect(chest.parentEntityId).toBe("haunted");
    expect(chest.transform).toEqual(identityTransform());
    expect(previewEntityTransform(next.content, chest.id, bedroom.id, bedroom).position).toEqual(
      previewEntityTransform(next.content, "haunted", bedroom.id, bedroom).position,
    );
  });

  it("converts a world placement back through a pre-existing translated element anchor", () => {
    const first = insertSpatialElementInEnvironment(empty(), "articulated-chest", "first", bedroom);
    first.content.anchors[0].transform.position = { x: 0.3, y: 0, z: -0.2 };
    const next = insertSpatialElementInEnvironment(first, "articulated-chest", "second", bedroom);
    const pose = previewEntityTransform(next.content, "second", bedroom.id, bedroom);
    expect(pose.position.y).toBeCloseTo(0.01);
    expect(Math.abs(pose.position.z)).toBeLessThan(2);
    expect(next.content.anchors).toEqual(first.content.anchors);
    expect(next.content.entities[0]).toEqual(first.content.entities[0]);
  });

  it("does not insert or alter any item when the displayed room has no fitting support", () => {
    const source = empty();
    const before = structuredClone(source);
    expect(() =>
      insertSpatialElementInEnvironment(source, "sofa", "sofa", { ...bedroom, width: 1.8, depth: 2 }),
    ).toThrow(/No item was inserted/);
    expect(source).toEqual(before);
  });
});
