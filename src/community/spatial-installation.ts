import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { canonicalChecksum } from "@/drydock/canonical";
import { draftSchema } from "@/parallax/authoring";
import { roomEnvironmentSchema } from "@/parallax/environment-contracts";
import { environmentDraftSchema, environmentVersionSchema } from "@/parallax/library-lifecycle-contracts";
import { environmentContentSchema } from "@/parallax/legacy-scene-environment-contracts";
import { legacyEnvironmentItemKind } from "@/parallax/legacy-environment-service";
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
const legacyEnvironmentPayloadSchema = z.strictObject({
  schemaVersion: z.literal(1),
  content: environmentContentSchema,
});
const richEnvironmentPayloadSchema = z.strictObject({
  schemaVersion: z.literal(2),
  format: z.literal("PARALLAX_ENVIRONMENT_VERSION_1"),
  content: z.strictObject({
    id: environmentDraftSchema.shape.id,
    name: environmentDraftSchema.shape.name,
    description: environmentDraftSchema.shape.description,
    category: environmentDraftSchema.shape.category,
    room: roomEnvironmentSchema,
  }),
});
const environmentPayloadSchema = z.union([legacyEnvironmentPayloadSchema, richEnvironmentPayloadSchema]);

function installedStudioUrl(source: Awaited<ReturnType<typeof loadPublishedSpatialPackage>>, targetId: string) {
  const environment = source.listing.itemType === "SPATIAL_ENVIRONMENT";
  const kind = environment
    ? "ENVIRONMENTS"
    : source.releaseManifest.publicMetadata.category === "COMPOSITION"
      ? "COMPOSITIONS"
      : source.releaseManifest.publicMetadata.category === "EFFECT"
        ? "EFFECTS"
        : source.listing.itemType === "SPATIAL_SCENE"
          ? "SCENES"
          : "ASSETS";
  const entryId = `${environment ? "environment" : "saved"}:${targetId}`;
  return `/studio/parallax?${new URLSearchParams({ library: entryId, libraryKind: kind })}`;
}

async function requirePinnedInstallTargets(
  client: Prisma.TransactionClient,
  accountId: string,
  operationId: string,
  manifest: CommunityPackageManifest,
  environmentKind: string,
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
    kind: item.type === "SPATIAL_ENVIRONMENT" ? environmentKind : spatialItemKind,
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
  let richEnvironmentValid = true;
  const richEnvironmentId = environmentKind === spatialItemKind ? mappingBySource.get("environment")?.targetId : null;
  if (richEnvironmentId) {
    const versions = await client.reusableAuthoringItemVersion.findMany({
      where: { itemId: richEnvironmentId, versionNumber: { in: [0, 1] } },
    });
    try {
      const working = versions.find((row) => row.versionNumber === 0);
      const released = versions.find((row) => row.versionNumber === 1);
      if (!working || !released) throw new Error("Installed Environment versions are missing.");
      const draft = environmentDraftSchema.parse(JSON.parse(working.envelope));
      const version = environmentVersionSchema.parse(JSON.parse(released.envelope));
      richEnvironmentValid =
        draft.id === richEnvironmentId &&
        version.definitionId === richEnvironmentId &&
        version.content.id === richEnvironmentId &&
        version.id === released.id &&
        canonicalChecksum(draft) === working.checksum &&
        canonicalChecksum(version) === released.checksum;
    } catch {
      richEnvironmentValid = false;
    }
  }
  if (
    !operation ||
    !richEnvironmentValid ||
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
  const releaseManifest = z
    .object({
      sourceKind: z.enum(["ASSET", "SCENE", "ENVIRONMENT"]),
      packageChecksum: z.string(),
      publicMetadata: z.object({ shortDescription: z.string().nullable(), category: z.string() }).passthrough(),
    })
    .passthrough()
    .parse(JSON.parse(release.manifest));
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
  const environmentFile = files.find((file) => file.path === "items/environment.json");
  const environmentPayload = environmentFile
    ? environmentPayloadSchema.parse(JSON.parse(new TextDecoder().decode(environmentFile.bytes)))
    : null;
  const environmentKind = environmentPayload?.schemaVersion === 2 ? spatialItemKind : legacyEnvironmentItemKind;
  return { listing, release, record, manifest, releaseManifest, files, license, environmentPayload, environmentKind };
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
    mappings = await requirePinnedInstallTargets(
      db,
      accountId,
      existing.operationId,
      source.manifest,
      source.environmentKind,
    );
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
    studioUrl: targetId ? installedStudioUrl(source, targetId) : null,
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
    const mappings = await requirePinnedInstallTargets(
      db,
      input.accountId,
      prior.operationId,
      source.manifest,
      source.environmentKind,
    );
    const targetId = mappings.get(
      source.listing.itemType === "SPATIAL_ENVIRONMENT" ? "environment" : "spatial",
    )?.targetId;
    return {
      status: "ALREADY_INSTALLED" as const,
      itemId: targetId ?? null,
      releaseId: input.releaseId,
      studioUrl: targetId ? installedStudioUrl(source, targetId) : null,
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
  const environmentPayload = source.environmentPayload;
  const spatialContent = spatialFile
    ? payloadSchema.parse(JSON.parse(new TextDecoder().decode(spatialFile.bytes)))
    : null;
  if (spatialContent?.composition && spatialContent.category !== "SCENE_TEMPLATE")
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The composition category is invalid.");
  if (
    (environmentPayload?.schemaVersion === 1 && environmentPayload.content.origin === "RECONSTRUCTED") ||
    (environmentPayload?.schemaVersion === 2 && environmentPayload.content.room.origin === "PHOTO_RECONSTRUCTION")
  )
    throw new CommunityError(
      "COMMUNITY_PRIVATE_ENVIRONMENT",
      "A reconstructed room cannot be installed from Community.",
    );
  const environmentId = mapped.environment;
  const spatialId = mapped.spatial;
  const localLegacyEnvironment =
    environmentPayload?.schemaVersion === 1 && environmentId
      ? environmentContentSchema.parse({
          ...environmentPayload.content,
          id: environmentId,
          sourceLabel: `Community release ${source.release.semanticVersion}`,
        })
      : null;
  const localRichRoom =
    environmentPayload?.schemaVersion === 2 && environmentId
      ? roomEnvironmentSchema.parse({
          ...environmentPayload.content.room,
          id: environmentId,
          name: environmentPayload.content.name,
        })
      : null;
  const localRichEnvironment =
    environmentPayload?.schemaVersion === 2 && environmentId && localRichRoom
      ? environmentDraftSchema.parse({
          format: "PARALLAX_ENVIRONMENT_DRAFT_1",
          id: environmentId,
          name: environmentPayload.content.name,
          description: environmentPayload.content.description,
          category: environmentPayload.content.category,
          room: localRichRoom,
          tags: [],
          collection: "Community",
          favorite: false,
          lineage: { definitionId: environmentPayload.content.id, versionId: source.release.id },
        })
      : null;
  const localRichVersion = localRichEnvironment
    ? environmentVersionSchema.parse({
        format: "PARALLAX_ENVIRONMENT_VERSION_1",
        id: `${environmentId}:v1`,
        definitionId: environmentId,
        number: 1,
        createdAt: new Date().toISOString(),
        notes: `Installed Community release ${source.release.semanticVersion}`,
        content: localRichEnvironment,
      })
    : null;
  const environmentReference = localLegacyEnvironment
    ? {
        environmentId,
        versionId: `${environmentId}:e1`,
        revision: 1,
        checksum: canonicalChecksum(localLegacyEnvironment),
      }
    : localRichVersion
      ? {
          environmentId,
          versionId: localRichVersion.id,
          revision: 1,
          checksum: canonicalChecksum(localRichVersion),
        }
      : null;
  const importedStudio = spatialContent?.content.studio ? structuredClone(spatialContent.content.studio) : undefined;
  if (importedStudio && environmentReference) {
    delete importedStudio.environmentBinding;
    if (localRichRoom) importedStudio.environment = localRichRoom;
  }
  const importedDraft =
    spatialContent && spatialId
      ? draftSchema.parse({
          content: {
            ...spatialContent.content,
            id: `${spatialId}:draft`,
            definitionId: spatialId,
            semanticVersion: "1.0.0",
            ...(importedStudio && { studio: importedStudio }),
            ...(environmentReference ? { environment: environmentReference } : {}),
          },
          scope: "MY_LIBRARY",
          library: {
            type:
              source.listing.itemType === "SPATIAL_SCENE" ? "SCENE" : spatialContent.composition ? "ASSEMBLY" : "ASSET",
            description: source.releaseManifest.publicMetadata.shortDescription ?? "",
          },
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
      const mappings = await requirePinnedInstallTargets(
        tx,
        input.accountId,
        existing.id,
        source.manifest,
        source.environmentKind,
      );
      const targetId = mappings.get(spatialId ? "spatial" : "environment")?.targetId;
      return { status: existing.status, itemId: targetId ?? null, releaseId: input.releaseId };
    }
    if (localLegacyEnvironment && environmentReference) {
      await tx.reusableAuthoringItem.create({
        data: {
          id: environmentId,
          ownerAccountId: input.accountId,
          kind: legacyEnvironmentItemKind,
          name: localLegacyEnvironment.name,
          status: "INSTALLED_READ_ONLY",
          currentVersionNumber: 1,
          versions: {
            create: {
              id: environmentReference.versionId,
              versionNumber: 1,
              checksum: environmentReference.checksum,
              envelope: JSON.stringify({ reference: environmentReference, content: localLegacyEnvironment }),
            },
          },
        },
      });
    }
    if (localRichEnvironment && localRichVersion && environmentReference) {
      await tx.reusableAuthoringItem.create({
        data: {
          id: environmentId,
          ownerAccountId: input.accountId,
          kind: spatialItemKind,
          name: localRichEnvironment.name,
          description: localRichEnvironment.description,
          status: "INSTALLED_READ_ONLY",
          currentVersionNumber: 1,
          versions: {
            create: [
              {
                id: `${environmentId}:working`,
                versionNumber: 0,
                checksum: canonicalChecksum(localRichEnvironment),
                envelope: JSON.stringify(localRichEnvironment),
              },
              {
                id: localRichVersion.id,
                versionNumber: 1,
                checksum: environmentReference.checksum,
                envelope: JSON.stringify(localRichVersion),
              },
            ],
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
    studioUrl: result.itemId ? installedStudioUrl(source, result.itemId) : null,
  };
}
