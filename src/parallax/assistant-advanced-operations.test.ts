// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSpatialDraft, editSpatialDraft, previewEntityTransforms } from "./authoring";
import {
  materializeAssistantInterpretation,
  materializeAssistantProposal,
  assistantSceneDigest,
  prepareAssistantContext,
} from "./spatial-assistant";
import { saveEditingGroup } from "./editing-groups";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import type { AssistantOperation } from "./spatial-assistant";
const common = { id: "change", explanation: "Change the requested scene property.", dependsOn: [] as string[] };
const proposal = (operations: AssistantOperation[]) => ({
  intentType: "EDIT",
  summary: "I'll update the scene.",
  clarification: null,
  operations,
  assumptions: [],
  unsupportedCapabilities: [],
  warnings: [],
  accessibilityNotes: [],
  creatorExplanation: "I'll preserve unrelated objects and their text.",
});
const source = () => createSpatialDraft("advanced-test", "Ghost Footprint Trail");
const run = (draft: ReturnType<typeof source>, ...operations: AssistantOperation[]) =>
  materializeAssistantInterpretation(draft, proposal(operations));
const layer = (entityId: string, locked: boolean): Extract<AssistantOperation, { type: "LAYER" }> => ({
  ...common,
  type: "LAYER",
  entityId,
  visible: null,
  locked,
  selectable: null,
  audience: null,
  tags: null,
});
describe("advanced Assistant commands through canonical authoring", () => {
  it("creates, transforms and removes room features only in environment editing, preserving the whole floor", () => {
    const draft = source();
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    const create: AssistantOperation = {
      ...common,
      type: "ROOM_FEATURE_CREATE",
      featureId: "extra-chair",
      classification: "CHAIR",
    };
    const interpretation = proposal([
      create,
      {
        ...common,
        id: "move-chair",
        type: "ROOM_FEATURE_TRANSFORM",
        featureId: "extra-chair",
        dependsOn: [common.id],
        translation: { x: 0.4, y: 0, z: 0.2 },
        yawDegrees: 90,
        scale: 1.1,
      },
    ]);
    expect(() => materializeAssistantInterpretation(draft, interpretation)).toThrow(/environment editing/);
    const next = materializeAssistantInterpretation(draft, interpretation, undefined, { environmentEditing: true });
    const chair = next.content.studio!.environment!.features.find((f) => f.id === "extra-chair")!;
    expect(chair.yawDegrees).toBeCloseTo(90);
    expect(chair.position.x).toBeCloseTo(0.4);
    const removed = materializeAssistantInterpretation(
      next,
      proposal([{ ...common, type: "ROOM_FEATURE_REMOVE", featureId: chair.id }]),
      undefined,
      { environmentEditing: true },
    );
    expect(removed.content.studio!.environment!.features.some((f) => f.id === chair.id)).toBe(false);
    const floor = draft.content.studio!.environment!.features.find((f) => f.classification === "FLOOR")!;
    expect(() =>
      materializeAssistantInterpretation(
        draft,
        proposal([{ ...common, type: "ROOM_FEATURE_REMOVE", featureId: floor.id }]),
        undefined,
        { environmentEditing: true },
      ),
    ).toThrow(/whole floor/);
    expect(() =>
      materializeAssistantInterpretation(draft, proposal([{ ...create, classification: "FLOOR" }]), undefined, {
        environmentEditing: true,
      }),
    ).toThrow(/whole-floor/);
  });
  it("rejects hierarchy cycles and preserves canonical pose during parenting and detaching", () => {
    const draft = source(),
      [a, b] = draft.content.entities,
      before = previewEntityTransforms(draft.content);
    const next = run(draft, { ...common, type: "PARENT", entityId: b.id, parentEntityId: a.id });
    for (const axis of ["x", "y", "z"] as const)
      expect(previewEntityTransforms(next.content)[b.id].position[axis]).toBeCloseTo(before[b.id].position[axis]);
    expect(() => run(next, { ...common, type: "PARENT", entityId: a.id, parentEntityId: b.id })).toThrow();
    const detached = run(next, { ...common, type: "PARENT", entityId: b.id, parentEntityId: null });
    expect(detached.content.entities.find((e) => e.id === b.id)?.parentEntityId).toBeUndefined();
  });

  it("duplicates authored content without exposing it in context, then removes only the selected duplicate", () => {
    const draft = source(),
      id = draft.content.entities[0].id;
    draft.content.entities[0].content = "Private authored clue";
    const copy = run(draft, { ...common, type: "DUPLICATE", entityId: id, newEntityId: "copied-footprint" });
    expect(copy.content.entities.at(-1)?.content).toBe("Private authored clue");
    expect(JSON.stringify(prepareAssistantContext(copy, id))).not.toContain("Private authored clue");
    const removed = run(copy, { ...common, type: "DELETE", entityId: "copied-footprint" });
    expect(removed.content.entities).toEqual(draft.content.entities);
    expect(draft.content.entities).toHaveLength(5);
    expect(() => run(copy, { ...common, type: "DUPLICATE", entityId: id, newEntityId: id })).toThrow(/new identity/);
  });
  it("enforces locks atomically and permits an explicit unlock before a dependent edit", () => {
    const draft = source(),
      id = draft.content.entities[0].id;
    const locked = editSpatialDraft(draft, { type: "LAYER", entityId: id, patch: { locked: true } });
    expect(() => run(locked, { ...common, type: "DELETE", entityId: id })).toThrow(/Unlock/);
    expect(() => run(locked, { ...layer(id, false), visible: false })).toThrow(/Unlock/);
    const next = run(locked, layer(id, false), {
      ...common,
      id: "remove",
      dependsOn: [common.id],
      type: "DELETE",
      entityId: id,
    });
    expect(next.content.entities.some((e) => e.id === id)).toBe(false);
    expect(locked.content.entities).toHaveLength(5);
  });
  it("prunes group membership and animation when deleting a member, and rejects deleting the last asset", () => {
    let draft = source();
    const [a, b] = draft.content.entities;
    draft = saveEditingGroup(
      draft,
      { id: "pair", name: "Pair", members: [a, b].map((e) => ({ kind: "ASSET", id: e.id })) },
      true,
    );
    draft.content.studio!.animationTracks = [
      {
        id: "fade",
        entityId: a.id,
        property: "OPACITY",
        interpolation: "EASE_IN_OUT",
        enabled: true,
        keyframes: [
          { id: "start", atMs: 0, value: 0 },
          { id: "end", atMs: 1000, value: 1 },
        ],
      },
    ];
    const next = run(draft, { ...common, type: "DELETE", entityId: a.id });
    expect(next.content.studio!.animationTracks).toEqual([]);
    expect(next.content.studio!.editingGroups![0].members).toEqual([{ kind: "ASSET", id: b.id }]);
    const one = createSpatialDraft("one");
    expect(() => run(one, { ...common, type: "DELETE", entityId: one.content.entities[0].id })).toThrow(/at least one/);
  });
  it("changes scene metadata without changing ownership, identities, or assets", () => {
    const draft = source();
    const next = run(draft, {
      ...common,
      type: "SCENE_DETAILS",
      title: "Moonlit route",
      tags: ["night"],
      collection: null,
      favorite: true,
    });
    expect(next.content.title).toBe("Moonlit route");
    expect(next.favorite).toBe(true);
    expect(next.content.entities).toEqual(draft.content.entities);
    expect(next.content.definitionId).toBe(draft.content.definitionId);
    expect(next.scope).toBe(draft.scope);
  });
  it("reorders and rotates one asset while preserving its world position and all other assets", () => {
    const draft = source(),
      a = draft.content.entities[0],
      before = previewEntityTransforms(draft.content);
    const next = run(
      draft,
      { ...common, type: "ROTATE", entityId: a.id, axis: "SURFACE", degrees: 45 },
      { ...common, id: "order", type: "REORDER", entityId: a.id, offset: 2 },
    );
    expect(next.content.entities[2].id).toBe(a.id);
    for (const axis of ["x", "y", "z"] as const)
      expect(previewEntityTransforms(next.content)[a.id].position[axis]).toBeCloseTo(before[a.id].position[axis]);
    expect(next.content.entities.filter((e) => e.id !== a.id)).toEqual(draft.content.entities.slice(1));
  });
  it("creates a cinematic track, retimes and disables it, and removes it without deleting the asset", () => {
    const draft = source(),
      id = draft.content.entities[0].id;
    const track = {
      id: "fade",
      entityId: id,
      property: "OPACITY" as const,
      interpolation: "CINEMATIC" as const,
      enabled: true,
      keyframes: [
        { id: "start", atMs: 0, value: 0 },
        { id: "end", atMs: 1000, value: 1 },
      ],
    };
    let next = run(draft, { ...common, type: "ANIMATION", track });
    next = run(
      next,
      { ...common, type: "RETIME_ANIMATION", trackId: track.id, startMs: 2000, endMs: 5000 },
      {
        ...common,
        id: "style",
        type: "ANIMATION_STYLE",
        trackId: track.id,
        interpolation: "EASE_IN_OUT",
        enabled: false,
      },
    );
    expect(next.content.studio!.animationTracks![0]).toMatchObject({
      enabled: false,
      interpolation: "EASE_IN_OUT",
      keyframes: [
        { id: "start", atMs: 2000, value: 0 },
        { id: "end", atMs: 5000, value: 1 },
      ],
    });
    next = run(next, { ...common, type: "REMOVE_ANIMATION", trackId: track.id });
    expect(next.content.studio!.animationTracks).toEqual([]);
    expect(next.content.entities).toEqual(draft.content.entities);
    expect(() =>
      materializeAssistantInterpretation(draft, {
        ...proposal([]),
        operations: [
          {
            ...common,
            type: "ANIMATION",
            track: {
              ...track,
              property: "VISIBILITY",
              keyframes: [
                { id: "a", atMs: 0, value: false },
                { id: "b", atMs: 1000, value: true },
              ],
            },
          },
        ],
      }),
    ).toThrow();
  });
  it("requires environment editing for room membership and mixed group movement, bound to the retained proposal", async () => {
    const draft = source();
    draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
    const roomFeature = draft.content.studio!.environment.features.find(
      (f) => f.classification !== "FLOOR" && f.classification !== "WALL",
    )!;
    const create: AssistantOperation = {
      ...common,
      type: "GROUP_CREATE",
      groupId: "mixed",
      name: "Mixed",
      members: [
        { kind: "ASSET", id: draft.content.entities[0].id },
        { kind: "ROOM_FEATURE", id: roomFeature.id },
      ],
    };
    expect(() => run(draft, create)).toThrow(/environment editing/);
    const grouped = materializeAssistantInterpretation(draft, proposal([create]), undefined, {
      environmentEditing: true,
    });
    expect(() =>
      run(grouped, {
        ...common,
        type: "GROUP_TRANSFORM",
        groupId: "mixed",
        translation: { x: 0.1, y: 0, z: 0 },
        yawDegrees: 0,
        scale: 1,
      }),
    ).toThrow(/environment editing/);
    expect(
      run(grouped, { ...common, type: "GROUP_RENAME", groupId: "mixed", name: "Renamed" }).content.studio!
        .editingGroups![0].name,
    ).toBe("Renamed");
    const bound = {
      ...proposal([create]),
      schemaVersion: 1,
      requestId: "request",
      definitionId: draft.content.definitionId,
      sceneRevision: 1,
      editorGeneration: 3,
      sceneDigest: await assistantSceneDigest(draft),
      environmentEditing: true,
    };
    expect(
      (await materializeAssistantProposal(draft, 1, bound, undefined, 3)).content.studio!.editingGroups![0].name,
    ).toBe("Mixed");
    await expect(materializeAssistantProposal(draft, 1, bound, undefined, 4)).rejects.toThrow(/scene has changed/);
    expect(prepareAssistantContext(draft, null, null, [], true).environmentEditing).toBe(true);
  });
});
