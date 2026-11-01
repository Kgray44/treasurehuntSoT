import { assistantEvaluationCorpus, MAP, type AssistantEvaluationCase } from "./spatial-assistant-corpus-v1";
import { createRoomEnvironment } from "../../src/parallax/environment-authoring";
import { simulationEnvironments } from "../../src/parallax/studio-validation";
import {
  materializeAssistantInterpretation,
  assistantInterpretationSchema,
} from "../../src/parallax/spatial-assistant";
import { previewEntityTransform, type SpatialDraft } from "../../src/parallax/authoring";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "../../src/parallax/room-geometry";
import { placeOnSurface, surfaceFrameRotation } from "../../src/parallax/surface-placement";

export type RoomPlacementCase = AssistantEvaluationCase & {
  roomPreset: string;
  supportId: string;
  landmarkId: string | null;
  maximumLandmarkDistance: number;
  editOnly?: boolean;
  roomSupport?: string;
};
function roomCase(
  id: string,
  preset: string,
  request: string,
  supportId: string,
  landmarkId: string | null,
  distance = 1.3,
): RoomPlacementCase {
  const base = structuredClone(assistantEvaluationCorpus.find((item) => item.id === "create-note")!);
  const room = createRoomEnvironment(simulationEnvironments.find((p) => p.id === preset)!);
  const feature = room.features.find((f) => f.id === supportId)!;
  const create = base.deterministicFixture.operations.find((op) => op.type === "CREATE")!;
  create.placement = feature.classification === "WALL" ? "WALL" : "DESK";
  create.position = { x: 0, y: 0, z: 0 };
  const fixture = base.deterministicFixture;
  fixture.operations = [
    create,
    {
      id: "room-support",
      explanation: "Use a clear part of the requested feature.",
      dependsOn: [create.id],
      type: "ROOM_PLACEMENT",
      entityId: create.entityId,
      classification: feature.classification,
      targetFeatureId: supportId,
      nearFeatureId: landmarkId,
    },
  ];
  return {
    ...base,
    id,
    category: "CURRENT_ROOM_GROUNDED_PLACEMENT",
    request,
    selectedEntityId: null,
    roomPreset: preset,
    supportId,
    landmarkId,
    maximumLandmarkDistance: distance,
    expected: { ...base.expected, scene: [], requiredOperations: [{ type: "CREATE" }, { type: "ROOM_PLACEMENT" }] },
    deterministicFixture: fixture,
  };
}
export const roomPlacementExperiments: RoomPlacementCase[] = [
  roomCase(
    "room-bedroom-entrance",
    "bedroom",
    "Place a readable old pirate note on a wall near the entrance.",
    "wall-front",
    "entry-door",
  ),
  roomCase(
    "room-bedroom-door-sign",
    "bedroom",
    "Add a readable wall sign beside the bedroom door. Keep it off the door itself and off the window.",
    "wall-front",
    "entry-door",
  ),
  roomCase(
    "room-bedroom-desk-window",
    "bedroom",
    "Place a readable parchment clue on the desk closest to the window.",
    "reference-desk",
    "window",
    2,
  ),
  roomCase("room-bedroom-chair", "bedroom", "Put a small readable note on the desk chair's seat.", "desk-chair", null),
  roomCase(
    "room-bedroom-floor-bed",
    "bedroom",
    "Place a small marker on the floor beside the bed.",
    "floor-furniture",
    "bed",
    1.8,
  ),
  roomCase(
    "room-dorm-door",
    "dorm",
    "Put a readable old note on the wall next to the entrance.",
    "wall-front",
    "entry-door",
  ),
  roomCase(
    "room-office-door-desk",
    "office",
    "Put a small readable note on the desk nearest the entrance door.",
    "workstation-right-front",
    "entry-door",
    2,
  ),
  roomCase(
    "room-living-sofa-table",
    "living-room",
    "Put a readable note on the coffee table next to the sofa.",
    "table-left",
    "sofa",
    2,
  ),
  roomCase(
    "room-gallery-door",
    "gallery",
    "Place a readable gallery entrance sign on the wall beside its doorway.",
    "wall-front",
    "entry-door",
  ),
  roomCase(
    "room-bedroom-wall-window",
    "bedroom",
    "Put a readable note on the wall beside the window, not on the glass.",
    "wall-window",
    "window",
  ),
  roomCase(
    "room-bedroom-table",
    "bedroom",
    "Put a small readable note on the bedside table next to the lamp.",
    "table-left",
    "bedside-lamp",
    1.5,
  ),
];
for (const supportId of ["reference-desk", "wall-front"]) {
  const item = roomCase(
    `room-adjust-${supportId}`,
    "bedroom",
    "Make the selected map 15% smaller and move it 0.1 meters to the left. Preserve its clue text, height and support.",
    supportId,
    null,
  );
  item.roomSupport = supportId;
  item.editOnly = true;
  item.selectedEntityId = MAP;
  item.expected.intentType = "EDIT";
  item.expected.requiredOperations = [{ type: "RELATIVE_TRANSFORM", entityId: MAP }];
  item.deterministicFixture.intentType = "EDIT";
  item.deterministicFixture.summary = "I’d make the map smaller and shift it left.";
  item.deterministicFixture.operations = [
    {
      id: "adjust",
      type: "RELATIVE_TRANSFORM",
      entityId: MAP,
      translation: { x: -0.1, y: 0, z: 0 },
      scaleFactor: 0.85,
      explanation: "I’d preserve its height and support.",
      dependsOn: [],
    },
  ];
  roomPlacementExperiments.push(item);
}
export function evaluateRoomPlacement(item: RoomPlacementCase, draft: SpatialDraft, raw: unknown) {
  const findings: string[] = [];
  const parsed = assistantInterpretationSchema.safeParse(raw);
  if (!parsed.success) return { passed: false, findings: ["SCHEMA_INVALID"] };
  try {
    const next = materializeAssistantInterpretation(draft, parsed.data);
    const room = next.content.studio!.environment!;
    const preview = { ...simulationEnvironments.find((p) => p.id === item.roomPreset)!, ...room };
    const surfaces = discoverRoomSurfaces(syntheticRoomGeometry(preview), preview);
    const support = room.features.find((f) => f.id === item.supportId)!;
    const landmark = room.features.find((f) => f.id === item.landmarkId);
    const created = parsed.data.operations.filter((op) => op.type === "CREATE");
    if (!created.length && !item.editOnly) findings.push("NO_CREATED_ASSET");
    if (item.editOnly && !parsed.data.operations.some((op) => op.type === "RELATIVE_TRANSFORM"))
      findings.push("NO_RELATIVE_EDIT");
    const targets = item.editOnly ? [{ entityId: MAP }] : created;
    for (const op of targets) {
      const entity = next.content.entities.find((e) => e.id === op.entityId)!;
      const binding = next.content.studio!.surfacePreviewFrames?.find((f) => f.anchorId === entity.anchorId);
      if (!support.parts.some((p) => p.id === binding?.surfaceId)) findings.push("WRONG_SUPPORT_FEATURE");
      const surface = surfaces.find((s) => s.id === binding?.surfaceId);
      const pose = previewEntityTransform(next.content, entity.id, room.id, preview);
      if (!surface || !placeOnSurface(pose, surface, entity.widthMeters)) findings.push("BLOCKED_OR_OUTSIDE_SURFACE");
      if (surface) {
        const expected = surfaceFrameRotation(surface),
          actual = pose.rotation;
        if (
          Math.abs(expected.x * actual.x + expected.y * actual.y + expected.z * actual.z + expected.w * actual.w) <
          1 - 1e-6
        )
          findings.push("WRONG_SURFACE_ORIENTATION");
      }
      if (
        landmark &&
        Math.hypot(pose.position.x - landmark.position.x, pose.position.z - landmark.position.z) >
          item.maximumLandmarkDistance
      )
        findings.push("TOO_FAR_FROM_LANDMARK");
    }
    for (const entity of draft.content.entities)
      if (
        !(item.editOnly && entity.id === MAP) &&
        JSON.stringify(next.content.entities.find((e) => e.id === entity.id)) !== JSON.stringify(entity)
      )
        findings.push("EXISTING_ASSET_CHANGED");
    if (item.editOnly) {
      const before = previewEntityTransform(draft.content, MAP, room.id, preview),
        after = previewEntityTransform(next.content, MAP, room.id, preview);
      if (
        Math.abs(after.position.x - before.position.x + 0.1) > 1e-6 ||
        Math.abs(after.position.y - before.position.y) > 1e-6 ||
        Math.abs(after.position.z - before.position.z) > 1e-6 ||
        Math.abs(after.scale / before.scale - 0.85) > 1e-6
      )
        findings.push("RELATIVE_EDIT_MISMATCH");
      if (
        next.content.entities.find((e) => e.id === MAP)!.content !==
        draft.content.entities.find((e) => e.id === MAP)!.content
      )
        findings.push("CLUE_CHANGED");
      if (!/\bI(?:[’']d|[’']ll| can| will| propose| suggest|\b)/.test(parsed.data.summary))
        findings.push("FIRST_PERSON_MISSING");
    }
    if (JSON.stringify(next.content.studio!.environment) !== JSON.stringify(draft.content.studio!.environment))
      findings.push("ENVIRONMENT_CHANGED");
  } catch {
    findings.push("MATERIALIZATION_REJECTED");
  }
  return { passed: !findings.length, findings };
}
