import { expect, it } from "vitest";
import {
  createRoomEnvironment,
  authoredPreviewEnvironment,
  resizeRoomEnvironment,
  resolveRoomFeature,
} from "./environment-authoring";
import { roomEnvironmentSchema } from "./environment-contracts";
import { createSpatialDraft, previewEntityTransform, draftSchema } from "./authoring";
import { simulationEnvironments } from "./studio-validation";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { placeOnRoomFeature } from "./room-placement";
import { prepareAssistantContext, materializeAssistantInterpretation } from "./spatial-assistant";
import { verifyConstructedEnvironment } from "./construction-verification";
import { buildOpenAIRequest } from "./openai-provider";
import { defaultAIGlobalPolicy } from "./ai-policy";

it.each(simulationEnvironments)("preserves actual $name geometry in its editable semantic definition", (preset) => {
  const room = createRoomEnvironment(preset);
  const draft = createSpatialDraft("semantic-room");
  draft.content.studio!.environment = room;
  const environment = authoredPreviewEnvironment(draft.content, { ...preset, id: room.id });
  const before = syntheticRoomGeometry(preset),
    after = syntheticRoomGeometry(environment);
  expect(after).toHaveLength(before.length);
  for (const part of before) {
    const restored = after.find((p) => p.id === part.id)!;
    restored.position.forEach((v, i) => expect(v).toBeCloseTo(part.position[i]));
    restored.size.forEach((v, i) => expect(v).toBeCloseTo(part.size[i]));
  }
  const surfaces = discoverRoomSurfaces(after, environment);
  expect(surfaces.filter((c) => c.surface === "FLOOR")).toHaveLength(1);
  expect(surfaces.filter((c) => c.surface === "WALL")).toHaveLength(preset.vertical ? 4 : 0);
  expect(draftSchema.parse(draft).content.studio!.environment).toEqual(room);
});
it("moves, resizes and rotates a real desk face together with its bound clue", () => {
  let draft = createSpatialDraft("room-placement");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  const entityId = draft.content.entities[0].id;
  draft = placeOnRoomFeature(draft, entityId, {
    classification: "DESK",
    targetFeatureId: "reference-desk",
    nearFeatureId: "window",
  });
  const room = draft.content.studio!.environment!;
  const desk = room.features.find((f) => f.id === "reference-desk")!;
  const beforeEnvironment = authoredPreviewEnvironment(draft.content, { ...simulationEnvironments[0], id: room.id });
  const beforePose = previewEntityTransform(draft.content, entityId, room.id, beforeEnvironment);
  const offset = { x: beforePose.position.x - desk.position.x, z: beforePose.position.z - desk.position.z };
  desk.position.x += 0.8;
  desk.yawDegrees = 90;
  desk.dimensions[0] = 1.6;
  const environment = authoredPreviewEnvironment(draft.content, { ...simulationEnvironments[0], id: room.id });
  const surface = discoverRoomSurfaces(syntheticRoomGeometry(environment), environment).find(
    (c) => c.id === "reference-desk",
  )!;
  const pose = previewEntityTransform(draft.content, entityId, room.id, environment);
  expect(surface.widthMeters).toBeCloseTo(1.6);
  expect(surface.rotation!.y).not.toBe(0);
  // Near-window placement now chooses a fitting point towards the window.
  // Its local offset must rotate with the edited desk rather than recentre.
  expect(pose.position.x).toBeCloseTo(surface.position.x + offset.z);
  expect(pose.position.z).toBeCloseTo(surface.position.z - offset.x);
  expect(pose.position.y).toBeCloseTo(surface.position.y + 0.01);
});
it("requires clarification for equivalent targets and uses actual near-window distances", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const desk = room.features.find((f) => f.id === "reference-desk")!;
  const second = structuredClone(desk);
  second.id = "second-desk";
  second.name = "Second desk";
  second.parts.forEach((p) => (p.id = `second-${p.id}`));
  second.position.z = 1;
  room.features.push(second);
  expect(resolveRoomFeature(room, "DESK").status).toBe("AMBIGUOUS");
  expect(resolveRoomFeature(room, "DESK", "window")).toMatchObject({
    status: "RESOLVED",
    feature: { id: "reference-desk" },
  });
  expect(resolveRoomFeature(room, "DESK", "missing").status).toBe("MISSING");
  expect(resolveRoomFeature(room, "DOOR").status).toBe("RESOLVED");
  const draft = createSpatialDraft("ambiguous");
  draft.content.studio!.environment = room;
  expect(() =>
    placeOnRoomFeature(draft, draft.content.entities[0].id, {
      classification: "DESK",
      targetFeatureId: null,
      nearFeatureId: null,
    }),
  ).toThrow(/Which desk/);
});
it("rescales shell and positions while retaining explicit furniture dimensions", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const resized = resizeRoomEnvironment(room, [8, 2.8, 6]);
  const before = room.features.find((f) => f.id === "reference-desk")!,
    after = resized.features.find((f) => f.id === before.id)!;
  expect(after.dimensions).toEqual(before.dimensions);
  expect(after.position.x).toBeCloseTo(before.position.x * 2);
  expect(resized.features.find((f) => f.classification === "FLOOR")!.dimensions[0]).toBeCloseTo(8);
  expect(() => resizeRoomEnvironment(room, [0, 3, 4])).toThrow();
});
it("rejects duplicate and oversized room definitions", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  expect(roomEnvironmentSchema.safeParse({ ...room, features: [...room.features, room.features[0]] }).success).toBe(
    false,
  );
  expect(roomEnvironmentSchema.safeParse({ ...room, width: Infinity }).success).toBe(false);
});
it("omits protected source identity and materializes room proposals through the same surface engine", () => {
  const draft = createSpatialDraft("room-assistant");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft.content.studio!.environment!.features[0].provenance.sourceMediaIds = ["private-source-opaque"];
  const entityId = draft.content.entities[0].id,
    context = prepareAssistantContext(draft, entityId);
  expect(JSON.stringify(context)).not.toContain("private-source-opaque");
  const next = materializeAssistantInterpretation(draft, {
    intentType: "EDIT",
    summary: "Place the map on the desk beside the window",
    clarification: null,
    operations: [
      {
        id: "room-op",
        explanation: "Use the authored desk beside the window",
        dependsOn: [],
        type: "ROOM_PLACEMENT",
        entityId,
        classification: "DESK",
        targetFeatureId: "reference-desk",
        nearFeatureId: "window",
      },
    ],
    assumptions: [],
    unsupportedCapabilities: [],
    warnings: [],
    accessibilityNotes: [],
    creatorExplanation: "Review the editable geometry before applying.",
  });
  expect(next.content.studio!.surfacePreviewFrames![0].surfaceId).toBe("reference-desk");
  expect(draft.content.studio!.surfacePreviewFrames).toBeUndefined();
  const body = buildOpenAIRequest({
    request: "Place the map on the desk near the window",
    context,
    model: "gpt-6-luna",
    mode: "STANDARD",
    policy: { ...defaultAIGlobalPolicy, maximumInputTokens: 32000 },
  });
  expect(JSON.stringify(body)).toContain("ROOM_PLACEMENT");
  expect(JSON.stringify(body)).not.toContain("private-source-opaque");
});

it.each(simulationEnvironments.filter((preset) => preset.vertical))(
  "retains grounding, attachments and joined side walls when resizing $name",
  (preset) => {
    const room = createRoomEnvironment(preset);
    const resized = resizeRoomEnvironment(room, [room.width * 1.25, 3.2, room.depth * 1.5]);
    expect(verifyConstructedEnvironment(resized, syntheticRoomGeometry({ ...preset, ...resized })).findings).toEqual(
      [],
    );
    for (const relation of room.construction?.relationships.filter((relation) => relation.type === "SUPPORTED_BY") ??
      []) {
      const before = room.features.find((feature) => feature.id === relation.featureId)!;
      const parentBefore = room.features.find((feature) => feature.id === relation.targetFeatureId)!;
      const after = resized.features.find((feature) => feature.id === relation.featureId)!;
      const parentAfter = resized.features.find((feature) => feature.id === relation.targetFeatureId)!;
      expect(after.position.x - parentAfter.position.x).toBeCloseTo(before.position.x - parentBefore.position.x);
      expect(after.position.z - parentAfter.position.z).toBeCloseTo(before.position.z - parentBefore.position.z);
    }
  },
);
