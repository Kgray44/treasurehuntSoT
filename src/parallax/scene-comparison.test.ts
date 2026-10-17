import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { editSpatialDraft } from "./authoring";
import { createEnvironmentScene, duplicateEnvironmentScene } from "./environment-authoring";
import { builtinEnvironments } from "./environment-service";
import { compareScenes } from "./scene-comparison";

describe("Scene comparison identity and presentation", () => {
  const environment = builtinEnvironments()[0].current;

  it("reports replacement objects as added and removed even when their visible properties match", () => {
    const source = createEnvironmentScene("comparison-source", "Original", environment);
    const original = source.content.entities[0];
    const replacement = { ...structuredClone(original), id: "replacement-object" };
    const before = canonicalChecksum(source);
    let target = duplicateEnvironmentScene(source, "comparison-target", "Replacement");
    target = editSpatialDraft(target, { type: "CREATE", entity: replacement });
    target = editSpatialDraft(target, { type: "DELETE", entityId: original.id });

    expect(target.content.entities[0]).toEqual(replacement);
    expect(compareScenes(source, target).differences).toEqual([
      { category: "REMOVED_OBJECT", entityId: original.id, message: `Removed ${original.name}` },
      { category: "ADDED_OBJECT", entityId: replacement.id, message: `Added ${replacement.name}` },
    ]);
    expect(canonicalChecksum(source)).toBe(before);
  });

  it("distinguishes a Scene lighting override without reporting changes to shared geometry or objects", () => {
    const source = createEnvironmentScene("lighting-source", "Ordinary Room", environment);
    const target = duplicateEnvironmentScene(source, "lighting-target", "The Haunting");
    const before = canonicalChecksum(source);
    target.content.scenePresentation = { lighting: "LOW" };

    const expected = [{ category: "LIGHTING_EFFECT", message: "Scene presentation or lighting overrides changed" }];
    expect(compareScenes(source, target).differences).toEqual(expected);
    expect(compareScenes(target, source).differences).toEqual(expected);
    expect(target.content.environment).toEqual(source.content.environment);
    expect(target.content.entities).toEqual(source.content.entities);
    expect(canonicalChecksum(source)).toBe(before);
  });
});
