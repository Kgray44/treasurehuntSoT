import { expect, it } from "vitest";
import {
  createSpatialDraft,
  draftSchema,
  editSpatialDraft,
  changeHistory,
  undo,
  redo,
  previewEntityTransforms,
} from "./authoring";
import { insertSpatialPreset } from "./editor-assets";
import { saveEditingGroup, ungroupEditingGroup, transformEditingSelection } from "./editing-groups";
import { identityTransform } from "./contracts";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { placeOnRoomFeature } from "./room-placement";
import { createGenericRoomFeature } from "./room-feature-construction";

const trail = () => {
  let draft = createSpatialDraft("trail", "Ghost Footprint Trail");
  for (let index = 1; index < 4; index++) draft = insertSpatialPreset(draft, "Ghost Footprint Trail", `trail-${index}`);
  return draft;
};
it("groups twenty actual footprints, translates atomically and preserves membership/poses across undo, redo and serialization", () => {
  const original = trail();
  const members = original.content.entities.map((entity) => ({ kind: "ASSET" as const, id: entity.id }));
  const grouped = saveEditingGroup(original, { id: "route", name: "Ghost route", members }, true);
  expect(grouped.content.entities).toEqual(original.content.entities);
  const moved = transformEditingSelection(grouped, members, {
    ...identityTransform(),
    position: { x: 1.5, y: 0.25, z: -1 },
  });
  const before = previewEntityTransforms(grouped.content),
    after = previewEntityTransforms(moved.content);
  for (const member of members) {
    expect(after[member.id].position.x - before[member.id].position.x).toBeCloseTo(1.5);
    expect(after[member.id].position.y - before[member.id].position.y).toBeCloseTo(0.25);
    expect(after[member.id].position.z - before[member.id].position.z).toBeCloseTo(-1);
  }
  const history = changeHistory({ present: grouped, past: [], future: [] }, { type: "REPLACE", draft: moved });
  expect(undo(history).present).toEqual(grouped);
  expect(redo(undo(history)).present).toEqual(moved);
  expect(draftSchema.parse(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
  expect(ungroupEditingGroup(moved, "route").content.entities).toEqual(moved.content.entities);
});
it("does not double-transform a selected parent/child, and moves the parent's authored animation path", () => {
  let draft = createSpatialDraft("parent", "Ghost Footprint Trail");
  const [parent, child] = draft.content.entities;
  draft = editSpatialDraft(draft, { type: "PARENT", entityId: child.id, parentId: parent.id });
  draft.content.studio!.animationTracks = [
    {
      id: "walk",
      entityId: parent.id,
      enabled: true,
      property: "POSITION",
      interpolation: "EASE_IN_OUT",
      keyframes: [
        { id: "start", atMs: 0, value: { ...parent.transform.position } },
        { id: "end", atMs: 1000, value: { x: 1, y: 0.02, z: -2 } },
      ],
    },
  ];
  const members = [parent, child].map((entity) => ({ kind: "ASSET" as const, id: entity.id }));
  const before = previewEntityTransforms(draft.content);
  const moved = transformEditingSelection(draft, members, { ...identityTransform(), position: { x: 2, y: 0, z: 0 } });
  const after = previewEntityTransforms(moved.content);
  expect(after[child.id].position.x - before[child.id].position.x).toBeCloseTo(2);
  expect(moved.content.entities.find((entity) => entity.id === child.id)!.transform).toEqual(
    draft.content.entities.find((entity) => entity.id === child.id)!.transform,
  );
  const track = moved.content.studio!.animationTracks![0];
  if (track.property !== "POSITION") throw new Error("Position track required");
  expect(track.keyframes[1].value.x).toBeCloseTo(3);
});
it("moves mixed room/asset groups once, including a selected attached feature and a surface-bound asset", () => {
  let draft = createSpatialDraft("mixed");
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const desk = room.features.find((feature) => feature.classification === "DESK")!;
  const lamp = createGenericRoomFeature({
    id: "lamp",
    classification: "APPLIANCE",
    applianceShape: "GENERIC_BOX",
    dimensions: [0.2, 0.3, 0.2],
    position: { x: desk.position.x, y: desk.dimensions[1] + 0.15, z: desk.position.z },
  });
  room.features.push(lamp);
  room.construction!.relationships.push({ featureId: lamp.id, targetFeatureId: desk.id, type: "SUPPORTED_BY" });
  draft.content.studio!.environment = room;
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification: "DESK",
    targetFeatureId: desk.id,
    nearFeatureId: null,
  });
  const members = [
    { kind: "ROOM_FEATURE" as const, id: desk.id },
    { kind: "ROOM_FEATURE" as const, id: lamp.id },
    { kind: "ASSET" as const, id: draft.content.entities[0].id },
  ];
  const before = previewEntityTransforms(draft.content, room.id, { ...room, horizontal: true, vertical: true });
  const moved = transformEditingSelection(
    draft,
    members,
    { ...identityTransform(), position: { x: 0.5, y: 0, z: 0.3 } },
    room.id,
  );
  const newRoom = moved.content.studio!.environment!;
  const after = previewEntityTransforms(moved.content, room.id, { ...newRoom, horizontal: true, vertical: true });
  expect(after[members[2].id].position.x - before[members[2].id].position.x).toBeCloseTo(0.5);
  expect(newRoom.features.find((feature) => feature.id === lamp.id)!.position.x - lamp.position.x).toBeCloseTo(0.5);
  expect(newRoom.features.find((feature) => feature.id === desk.id)!.position.z - desk.position.z).toBeCloseTo(0.3);
});
it("refuses partial locked edits, transfers memberships explicitly, and trims deleted items without deleting remaining groups", () => {
  const draft = trail(),
    members = draft.content.entities.slice(0, 3).map((entity) => ({ kind: "ASSET" as const, id: entity.id }));
  let grouped = saveEditingGroup(draft, { id: "first", name: "First", members }, true);
  grouped = saveEditingGroup(grouped, { id: "second", name: "Second", members: [members[2]] }, true);
  expect(grouped.content.studio!.editingGroups!.find((group) => group.id === "first")!.members).toEqual(
    members.slice(0, 2),
  );
  grouped = editSpatialDraft(grouped, { type: "LAYER", entityId: members[1].id, patch: { locked: true } });
  const snapshot = JSON.stringify(grouped);
  expect(() =>
    transformEditingSelection(grouped, members, { ...identityTransform(), position: { x: 1, y: 0, z: 0 } }),
  ).toThrow("Unlock every");
  expect(JSON.stringify(grouped)).toBe(snapshot);
  grouped = editSpatialDraft(grouped, { type: "DELETE", entityId: members[0].id });
  expect(grouped.content.studio!.editingGroups!.find((group) => group.id === "first")!.members).toEqual([members[1]]);
  expect(draftSchema.parse(draft).content.studio).not.toHaveProperty("editingGroups");
});
