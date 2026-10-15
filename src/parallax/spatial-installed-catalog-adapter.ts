import type { SpatialCatalogProviderEntry, SpatialContentKind } from "./spatial-content-catalog";

/** The shape supplied by SC-07A's account-scoped, pinned installation reader. */
export type InstalledSpatialCatalogSource = {
  targetId: string;
  sourceId: "spatial" | "environment";
  kind: SpatialContentKind;
  origin: "INSTALLED";
  name: string;
  description: string;
  category: string;
  listingId: string;
  releaseId: string;
  semanticVersion: string;
  licenseSnapshot: { key: string; version: number; requiresAttribution: boolean };
  attributionSnapshot: { displayName: string; contributionType: string }[];
  thumbnail: null;
  readOnly: true;
  installedAt: string;
};

/** Pure Library presentation adapter; SC-07A remains the installation authority. */
export function installedSpatialCatalogEntries(
  summaries: readonly InstalledSpatialCatalogSource[],
): SpatialCatalogProviderEntry[] {
  return summaries.map((summary) => ({
    id: `${summary.sourceId === "environment" ? "environment" : "saved"}:${summary.targetId}`,
    kind: summary.kind,
    origin: "INSTALLED",
    name: summary.name,
    description: summary.description || "Installed Community content.",
    family: summary.sourceId === "environment" ? "Installed Environment" : `Installed ${summary.kind.toLowerCase()}`,
    environmentId: summary.sourceId === "environment" ? summary.targetId : undefined,
    saveState: "SAVED",
    readOnly: true,
    updatedAt: summary.installedAt,
    community: {
      listingId: summary.listingId,
      releaseId: summary.releaseId,
      semanticVersion: summary.semanticVersion,
      license: {
        key: summary.licenseSnapshot.key,
        version: summary.licenseSnapshot.version,
        requiresAttribution: summary.licenseSnapshot.requiresAttribution,
      },
      attribution: summary.attributionSnapshot.map(({ displayName, contributionType }) => ({
        displayName,
        contributionType,
      })),
    },
  }));
}
