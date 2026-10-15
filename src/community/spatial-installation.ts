import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "@/parallax/authoring";
import { environmentContentSchema } from "@/parallax/environment-contracts";
import { environmentItemKind } from "@/parallax/environment-service";
import { materializeLibraryMoment, spatialItemKind } from "@/parallax/library-service";
import { versionContentSchema } from "@/parallax/contracts";
import { CommunityError, stableJson } from "./domain";
import { beginInstallOperation, commitInstallOperation, createInstallPlan, type LicenseSnapshot } from "./exchange";
import {
  communityPackageManifestSchema,
  sha256,
  verifyCommunityPackage,
  type CommunityPackageFile,
  type CommunityPackageManifest,
} from "./package";

const payloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  category: draftSchema.shape.category,
  composition: z.literal(true).optional(),
  content: versionContentSchema,
});
const environmentPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  content: environmentContentSchema,
});

async function requirePinnedInstallTargets(
  client: Prisma.TransactionClient,
  accountId: string,
  operationId: string,
  manifest: CommunityPackageManifest,
) {
  const operation = await client.communityInstallOperation.findFirst({
    where: {
      id: operationId,
      accountId,
      releaseId: manifest.releaseId,
      packageId: manifest.packageId,
      mode: "LIBRARY_REFERENCE",
      status: "COMMITTED",
    },
    select: { id: true },
  });
  const expected = manifest.items.map((item) => ({
    sourceId: item.id,
    kind: item.type === "SPATIAL_ENVIRONMENT" ? environmentItemKind : spatialItemKind,
  }));
  const mappings = await client.communityInstallMapping.findMany({
    where: { operationId, sourceId: { in: expected.map((item) => item.sourceId) } },
    select: { sourceId: true, targetId: true },
  });
  const targets = await client.reusableAuthoringItem.findMany({
    where: {
      id: { in: mappings.map((mapping) => mapping.targetId) },
      ownerAccountId: accountId,
      status: "INSTALLED_READ_ONLY",
      archivedAt: null,
    },
    select: { id: true, kind: true },
  });
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const mappingBySource = new Map(mappings.map((mapping) => [mapping.sourceId, mapping]));
  if (
    !operation ||
    mappings.length !== expected.length ||
    expected.some((item) => {
      const mapping = mappingBySource.get(item.sourceId);
      return !mapping || targetById.get(mapping.targetId)?.kind !== item.kind;
    })
  )
    throw new CommunityError(
      "COMMUNITY_INSTALLATION_STALE",
      "This Community installation no longer has its pinned read-only Library content.",
    );
  return mappingBySource;
}

async function loadPublishedSpatialPackage(listingId: string) {
  const listing = await db.communityListing.findFirst({
    where: {
      id: listingId,
      itemType: { in: ["SPATIAL_ASSET", "SPATIAL_SCENE", "SPATIAL_ENVIRONMENT"] },
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "UNLISTED"] },
      moderationStatus: "ACTIVE",
      archivedAt: null,
      removedAt: null,
    },
    include: { currentRelease: true, owner: true },
  });
  const release = listing?.currentRelease;
  if (!listing || !release || release.moderationStatus !== "ACTIVE" || release.deprecatedAt)
    throw new CommunityError("COMMUNITY_LISTING_NOT_FOUND", "This spatial release is not available for installation.");
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The release package is not finalized and clean.");
  const manifest = communityPackageManifestSchema.parse(JSON.parse(record.manifest));
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  const files: CommunityPackageFile[] = rows.map((row) => ({
    path: row.relativePath,
    mediaType: row.mediaType,
    bytes: new TextEncoder().encode(row.metadata),
  }));
  if (files.some((file) => file.mediaType !== "application/json"))
    throw new CommunityError(
      "COMMUNITY_PACKAGE_FORBIDDEN_CONTENT",
      "This spatial installer accepts reviewed JSON content only.",
    );
  const expectedPaths =
    listing.itemType === "SPATIAL_ENVIRONMENT"
      ? ["items/environment.json"]
      : listing.itemType === "SPATIAL_SCENE"
        ? ["items/environment.json", "items/spatial.json"]
        : ["items/spatial.json"];
  if (files.length !== expectedPaths.length || expectedPaths.some((path) => !files.some((file) => file.path === path)))
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The spatial package content set is incomplete.");
  const verified = verifyCommunityPackage(manifest, files);
  const releaseManifest = JSON.parse(release.manifest) as { sourceKind?: string; packageChecksum?: string };
  const expectedSourceKind =
    listing.itemType === "SPATIAL_ENVIRONMENT"
      ? "ENVIRONMENT"
      : listing.itemType === "SPATIAL_SCENE"
        ? "SCENE"
        : "ASSET";
  const license = JSON.parse(release.licenseSnapshot) as LicenseSnapshot & { version?: number };
  if (
    manifest.releaseId !== release.id ||
    manifest.packageId !== record.id ||
    manifest.semanticVersion !== release.semanticVersion ||
    verified.checksum !== record.packageChecksum ||
    release.manifestChecksum !== sha256(stableJson(releaseManifest)) ||
    releaseManifest.packageChecksum !== record.packageChecksum ||
    releaseManifest.sourceKind !== expectedSourceKind ||
    license.key !== manifest.license.key ||
    license.version !== manifest.license.version ||
    stableJson(JSON.parse(release.attributionSnapshot)) !== stableJson(manifest.attribution)
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The package does not match its immutable release.");
  if (!license.allowsPublicUse)
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "This release no longer has public-use rights.");
  return { listing, release, record, manifest, files, license };
}

function assertInstallReceipt(
  installation: { packageId: string; installedPackageChecksum: string },
  source: Awaited<ReturnType<typeof loadPublishedSpatialPackage>>,
) {
  if (
    installation.packageId !== source.record.id ||
    installation.installedPackageChecksum !== source.record.packageChecksum
  )
    throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "This pinned Community installation receipt has changed.");
}

export async function reviewSpatialInstallation(accountId: string, listingId: string) {
  const source = await loadPublishedSpatialPackage(listingId);
  const existing = await db.communityInstallation.findFirst({
    where: { accountId, releaseId: source.release.id, mode: "LIBRARY_REFERENCE" },
  });
  let mappings: Awaited<ReturnType<typeof requirePinnedInstallTargets>> | null = null;
  if (existing) {
    assertInstallReceipt(existing, source);
    mappings = await requirePinnedInstallTargets(db, accountId, existing.operationId, source.manifest);
  }
  const targetId = mappings?.get(
    source.listing.itemType === "SPATIAL_ENVIRONMENT" ? "environment" : "spatial",
  )?.targetId;
  return {
    listingId,
    title: source.listing.title,
    itemType: source.listing.itemType,
    creator: source.listing.owner.displayName,
    releaseId: source.release.id,
    semanticVersion: source.release.semanticVersion,
    packageChecksum: source.record.packageChecksum,
    license: source.license,
    attribution: JSON.parse(source.release.attributionSnapshot) as unknown,
    included: source.manifest.items.map((item) => ({
      type: item.type,
      description: item.accessibility?.description ?? item.id,
    })),
    alreadyInstalled: Boolean(existing),
    studioUrl: targetId
      ? source.listing.itemType === "SPATIAL_ENVIRONMENT"
        ? "/studio/parallax"
        : `/studio/parallax?definition=${encodeURIComponent(targetId)}`
      : null,
  };
}

export async function installSpatialCommunityRelease(input: {
  accountId: string;
  listingId: string;
  releaseId: string;
  packageChecksum: string;
  requestId: string;
}) {
  const source = await loadPublishedSpatialPackage(input.listingId);
  if (source.release.id !== input.releaseId || source.record.packageChecksum !== input.packageChecksum)
    throw new CommunityError("COMMUNITY_REVIEW_STALE", "The Community release changed. Review its current version.");
  const prior = await db.communityInstallation.findFirst({
    where: { accountId: input.accountId, releaseId: input.releaseId, mode: "LIBRARY_REFERENCE" },
  });
  if (prior) {
    assertInstallReceipt(prior, source);
    const mappings = await requirePinnedInstallTargets(db, input.accountId, prior.operationId, source.manifest);
    const targetId = mappings.get(
      source.listing.itemType === "SPATIAL_ENVIRONMENT" ? "environment" : "spatial",
    )?.targetId;
    return {
      status: "ALREADY_INSTALLED" as const,
      itemId: targetId ?? null,
      releaseId: input.releaseId,
      studioUrl: targetId
        ? source.listing.itemType === "SPATIAL_ENVIRONMENT"
          ? "/studio/parallax"
          : `/studio/parallax?definition=${encodeURIComponent(targetId)}`
        : null,
    };
  }
  const plan = createInstallPlan({
    packageManifest: source.manifest,
    packageChecksum: source.record.packageChecksum,
    mode: "LIBRARY_REFERENCE",
    destinationRevision: "NEW_LIBRARY_ENTRY",
    currentDestinationRevision: "NEW_LIBRARY_ENTRY",
    license: source.license,
  });
  const operation = commitInstallOperation(beginInstallOperation(plan, input.requestId), true);
  const suffix = canonicalChecksum(input.accountId).slice(0, 10);
  const mapped = Object.fromEntries(Object.entries(plan.idMappings).map(([key, value]) => [key, `${value}-${suffix}`]));
  const itemById = new Map(source.manifest.items.map((item) => [item.id, item]));
  const fileByPath = new Map(source.files.map((file) => [file.path, file]));
  const environmentFile = itemById.get("environment") ? fileByPath.get(itemById.get("environment")!.path) : null;
  const spatialFile = itemById.get("spatial") ? fileByPath.get(itemById.get("spatial")!.path) : null;
  if (source.listing.itemType === "SPATIAL_ENVIRONMENT" && !environmentFile)
    throw new CommunityError("COMMUNITY_DEPENDENCY_MISSING", "Environment content is missing.");
  if (source.listing.itemType !== "SPATIAL_ENVIRONMENT" && !spatialFile)
    throw new CommunityError("COMMUNITY_DEPENDENCY_MISSING", "Spatial content is missing.");
  const environmentContent = environmentFile
    ? environmentPayloadSchema.parse(JSON.parse(new TextDecoder().decode(environmentFile.bytes))).content
    : null;
  const spatialContent = spatialFile
    ? payloadSchema.parse(JSON.parse(new TextDecoder().decode(spatialFile.bytes)))
    : null;
  if (spatialContent?.composition && spatialContent.category !== "SCENE_TEMPLATE")
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The composition category is invalid.");
  if (environmentContent?.origin === "RECONSTRUCTED")
    throw new CommunityError(
      "COMMUNITY_PRIVATE_ENVIRONMENT",
      "A reconstructed room cannot be installed from Community.",
    );
  const environmentId = mapped.environment;
  const spatialId = mapped.spatial;
  const localEnvironment =
    environmentContent && environmentId
      ? environmentContentSchema.parse({
          ...environmentContent,
          id: environmentId,
          sourceLabel: `Community release ${source.release.semanticVersion}`,
        })
      : null;
  const environmentReference = localEnvironment
    ? {
        environmentId,
        versionId: `${environmentId}:e1`,
        revision: 1,
        checksum: canonicalChecksum(localEnvironment),
      }
    : null;
  const importedDraft =
    spatialContent && spatialId
      ? draftSchema.parse({
          content: {
            ...spatialContent.content,
            id: `${spatialId}:draft`,
            definitionId: spatialId,
            semanticVersion: "1.0.0",
            ...(environmentReference ? { environment: environmentReference } : {}),
          },
          scope: "MY_LIBRARY",
          chronicleId: null,
          category: spatialContent.category,
          tags: spatialContent.composition ? ["composition"] : [],
          collection: "Community",
          favorite: false,
          lineage: { definitionId: spatialContent.content.definitionId, versionId: source.release.id },
        })
      : null;
  const moment = importedDraft ? materializeLibraryMoment(importedDraft, input.accountId, 1) : null;
  const result = await db.$transaction(async (tx) => {
    const existing = await tx.communityInstallOperation.findUnique({
      where: { accountId_requestId: { accountId: input.accountId, requestId: input.requestId } },
    });
    if (existing) {
      if (existing.releaseId !== input.releaseId || existing.packageId !== source.record.id)
        throw new CommunityError(
          "COMMUNITY_SOURCE_CONFLICT",
          "This installation request was used for another release.",
        );
      const matchingInstallation = await tx.communityInstallation.findFirst({
        where: {
          operationId: existing.id,
          accountId: input.accountId,
          releaseId: input.releaseId,
          mode: "LIBRARY_REFERENCE",
        },
      });
      if (!matchingInstallation)
        throw new CommunityError(
          "COMMUNITY_INSTALLATION_STALE",
          "This pinned Community installation receipt is missing.",
        );
      assertInstallReceipt(matchingInstallation, source);
      const mappings = await requirePinnedInstallTargets(tx, input.accountId, existing.id, source.manifest);
      const targetId = mappings.get(spatialId ? "spatial" : "environment")?.targetId;
      return { status: existing.status, itemId: targetId ?? null, releaseId: input.releaseId };
    }
    if (localEnvironment && environmentReference) {
      await tx.reusableAuthoringItem.create({
        data: {
          id: environmentId,
          ownerAccountId: input.accountId,
          kind: environmentItemKind,
          name: localEnvironment.name,
          status: "INSTALLED_READ_ONLY",
          currentVersionNumber: 1,
          versions: {
            create: {
              id: environmentReference.versionId,
              versionNumber: 1,
              checksum: environmentReference.checksum,
              envelope: JSON.stringify({ reference: environmentReference, content: localEnvironment }),
            },
          },
        },
      });
    }
    if (importedDraft && moment) {
      await tx.reusableAuthoringItem.create({
        data: {
          id: spatialId,
          ownerAccountId: input.accountId,
          kind: spatialItemKind,
          name: importedDraft.content.title,
          status: "INSTALLED_READ_ONLY",
          currentVersionNumber: 1,
          versions: {
            create: [
              {
                id: `${spatialId}:working`,
                versionNumber: 0,
                checksum: canonicalChecksum(importedDraft),
                envelope: JSON.stringify(importedDraft),
              },
              {
                id: moment.version.id,
                versionNumber: 1,
                checksum: moment.version.checksum,
                envelope: JSON.stringify(moment),
              },
            ],
          },
        },
      });
    }
    const stored = await tx.communityInstallOperation.create({
      data: {
        id: operation.id,
        requestId: input.requestId,
        idempotencyKey: operation.idempotencyKey,
        packageId: source.record.id,
        releaseId: input.releaseId,
        accountId: input.accountId,
        mode: "LIBRARY_REFERENCE",
        status: "COMMITTED",
        destinationRevision: plan.destinationRevision,
        plan: JSON.stringify({ ...plan, idMappings: mapped }),
        completedAt: new Date(),
      },
    });
    await tx.communityInstallMapping.createMany({
      data: Object.entries(mapped).map(([sourceId, targetId]) => ({
        operationId: stored.id,
        sourceId,
        targetId,
        kind: "PACKAGE_ITEM",
      })),
    });
    await tx.communityInstallation.create({
      data: {
        accountId: input.accountId,
        packageId: source.record.id,
        releaseId: input.releaseId,
        operationId: stored.id,
        mode: "LIBRARY_REFERENCE",
        installedPackageChecksum: source.record.packageChecksum,
        upstreamReleaseId: input.releaseId,
      },
    });
    return { status: "COMMITTED" as const, itemId: spatialId ?? environmentId ?? null, releaseId: input.releaseId };
  });
  return {
    ...result,
    studioUrl: result.itemId
      ? source.listing.itemType === "SPATIAL_ENVIRONMENT"
        ? "/studio/parallax"
        : `/studio/parallax?definition=${encodeURIComponent(result.itemId)}`
      : null,
  };
}
