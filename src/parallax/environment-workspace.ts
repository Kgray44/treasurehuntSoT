import { createSpatialDraft, draftSchema } from "./authoring";
import type { EnvironmentDraft } from "./library-lifecycle-contracts";

/** View-only adapter to the existing scene canvas and photo contract. Never stored
 * as a scene: the authoritative version-zero envelope is EnvironmentDraft. */
export function environmentPreviewDraft(document: EnvironmentDraft) {
  const view = createSpatialDraft(document.id);
  view.content.title = document.name;
  view.content.studio!.layers.forEach((layer) => {
    layer.visible = false;
    layer.selectable = false;
    layer.locked = true;
  });
  if (document.room) view.content.studio!.environment = structuredClone(document.room);
  view.content.studio!.provenance.origin = "MANUAL";
  return draftSchema.parse(view);
}
