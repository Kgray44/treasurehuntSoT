import { z } from "zod";
import { Quaternion, Vector3 } from "three";
import { draftSchema, editSpatialDraft, previewEntityTransform, presetNames, type SpatialDraft } from "./authoring";
import { identityTransform, spatialId } from "./contracts";
import { animationTrackSchema, emptyStudioContent } from "./studio-contracts";
import { retimeAnimationTrack } from "./animation-authoring";
import { transformEditingSelection } from "./editing-groups";
import { insertSpatialPreset } from "./editor-assets";
import { authoredPreviewEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { roomFeatureClasses } from "./environment-contracts";
import { addRoomFeature, removeRoomFeature, boundRoomSurfaceIds } from "./parametric-room";
import { pruneEditingGroups } from "./editing-group-contracts";

const text = (length: number) => z.string().trim().min(1).max(length);
const common = { id: spatialId, explanation: text(400), dependsOn: z.array(spatialId).max(16) };
/** Narrow model commands reuse the manual editor's authority; never a whole-draft replacement. */
export const advancedAssistantOperationOptions = [
  z.strictObject({
    ...common,
    type: z.literal("ROOM_FEATURE_CREATE"),
    featureId: spatialId,
    classification: z.enum(roomFeatureClasses),
  }),
  z.strictObject({ ...common, type: z.literal("ROOM_FEATURE_REMOVE"), featureId: spatialId }),
  z.strictObject({
    ...common,
    type: z.literal("ROOM_FEATURE_TRANSFORM"),
    featureId: spatialId,
    translation: z.strictObject({
      x: z.number().finite().min(-10).max(10),
      y: z.number().finite().min(-3).max(3),
      z: z.number().finite().min(-10).max(10),
    }),
    yawDegrees: z.number().finite().min(-360).max(360),
    scale: z.number().finite().min(0.01).max(10),
  }),
  z.strictObject({ ...common, type: z.literal("DELETE"), entityId: spatialId }),
  z.strictObject({ ...common, type: z.literal("DUPLICATE"), entityId: spatialId, newEntityId: spatialId }),
  z.strictObject({ ...common, type: z.literal("PARENT"), entityId: spatialId, parentEntityId: spatialId.nullable() }),
  z.strictObject({
    ...common,
    type: z.literal("REORDER"),
    entityId: spatialId,
    offset: z.number().int().min(-31).max(31),
  }),
  z.strictObject({
    ...common,
    type: z.literal("LAYER"),
    entityId: spatialId,
    visible: z.boolean().nullable(),
    locked: z.boolean().nullable(),
    selectable: z.boolean().nullable(),
    audience: z.enum(["BOTH", "EDITOR_ONLY", "RUNTIME_ONLY"]).nullable(),
    tags: z.array(text(60)).max(16).nullable(),
  }),
  z.strictObject({
    ...common,
    type: z.literal("ROTATE"),
    entityId: spatialId,
    axis: z.enum(["SURFACE", "X", "Y", "Z"]),
    degrees: z.number().finite().min(-360).max(360),
  }),
  z.strictObject({
    ...common,
    type: z.literal("SCENE_DETAILS"),
    title: text(200).nullable(),
    tags: z.array(text(60)).max(16).nullable(),
    collection: z.string().trim().max(120).nullable(),
    favorite: z.boolean().nullable(),
  }),
  z.strictObject({ ...common, type: z.literal("INSERT_PRESET"), preset: z.enum(presetNames), idPrefix: spatialId }),
  z.strictObject({ ...common, type: z.literal("REMOVE_BEHAVIOR"), behaviorId: spatialId }),
  z.strictObject({ ...common, type: z.literal("ANIMATION"), track: animationTrackSchema }),
  z.strictObject({ ...common, type: z.literal("REMOVE_ANIMATION"), trackId: spatialId }),
  z.strictObject({
    ...common,
    type: z.literal("RETIME_ANIMATION"),
    trackId: spatialId,
    startMs: z.number().int().min(0).max(60000),
    endMs: z.number().int().min(0).max(60000),
  }),
  z.strictObject({
    ...common,
    type: z.literal("ANIMATION_STYLE"),
    trackId: spatialId,
    interpolation: z.enum(["STEP", "LINEAR", "EASE_IN_OUT", "CINEMATIC"]).nullable(),
    enabled: z.boolean().nullable(),
  }),
] as const;
export const advancedAssistantOperationSchema = z.discriminatedUnion("type", advancedAssistantOperationOptions);
export type AdvancedAssistantOperation = z.infer<typeof advancedAssistantOperationSchema>;
const types = new Set(advancedAssistantOperationOptions.map((option) => option.shape.type.value));
export function isAdvancedAssistantOperation(operation: { type: string }): operation is AdvancedAssistantOperation {
  return types.has(operation.type as AdvancedAssistantOperation["type"]);
}
export function advancedOperationTitle(operation: AdvancedAssistantOperation) {
  return {
    ROOM_FEATURE_CREATE: "Add room feature",
    ROOM_FEATURE_REMOVE: "Remove room feature",
    ROOM_FEATURE_TRANSFORM: "Room feature transform",
    DELETE: "Remove asset",
    DUPLICATE: "Duplicate asset",
    PARENT: "Asset hierarchy",
    REORDER: "Scene Graph order",
    LAYER: "Asset controls",
    ROTATE: "Rotation",
    SCENE_DETAILS: "Scene details",
    INSERT_PRESET: "Library preset",
    REMOVE_BEHAVIOR: "Remove interaction",
    ANIMATION: "Animation",
    REMOVE_ANIMATION: "Remove animation",
    RETIME_ANIMATION: "Animation timing",
    ANIMATION_STYLE: "Animation style",
  }[operation.type];
}
export function advancedOperationDescription(operation: AdvancedAssistantOperation, draft: SpatialDraft) {
  const name =
    "entityId" in operation
      ? (draft.content.entities.find((entity) => entity.id === operation.entityId)?.name ?? "Asset")
      : "Scene";
  switch (operation.type) {
    case "ROOM_FEATURE_CREATE":
      return `Add ${operation.classification.toLowerCase().replaceAll("_", " ")}`;
    case "ROOM_FEATURE_REMOVE":
      return `Remove ${draft.content.studio?.environment?.features.find((f) => f.id === operation.featureId)?.name ?? "room feature"}`;
    case "ROOM_FEATURE_TRANSFORM":
      return `Move, rotate or resize ${draft.content.studio?.environment?.features.find((f) => f.id === operation.featureId)?.name ?? "room feature"}`;
    case "DELETE":
      return `${name} · remove from this scene`;
    case "DUPLICATE":
      return `${name} · add a separate copy`;
    case "PARENT":
      return `${name} · ${operation.parentEntityId ? `attach to ${draft.content.entities.find((entity) => entity.id === operation.parentEntityId)?.name ?? "parent"}` : "move to scene root"}`;
    case "REORDER":
      return `${name} · move ${Math.abs(operation.offset)} places ${operation.offset < 0 ? "up" : "down"}`;
    case "LAYER":
      return `${name} · ${[operation.visible === null ? null : operation.visible ? "show" : "hide", operation.locked === null ? null : operation.locked ? "lock" : "unlock", operation.selectable === null ? null : operation.selectable ? "selectable" : "unselectable", operation.audience === null ? null : operation.audience.toLowerCase().replaceAll("_", " "), operation.tags === null ? null : "update tags"].filter(Boolean).join(", ")}`;
    case "ROTATE":
      return `${name} · ${operation.degrees}° around ${operation.axis === "SURFACE" ? "its surface normal" : `${operation.axis} axis`}`;
    case "SCENE_DETAILS":
      return operation.title ? `Scene · ${operation.title}` : "Scene · update library details";
    case "INSERT_PRESET":
      return operation.preset;
    case "REMOVE_BEHAVIOR":
      return "Remove the selected interaction behavior";
    case "ANIMATION":
      return `${draft.content.entities.find((entity) => entity.id === operation.track.entityId)?.name ?? "Asset"} · ${operation.track.property.toLowerCase()} · ${operation.track.keyframes.length} keyframes`;
    case "REMOVE_ANIMATION":
      return "Remove this animation track; keep its asset";
    case "RETIME_ANIMATION":
      return `Animation · ${(operation.startMs / 1000).toFixed(1)}–${(operation.endMs / 1000).toFixed(1)} s`;
    case "ANIMATION_STYLE":
      return `Animation · ${operation.interpolation?.toLowerCase().replaceAll("_", " ") ?? "keep motion style"}${operation.enabled === null ? "" : operation.enabled ? " · enabled" : " · disabled"}`;
  }
}
function editable(draft: SpatialDraft, id: string) {
  if (!draft.content.entities.some((entity) => entity.id === id)) throw new Error("Choose an existing asset.");
  if (draft.content.studio?.layers.some((layer) => layer.entityId === id && layer.locked))
    throw new Error("Unlock the affected asset before editing it.");
}
export function applyAdvancedAssistantOperation(
  input: SpatialDraft,
  raw: AdvancedAssistantOperation,
  options: { environmentEditing?: boolean } = {},
): SpatialDraft {
  const operation = advancedAssistantOperationSchema.parse(raw);
  if (operation.type.startsWith("ROOM_FEATURE_")) {
    if (!options.environmentEditing) throw new Error("Enable environment editing before changing room features.");
    const room = input.content.studio?.environment;
    if (!room) throw new Error("Choose an editable environment first.");
    if (operation.type === "ROOM_FEATURE_TRANSFORM") {
      const angle = (operation.yawDegrees * Math.PI) / 360;
      return transformEditingSelection(
        input,
        [{ kind: "ROOM_FEATURE", id: operation.featureId }],
        {
          position: operation.translation,
          rotation: { x: 0, y: Math.sin(angle), z: 0, w: Math.cos(angle) },
          scale: operation.scale,
        },
        room.id,
      );
    }
    const next = structuredClone(input);
    if (operation.type === "ROOM_FEATURE_CREATE") {
      if (room.features.some((f) => f.id === operation.featureId))
        throw new Error("Use a new identity for the room feature.");
      next.content.studio!.environment = addRoomFeature(room, operation.classification, operation.featureId);
    } else if (operation.type === "ROOM_FEATURE_REMOVE")
      next.content.studio!.environment = removeRoomFeature(
        room,
        operation.featureId,
        boundRoomSurfaceIds(input.content),
      );
    pruneEditingGroups(next.content);
    return draftSchema.parse(next);
  }
  switch (operation.type) {
    case "DELETE":
      if (input.content.entities.length < 2)
        throw new Error("Keep at least one asset in this spatial scene, or add a replacement first.");
      return editSpatialDraft(input, { type: "DELETE", entityId: operation.entityId });
    case "DUPLICATE":
      if (input.content.entities.some((entity) => entity.id === operation.newEntityId))
        throw new Error("Use a new identity for the duplicate.");
      return editSpatialDraft(input, { type: "DUPLICATE", entityId: operation.entityId, newId: operation.newEntityId });
    case "PARENT":
      if (operation.parentEntityId) editable(input, operation.parentEntityId);
      return editSpatialDraft(input, {
        type: "PARENT",
        entityId: operation.entityId,
        parentId: operation.parentEntityId,
      });
    case "REORDER":
      return editSpatialDraft(input, { type: "REORDER", entityId: operation.entityId, offset: operation.offset });
    case "LAYER": {
      const { visible, locked, selectable, audience, tags } = operation;
      if ([visible, locked, selectable, audience, tags].every((value) => value === null))
        throw new Error("Choose a layer property to change.");
      return editSpatialDraft(input, {
        type: "LAYER",
        entityId: operation.entityId,
        patch: {
          ...(visible === null ? {} : { visible }),
          ...(locked === null ? {} : { locked }),
          ...(selectable === null ? {} : { selectable }),
          ...(audience === null ? {} : { audience }),
          ...(tags === null ? {} : { tags }),
        },
      });
    }
    case "ROTATE": {
      const room = input.content.studio?.environment;
      const environment = authoredPreviewEnvironment(input.content, {
        ...simulationEnvironments[0],
        ...(room ? { id: room.id } : {}),
      });
      const pose = previewEntityTransform(input.content, operation.entityId, room?.id, environment);
      const axis =
        operation.axis === "SURFACE"
          ? new Vector3(0, 0, 1).applyQuaternion(
              new Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w),
            )
          : new Vector3(operation.axis === "X" ? 1 : 0, operation.axis === "Y" ? 1 : 0, operation.axis === "Z" ? 1 : 0);
      const q = new Quaternion().setFromAxisAngle(axis, (operation.degrees * Math.PI) / 180);
      return transformEditingSelection(
        input,
        [{ kind: "ASSET", id: operation.entityId }],
        { ...identityTransform(), rotation: { x: q.x, y: q.y, z: q.z, w: q.w } },
        room?.id,
      );
    }
    case "INSERT_PRESET":
      if (input.content.studio?.environment && input.content.placementPolicy === "FIXED")
        throw new Error("Create explicit assets with reviewed room surface placements in this environment.");
      return insertSpatialPreset(input, operation.preset, operation.idPrefix);
    case "RETIME_ANIMATION":
      return retimeAnimationTrack(input, operation.trackId, operation.startMs, operation.endMs);
  }
  const next = structuredClone(input),
    studio = (next.content.studio ??= emptyStudioContent());
  switch (operation.type) {
    case "SCENE_DETAILS":
      if ([operation.title, operation.tags, operation.collection, operation.favorite].every((value) => value === null))
        throw new Error("Choose a scene detail to change.");
      if (operation.title !== null) next.content.title = operation.title;
      if (operation.tags !== null) next.tags = operation.tags;
      if (operation.collection !== null) next.collection = operation.collection;
      if (operation.favorite !== null) next.favorite = operation.favorite;
      break;
    case "REMOVE_BEHAVIOR": {
      const behavior = studio.behaviors.find((item) => item.id === operation.behaviorId);
      if (!behavior) throw new Error("Choose an existing interaction behavior.");
      editable(next, behavior.targetEntityId);
      if (behavior.sourceEntityId) editable(next, behavior.sourceEntityId);
      studio.behaviors = studio.behaviors.filter((item) => item.id !== operation.behaviorId);
      break;
    }
    case "ANIMATION": {
      const track = animationTrackSchema.parse(operation.track);
      editable(next, track.entityId);
      if (next.content.adaptive && track.property === "POSITION")
        throw new Error("Automatic placement owns asset positions. Animate rotation, scale or opacity instead.");
      const room = next.content.studio?.environment;
      if (room && track.property === "POSITION") {
        const environment = authoredPreviewEnvironment(next.content, { ...simulationEnvironments[0], id: room.id });
        for (const frame of track.keyframes) {
          const sample = structuredClone(next);
          sample.content.entities.find((entity) => entity.id === track.entityId)!.transform.position = frame.value;
          const pose = previewEntityTransform(sample.content, track.entityId, room.id, environment);
          if (
            pose.position.y < -0.02 ||
            pose.position.y > room.height ||
            Math.abs(pose.position.x) > room.width / 2 ||
            Math.abs(pose.position.z) > room.depth / 2
          )
            throw new Error("Keep animation keyframes inside the current room. Review this motion path.");
        }
      }
      const tracks = (studio.animationTracks ??= []),
        existing = tracks.find((item) => item.id === track.id);
      if (existing && (existing.entityId !== track.entityId || existing.property !== track.property))
        throw new Error("Keep an existing animation's asset and property binding.");
      if (!existing && tracks.some((item) => item.entityId === track.entityId && item.property === track.property))
        throw new Error("Edit the existing track for this animated property.");
      const index = tracks.findIndex((item) => item.id === track.id);
      if (index < 0) tracks.push(track);
      else tracks[index] = track;
      break;
    }
    case "REMOVE_ANIMATION":
    case "ANIMATION_STYLE": {
      const track = studio.animationTracks?.find((item) => item.id === operation.trackId);
      if (!track) throw new Error("Choose an existing animation track.");
      editable(next, track.entityId);
      if (operation.type === "REMOVE_ANIMATION")
        studio.animationTracks = studio.animationTracks!.filter((item) => item.id !== track.id);
      else {
        if (operation.interpolation !== null) track.interpolation = operation.interpolation;
        if (operation.enabled !== null) track.enabled = operation.enabled;
      }
      break;
    }
  }
  return draftSchema.parse(next);
}
