import { describe, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { builtinEnvironments } from "./environment-service";
import { environmentContentSchema } from "./environment-contracts";
import {
  createEnvironmentScene,
  duplicateEnvironmentScene,
  hauntedBedroomScenes,
  reviewEnvironmentImpact,
  updateSceneEnvironment,
} from "./environment-authoring";
import { changeHistory, undo, redo, type History } from "./authoring";
import { compareScenes } from "./scene-comparison";
import { evaluateSpatialBehavior } from "./behavior";
import { materializeLibraryMoment } from "./library-service";
import { sceneReference, validateSceneReference } from "./scene-reference";

describe("reusable Environments and independent Scenes", () => {
  const base = builtinEnvironments()[0].current;
  it("fits the supported footprint starting content inside the selected room without changing the shared baseline", () => {
    const room = builtinEnvironments().find((e) => e.id === "builtin:cluttered")!.current;
    const scene = createEnvironmentScene("trail", "The Haunting", room, null, "Ghost Footprint Trail");
    expect(scene.content.entities).toHaveLength(5);
    expect(reviewEnvironmentImpact(scene, room).status).toBe("CURRENT");
    expect(room.content.depth).toBe(2);
  });
  it("keeps the Haunted Bedroom scene content and behavior independent while sharing one immutable baseline", () => {
    const original = JSON.stringify(base);
    const [ordinary, haunting, letter] = hauntedBedroomScenes(base, ["ordinary", "haunting", "letter"]);
    expect(new Set([ordinary, haunting, letter].map((d) => d.content.definitionId)).size).toBe(3);
    for (const d of [ordinary, haunting, letter]) expect(d.content.environment).toEqual(base.reference);
    expect(ordinary.content.studio!.behaviors).toEqual([]);
    const id = haunting.content.entities[0].id;
    expect(evaluateSpatialBehavior(haunting.content, [{ trigger: "SCENE_ENTER", atMs: 0 }], 0)[id].visible).toBe(false);
    expect(evaluateSpatialBehavior(haunting.content, [{ trigger: "SCENE_ENTER", atMs: 0 }], 2000)[id].visible).toBe(
      true,
    );
    expect(letter.content.entities[0].content).toMatch(/floorboard/);
    haunting.content.entities[0].transform.position.x = 0.3;
    expect(ordinary.content.entities[0].transform.position.x).toBe(0);
    expect(letter.content.entities[0].transform.position.x).toBe(0);
    expect(JSON.stringify(base)).toBe(original);
  });
  it("duplicates a Scene with fresh definition identity, preserves stable object identities for comparison, and deep copies edits", () => {
    const source = createEnvironmentScene("source", "Original", base);
    const clone = duplicateEnvironmentScene(source, "clone", "Duplicate");
    expect(clone.content.definitionId).toBe("clone");
    expect(clone.content.entities[0].id).toBe(source.content.entities[0].id);
    expect(clone.content.environment).toEqual(source.content.environment);
    clone.content.entities[0].content = "Only this copy";
    clone.content.scenePresentation = { lighting: "LOW" };
    expect(source.content.entities[0].content).not.toBe("Only this copy");
    expect(source.content.scenePresentation).toBeUndefined();
    expect(compareScenes(source, clone).differences.map((d) => d.category)).toContain("CONTENT");
    expect(compareScenes(source, clone).differences.map((d) => d.category)).toContain("LIGHTING_EFFECT");
  });
  it("updates only the chosen working Scene and supports ordinary Undo/Redo of its Environment pin", () => {
    const source = createEnvironmentScene("scene", "First", base);
    const other = createEnvironmentScene("other", "Second", base);
    const next = structuredClone(base);
    next.reference.revision = 2;
    next.reference.versionId = "builtin:bedroom:e2";
    next.content.description = "A revised room";
    next.reference.checksum = canonicalChecksum(next.content);
    expect(reviewEnvironmentImpact(source, next).status).toBe("REVIEW_REQUIRED");
    const history: History = { past: [], present: source, future: [] };
    const edited = changeHistory(history, { type: "REPLACE", draft: updateSceneEnvironment(source, next) });
    expect(edited.present.content.environment?.revision).toBe(2);
    expect(other.content.environment?.revision).toBe(1);
    expect(undo(edited).present).toEqual(source);
    expect(redo(undo(edited)).present).toEqual(edited.present);
  });
  it("blocks missing semantic references, removed surfaces and geometry outside a revised room", () => {
    const source = createEnvironmentScene("scene", "First", base);
    source.content.environmentPlacements = [{ entityId: source.content.entities[0].id, featureId: "removed-desk" }];
    expect(reviewEnvironmentImpact(source, base).findings[0].message).toMatch(/missing or unsafe/);
    expect(() => updateSceneEnvironment(source, base)).toThrow(/missing or unsafe/);
    delete source.content.environmentPlacements;
    const next = structuredClone(base);
    next.content.horizontal = false;
    expect(reviewEnvironmentImpact(source, next).status).toBe("INVALID");
    source.content.entities[0].transform.position.x = 5;
    expect(reviewEnvironmentImpact(source, base).findings.some((f) => /outside/.test(f.message))).toBe(true);
  });
  it("rejects invalid environment geometry and duplicate feature identities", () => {
    const invalid = structuredClone(base.content);
    invalid.evidence.candidates.push(invalid.evidence.candidates[0]);
    expect(environmentContentSchema.safeParse(invalid).success).toBe(false);
    const fixture = structuredClone(base.content);
    fixture.fixtures = [
      {
        id: "bed",
        name: "Bed",
        kind: "FURNITURE",
        position: { x: 4, y: 0.3, z: 0 },
        size: { x: 1, y: 0.5, z: 1 },
        color: "#667788",
      },
    ];
    expect(environmentContentSchema.safeParse(fixture).success).toBe(false);
  });
  it("reports transforms, visibility, behaviors, animation timing and reference differences without an edition authority", () => {
    const source = createEnvironmentScene("a", "One", base);
    const target = duplicateEnvironmentScene(source, "b", "Two");
    const entity = target.content.entities[0];
    entity.transform.position.x = 0.3;
    entity.interactions = ["INSPECT"];
    target.content.studio!.layers[0].visible = false;
    target.content.studio!.behaviors = [
      { id: "reveal", trigger: "SCENE_ENTER", delayMs: 100, targetEntityId: entity.id, action: "SHOW" },
    ];
    target.content.environment!.revision = 2;
    const categories = compareScenes(source, target).differences.map((d) => d.category);
    expect(categories).toEqual(
      expect.arrayContaining(["TRANSFORM", "VISIBILITY", "INTERACTION", "ANIMATION", "ENVIRONMENT_REFERENCE"]),
    );
    target.content.environment!.environmentId = "other";
    expect(() => compareScenes(source, target)).toThrow(/same Environment/);
  });
  it("exposes an exact future Chronicle binding and retains published Scene stability after environment changes", () => {
    const source = createEnvironmentScene("a", "One", base);
    const moment = materializeLibraryMoment(source, "creator", 1);
    const before = JSON.stringify(moment);
    const reference = sceneReference(moment, "PRESERVE_ENVIRONMENT");
    expect(reference.environment).toEqual(base.reference);
    expect(validateSceneReference(reference, moment)).toEqual(reference);
    source.content.title = "Later edit";
    source.content.environment!.revision = 2;
    expect(JSON.stringify(moment)).toBe(before);
    expect(() => validateSceneReference({ ...reference, sceneChecksum: "0".repeat(64) }, moment)).toThrow(
      /immutable release/,
    );
  });
});
