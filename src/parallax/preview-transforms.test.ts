import { expect, it, vi } from "vitest";
import { createSpatialDraft, editSpatialDraft, previewEntityTransform, previewEntityTransforms } from "./authoring";
import { spatialPropStyle } from "./prop-style";
import { syntheticRoomGeometry, discoverRoomSurfaces } from "./room-geometry";
import { createPresetConstruction } from "./preset-construction";
import { createMotionTrack, retimeAnimationTrack, recordAnimationKeyframe } from "./animation-authoring";
import { evaluateSpatialScene } from "./behavior";

it("resolves shared, parented and surface-bound transforms identically using a single supplied surface collection", () => {
  let draft = createSpatialDraft("preview");
  for (let i = 0; i < 15; i++)
    draft = editSpatialDraft(draft, { type: "DUPLICATE", entityId: draft.content.entities[0].id, newId: `copy-${i}` });
  draft = editSpatialDraft(draft, { type: "PARENT", entityId: "copy-1", parentId: "copy-0" });
  const room = {
    ...createPresetConstruction({ id: "bedroom", width: 4, depth: 4, vertical: true }),
    horizontal: true,
    vertical: true,
  };
  const surfaces = discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 });
  const batched = previewEntityTransforms(draft.content, room.id, room, surfaces);
  for (const entity of draft.content.entities)
    expect(batched[entity.id]).toEqual(previewEntityTransform(draft.content, entity.id, room.id, room));
});

it.each(["Desk Map", "Peeking Letter", "Ghost Footprint Trail", "Floating Compass"])(
  "retains %s visual identity through rename and serialization",
  (preset) => {
    const draft = createSpatialDraft("rename", preset);
    const entity = draft.content.entities[0];
    const next = editSpatialDraft(draft, { type: "CONTENT", entityId: entity.id, patch: { name: "My secret clue" } });
    expect(spatialPropStyle(JSON.parse(JSON.stringify(next.content.entities[0])))).toBe(spatialPropStyle(entity));
    expect(next.content.entities[0].id).toBe(entity.id);
    expect(next.content.entities[0].transform).toEqual(entity.transform);
    expect(draft.content.entities[0].propStyle).toBeUndefined();
  },
);

it("creates actual interpolated motion, retimes every pose and preserves intermediate interpolation", () => {
  vi.stubGlobal("crypto", { randomUUID: () => `key-${Math.random().toString(16).slice(2)}` });
  const draft = createSpatialDraft("motion", "Floating Compass"),
    id = draft.content.entities[0].id;
  const next = createMotionTrack(draft, id, "POSITION", 0);
  const track = next.content.studio!.animationTracks![0];
  expect(evaluateSpatialScene(next.content, [], 1000).states[id].transform.position.x).toBeCloseTo(0.125);
  const moved = retimeAnimationTrack(next, track.id, 1000, 5000);
  expect(moved.content.studio!.animationTracks![0].keyframes.map((frame) => frame.atMs)).toEqual([1000, 5000]);
  expect(evaluateSpatialScene(moved.content, [], 3000).states[id].transform.position.x).toBeCloseTo(0.125);
  expect(() => retimeAnimationTrack(next, track.id, 0, 0)).toThrow();
  expect(() => retimeAnimationTrack(next, track.id, -100, 2000)).toThrow();
  next.content.studio!.layers[0].locked = true;
  expect(() => retimeAnimationTrack(next, track.id, 0, 3000)).toThrow(/Unlock/);
  vi.unstubAllGlobals();
});

it("records an edited pose in Editor without copying an old animation sample", () => {
  let draft = createSpatialDraft("record", "Floating Compass");
  const id = draft.content.entities[0].id;
  draft = recordAnimationKeyframe(draft, id, "POSITION", 0, "AUTHORED");
  draft = editSpatialDraft(draft, {
    type: "TRANSFORM",
    entityId: id,
    transform: { ...draft.content.entities[0].transform, position: { x: 1, y: 0.55, z: 0 } },
  });
  const preview = recordAnimationKeyframe(draft, id, "POSITION", 2000, "PREVIEW");
  expect(preview.content.studio!.animationTracks![0].keyframes[1].value).toMatchObject({ x: 0 });
  const authored = recordAnimationKeyframe(draft, id, "POSITION", 2000, "AUTHORED");
  expect(evaluateSpatialScene(authored.content, [], 1000).states[id].transform.position.x).toBeCloseTo(0.5);
  const updated = recordAnimationKeyframe(authored, id, "POSITION", 0, "AUTHORED");
  expect(updated.content.studio!.animationTracks![0].keyframes).toHaveLength(2);
  expect(updated.content.studio!.animationTracks![0].keyframes[0].value).toMatchObject({ x: 1 });
});
