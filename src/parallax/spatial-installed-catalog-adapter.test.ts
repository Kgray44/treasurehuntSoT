import { expect, it, vi } from "vitest";
import {
  collectInstalledSpatialCatalogEntries,
  installedSpatialCatalogEntries,
  type InstalledSpatialCatalogSource,
} from "./spatial-installed-catalog-adapter";

it("projects only pinned installed metadata into read-only Library entries", () => {
  const source: InstalledSpatialCatalogSource = {
    targetId: "local-scene",
    sourceId: "spatial",
    kind: "SCENES",
    origin: "INSTALLED",
    name: "Port Scene",
    description: "A published scene",
    category: "SCENE",
    listingId: "listing-one",
    releaseId: "release-two",
    semanticVersion: "2.1.0",
    licenseSnapshot: { key: "share", version: 3, requiresAttribution: true, allowsModification: true },
    attributionSnapshot: [{ displayName: "A. Creator", contributionType: "AUTHOR" }],
    thumbnail: null,
    readOnly: true,
    installedAt: "2026-10-15T00:00:00.000Z",
  };
  expect(installedSpatialCatalogEntries([source])).toEqual([
    expect.objectContaining({
      id: "saved:local-scene",
      kind: "SCENES",
      origin: "INSTALLED",
      saveState: "SAVED",
      readOnly: true,
      community: {
        listingId: "listing-one",
        releaseId: "release-two",
        semanticVersion: "2.1.0",
        license: { key: "share", version: 3, requiresAttribution: true, allowsModification: true },
        attribution: [{ displayName: "A. Creator", contributionType: "AUTHOR" }],
      },
    }),
  ]);
  expect(
    installedSpatialCatalogEntries([
      { ...source, targetId: "local-place", sourceId: "environment", kind: "ENVIRONMENTS" },
    ])[0],
  ).toMatchObject({
    id: "environment:local-place",
    environmentId: "local-place",
    family: "Installed Environment",
  });
});

it("collects every canonical installation page before Library paging and rejects cursor loops", async () => {
  const source: InstalledSpatialCatalogSource = {
    targetId: "local-000",
    sourceId: "spatial",
    kind: "ASSETS",
    origin: "INSTALLED",
    name: "Installed asset",
    description: "Pinned release",
    category: "ASSET",
    listingId: "listing",
    releaseId: "release",
    semanticVersion: "1.0.0",
    licenseSnapshot: { key: "share", version: 1, requiresAttribution: false, allowsModification: true },
    attributionSnapshot: [],
    thumbnail: null,
    readOnly: true,
    installedAt: "2026-10-15T00:00:00.000Z",
  };
  const first = Array.from({ length: 200 }, (_, index) => ({
    ...source,
    targetId: `local-${String(index).padStart(3, "0")}`,
  }));
  const reader = vi.fn(async (_accountId: string, query: { after?: string; limit: number }) =>
    query.after
      ? { items: [{ ...source, targetId: "local-200" }], nextCursor: null }
      : { items: first, nextCursor: "installation-200" },
  );
  const entries = await collectInstalledSpatialCatalogEntries("creator", reader);
  expect(entries).toHaveLength(201);
  expect(entries[200]).toMatchObject({ id: "saved:local-200", origin: "INSTALLED" });
  expect(reader).toHaveBeenNthCalledWith(1, "creator", { limit: 200 });
  expect(reader).toHaveBeenNthCalledWith(2, "creator", { after: "installation-200", limit: 200 });

  await expect(
    collectInstalledSpatialCatalogEntries("creator", async () => ({ items: [], nextCursor: "repeat" })),
  ).rejects.toThrow(/cursor repeated/);
  await expect(
    collectInstalledSpatialCatalogEntries("creator", async () => ({ items: [source], nextCursor: "next" })),
  ).rejects.toThrow(/duplicate local target/);
});
