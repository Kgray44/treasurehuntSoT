import { expect, it } from "vitest";
import { createSpatialDraft, previewEntityTransform } from "./authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { placeOnRoomFeature } from "./room-placement";
import {
  materializeAssistantInterpretation,
  prepareAssistantContext,
  type AssistantInterpretation,
} from "./spatial-assistant";

const proposal: AssistantInterpretation = {
  intentType: "EDIT",
  summary: "I’d make the map smaller and move it left.",
  clarification: null,
  operations: [],
  assumptions: [],
  warnings: [],
  unsupportedCapabilities: [],
  accessibilityNotes: [],
  creatorExplanation: "I’ll keep its clue and height.",
};
function fixture(classification: "DESK" | "WALL" = "DESK") {
  let draft = createSpatialDraft("relative-edit");
  draft.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  draft = placeOnRoomFeature(draft, draft.content.entities[0].id, {
    classification,
    targetFeatureId: classification === "DESK" ? "reference-desk" : "wall-front",
    nearFeatureId: null,
  });
  return draft;
}
it.each(["DESK", "WALL"] as const)(
  "smaller and left preserves %s support, world height, orientation, clue and other settings",
  (classification) => {
    const draft = fixture(classification),
      entity = draft.content.entities[0];
    const room = { ...simulationEnvironments[0], ...draft.content.studio!.environment! };
    const before = previewEntityTransform(draft.content, entity.id, room.id, room);
    const next = materializeAssistantInterpretation(draft, {
      ...proposal,
      operations: [
        {
          id: "adjust",
          type: "RELATIVE_TRANSFORM",
          entityId: entity.id,
          translation: { x: -0.1, y: 0, z: 0 },
          scaleFactor: 0.85,
          dependsOn: [],
          explanation: "I’ll shift left without changing height.",
        },
      ],
    });
    const after = previewEntityTransform(next.content, entity.id, room.id, room);
    expect(after.position.x).toBeCloseTo(before.position.x - 0.1);
    expect(after.position.y).toBeCloseTo(before.position.y);
    expect(after.position.z).toBeCloseTo(before.position.z);
    for (const axis of ["x", "y", "z", "w"] as const)
      expect(after.rotation[axis]).toBeCloseTo(before.rotation[axis], 10);
    expect(after.scale).toBeCloseTo(before.scale * 0.85);
    expect(next.content.entities[0].content).toBe(entity.content);
    expect(next.content.entities[0].interactions).toEqual(entity.interactions);
    expect(next.content.studio!.surfacePreviewFrames).toEqual(draft.content.studio!.surfacePreviewFrames);
    expect(prepareAssistantContext(draft, entity.id).entities[0].worldPosition).toEqual(before.position);
  },
);
it("rejects an absolute plane-local offset that sends a desk map above the ceiling, without editing the source", () => {
  const draft = fixture(),
    before = structuredClone(draft);
  expect(() =>
    materializeAssistantInterpretation(draft, {
      ...proposal,
      operations: [
        {
          id: "bad",
          type: "TRANSFORM",
          entityId: draft.content.entities[0].id,
          position: { x: -0.1, y: 0, z: 3 },
          scale: 0.85,
          dependsOn: [],
          explanation: "A synthetic coordinate-frame mistake.",
        },
      ],
    }),
  ).toThrow(/outside the current room/);
  expect(draft).toEqual(before);
});
it("rejects a relative move that leaves the supporting desk", () => {
  const draft = fixture();
  expect(() =>
    materializeAssistantInterpretation(draft, {
      ...proposal,
      operations: [
        {
          id: "bad",
          type: "RELATIVE_TRANSFORM",
          entityId: draft.content.entities[0].id,
          translation: { x: -1, y: 0, z: 0 },
          scaleFactor: 1,
          dependsOn: [],
          explanation: "Move too far for this desk.",
        },
      ],
    }),
  ).toThrow(/supporting surface/);
});
