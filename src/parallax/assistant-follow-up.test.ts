import { expect, it } from "vitest";
import { createSpatialDraft } from "./authoring";
import { prepareAssistantContext } from "./spatial-assistant";
import { assistantFollowUpFocus } from "./assistant-follow-up";
it("resolves the last mentioned asset across an advisory turn, without importing its private text or earlier transforms", () => {
  const draft = createSpatialDraft("focus", "Ghost Footprint Trail"),
    id = draft.content.entities[2].id;
  draft.content.entities[2].content = "Private clue";
  const focus = assistantFollowUpFocus(draft, [
    { requestId: "old", operations: [{ entityId: draft.content.entities[0].id }] },
    { requestId: "latest", operations: [{ entityId: id }, { entityId: id }] },
    { requestId: "advisory", operations: [] },
  ]);
  expect(focus).toMatchObject({ status: "RESOLVED", sourceRequestId: "latest", references: [{ kind: "ASSET", id }] });
  expect(JSON.stringify(focus)).not.toContain("Private clue");
});
it("keeps multiple subjects ambiguous and missing subjects unavailable rather than retargeting", () => {
  const draft = createSpatialDraft("focus", "Ghost Footprint Trail");
  expect(
    assistantFollowUpFocus(draft, [
      { requestId: "multi", operations: draft.content.entities.map((e) => ({ entityId: e.id })) },
    ]).status,
  ).toBe("AMBIGUOUS");
  expect(
    assistantFollowUpFocus(draft, [
      { requestId: "earlier", operations: [{ entityId: draft.content.entities[0].id }] },
      { requestId: "removed", operations: [{ entityId: "gone" }] },
    ]).status,
  ).toBe("UNAVAILABLE");
  expect(assistantFollowUpFocus(draft, []).status).toBe("NONE");
});
it("treats the last edited group as one subject instead of selecting an arbitrary member", () => {
  const draft = createSpatialDraft("focus", "Ghost Footprint Trail");
  draft.content.studio!.editingGroups = [
    { id: "route", name: "Footprints", members: draft.content.entities.map((e) => ({ kind: "ASSET", id: e.id })) },
  ];
  expect(
    assistantFollowUpFocus(draft, [{ requestId: "group-turn", operations: [{ entityId: null, groupId: "route" }] }]),
  ).toMatchObject({ status: "RESOLVED", references: [{ kind: "GROUP", id: "route", name: "Footprints" }] });
});

it("does not hide an unrelated asset behind a group reference", () => {
  const draft = createSpatialDraft("focus", "Ghost Footprint Trail");
  draft.content.studio!.editingGroups = [
    { id: "route", name: "Route", members: [{ kind: "ASSET", id: draft.content.entities[0].id }] },
  ];
  expect(
    assistantFollowUpFocus(draft, [
      {
        requestId: "mixed",
        operations: [{ entityId: null, groupId: "route" }, { entityId: draft.content.entities[1].id }],
      },
    ]).status,
  ).toBe("AMBIGUOUS");
});

it("includes current geometry for a later conversation subject without growing the bounded detailed asset context", () => {
  const draft = createSpatialDraft("focus", "Ghost Footprint Trail"),
    last = draft.content.entities.at(-1)!;
  const context = prepareAssistantContext(draft, draft.content.entities[0].id, null, [], false, [last.id]);
  expect(context.entities.some((entity) => entity.id === last.id && entity.worldPosition)).toBe(true);
  expect(context.entities).toHaveLength(4);
  expect(context.selectedEntityId).toBe(draft.content.entities[0].id);
});

it("keeps scene metadata as the new subject instead of falling back to an older asset", () => {
  const draft = createSpatialDraft("focus");
  expect(
    assistantFollowUpFocus(draft, [
      { requestId: "old-asset", operations: [{ entityId: draft.content.entities[0].id }] },
      { requestId: "scene-title", operations: [{ type: "SCENE_DETAILS", entityId: null }] },
    ]),
  ).toMatchObject({
    status: "RESOLVED",
    sourceRequestId: "scene-title",
    references: [{ kind: "SCENE", id: draft.content.definitionId, name: draft.content.title }],
  });
});
it("distinguishes animation timing and interaction subjects from their target assets", () => {
  const draft = createSpatialDraft("focus"),
    entityId = draft.content.entities[0].id;
  draft.content.studio!.animationTracks = [
    {
      id: "fade",
      entityId,
      property: "OPACITY",
      interpolation: "LINEAR",
      enabled: true,
      keyframes: [
        { id: "a", atMs: 0, value: 0 },
        { id: "b", atMs: 2000, value: 1 },
      ],
    },
  ];
  draft.content.studio!.behaviors = [
    { id: "reveal", trigger: "TIMER", targetEntityId: entityId, action: "SHOW", delayMs: 1000 },
  ];
  expect(
    assistantFollowUpFocus(draft, [
      { requestId: "animation", operations: [{ entityId, trackId: "fade", type: "ANIMATION" }] },
    ]),
  ).toMatchObject({ status: "RESOLVED", references: [{ kind: "ANIMATION", id: "fade" }] });
  expect(
    assistantFollowUpFocus(draft, [
      { requestId: "interaction", operations: [{ entityId, behaviorId: "reveal", type: "BEHAVIOR" }] },
    ]),
  ).toMatchObject({ status: "RESOLVED", references: [{ kind: "INTERACTION", id: "reveal" }] });
});
