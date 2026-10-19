import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { canonicalChecksum } from "@/drydock/canonical";
import { resolvePublicProfileProjection } from "./public-profile";
import { assertPublishingAllowed, CommunityError, listingInputSchema, stableJson } from "./domain";
import {
  assertPublicationScanStatus,
  communityPackageManifestSchema,
  packageChecksum,
  sha256,
  verifyCommunityPackage,
  type CommunityPackageFile,
} from "./package";
import { assertTrustedCommunityScanReceipts, scanCommunityPackageFiles } from "./scanner";
import { legacyEnvironmentItemKind } from "@/parallax/legacy-environment-service";
import { resolvePinnedEnvironment } from "@/parallax/environment-version-resolution";
import { draftSchema } from "@/parallax/authoring";
import { matchesExtractedComposition } from "@/parallax/element-authoring";
import { spatialItemKind } from "@/parallax/library-service";
import { spatialPackageManifest, projectSpatialPackage, spatialSourceSchema } from "./spatial-package";

const attributionSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(160),
  contributionType: z.string().trim().min(1).max(120),
});
export const spatialPublicationInputSchema = z.strictObject({
  source: spatialSourceSchema,
  listingId: z.string().min(1).max(128).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(2000),
  tags: z
    .array(
      z
        .string()
        .trim()
        .regex(/^[a-z0-9-]{1,32}$/),
    )
    .max(12),
  visibility: z.literal("COMMUNITY"),
  locationClass: z.enum(["FICTIONAL", "GENERIC"]),
  licenseKey: z.string().min(1).max(128),
  attribution: z.array(attributionSchema).max(24),
  rightsAcknowledged: z.literal(true),
  environmentPrivacyAcknowledged: z.boolean().default(false),
});
export type SpatialPublicationInput = z.infer<typeof spatialPublicationInputSchema>;

async function loadSource(accountId: string, source: SpatialPublicationInput["source"]) {
  const item = await db.reusableAuthoringItem.findUnique({
    where: { id: source.id },
    include: { versions: true },
  });
  if (!item || item.ownerAccountId !== accountId || item.archivedAt)
    throw new CommunityError("COMMUNITY_SOURCE_NOT_OWNED", "This saved content is unavailable to this Creator.");
  if (item.status === "INSTALLED_READ_ONLY")
    throw new CommunityError(
      "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
      "Installed Community content cannot be republished as your own source.",
    );
  if (item.status !== "SAVED")
    throw new CommunityError(
      "COMMUNITY_SOURCE_NOT_SHAREABLE",
      "Save this content to My Spatial Library before publishing it.",
    );
  if (item.currentVersionNumber !== source.revision)
    throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The saved source changed. Review its current revision.");
  if (
    source.kind === "ENVIRONMENT"
      ? ![legacyEnvironmentItemKind, spatialItemKind].includes(item.kind)
      : item.kind !== spatialItemKind
  )
    throw new CommunityError(
      "COMMUNITY_SOURCE_TYPE_MISMATCH",
      "The selected content type does not match its saved source.",
    );
  const row = item.versions.find((v) =>
    source.kind === "ENVIRONMENT" ? v.id === source.versionId && v.versionNumber > 0 : v.versionNumber === 0,
  );
  const envelope = row ? (JSON.parse(row.envelope) as { content?: unknown }) : null;
  if (
    !row ||
    !envelope ||
    canonicalChecksum(
      source.kind === "ENVIRONMENT" && item.kind === legacyEnvironmentItemKind ? envelope.content : envelope,
    ) !== row.checksum
  )
    throw new CommunityError("COMMUNITY_SOURCE_VERSION_MISMATCH", "The saved revision failed integrity verification.");
  let raw: unknown = envelope;
  if (source.kind === "ENVIRONMENT") {
    try {
      raw = await resolvePinnedEnvironment(accountId, {
        environmentId: source.id,
        versionId: source.versionId,
        revision: row.versionNumber,
        checksum: row.checksum,
      });
    } catch {
      throw new CommunityError(
        "COMMUNITY_SOURCE_VERSION_MISMATCH",
        "The selected Environment version is unavailable or invalid.",
      );
    }
  }
  let verifiedOwnedComposition = false;
  if (source.kind !== "ENVIRONMENT") {
    const draft = draftSchema.parse(raw);
    if (draft.lineage && draft.category === "SCENE_TEMPLATE" && draft.tags.includes("composition")) {
      const parent = await db.reusableAuthoringItem.findUnique({
        where: { id: draft.lineage.definitionId },
        include: { versions: { where: { versionNumber: 0 } } },
      });
      const working = parent?.versions[0];
      if (
        !parent ||
        parent.ownerAccountId !== accountId ||
        parent.kind !== spatialItemKind ||
        parent.status !== "SAVED" ||
        parent.archivedAt ||
        !working
      )
        throw new CommunityError(
          "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
          "Save the composition's current source as your owned Spatial Library item before publishing.",
        );
      const parentEnvelope = JSON.parse(working.envelope);
      if (
        canonicalChecksum(parentEnvelope) !== working.checksum ||
        !matchesExtractedComposition(draftSchema.parse(parentEnvelope), draft)
      )
        throw new CommunityError(
          "COMMUNITY_REDISTRIBUTION_UNVERIFIED",
          "This composition no longer matches its owned source. Save a fresh composition from the current source.",
        );
      verifiedOwnedComposition = true;
    }
  }
  let environment: unknown;
  if (source.kind === "SCENE") {
    const draft = draftSchema.parse(raw);
    if (draft.content.environment) {
      try {
        environment = await resolvePinnedEnvironment(accountId, draft.content.environment);
      } catch {
        throw new CommunityError(
          "COMMUNITY_DEPENDENCY_MISSING",
          "The Scene's pinned Environment is unavailable or invalid.",
        );
      }
    }
  }
  return projectSpatialPackage(source, raw, environment, verifiedOwnedComposition);
}

async function resolveReview(accountId: string, raw: unknown) {
  const input = spatialPublicationInputSchema.parse(raw);
  if (process.env.COMMUNITY_ENABLED === "false")
    throw new CommunityError("COMMUNITY_NOT_ENABLED", "Community Harbor is disabled.");
  const rate = consumeRateLimit(`community-spatial-preflight:${accountId}`, { limit: 25, windowMs: 60_000 });
  if (!rate.allowed) throw new CommunityError("COMMUNITY_RATE_LIMITED", "Please wait before reviewing again.");
  const profile = await resolvePublicProfileProjection(db, accountId);
  assertPublishingAllowed(
    { enabled: true, publicPublishingEnabled: process.env.COMMUNITY_PUBLIC_PUBLISHING_ENABLED !== "false" },
    { role: "CREATOR", suspended: profile.creatorStatus === "SUSPENDED" || profile.moderationStatus !== "ACTIVE" },
  );
  const policy = await db.communityLicensePolicy.findUnique({ where: { key: input.licenseKey } });
  if (!policy?.active || !policy.allowsPublicUse || !policy.allowsRedistribution || policy.key === "CUSTOM")
    throw new CommunityError(
      "COMMUNITY_LICENSE_UNAVAILABLE",
      "Choose a configured Community license that permits public use and redistribution.",
    );
  const projection = await loadSource(accountId, input.source);
  if (projection.dependencies.length || input.source.kind === "ENVIRONMENT") {
    if (!input.environmentPrivacyAcknowledged)
      throw new CommunityError(
        "COMMUNITY_ENVIRONMENT_ACKNOWLEDGMENT_REQUIRED",
        "Review the Environment geometry and acknowledge that a reconstructed home layout can remain sensitive.",
      );
  }
  const listingInput = listingInputSchema.parse({
    itemType: projection.itemType,
    slug: input.slug,
    title: input.title,
    shortDescription: input.description.slice(0, 280),
    longDescription: input.description,
    visibility: input.visibility,
    spoilerLevel: "NONE",
    locationClass: input.locationClass,
    tags: input.tags,
  });
  if (input.listingId) {
    const listing = await db.communityListing.findFirst({
      where: { id: input.listingId, ownerProfileId: profile.id },
      include: { currentRelease: true },
    });
    if (!listing || listing.itemType !== projection.itemType || listing.slug !== input.slug)
      throw new CommunityError("COMMUNITY_ACCESS_DENIED", "The update must target your existing spatial listing.");
    const prior = listing.currentRelease
      ? (JSON.parse(listing.currentRelease.manifest) as { sourceId?: string })
      : null;
    if (!prior || prior.sourceId !== input.source.id)
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The listing belongs to a different saved spatial source.");
  }
  const license = { key: policy.key, version: policy.policyVersion };
  const attribution = [{ displayName: profile.displayName, contributionType: "Creator" }, ...input.attribution];
  const reviewDigest = sha256(
    stableJson({
      source: input.source,
      sourceChecksum: projection.sourceChecksum,
      files: projection.files.map((file) => ({ path: file.path, checksum: sha256(file.bytes) })),
      listing: listingInput,
      license,
      attribution,
      listingId: input.listingId ?? null,
    }),
  );
  if (!input.listingId) {
    const slugOwner = await db.communityListing.findUnique({
      where: { slug: input.slug },
      include: { currentRelease: true },
    });
    if (slugOwner) {
      let priorDigest: string | null = null;
      try {
        priorDigest =
          (JSON.parse(slugOwner.currentRelease?.manifest ?? "{}") as { reviewDigest?: string }).reviewDigest ?? null;
      } catch {
        /* Older manifests are not spatial retry receipts. */
      }
      if (
        slugOwner.ownerProfileId === profile.id &&
        slugOwner.itemType === projection.itemType &&
        slugOwner.currentRelease &&
        priorDigest === null
      )
        throw new CommunityError(
          "COMMUNITY_PACKAGE_RECEIPT_INVALID",
          "The recorded Community release cannot be verified for an exact retry.",
        );
      if (slugOwner.ownerProfileId !== profile.id || priorDigest !== reviewDigest)
        throw new CommunityError("COMMUNITY_SLUG_TAKEN", "This Community address is already in use.");
    }
  }
  return { input, profile, policy, projection, listingInput, license, attribution, reviewDigest };
}

export async function listSpatialPublicationLicenses() {
  const rows = await db.communityLicensePolicy.findMany({
    where: { active: true, allowsPublicUse: true, allowsRedistribution: true, key: { not: "CUSTOM" } },
    orderBy: { displayName: "asc" },
  });
  return rows.map((row) => ({
    key: row.key,
    name: row.displayName,
    allowsModification: row.allowsModification,
    allowsCommercialUse: row.allowsCommercialUse,
    requiresAttribution: row.requiresAttribution,
    shareAlike: row.shareAlike,
  }));
}

export async function listOwnedSpatialPublications(accountId: string, rawSource: unknown) {
  const source = spatialSourceSchema.parse(rawSource);
  const item = await db.reusableAuthoringItem.findUnique({ where: { id: source.id } });
  if (!item || item.ownerAccountId !== accountId || item.archivedAt)
    throw new CommunityError("COMMUNITY_SOURCE_NOT_OWNED", "This saved content is unavailable to this Creator.");
  const profile = await db.communityProfile.findUnique({ where: { accountId } });
  if (!profile) return [];
  const itemType =
    source.kind === "ENVIRONMENT" ? "SPATIAL_ENVIRONMENT" : source.kind === "SCENE" ? "SPATIAL_SCENE" : "SPATIAL_ASSET";
  const listings = await db.communityListing.findMany({
    where: { ownerProfileId: profile.id, itemType, removedAt: null },
    include: { currentRelease: true },
    orderBy: { updatedAt: "desc" },
  });
  return listings.flatMap((listing) => {
    if (!listing.currentRelease) return [];
    try {
      const manifest = JSON.parse(listing.currentRelease.manifest) as { sourceId?: string; sourceKind?: string };
      if (manifest.sourceId !== source.id || manifest.sourceKind !== source.kind) return [];
      const license = JSON.parse(listing.currentRelease.licenseSnapshot) as { key?: string };
      const tags = z.array(z.string()).safeParse(JSON.parse(listing.tags));
      return [
        {
          id: listing.id,
          slug: listing.slug,
          title: listing.title,
          description: listing.longDescription ?? listing.shortDescription ?? "",
          tags: tags.success ? tags.data : [],
          licenseKey: license.key ?? "",
          publicationStatus: listing.publicationStatus,
          semanticVersion: listing.currentRelease.semanticVersion,
        },
      ];
    } catch {
      return [];
    }
  });
}

export async function preflightSpatialPublication(accountId: string, raw: unknown) {
  const review = await resolveReview(accountId, raw);
  return {
    reviewDigest: review.reviewDigest,
    source: review.input.source,
    itemType: review.projection.itemType,
    category: review.projection.category,
    sourceChecksum: review.projection.sourceChecksum,
    included: review.projection.files.map((file) => ({
      path: file.path,
      preview: JSON.parse(new TextDecoder().decode(file.bytes)) as unknown,
    })),
    dependencies: review.projection.dependencies,
    warnings: review.projection.warnings,
    license: {
      key: review.policy.key,
      name: review.policy.displayName,
      allowsModification: review.policy.allowsModification,
      requiresAttribution: review.policy.requiresAttribution,
    },
    attribution: review.attribution,
    publicationState: "READY_FOR_REVIEW" as const,
  };
}

async function requireRecordedSpatialSubmission(
  listing: Prisma.CommunityListingGetPayload<{ include: { currentRelease: true } }>,
  review: Awaited<ReturnType<typeof resolveReview>>,
) {
  const release = listing?.currentRelease;
  if (
    !listing ||
    !release ||
    !["READY_FOR_REVIEW", "IN_REVIEW", "UPDATE_PENDING", "PUBLISHED"].includes(listing.publicationStatus) ||
    listing.moderationStatus !== "ACTIVE" ||
    listing.archivedAt ||
    listing.removedAt ||
    release.moderationStatus !== "ACTIVE" ||
    release.deprecatedAt
  )
    throw new CommunityError(
      "COMMUNITY_SOURCE_CONFLICT",
      "The recorded Community release is no longer available for this retry.",
    );
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    !record.finalizedAt ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The recorded Community package is not finalized and clean.",
    );
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  const files: CommunityPackageFile[] = rows.map((row) => ({
    path: row.relativePath,
    mediaType: row.mediaType,
    bytes: new TextEncoder().encode(row.metadata),
  }));
  let receiptMatches = false;
  try {
    const manifest = communityPackageManifestSchema.parse(JSON.parse(record.manifest));
    const verified = verifyCommunityPackage(manifest, files);
    const releaseManifest = JSON.parse(release.manifest) as {
      sourceId?: string;
      sourceKind?: string;
      sourceRevision?: number;
      sourceChecksum?: string;
      reviewDigest?: string;
      packageChecksum?: string;
      publicMetadata?: unknown;
    };
    const license = JSON.parse(release.licenseSnapshot) as { key?: string; version?: number };
    const attribution = JSON.parse(release.attributionSnapshot) as unknown;
    const expectedFiles = new Map(review.projection.files.map((file) => [file.path, file]));
    const expectedManifest = spatialPackageManifest({
      packageId: record.id,
      releaseId: release.id,
      semanticVersion: release.semanticVersion,
      license: review.license,
      attribution: review.attribution,
      projection: review.projection,
    });
    receiptMatches =
      manifest.releaseId === release.id &&
      manifest.packageId === record.id &&
      manifest.semanticVersion === release.semanticVersion &&
      stableJson(manifest) === stableJson(expectedManifest) &&
      verified.checksum === record.packageChecksum &&
      verified.byteLength === record.byteLength &&
      release.manifestChecksum === sha256(stableJson(releaseManifest)) &&
      releaseManifest.sourceId === review.input.source.id &&
      releaseManifest.sourceKind === review.input.source.kind &&
      releaseManifest.sourceRevision === review.input.source.revision &&
      releaseManifest.sourceChecksum === review.projection.sourceChecksum &&
      releaseManifest.reviewDigest === review.reviewDigest &&
      releaseManifest.packageChecksum === record.packageChecksum &&
      stableJson(releaseManifest.publicMetadata) ===
        stableJson({
          title: review.listingInput.title,
          shortDescription: review.listingInput.shortDescription,
          category: review.projection.category,
          spoilerLevel: review.listingInput.spoilerLevel,
        }) &&
      license.key === manifest.license.key &&
      license.version === manifest.license.version &&
      stableJson(attribution) === stableJson(review.attribution) &&
      stableJson(manifest.attribution) === stableJson(review.attribution) &&
      files.length === expectedFiles.size &&
      files.every((file) => {
        const expected = expectedFiles.get(file.path);
        return expected?.mediaType === file.mediaType && sha256(expected.bytes) === sha256(file.bytes);
      });
  } catch {
    // A malformed or incomplete stored receipt never confirms a publication.
  }
  if (!receiptMatches)
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The recorded Community package no longer matches your review.",
    );
  const declaration = await db.communityOwnershipDeclaration.findFirst({
    where: { listingId: listing.id, releaseId: release.id, declarantProfileId: review.profile.id },
    select: { id: true },
  });
  if (!declaration)
    throw new CommunityError(
      "COMMUNITY_OWNERSHIP_UNVERIFIED",
      "The recorded Community release has no rights declaration.",
    );
  return record;
}

export async function publishSpatialToCommunity(accountId: string, raw: unknown, expectedReviewDigest: string) {
  const review = await resolveReview(accountId, raw);
  if (review.reviewDigest !== expectedReviewDigest)
    throw new CommunityError(
      "COMMUNITY_REVIEW_STALE",
      "The source or publishing choices changed. Review the package again.",
    );
  const prior = await db.communityListing.findUnique({
    where: review.input.listingId ? { id: review.input.listingId } : { slug: review.input.slug },
    include: { currentRelease: true },
  });
  if (prior?.ownerProfileId === review.profile.id && prior.currentRelease) {
    let saved: { reviewDigest?: string };
    try {
      saved = JSON.parse(prior.currentRelease.manifest) as { reviewDigest?: string };
    } catch {
      throw new CommunityError(
        "COMMUNITY_PACKAGE_RECEIPT_INVALID",
        "The recorded Community release cannot be verified for an exact retry.",
      );
    }
    if (saved.reviewDigest === review.reviewDigest) {
      const record = await requireRecordedSpatialSubmission(prior, review);
      return {
        listingId: prior.id,
        releaseId: prior.currentRelease.id,
        packageId: record.id,
        semanticVersion: prior.currentRelease.semanticVersion,
        publicationStatus: prior.publicationStatus,
        listingUrl: `/community/${review.input.slug}`,
        message:
          prior.publicationStatus === "PUBLISHED"
            ? "This exact release is published in Community Harbor."
            : "This exact release is already submitted to Community Harbor for moderation.",
      };
    }
  }
  const scanned = await scanCommunityPackageFiles(review.projection.files);
  assertTrustedCommunityScanReceipts(scanned.receipts);
  assertPublicationScanStatus(scanned.result, review.projection.files);
  const listingId = review.input.listingId ?? randomUUID();
  const releaseId = randomUUID();
  const packageId = randomUUID();
  const existingCount = review.input.listingId ? await db.communityRelease.count({ where: { listingId } }) : 0;
  const semanticVersion = `${existingCount + 1}.0.0`;
  const manifest = spatialPackageManifest({
    packageId,
    releaseId,
    semanticVersion,
    license: review.license,
    attribution: review.attribution,
    projection: review.projection,
  });
  const checksum = packageChecksum(manifest);
  const publicationManifest = {
    schemaVersion: 1,
    sourceKind: review.input.source.kind,
    sourceId: review.input.source.id,
    sourceRevision: review.input.source.revision,
    sourceChecksum: review.projection.sourceChecksum,
    reviewDigest: review.reviewDigest,
    packageChecksum: checksum,
    publicMetadata: {
      title: review.listingInput.title,
      shortDescription: review.listingInput.shortDescription,
      category: review.projection.category,
      spoilerLevel: review.listingInput.spoilerLevel,
    },
  };
  const result = await db.$transaction(async (tx) => {
    const listing = review.input.listingId
      ? await tx.communityListing.findFirst({ where: { id: listingId, ownerProfileId: review.profile.id } })
      : null;
    if (review.input.listingId && !listing)
      throw new CommunityError("COMMUNITY_ACCESS_DENIED", "The target listing is no longer available.");
    if (listing && !["PUBLISHED", "REJECTED", "DRAFT"].includes(listing.publicationStatus))
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "This listing is already awaiting review.");
    if (listing && (await tx.communityRelease.count({ where: { listingId } })) !== existingCount)
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "A newer release was created. Review the listing again.");
    const submissionStatus = listing?.publicationStatus === "PUBLISHED" ? "UPDATE_PENDING" : "READY_FOR_REVIEW";
    const target = listing
      ? await tx.communityListing.update({
          where: { id: listingId },
          data: {
            title: review.listingInput.title,
            primaryCategory: review.projection.category,
            shortDescription: review.listingInput.shortDescription,
            longDescription: review.listingInput.longDescription,
            visibility: review.listingInput.visibility,
            locationClass: review.listingInput.locationClass,
            tags: JSON.stringify(review.listingInput.tags),
            publicationStatus: submissionStatus,
          },
        })
      : await tx.communityListing.create({
          data: {
            id: listingId,
            ownerProfileId: review.profile.id,
            ...review.listingInput,
            primaryCategory: review.projection.category,
            tags: JSON.stringify(review.listingInput.tags),
            publicationStatus: "READY_FOR_REVIEW",
          },
        });
    await tx.communityRelease.create({
      data: {
        id: releaseId,
        listingId,
        semanticVersion,
        manifestSchemaVersion: 1,
        manifest: JSON.stringify(publicationManifest),
        manifestChecksum: sha256(stableJson(publicationManifest)),
        packageChecksum: checksum,
        compatibility: JSON.stringify({
          requiredParallaxVersion: "PARALLAX_2",
          dependencies: review.projection.dependencies,
        }),
        licenseSnapshot: JSON.stringify({
          key: review.policy.key,
          version: review.policy.policyVersion,
          allowsModification: review.policy.allowsModification,
          allowsPublicUse: review.policy.allowsPublicUse,
          allowsCommercialUse: review.policy.allowsCommercialUse,
          requiresAttribution: review.policy.requiresAttribution,
          shareAlike: review.policy.shareAlike,
        }),
        attributionSnapshot: JSON.stringify(review.attribution),
        spoilerSnapshot: JSON.stringify({ level: "NONE" }),
        publishedByProfileId: review.profile.id,
        attributions: {
          create: review.attribution.map((credit, sortOrder) => ({
            creditedDisplayName: credit.displayName,
            contributionType: credit.contributionType,
            sortOrder,
          })),
        },
      },
    });
    await tx.communityPackage.create({
      data: {
        id: packageId,
        releaseId,
        packageSchema: 1,
        packageChecksum: checksum,
        manifest: JSON.stringify(manifest),
        byteLength: review.projection.files.reduce((sum, file) => sum + file.bytes.byteLength, 0),
        storageStatus: "READY",
        scanStatus: scanned.result,
        finalizedAt: new Date(),
      },
    });
    await tx.communityPackageItem.createMany({
      data: manifest.items.map((item) => ({
        packageId,
        logicalId: item.id,
        itemType: item.type,
        relativePath: item.path,
        checksum: item.checksum,
        mediaType: item.mediaType,
        byteLength: item.byteLength,
        metadata: new TextDecoder().decode(review.projection.files.find((file) => file.path === item.path)!.bytes),
        accessibility: JSON.stringify(item.accessibility ?? {}),
      })),
    });
    await tx.communityOwnershipDeclaration.create({
      data: {
        listingId,
        releaseId,
        declarantProfileId: review.profile.id,
        declarationVersion: 1,
        acceptedStatements: JSON.stringify([
          "I own or have permission to distribute every included item.",
          "I reviewed the exact public package and its Environment privacy implications.",
        ]),
      },
    });
    await tx.communityOutboxEvent.create({
      data: {
        eventType: "COMMUNITY_RELEASE_CREATED",
        aggregateType: "COMMUNITY_RELEASE",
        aggregateId: releaseId,
        payload: JSON.stringify({ listingId, packageId, semanticVersion }),
        idempotencyKey: `COMMUNITY_RELEASE_CREATED:${releaseId}`,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "USER_ACCOUNT",
        actorId: accountId,
        action: "COMMUNITY_SPATIAL_PUBLICATION_SUBMITTED",
        resourceType: "COMMUNITY_LISTING",
        resourceId: listingId,
        correlationId: randomUUID(),
        metadata: JSON.stringify({ releaseId, sourceKind: review.input.source.kind }),
      },
    });
    await tx.communityListing.update({ where: { id: target.id }, data: { currentReleaseId: releaseId } });
    return { listingId, releaseId, packageId, semanticVersion, publicationStatus: submissionStatus };
  });
  return {
    ...result,
    listingUrl: `/community/${review.input.slug}`,
    message:
      result.publicationStatus === "UPDATE_PENDING"
        ? "A new immutable release was submitted to Community Harbor for moderation."
        : "Submitted to Community Harbor for moderation. The listing becomes public after approval.",
  };
}
