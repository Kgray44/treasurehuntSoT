import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import { copyCreatorReusableEnvelope, verifyCreatorReusablePackage } from "./creator-reusable-publication";

async function loadRelease(listingId: string) {
  const listing = await db.communityListing.findFirst({
    where: {
      id: listingId,
      itemType: { in: ["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"] },
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "UNLISTED"] },
      moderationStatus: "ACTIVE",
      archivedAt: null,
      removedAt: null,
      owner: { visibility: "COMMUNITY", moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
    },
    include: { owner: true, currentRelease: true },
  });
  const release = listing?.currentRelease;
  if (!listing || !release || release.moderationStatus !== "ACTIVE" || release.deprecatedAt)
    throw new CommunityError("COMMUNITY_LISTING_NOT_FOUND", "This Creator release is unavailable for installation.");
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    !record.finalizedAt ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The pinned package is not finalized and clean.");
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  if (rows.length !== 1 || rows[0].itemType !== listing.itemType)
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The package content set is incomplete.");
  const item = rows[0];
  const verified = verifyCreatorReusablePackage({
    releaseId: release.id,
    releaseManifest: release.manifest,
    releaseManifestChecksum: release.manifestChecksum,
    packageChecksum: release.packageChecksum,
    packageId: record.id,
    packageManifest: record.manifest,
    packageRecordChecksum: record.packageChecksum,
    itemMetadata: item.metadata,
    itemChecksum: item.checksum,
    itemType: item.itemType,
    itemPath: item.relativePath,
    itemMediaType: item.mediaType,
    itemByteLength: item.byteLength,
  });
  const license = JSON.parse(release.licenseSnapshot) as {
    key?: string;
    version?: number;
    allowsPrivateUse?: boolean;
    allowsModification?: boolean;
    requiresAttribution?: boolean;
  };
  if (
    !license.allowsPrivateUse ||
    license.key !== verified.manifest.license.key ||
    license.version !== verified.manifest.license.version
  )
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "This release does not permit private Creator reuse.");
  return { listing, release, record, verified, license };
}

async function installedTarget(accountId: string, releaseId: string) {
  const installation = await db.communityInstallation.findFirst({
    where: { accountId, releaseId, mode: "LIBRARY_REFERENCE" },
  });
  if (!installation) return null;
  const mapping = await db.communityInstallMapping.findFirst({
    where: { operationId: installation.operationId, sourceId: "creator-item" },
  });
  const target = mapping
    ? await db.reusableAuthoringItem.findFirst({
        where: { id: mapping.targetId, ownerAccountId: accountId, status: "INSTALLED_READ_ONLY", archivedAt: null },
      })
    : null;
  if (!target) throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The pinned private Creator item is missing.");
  return { installation, target };
}

export async function reviewCreatorReusableInstallation(accountId: string, listingId: string) {
  const source = await loadRelease(listingId);
  const prior = await installedTarget(accountId, source.release.id);
  if (
    prior &&
    (prior.installation.packageId !== source.record.id ||
      prior.installation.installedPackageChecksum !== source.record.packageChecksum)
  )
    throw new CommunityError(
      "COMMUNITY_INSTALLATION_STALE",
      "The existing installation no longer matches this release.",
    );
  return {
    listingId,
    title: source.listing.title,
    itemType: source.listing.itemType,
    creator: source.listing.owner.displayName,
    releaseId: source.release.id,
    semanticVersion: source.release.semanticVersion,
    packageChecksum: source.record.packageChecksum,
    license: source.license,
    attribution: source.verified.manifest.attribution,
    included: { name: source.verified.envelope.name, description: source.verified.envelope.description },
    alreadyInstalled: Boolean(prior),
    itemId: prior?.target.id ?? null,
    studioUrl: prior ? "/studio/library" : null,
  };
}

export async function installCreatorReusableRelease(input: {
  accountId: string;
  listingId: string;
  releaseId: string;
  packageChecksum: string;
  requestId: string;
}) {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(input.requestId))
    throw new CommunityError("COMMUNITY_INVALID_REQUEST", "Use a unique installation request identifier.");
  const account = await db.userAccount.findUnique({ where: { id: input.accountId }, select: { status: true } });
  if (account?.status !== "ACTIVE")
    throw new CommunityError("COMMUNITY_ACCESS_DENIED", "An active Creator account is required.");
  const source = await loadRelease(input.listingId);
  if (source.release.id !== input.releaseId || source.record.packageChecksum !== input.packageChecksum)
    throw new CommunityError(
      "COMMUNITY_REVIEW_STALE",
      "The release changed. Review its current package before installing.",
    );
  const prior = await installedTarget(input.accountId, input.releaseId);
  if (prior) return { status: "ALREADY_INSTALLED" as const, itemId: prior.target.id, releaseId: input.releaseId };
  const itemId = randomUUID();
  const versionId = randomUUID();
  const operationId = randomUUID();
  const envelope = copyCreatorReusableEnvelope(
    source.verified.envelope,
    input.accountId,
    itemId,
    versionId,
    source.release.id,
    source.license.key!,
  );
  return db.$transaction(async (tx) => {
    const existing = await tx.communityInstallOperation.findUnique({
      where: { accountId_requestId: { accountId: input.accountId, requestId: input.requestId } },
    });
    if (existing) {
      if (existing.releaseId !== input.releaseId || existing.packageId !== source.record.id)
        throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "This request was used for another release.");
      const mapping = await tx.communityInstallMapping.findFirst({
        where: { operationId: existing.id, sourceId: "creator-item" },
      });
      if (!mapping) throw new CommunityError("COMMUNITY_INSTALLATION_STALE", "The prior installation is incomplete.");
      return { status: "ALREADY_INSTALLED" as const, itemId: mapping.targetId, releaseId: input.releaseId };
    }
    const stillPublic = await tx.communityListing.findFirst({
      where: {
        id: input.listingId,
        currentReleaseId: input.releaseId,
        publicationStatus: "PUBLISHED",
        moderationStatus: "ACTIVE",
        archivedAt: null,
        removedAt: null,
      },
    });
    if (!stillPublic) throw new CommunityError("COMMUNITY_REVIEW_STALE", "This release is no longer public.");
    await tx.reusableAuthoringItem.create({
      data: {
        id: itemId,
        ownerAccountId: input.accountId,
        kind: envelope.kind,
        name: envelope.name,
        description: envelope.description,
        tags: JSON.stringify(envelope.tags),
        status: "INSTALLED_READ_ONLY",
        currentVersionNumber: 1,
        versions: {
          create: { id: versionId, versionNumber: 1, envelope: JSON.stringify(envelope), checksum: envelope.checksum },
        },
      },
    });
    await tx.communityInstallOperation.create({
      data: {
        id: operationId,
        requestId: input.requestId,
        idempotencyKey: `CREATOR_REUSABLE:${input.accountId}:${input.requestId}`,
        packageId: source.record.id,
        releaseId: input.releaseId,
        accountId: input.accountId,
        mode: "LIBRARY_REFERENCE",
        status: "COMMITTED",
        destinationRevision: "NEW_LIBRARY_ENTRY",
        plan: JSON.stringify({
          sourceItemId: source.verified.envelope.itemId,
          targetItemId: itemId,
          packageChecksum: source.record.packageChecksum,
        }),
        completedAt: new Date(),
      },
    });
    await tx.communityInstallMapping.create({
      data: {
        operationId,
        sourceId: "creator-item",
        targetId: itemId,
        kind: envelope.kind,
      },
    });
    await tx.communityInstallation.create({
      data: {
        accountId: input.accountId,
        packageId: source.record.id,
        releaseId: input.releaseId,
        operationId,
        mode: "LIBRARY_REFERENCE",
        installedPackageChecksum: source.record.packageChecksum,
        upstreamReleaseId: input.releaseId,
      },
    });
    return { status: "COMMITTED" as const, itemId, releaseId: input.releaseId };
  });
}
