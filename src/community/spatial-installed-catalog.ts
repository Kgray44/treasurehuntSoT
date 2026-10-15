import { z } from "zod";
import { db } from "@/lib/db";
import { legacyEnvironmentItemKind as environmentItemKind } from "@/parallax/legacy-environment-service";
import { environmentDraftSchema } from "@/parallax/library-lifecycle-contracts";
import { spatialItemKind } from "@/parallax/library-service";
import { canonicalChecksum } from "@/drydock/canonical";
import { sha256 } from "./package";
import { stableJson } from "./domain";

const pageSchema = z.strictObject({
  after: z.string().min(1).max(128).optional(),
  limit: z.number().int().min(1).max(200).default(100),
});
const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceKind: z.enum(["ASSET", "SCENE", "ENVIRONMENT"]),
    packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
    publicMetadata: z
      .object({
        title: z.string(),
        shortDescription: z.string().nullable(),
        category: z.string(),
      })
      .passthrough(),
  })
  .passthrough();
const licenseSchema = z
  .object({
    key: z.string(),
    version: z.number().int().positive(),
    allowsModification: z.boolean(),
    allowsPublicUse: z.boolean(),
    allowsCommercialUse: z.boolean(),
    requiresAttribution: z.boolean(),
    shareAlike: z.boolean(),
  })
  .strict();
const attributionSchema = z.array(
  z
    .object({
      displayName: z.string(),
      contributionType: z.string(),
    })
    .strict(),
);

export type InstalledSpatialCommunitySummary = {
  targetId: string;
  sourceId: "spatial" | "environment";
  localKind: string;
  kind: "ASSETS" | "ENVIRONMENTS" | "SCENES" | "EFFECTS" | "COMPOSITIONS";
  origin: "INSTALLED";
  name: string;
  description: string;
  category: string;
  composition: boolean;
  listingId: string;
  releaseId: string;
  semanticVersion: string;
  licenseSnapshot: z.infer<typeof licenseSchema>;
  attributionSnapshot: z.infer<typeof attributionSchema>;
  thumbnail: null;
  readOnly: true;
  installedAt: string;
};

/**
 * A bounded account-scoped handoff to Spatial Library. No package bytes,
 * private source records, or mutable listing copy are returned.
 */
export async function readInstalledSpatialCommunitySummaryPage(
  accountId: string,
  raw: { after?: string; limit?: number } = {},
): Promise<{ items: InstalledSpatialCommunitySummary[]; nextCursor: string | null }> {
  const query = pageSchema.parse(raw);
  const installations = await db.communityInstallation.findMany({
    where: {
      accountId,
      mode: "LIBRARY_REFERENCE",
      ...(query.after ? { id: { gt: query.after } } : {}),
    },
    select: {
      id: true,
      releaseId: true,
      operationId: true,
      installedPackageChecksum: true,
      installedAt: true,
    },
    orderBy: { id: "asc" },
    take: query.limit + 1,
  });
  const page = installations.slice(0, query.limit);
  if (!page.length) return { items: [], nextCursor: null };
  const operationIds = page.map((row) => row.operationId);
  const releaseIds = [...new Set(page.map((row) => row.releaseId))];
  const [mappings, releases, packages] = await Promise.all([
    db.communityInstallMapping.findMany({
      where: { operationId: { in: operationIds }, sourceId: { in: ["spatial", "environment"] } },
      select: { operationId: true, sourceId: true, targetId: true },
    }),
    db.communityRelease.findMany({
      where: { id: { in: releaseIds } },
      select: {
        id: true,
        listingId: true,
        semanticVersion: true,
        packageChecksum: true,
        manifest: true,
        manifestChecksum: true,
        licenseSnapshot: true,
        attributionSnapshot: true,
        moderationStatus: true,
        listing: { select: { itemType: true, moderationStatus: true, removedAt: true } },
      },
    }),
    db.communityPackage.findMany({
      where: { releaseId: { in: releaseIds } },
      select: { releaseId: true, packageChecksum: true, storageStatus: true, scanStatus: true },
    }),
  ]);
  const targets = await db.reusableAuthoringItem.findMany({
    where: {
      id: { in: mappings.map((row) => row.targetId) },
      ownerAccountId: accountId,
      status: "INSTALLED_READ_ONLY",
      archivedAt: null,
    },
    select: { id: true, kind: true, name: true },
  });
  const richEnvironmentTargets = targets
    .filter(
      (target) =>
        target.kind === spatialItemKind &&
        mappings.some((row) => row.sourceId === "environment" && row.targetId === target.id),
    )
    .map((target) => target.id);
  const richEnvironmentRows = richEnvironmentTargets.length
    ? await db.reusableAuthoringItemVersion.findMany({
        where: { itemId: { in: richEnvironmentTargets }, versionNumber: 0 },
        select: { itemId: true, envelope: true, checksum: true },
      })
    : [];
  const richEnvironmentIds = new Set<string>();
  for (const row of richEnvironmentRows) {
    try {
      const draft = environmentDraftSchema.parse(JSON.parse(row.envelope));
      if (draft.id === row.itemId && canonicalChecksum(draft) === row.checksum) richEnvironmentIds.add(row.itemId);
    } catch {
      // A malformed rich Environment is not an installed Library entry.
    }
  }
  const mappingsByOperation = new Map<string, typeof mappings>();
  for (const mapping of mappings) {
    const group = mappingsByOperation.get(mapping.operationId) ?? [];
    group.push(mapping);
    mappingsByOperation.set(mapping.operationId, group);
  }
  const releaseById = new Map(releases.map((row) => [row.id, row]));
  const packageByRelease = new Map(packages.map((row) => [row.releaseId, row]));
  const targetById = new Map(targets.map((row) => [row.id, row]));
  const items: InstalledSpatialCommunitySummary[] = [];
  for (const installation of page) {
    const release = releaseById.get(installation.releaseId);
    const record = packageByRelease.get(installation.releaseId);
    if (
      !release ||
      !record ||
      release.moderationStatus !== "ACTIVE" ||
      release.listing.moderationStatus !== "ACTIVE" ||
      release.listing.removedAt ||
      release.packageChecksum !== installation.installedPackageChecksum ||
      record.packageChecksum !== installation.installedPackageChecksum ||
      record.storageStatus !== "READY" ||
      record.scanStatus !== "CLEAN"
    )
      continue;
    try {
      const rawManifest = JSON.parse(release.manifest) as unknown;
      const manifest = manifestSchema.parse(rawManifest);
      if (
        sha256(stableJson(rawManifest)) !== release.manifestChecksum ||
        manifest.packageChecksum !== installation.installedPackageChecksum ||
        (manifest.sourceKind === "ENVIRONMENT" && release.listing.itemType !== "SPATIAL_ENVIRONMENT") ||
        (manifest.sourceKind === "SCENE" && release.listing.itemType !== "SPATIAL_SCENE") ||
        (manifest.sourceKind === "ASSET" && release.listing.itemType !== "SPATIAL_ASSET")
      )
        continue;
      const licenseSnapshot = licenseSchema.parse(JSON.parse(release.licenseSnapshot));
      const attributionSnapshot = attributionSchema.parse(JSON.parse(release.attributionSnapshot));
      if (!licenseSnapshot.allowsPublicUse) continue;
      for (const mapping of mappingsByOperation.get(installation.operationId) ?? []) {
        if (mapping.sourceId !== "spatial" && mapping.sourceId !== "environment") continue;
        const target = targetById.get(mapping.targetId);
        if (
          !target ||
          (mapping.sourceId === "environment"
            ? target.kind !== environmentItemKind &&
              !(target.kind === spatialItemKind && richEnvironmentIds.has(target.id))
            : target.kind !== spatialItemKind)
        )
          continue;
        const composition = mapping.sourceId === "spatial" && manifest.publicMetadata.category === "COMPOSITION";
        const kind =
          mapping.sourceId === "environment"
            ? "ENVIRONMENTS"
            : composition
              ? "COMPOSITIONS"
              : manifest.publicMetadata.category === "EFFECT"
                ? "EFFECTS"
                : manifest.sourceKind === "SCENE"
                  ? "SCENES"
                  : "ASSETS";
        items.push({
          targetId: target.id,
          sourceId: mapping.sourceId,
          localKind: target.kind,
          kind,
          origin: "INSTALLED",
          name: target.name,
          description:
            mapping.sourceId === "environment" && manifest.sourceKind !== "ENVIRONMENT"
              ? `Included Environment for ${manifest.publicMetadata.title}`
              : (manifest.publicMetadata.shortDescription ?? ""),
          category: manifest.publicMetadata.category,
          composition,
          listingId: release.listingId,
          releaseId: release.id,
          semanticVersion: release.semanticVersion,
          licenseSnapshot,
          attributionSnapshot,
          thumbnail: null,
          readOnly: true,
          installedAt: installation.installedAt.toISOString(),
        });
      }
    } catch {
      // A corrupt pinned release cannot be projected into the Library.
    }
  }
  return {
    items,
    nextCursor: installations.length > query.limit ? page[page.length - 1].id : null,
  };
}
