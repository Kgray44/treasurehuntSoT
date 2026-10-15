import { spatialCatalog } from "./element-authoring";
import { physicalAssets } from "./asset-catalog";
import type { SpatialCatalogProviderEntry } from "./spatial-content-catalog";

/** Read-only descriptors for the implemented renderer; Library retains ownership of browsing. */
export const spatialElementCatalogEntries: SpatialCatalogProviderEntry[] = spatialCatalog.map((item) => {
  const asset = physicalAssets.find((entry) => entry.id === item.id);
  return {
    id: `sc02:${item.id}`,
    kind: item.type === "PHYSICAL_ASSET" ? "ASSETS" : item.type === "COMPOSITION" ? "COMPOSITIONS" : "EFFECTS",
    origin: "BUILT_IN",
    name: item.name,
    description: item.description,
    family: item.family,
    thumbnail: item.thumbnail ?? undefined,
    preset: `sc02:${item.id}`,
    blocked: asset?.visualBlocker,
    dimensions: asset?.dimensions,
    support: asset?.support,
  };
});
