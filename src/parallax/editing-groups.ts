import { draftSchema, previewEntityTransforms, previewReferenceFrame, type SpatialDraft } from "./authoring";
import { authoredPreviewEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { emptyStudioContent } from "./studio-contracts";
import {
  editingGroupSchema,
  groupMemberKey,
  type EditingGroup,
  type EditingGroupMember,
} from "./editing-group-contracts";
import { composeTransform, inverseTransform } from "./transforms";
import { identityTransform, type Transform } from "./contracts";
import { transformRoomFeature } from "./room-feature-transform";

/** Include existing hierarchical/support dependents in live projection, without double transforms. */
export function editingSelectionEffects(input: SpatialDraft, members: readonly EditingGroupMember[]) {
  const assets = new Set(members.filter((member) => member.kind === "ASSET").map((member) => member.id));
  const features = new Set(members.filter((member) => member.kind === "ROOM_FEATURE").map((member) => member.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const entity of input.content.entities)
      if (entity.parentEntityId && assets.has(entity.parentEntityId) && !assets.has(entity.id)) {
        assets.add(entity.id);
        changed = true;
      }
    for (const relation of input.content.studio?.environment?.construction?.relationships ?? [])
      if (features.has(relation.targetFeatureId) && !features.has(relation.featureId)) {
        features.add(relation.featureId);
        changed = true;
      }
    for (const feature of input.content.studio?.environment?.features ?? [])
      if (
        feature.exclusion?.sourceFeatureId &&
        features.has(feature.exclusion.sourceFeatureId) &&
        !features.has(feature.id)
      ) {
        features.add(feature.id);
        changed = true;
      }
  }
  const effects = [
    ...[...assets].map((id) => ({
      kind: "ASSET" as const,
      id,
      scaleWithGroup: true,
      supportOrigin: null as Transform["position"] | null,
    })),
    ...[...features].map((id) => ({
      kind: "ROOM_FEATURE" as const,
      id,
      scaleWithGroup: true,
      supportOrigin: null as Transform["position"] | null,
    })),
  ];
  const room = input.content.studio?.environment;
  if (room) {
    const partIds = new Set(
      room.features
        .filter((feature) => features.has(feature.id))
        .flatMap((feature) => feature.parts.map((part) => part.id)),
    );
    for (const entity of input.content.entities) {
      if (assets.has(entity.id)) continue;
      const frame = input.content.studio?.surfacePreviewFrames?.find(
        (frame) =>
          frame.anchorId === entity.anchorId && frame.environmentId === room.id && partIds.has(frame.surfaceId),
      );
      if (frame) {
        const anchor = input.content.anchors.find((anchor) => anchor.id === entity.anchorId)!;
        // The reference-frame origin moves with its surface; authored local offsets keep their size.
        const supportOrigin = previewReferenceFrame(input.content, anchor, room.id, {
          ...room,
          horizontal: true,
          vertical: true,
        }).position;
        effects.push({ kind: "ASSET", id: entity.id, scaleWithGroup: false, supportOrigin });
      }
    }
  }
  return effects;
}

export function validGroupMembers(draft: SpatialDraft, members: readonly EditingGroupMember[]) {
  const keys = members.map(groupMemberKey);
  if (!members.length || new Set(keys).size !== keys.length) throw new Error("Select distinct items for this group.");
  for (const member of members) {
    const found =
      member.kind === "ASSET"
        ? draft.content.entities.some((entity) => entity.id === member.id)
        : draft.content.studio?.environment?.features.some((feature) => feature.id === member.id);
    if (!found) throw new Error("A selected item is no longer in this scene. Refresh the selection.");
  }
  return members.map((member) => ({ ...member }));
}

export function saveEditingGroup(input: SpatialDraft, group: EditingGroup, createOnly = false): SpatialDraft {
  const next = structuredClone(input),
    parsed = editingGroupSchema.parse(group);
  validGroupMembers(next, parsed.members);
  const studio = (next.content.studio ??= emptyStudioContent());
  const existing = studio.editingGroups ?? [];
  if (createOnly && existing.some((item) => item.id === parsed.id))
    throw new Error("This group identity already exists.");
  // Explicit regrouping transfers membership; no item is duplicated, reparented or repositioned.
  const keys = new Set(parsed.members.map(groupMemberKey));
  studio.editingGroups = existing
    .filter((item) => item.id !== parsed.id)
    .map((item) => ({ ...item, members: item.members.filter((member) => !keys.has(groupMemberKey(member))) }))
    .filter((item) => item.members.length);
  studio.editingGroups.push(parsed);
  return draftSchema.parse(next);
}

export function ungroupEditingGroup(input: SpatialDraft, id: string): SpatialDraft {
  if (!input.content.studio?.editingGroups?.some((group) => group.id === id))
    throw new Error("Choose an existing group.");
  const next = structuredClone(input);
  next.content.studio!.editingGroups = next.content.studio!.editingGroups!.filter((group) => group.id !== id);
  return draftSchema.parse(next);
}

function roomFor(draft: SpatialDraft, environmentId?: string) {
  const authored = draft.content.studio?.environment;
  if (authored && (!environmentId || environmentId === authored.id))
    return authoredPreviewEnvironment(draft.content, { ...simulationEnvironments[0], id: authored.id });
  return authoredPreviewEnvironment(
    draft.content,
    simulationEnvironments.find((room) => room.id === environmentId) ?? simulationEnvironments[0],
  );
}

export function editingSelectionPivot(
  draft: SpatialDraft,
  members: readonly EditingGroupMember[],
  environmentId?: string,
): Transform["position"] {
  validGroupMembers(draft, members);
  const room = roomFor(draft, environmentId),
    poses = previewEntityTransforms(draft.content, environmentId ?? draft.content.studio?.environment?.id, room);
  const points = members.map((member) =>
    member.kind === "ASSET"
      ? poses[member.id].position
      : draft.content.studio!.environment!.features.find((feature) => feature.id === member.id)!.position,
  );
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

/** One atomic world-frame delta; canonical anchors, hierarchy and runtime entities remain intact. */
export function transformEditingSelection(
  input: SpatialDraft,
  members: readonly EditingGroupMember[],
  delta: Transform,
  environmentId?: string,
  worldPivot?: Transform["position"],
): SpatialDraft {
  validGroupMembers(input, members);
  if (!Number.isFinite(delta.scale) || delta.scale <= 0) throw new Error("Use a finite positive group scale.");
  const selectedAssets = new Set(members.filter((member) => member.kind === "ASSET").map((member) => member.id));
  const selectedFeatures = new Set(
    members.filter((member) => member.kind === "ROOM_FEATURE").map((member) => member.id),
  );
  if (selectedFeatures.size && environmentId && environmentId !== input.content.studio?.environment?.id)
    throw new Error("Return to this group's saved environment before transforming its room features.");
  if (selectedAssets.size && input.content.adaptive)
    throw new Error("Use Manual placement to transform this group; automatic placement retains its semantic rules.");
  const descendants = new Set(selectedAssets);
  let added = true;
  while (added) {
    added = false;
    for (const entity of input.content.entities)
      if (entity.parentEntityId && descendants.has(entity.parentEntityId) && !descendants.has(entity.id)) {
        descendants.add(entity.id);
        added = true;
      }
  }
  if (input.content.studio?.layers.some((layer) => descendants.has(layer.entityId) && layer.locked))
    throw new Error("Unlock every group member and attached child before transforming this selection.");
  if (selectedFeatures.size && (Math.abs(delta.rotation.x) > 1e-6 || Math.abs(delta.rotation.z) > 1e-6))
    throw new Error("Room-feature groups rotate around the upright Y axis.");
  const next = structuredClone(input),
    oldRoom = roomFor(input, environmentId);
  const oldWorlds = previewEntityTransforms(
    input.content,
    environmentId ?? input.content.studio?.environment?.id,
    oldRoom,
  );
  const pivot = worldPivot ?? editingSelectionPivot(input, members, environmentId);
  const around = composeTransform(
    {
      ...delta,
      position: { x: pivot.x + delta.position.x, y: pivot.y + delta.position.y, z: pivot.z + delta.position.z },
    },
    { ...identityTransform(), position: { x: -pivot.x, y: -pivot.y, z: -pivot.z } },
  );
  if (selectedFeatures.size) {
    const before = input.content.studio!.environment!;
    const hasSelectedAncestor = (id: string, seen = new Set<string>()): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      const source = before.features.find((feature) => feature.id === id)?.exclusion?.sourceFeatureId;
      if (source && (selectedFeatures.has(source) || hasSelectedAncestor(source, seen))) return true;
      return (before.construction?.relationships ?? [])
        .filter((relation) => relation.featureId === id)
        .some(
          (relation) =>
            selectedFeatures.has(relation.targetFeatureId) || hasSelectedAncestor(relation.targetFeatureId, seen),
        );
    };
    const yawDelta =
      (Math.atan2(2 * delta.rotation.y * delta.rotation.w, 1 - 2 * delta.rotation.y ** 2) * 180) / Math.PI;
    for (const id of selectedFeatures) {
      if (hasSelectedAncestor(id)) continue;
      const feature = before.features.find((item) => item.id === id)!;
      const position = composeTransform(around, { ...identityTransform(), position: feature.position }).position;
      next.content.studio!.environment = transformRoomFeature(next.content.studio!.environment!, id, {
        position,
        yawDegrees: feature.yawDegrees + yawDelta,
        scale: delta.scale,
      });
    }
  }
  const newRoom = roomFor(next, environmentId);
  const newWorlds = previewEntityTransforms(
    next.content,
    environmentId ?? next.content.studio?.environment?.id,
    newRoom,
  );
  const hasSelectedParent = (id: string): boolean => {
    const parent = input.content.entities.find((entity) => entity.id === id)?.parentEntityId;
    return Boolean(parent && (selectedAssets.has(parent) || hasSelectedParent(parent)));
  };
  for (const entity of next.content.entities) {
    if (!selectedAssets.has(entity.id) || hasSelectedParent(entity.id)) continue;
    const oldLocal = input.content.entities.find((item) => item.id === entity.id)!.transform;
    const oldParent = composeTransform(oldWorlds[entity.id], inverseTransform(oldLocal));
    const newParent = composeTransform(newWorlds[entity.id], inverseTransform(oldLocal));
    const localDelta = composeTransform(inverseTransform(newParent), composeTransform(around, oldParent));
    entity.transform = composeTransform(localDelta, oldLocal);
    // Key values are absolute local poses. Move the entire authored path with its asset.
    for (const track of next.content.studio?.animationTracks ?? []) {
      if (track.entityId !== entity.id) continue;
      if (track.property === "POSITION")
        for (const key of track.keyframes)
          key.value = composeTransform(localDelta, { ...identityTransform(), position: key.value }).position;
      else if (track.property === "ROTATION")
        for (const key of track.keyframes)
          key.value = composeTransform(
            { ...identityTransform(), rotation: localDelta.rotation },
            { ...identityTransform(), rotation: key.value },
          ).rotation;
      else if (track.property === "SCALE") for (const key of track.keyframes) key.value *= localDelta.scale;
    }
  }
  return draftSchema.parse(next);
}
