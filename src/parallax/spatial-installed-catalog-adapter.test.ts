import { expect, it } from "vitest";
import {
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
    licenseSnapshot: { key: "share", version: 3, requiresAttribution: true },
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
        license: { key: "share", version: 3, requiresAttribution: true },
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
