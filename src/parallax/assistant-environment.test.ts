import { expect, it } from "vitest";
import { prepareAssistantEnvironment } from "./assistant-environment";
import { createSpatialDraft, previewEntityTransform } from "./authoring";
import { simulationEnvironments } from "./studio-validation";
import { placeOnRoomFeature } from "./room-placement";
import { prepareAssistantContext, materializeAssistantInterpretation } from "./spatial-assistant";
import { roomPlacementExperiments } from "../../tests/parallax/room-placement-experiments";
import { createRoomEnvironment } from "./environment-authoring";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { placeOnSurface } from "./surface-placement";

it.each(simulationEnvironments)("pins $name geometry without changing the source draft or object", (preset) => {
  const draft = createSpatialDraft("assistant-room"),
    before = structuredClone(draft);
  const next = prepareAssistantEnvironment(draft, preset);
  expect(next.content.studio!.environment).toEqual(createRoomEnvironment(preset));
  expect(next.content.entities).toEqual(draft.content.entities);
  expect(draft).toEqual(before);
  expect(prepareAssistantEnvironment(next, preset)).toBe(next);
});

it("preserves an edited room and refuses to replace it with a comparison preset", () => {
  const room = prepareAssistantEnvironment(createSpatialDraft("edited"), simulationEnvironments[0]);
  room.content.studio!.environment!.features[0].name = "My floor";
  expect(() => prepareAssistantEnvironment(room, simulationEnvironments[1])).toThrow(/comparison/);
  expect(room.content.studio!.environment!.features[0].name).toBe("My floor");
});

it("cannot apply a generic wall placement or a partial create without its room placement dependency", () => {
  const draft = prepareAssistantEnvironment(createSpatialDraft("guard"), simulationEnvironments[0]);
  const interpretation = roomPlacementExperiments[0].deterministicFixture;
  const create = interpretation.operations.find((op) => op.type === "CREATE")!;
  expect(() => materializeAssistantInterpretation(draft, interpretation, [create.id])).toThrow(/clear surface/);
  expect(() => materializeAssistantInterpretation(draft, { ...interpretation, operations: [create] })).toThrow(
    /clear surface/,
  );
  expect(materializeAssistantInterpretation(draft, interpretation).content.entities.length).toBe(
    draft.content.entities.length + 1,
  );
});

it("exposes every feature's geometry once, with no imported image or private provenance identifiers", () => {
  const draft = prepareAssistantEnvironment(createSpatialDraft("context"), simulationEnvironments[0]);
  draft.content.studio!.environment!.features[0].provenance.sourceMediaIds = ["private-source-marker"];
  const context = prepareAssistantContext(draft, null);
  expect(context.roomFeatureIndex).toHaveLength(draft.content.studio!.environment!.features.length);
  for (const classification of ["WALL", "DOOR", "WINDOW", "DESK", "CHAIR"])
    expect(
      context.roomFeatureIndex.some((f) => f.classification === classification && f.position && f.dimensions),
    ).toBe(true);
  expect(JSON.stringify(context)).not.toContain("private-source-marker");
  expect(context.room?.featureData).toBe("roomFeatureIndex");
});

it.each(simulationEnvironments.filter((p) => p.vertical && p.id !== "empty"))(
  "puts a wall note by $name's door on a clear vertical face, never its window",
  (preset) => {
    const draft = prepareAssistantEnvironment(createSpatialDraft("entrance"), preset);
    const id = draft.content.entities[0].id;
    const room = draft.content.studio!.environment!;
    const door = room.features.find((f) => f.classification === "DOOR")!;
    const next = placeOnRoomFeature(draft, id, {
      classification: "WALL",
      targetFeatureId: null,
      nearFeatureId: door.id,
    });
    const frame = next.content.studio!.surfacePreviewFrames![0];
    const pose = previewEntityTransform(next.content, id, room.id, { ...preset, ...room });
    const surfaces = discoverRoomSurfaces(syntheticRoomGeometry({ ...preset, ...room }), { ...preset, ...room });
    const surface = surfaces.find((c) => c.id === frame.surfaceId)!;
    expect(surface.surface).toBe("WALL");
    expect(placeOnSurface(pose, surface, next.content.entities[0].widthMeters)).not.toBeNull();
    expect(Math.hypot(pose.position.x - door.position.x, pose.position.z - door.position.z)).toBeLessThan(1.3);
    expect(pose.rotation).toEqual(surface.rotation);
  },
);
