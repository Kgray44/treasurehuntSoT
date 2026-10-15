import { describe, expect, it } from "vitest";
import { createEmptyEnvironment, duplicateEnvironment } from "./environment-library-authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";

describe("new Library environments", () => {
  it("starts with an editable room shell and no furnishing/support relationships", () => {
    const room = createEmptyEnvironment("empty-room");
    expect(room.id).toBe("empty-room");
    expect(room.origin).toBe("MANUAL");
    expect(room.features.some((feature) => feature.classification === "FLOOR")).toBe(true);
    expect(room.features.filter((feature) => feature.classification === "WALL")).toHaveLength(4);
    expect(room.features.every((feature) => ["FLOOR", "WALL", "CEILING"].includes(feature.classification))).toBe(true);
    expect(room.construction?.relationships).toEqual([]);
  });
  it("duplicates geometry and local references without editing the original", () => {
    const source = createRoomEnvironment(simulationEnvironments[0]);
    const original = structuredClone(source);
    const copy = duplicateEnvironment(source, "new-independent-room");
    expect(copy.id).not.toBe(source.id);
    expect(copy.features).toEqual(source.features);
    expect(copy.construction).toEqual(source.construction);
    copy.features[0].position.x += 1;
    expect(source).toEqual(original);
  });
});
