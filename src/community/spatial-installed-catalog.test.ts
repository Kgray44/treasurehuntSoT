import { beforeEach, expect, it, vi } from "vitest";
import { sha256 } from "./package";
import { stableJson } from "./domain";

const queries = vi.hoisted(() => ({
  installs: vi.fn(),
  mappings: vi.fn(),
  releases: vi.fn(),
  packages: vi.fn(),
  targets: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    communityInstallation: { findMany: queries.installs },
    communityInstallMapping: { findMany: queries.mappings },
    communityRelease: { findMany: queries.releases },
    communityPackage: { findMany: queries.packages },
    reusableAuthoringItem: { findMany: queries.targets },
  },
}));
vi.mock("@/parallax/legacy-environment-service", () => ({ legacyEnvironmentItemKind: "PARALLAX_ENVIRONMENT" }));
vi.mock("@/parallax/library-service", () => ({ spatialItemKind: "PARALLAX_STUDIO" }));
import { readInstalledSpatialCommunitySummaryPage } from "./spatial-installed-catalog";

const checksum = "a".repeat(64);
const manifest = {
  schemaVersion: 1,
  sourceKind: "ASSET",
  packageChecksum: checksum,
  publicMetadata: { title: "Published effect", shortDescription: "Pinned description", category: "EFFECT" },
};
function released() {
  return {
    id: "release",
    listingId: "listing",
    semanticVersion: "1.2.0",
    packageChecksum: checksum,
    manifest: JSON.stringify(manifest),
    manifestChecksum: sha256(stableJson(manifest)),
    licenseSnapshot: JSON.stringify({
      key: "public-share",
      version: 2,
      allowsModification: false,
      allowsPublicUse: true,
      allowsCommercialUse: false,
      requiresAttribution: true,
      shareAlike: false,
    }),
    attributionSnapshot: JSON.stringify([{ displayName: "Synthetic Creator", contributionType: "AUTHOR" }]),
    moderationStatus: "ACTIVE",
    listing: { itemType: "SPATIAL_ASSET", moderationStatus: "ACTIVE", removedAt: null },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  queries.installs.mockResolvedValue([
    {
      id: "installation",
      releaseId: "release",
      operationId: "operation",
      installedPackageChecksum: checksum,
      installedAt: new Date("2026-10-15T00:00:00Z"),
    },
  ]);
  queries.mappings.mockResolvedValue([{ operationId: "operation", sourceId: "spatial", targetId: "local-effect" }]);
  queries.releases.mockResolvedValue([released()]);
  queries.packages.mockResolvedValue([
    { releaseId: "release", packageChecksum: checksum, storageStatus: "READY", scanStatus: "CLEAN" },
  ]);
  queries.targets.mockResolvedValue([{ id: "local-effect", kind: "PARALLAX_STUDIO", name: "Local effect name" }]);
});

it("reads only the requested account's pinned read-only targets and retains effect identity and license", async () => {
  const page = await readInstalledSpatialCommunitySummaryPage("synthetic-owner");
  expect(queries.installs).toHaveBeenCalledWith(
    expect.objectContaining({ where: { accountId: "synthetic-owner", mode: "LIBRARY_REFERENCE" } }),
  );
  expect(queries.targets).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        ownerAccountId: "synthetic-owner",
        status: "INSTALLED_READ_ONLY",
        archivedAt: null,
      }),
    }),
  );
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({
    targetId: "local-effect",
    kind: "EFFECTS",
    name: "Local effect name",
    readOnly: true,
    releaseId: "release",
    semanticVersion: "1.2.0",
    licenseSnapshot: { allowsModification: false, allowsCommercialUse: false },
  });
  expect(page.items[0]).not.toHaveProperty("manifest");
  expect(page.items[0]).not.toHaveProperty("packageBytes");
});

it.each(["manifest", "package", "moderation", "missing-target"])(
  "omits invalid installed provenance: %s",
  async (failure) => {
    if (failure === "manifest")
      queries.releases.mockResolvedValue([{ ...released(), manifestChecksum: "b".repeat(64) }]);
    if (failure === "package")
      queries.packages.mockResolvedValue([
        { releaseId: "release", packageChecksum: "b".repeat(64), storageStatus: "READY", scanStatus: "CLEAN" },
      ]);
    if (failure === "moderation") queries.releases.mockResolvedValue([{ ...released(), moderationStatus: "REMOVED" }]);
    if (failure === "missing-target") queries.targets.mockResolvedValue([]);
    expect((await readInstalledSpatialCommunitySummaryPage("synthetic-owner")).items).toEqual([]);
  },
);
