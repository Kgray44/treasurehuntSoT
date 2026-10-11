import { createSpatialDraft, draftSchema, type SpatialDraft } from "./authoring";
import { enableAdaptiveAuthoring } from "./adaptive-authoring";
import { emptyStudioContent } from "./studio-contracts";

/** Insert supported preset entities into the existing definition, preserving its version identity. */
export function insertSpatialPreset(draft: SpatialDraft, name: string, identity: string): SpatialDraft {
  const next = structuredClone(draft);
  let asset = createSpatialDraft(identity, name, draft.chronicleId);
  if (next.content.adaptive) asset = enableAdaptiveAuthoring(asset);
  if (next.content.entities.length + asset.content.entities.length > (next.content.adaptive ? 16 : 32))
    throw new Error("The scene entity budget is full. Remove an object before adding another asset.");
  next.content.entities.push(...asset.content.entities);
  next.content.anchors.push(...asset.content.anchors);
  next.content.studio ??= emptyStudioContent();
  next.content.studio!.layers.push(...asset.content.studio!.layers);
  if (next.content.adaptive && asset.content.adaptive) {
    next.content.adaptive.recipes.push(...asset.content.adaptive.recipes);
    next.content.adaptive.discovery.push(...asset.content.adaptive.discovery);
    next.content.adaptive.calibration.maturity = "SEMANTIC";
    delete next.content.adaptive.calibration.reviewReceiptId;
    if (next.content.placementPolicy === "CALIBRATED") next.content.placementPolicy = "ADAPTIVE_STICKY";
  }
  return draftSchema.parse(next);
}
