import { draftSchema, previewReferenceFrame, type SpatialDraft } from "./authoring";
import { insertSpatialElement } from "./element-authoring";
import { planPhysicalAssetInsertion } from "./element-insertion-placement";
import type { PreviewEnvironment } from "./environment-authoring";
import type { Transform } from "./contracts";
import { composeTransform, inverseTransform } from "./transforms";

/** Studio insertion uses the displayed room; showcase construction retains its explicit layout. */
export function insertSpatialElementInEnvironment(
  input: SpatialDraft,
  catalogId: string,
  id: string,
  environment: PreviewEnvironment,
  preferredPosition?: Transform["position"],
  preferredSurfaceId?: string,
): SpatialDraft {
  const next = insertSpatialElement(input, catalogId, id);
  if (input.content.adaptive) return next; // Existing semantic recipes own adaptive placement.
  const added = next.content.entities.slice(input.content.entities.length);
  const solids = added.filter((entity) => entity.element?.kind === "PHYSICAL_ASSET");
  if (!solids.length) return next;
  if (solids.length !== 1)
    throw new Error("This composition needs reviewed placement of its physical items. No items were inserted.");
  const solid = solids[0];
  if (solid.element?.kind !== "PHYSICAL_ASSET") return next;
  const plan = planPhysicalAssetInsertion({
    draft: input,
    modelId: solid.element.modelId,
    environment,
    preferredPosition,
    preferredSurfaceId,
  });
  if (plan.status === "NO_FIT") throw new Error(plan.message);
  const root = added.find((entity) => !entity.parentEntityId)!;
  // Current physical compositions have a solid at the root origin. Do not silently
  // misplace future assemblies whose physical members use another local frame.
  if (
    solid !== root &&
    (solid.parentEntityId !== root.id || Object.values(solid.transform.position).some((n) => n !== 0))
  )
    throw new Error("This composition needs reviewed placement of its physical items. No items were inserted.");
  const anchor = next.content.anchors.find((item) => item.id === root.anchorId)!;
  const frame = composeTransform(
    previewReferenceFrame(next.content, anchor, environment.id, environment, undefined, true),
    anchor.transform,
  );
  root.transform = composeTransform(inverseTransform(frame), plan.transform);
  return draftSchema.parse(next);
}
