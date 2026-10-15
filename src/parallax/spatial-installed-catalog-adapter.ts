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
  licenseSnapshot: { key: string; version: number; requiresAttribution: boolean; allowsModification: boolean };
  attributionSnapshot: { displayName: string; contributionType: string }[];
  thumbnail: null;
  readOnly: true;
  installedAt: string;
};

export type InstalledSpatialCatalogPage = {
  items: InstalledSpatialCatalogSource[];
  nextCursor: string | null;
};

/** Read all owner-authorized installation summaries before the global catalog slices a page. */
export async function collectInstalledSpatialCatalogEntries(
  accountId: string,
  readPage: (accountId: string, query: { after?: string; limit: number }) => Promise<InstalledSpatialCatalogPage>,
): Promise<SpatialCatalogProviderEntry[]> {
  const summaries: InstalledSpatialCatalogSource[] = [];
  const cursors = new Set<string>();
  const identities = new Set<string>();
  let after: string | undefined;
  for (;;) {
    const page = await readPage(accountId, { ...(after ? { after } : {}), limit: 200 });
    for (const item of page.items) {
      const id = `${item.sourceId}:${item.targetId}`;
      if (identities.has(id)) throw new Error("Installed Spatial catalog contains a duplicate local target.");
      identities.add(id);
      summaries.push(item);
    }
    if (!page.nextCursor) return installedSpatialCatalogEntries(summaries);
    if (cursors.has(page.nextCursor)) throw new Error("Installed Spatial catalog cursor repeated.");
    cursors.add(page.nextCursor);
    after = page.nextCursor;
  }
}

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
    family:
      summary.sourceId === "environment"
        ? "Installed Environment"
        : summary.kind === "SCENES"
          ? "Spatial Scene"
          : summary.kind === "EFFECTS"
            ? "Spatial effect"
            : summary.kind === "COMPOSITIONS"
              ? "Spatial composition"
              : "Spatial asset",
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
        allowsModification: summary.licenseSnapshot.allowsModification,
      },
      attribution: summary.attributionSnapshot.map(({ displayName, contributionType }) => ({
        displayName,
        contributionType,
      })),
    },
  }));
}
