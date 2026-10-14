import { previewEntityTransforms, type SpatialDraft } from "./authoring";
import type { EditingGroupMember } from "./editing-group-contracts";
import type { Candidate } from "./adaptive";
import { editingSelectionPivot, transformEditingSelection } from "./editing-groups";
import { identityTransform, type Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";
import { placeOnSurface, snapSpatialEntity, surfaceFrameRotation } from "./surface-placement";
import { authoredPreviewEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";

/** Atomic rigid placement: every selected asset must fit, or nothing moves. */
export function placeGroupOnSurface(
  input: SpatialDraft,
  members: readonly EditingGroupMember[],
  surface: Candidate,
  target: Transform["position"],
  environmentId: string,
): SpatialDraft {
  if (input.content.adaptive) throw new Error("Switch to Manual placement before moving a group to a surface.");
  if (!surface.safe || members.some((member) => member.kind !== "ASSET"))
    throw new Error("Use Move for groups containing room features. Surface placement supports asset groups.");
  const environment = authoredPreviewEnvironment(
    input.content,
    simulationEnvironments.find((p) => p.id === environmentId) ?? { ...simulationEnvironments[0], id: environmentId },
  );
  const poses = previewEntityTransforms(input.content, environmentId, environment);
  const pivot = editingSelectionPivot(input, members, environmentId);
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
  );
  const transformed = previewEntityTransforms(next.content, environmentId, environment);
  for (const member of members) {
    const entity = next.content.entities.find((e) => e.id === member.id)!;
    const pose = transformed[member.id];
    const placed = placeOnSurface(pose, surface, entity.widthMeters, 0.1);
    if (!placed) throw new Error("The whole group does not fit here. Choose a larger clear area; no items were moved.");
    next = snapSpatialEntity(next, member.id, { ...placed, rotation: pose.rotation }, surface, environmentId);
  }
  return next;
}
