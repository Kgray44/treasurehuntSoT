import type { Candidate } from "./adaptive";
import { composeTransform, inverseTransform } from "./transforms";
import type { Transform } from "./contracts";
import { editSpatialDraft, previewEntityTransform, type SpatialDraft } from "./authoring";
import type { PreviewEnvironment } from "./environment-authoring";
import { surfaceFrameRotation } from "./runtime-placement";
export {
  surfaceRotation,
  surfaceFrameRotation,
  placeOnSurface,
  snapToNearestSurface,
  resolveSurfaceSnap,
  surfacePointIsClear,
  findSurfacePlacement,
} from "./runtime-placement";

/** Native placement must request the selected plane's alignment as well as its pose. */
export function snapSpatialEntity(
  input: SpatialDraft,
  entityId: string,
  world: Transform,
  surface: Candidate,
  environmentId = "bedroom",
  environment?: PreviewEnvironment,
): SpatialDraft {
  const next = editSpatialDraft(input, {
    type: "PLACEMENT",
    entityId,
    placement: surface.surface === "WALL" ? "WALL" : "DESK",
  });
  const entity = next.content.entities.find((e) => e.id === entityId)!;
  const studio = next.content.studio!;
  studio.surfacePreviewFrames = [
    ...(studio.surfacePreviewFrames ?? []).filter((f) => f.anchorId !== entity.anchorId),
    {
      anchorId: entity.anchorId,
      environmentId,
      surfaceId: surface.id,
      position: surface.position,
      rotation: surfaceFrameRotation(surface),
    },
  ];
  const parent = previewEntityTransform(next.content, entityId, environmentId, environment);
  return editSpatialDraft(next, {
    type: "TRANSFORM",
    entityId,
    transform: composeTransform(inverseTransform(parent), world),
  });
}
