import { describe, expect, it } from "vitest";
import { createSpatialDraft } from "./authoring";
import { appendSpatialInput, evaluateSpatialScene, initialSpatialInputs, maximumSpatialInputs } from "./behavior";

describe("canonical simulation evidence", () => {
  it("attributes delayed actions to the matching input and rewinds without authoring mutations", () => {
    const draft = createSpatialDraft("simulation", "Floating Compass");
    const entityId = draft.content.entities[0].id;
    draft.content.studio!.behaviors = [
      {
        id: "hide",
        trigger: "INSPECT",
        sourceEntityId: entityId,
        targetEntityId: entityId,
        delayMs: 1000,
        action: "HIDE",
      },
    ];
    const original = structuredClone(draft);
    const inputs = appendSpatialInput(initialSpatialInputs(), { trigger: "INSPECT", entityId, atMs: 2000 });
    expect(evaluateSpatialScene(draft.content, inputs, 2999).events).toMatchObject([
      { inputIndex: 2, status: "WAITING", atMs: 3000 },
    ]);
    expect(evaluateSpatialScene(draft.content, inputs, 3000).states[entityId].visible).toBe(false);
    expect(evaluateSpatialScene(draft.content, inputs, 2999).states[entityId].visible).toBe(true);
    expect(evaluateSpatialScene(draft.content, initialSpatialInputs(), 5000).events).toEqual([]);
    expect(
      evaluateSpatialScene(draft.content, [{ trigger: "INSPECT", entityId: "other", atMs: 0 }], 5000).events,
    ).toEqual([]);
    expect(draft).toEqual(original);
  });
  it("reports audience-excluded actions as suppressed instead of applied", () => {
    const draft = createSpatialDraft("simulation");
    const entityId = draft.content.entities[0].id;
    draft.content.studio!.behaviors = [
      { id: "reveal", trigger: "SCENE_ENTER", targetEntityId: entityId, delayMs: 0, action: "SHOW" },
    ];
    draft.content.studio!.layers[0].audience = "EDITOR_ONLY";
    const lens = evaluateSpatialScene(draft.content, initialSpatialInputs(), 0);
    expect(lens.events[0].status).toBe("SUPPRESSED");
    expect(lens.states[entityId].visible).toBe(false);
    expect(evaluateSpatialScene(draft.content, initialSpatialInputs(), 0, true).events[0].status).toBe("APPLIED");
  });
  it("rejects excess inputs without dropping previous delayed effects", () => {
    let inputs = initialSpatialInputs();
    while (inputs.length < maximumSpatialInputs) inputs = appendSpatialInput(inputs, { trigger: "TIMER", atMs: 1000 });
    const saved = structuredClone(inputs);
    expect(() => appendSpatialInput(inputs, { trigger: "TIMER", atMs: 1000 })).toThrow(/Reset simulation/);
    expect(inputs).toEqual(saved);
    for (const atMs of [-1, 60001, NaN, Infinity])
      expect(() => appendSpatialInput([], { trigger: "TIMER", atMs })).toThrow(/time/);
  });
});
