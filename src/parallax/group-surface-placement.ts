import {
  draftSchema,
  elementUsesUprightFrame,
  previewEntityTransforms,
  previewReferenceFrame,
  type SpatialDraft,
} from "./authoring";
import type { EditingGroupMember } from "./editing-group-contracts";
import type { Candidate } from "./adaptive";
import { editingSelectionPivot, transformEditingSelection } from "./editing-groups";
import { identityTransform, type Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";
import { placeOnSurface, snapSpatialEntity, surfaceFrameRotation } from "./surface-placement";
import { authoredPreviewEnvironment } from "./environment-authoring";
import type { PreviewEnvironment } from "./environment-authoring";
import { syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { planPhysicalAssetInsertion } from "./element-insertion-placement";
import { simulationEnvironments } from "./studio-validation";

/** Keep root animation keyframes in the new surface anchor's local frame. */
function snapRootWithAnimation(
  input: SpatialDraft,
  entityId: string,
  world: Transform,
  surface: Candidate,
  environment: PreviewEnvironment,
): SpatialDraft {
  const oldEntity = input.content.entities.find((entity) => entity.id === entityId)!;
  const oldAnchor = input.content.anchors.find((anchor) => anchor.id === oldEntity.anchorId)!;
  const upright = elementUsesUprightFrame(input.content, entityId);
  const oldFrame = composeTransform(
    previewReferenceFrame(input.content, oldAnchor, environment.id, environment, undefined, upright),
    oldAnchor.transform,
  );
  const oldPose = previewEntityTransforms(input.content, environment.id, environment)[entityId];
  const snapped = snapSpatialEntity(input, entityId, world, surface, environment.id, environment);
  const newEntity = snapped.content.entities.find((entity) => entity.id === entityId)!;
  const newAnchor = snapped.content.anchors.find((anchor) => anchor.id === newEntity.anchorId)!;
  const newFrame = composeTransform(
    previewReferenceFrame(snapped.content, newAnchor, environment.id, environment, undefined, upright),
    newAnchor.transform,
  );
  const newPose = previewEntityTransforms(snapped.content, environment.id, environment)[entityId];
  const worldDelta = composeTransform(newPose, inverseTransform(oldPose));
  const localDelta = composeTransform(inverseTransform(newFrame), composeTransform(worldDelta, oldFrame));
  const next = structuredClone(snapped);
  for (const track of next.content.studio?.animationTracks ?? []) {
    if (track.entityId !== entityId) continue;
    if (track.property === "POSITION")
      for (const key of track.keyframes)
        key.value = composeTransform(localDelta, { ...oldEntity.transform, position: key.value }).position;
    else if (track.property === "ROTATION")
      for (const key of track.keyframes)
        key.value = composeTransform(localDelta, { ...oldEntity.transform, rotation: key.value }).rotation;
    else if (track.property === "SCALE") for (const key of track.keyframes) key.value *= localDelta.scale;
  }
  return draftSchema.parse(next);
}

/** Atomic rigid placement: every selected asset must fit, or nothing moves. */
export function placeGroupOnSurface(
  input: SpatialDraft,
  members: readonly EditingGroupMember[],
  surface: Candidate,
  target: Transform["position"],
  environmentInput: string | PreviewEnvironment,
): SpatialDraft {
  if (input.content.adaptive) throw new Error("Switch to Manual placement before moving a group to a surface.");
  if (!surface.safe || members.some((member) => member.kind !== "ASSET"))
    throw new Error("Use Move for groups containing room features. Surface placement supports asset groups.");
  const environmentId = typeof environmentInput === "string" ? environmentInput : environmentInput.id;
  const environment = authoredPreviewEnvironment(
    input.content,
    typeof environmentInput === "string"
      ? (simulationEnvironments.find((p) => p.id === environmentId) ?? {
          ...simulationEnvironments[0],
          id: environmentId,
        })
      : environmentInput,
  );
  const poses = previewEntityTransforms(input.content, environmentId, environment);
  const pivot = editingSelectionPivot(input, members, environmentId, environment);
  const primary = poses[members[0]?.id];
  if (!primary) throw new Error("Select an existing asset group.");
  const rotation = composeTransform(
    { ...identityTransform(), rotation: surfaceFrameRotation(surface) },
    inverseTransform({ ...identityTransform(), rotation: primary.rotation }),
  ).rotation;
  let next = transformEditingSelection(
    input,
    members,
    { position: { x: target.x - pivot.x, y: target.y - pivot.y, z: target.z - pivot.z }, rotation, scale: 1 },
    environmentId,
    pivot,
    environment,
  );
  const selected = new Set(members.map((member) => member.id));
  const roots = members.filter((member) => {
    const entity = next.content.entities.find((item) => item.id === member.id)!;
    return !entity.parentEntityId || !selected.has(entity.parentEntityId);
  });
  for (const member of roots) {
    const entity = next.content.entities.find((item) => item.id === member.id)!;
    const pose = previewEntityTransforms(next.content, environmentId, environment)[member.id];
    const placed = placeOnSurface(pose, surface, entity.widthMeters, 0.1);
    if (!placed) throw new Error("The whole group does not fit here. Choose a larger clear area; no items were moved.");
    next = snapRootWithAnimation(next, member.id, { ...placed, rotation: pose.rotation }, surface, environment);
  }
  const transformed = previewEntityTransforms(next.content, environmentId, environment);
  for (const member of members) {
    const entity = next.content.entities.find((e) => e.id === member.id)!;
    const pose = transformed[member.id];
    if (!placeOnSurface(pose, surface, entity.widthMeters))
      throw new Error("The whole group does not fit here. Choose a larger clear area; no items were moved.");
  }
  return next;
}

/** A saved physical release keeps the catalog model's full solid geometry and Y-up pose. */
export function placeSavedAssetOnSurface(
  base: SpatialDraft,
  copied: SpatialDraft,
  members: readonly EditingGroupMember[],
  surface: Candidate,
  target: Transform["position"],
  environmentInput: PreviewEnvironment,
  exactPoint: boolean,
): SpatialDraft {
  const added = copied.content.entities.slice(base.content.entities.length);
  if (added.length !== members.length || added.some((entity, index) => members[index]?.id !== entity.id))
    throw new Error("The saved asset changed. Choose it from the Library again.");
  const solids = added.filter((entity) => entity.element?.kind === "PHYSICAL_ASSET");
  if (!solids.length) return placeGroupOnSurface(copied, members, surface, target, environmentInput);
  if (solids.length !== 1 || added.length !== 1)
    throw new Error("This physical assembly needs reviewed placement of all its parts. No items were inserted.");
  const solid = solids[0];
  if (solid.element?.kind !== "PHYSICAL_ASSET") throw new Error("The saved physical asset is unavailable.");
  if (solid.element.articulation > 0)
    throw new Error("Close articulated models before placing this saved asset. No item was inserted.");
  const root = solid;
  if (root.parentEntityId)
    throw new Error("This physical assembly needs reviewed placement of all its parts. No items were inserted.");
  const environment = authoredPreviewEnvironment(base.content, environmentInput);
  const evidence = syntheticEnvironmentEvidence(environment);
  const poses = previewEntityTransforms(copied.content, environment.id, { ...environment, evidence });
  const solidPose = poses[solid.id];
  if (!solidPose || !Number.isFinite(solidPose.scale) || solidPose.scale <= 0)
    throw new Error("The saved physical asset has an invalid rendered scale. No item was inserted.");
  const plan = planPhysicalAssetInsertion({
    draft: base,
    modelId: solid.element.modelId,
    environment: { ...environment, evidence },
    preferredPosition: target,
    preferredSurfaceId: surface.id,
    exactPreferredPosition: exactPoint,
    widthMeters: solid.widthMeters * solidPose.scale,
  });
  if (plan.status === "NO_FIT") throw new Error(plan.message);
  if (plan.surfaceId !== surface.id) throw new Error("The selected surface changed. No item was inserted.");
  const rotation = composeTransform(
    { ...identityTransform(), rotation: plan.transform.rotation },
    inverseTransform({ ...identityTransform(), rotation: solidPose.rotation }),
  ).rotation;
  // The canonical group transform rebases root animation tracks and carries
  // children rigidly. Its scale stays 1 so the saved model's rendered scale
  // remains the same scale admitted by the physical planner.
  return transformEditingSelection(
    copied,
    [{ kind: "ASSET", id: root.id }],
    {
      position: {
        x: plan.transform.position.x - solidPose.position.x,
        y: plan.transform.position.y - solidPose.position.y,
        z: plan.transform.position.z - solidPose.position.z,
      },
      rotation,
      scale: 1,
    },
    environment.id,
    solidPose.position,
    { ...environment, evidence },
  );
}
