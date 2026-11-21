import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { CommunityError, stableJson } from "./domain";
import { requireModerator, type CommunityModeratorActor } from "./moderation";
import { sha256 } from "./package";
import { verifyCreatorReusablePackage } from "./creator-reusable-publication";

export const creatorReusableApprovalSchema = z.strictObject({
  releaseId: z.string().min(1),
  packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  packageReviewed: z.literal(true),
});

async function loadCandidate(listingId: string) {
  const listing = await db.communityListing.findUnique({
    where: { id: listingId },
    include: { owner: true, currentRelease: true },
  });
  const release = listing?.currentRelease;
  if (
    !listing ||
    !release ||
    !["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"].includes(listing.itemType) ||
    !["READY_FOR_REVIEW", "IN_REVIEW"].includes(listing.publicationStatus) ||
    listing.visibility !== "COMMUNITY" ||
    listing.moderationStatus !== "ACTIVE" ||
    listing.owner.moderationStatus !== "ACTIVE" ||
    listing.owner.creatorStatus === "SUSPENDED" ||
    listing.archivedAt ||
    listing.removedAt ||
    release.moderationStatus !== "ACTIVE" ||
    release.deprecatedAt
  )
    throw new CommunityError("COMMUNITY_REVIEW_UNAVAILABLE", "This Creator release is not awaiting review.");
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    !record.finalizedAt ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The Creator package is not finalized and clean.");
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  if (rows.length !== 1 || rows[0].itemType !== listing.itemType)
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The Creator package content set is incomplete.");
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
    displayName?: string;
    version?: number;
    allowsPrivateUse?: boolean;
    allowsPublicUse?: boolean;
    allowsRedistribution?: boolean;
  };
  if (
    !license.allowsPrivateUse ||
    !license.allowsPublicUse ||
    !license.allowsRedistribution ||
    license.key !== verified.manifest.license.key ||
    license.version !== verified.manifest.license.version
  )
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "The release license is not valid for Community reuse.");
  const declaration = await db.communityOwnershipDeclaration.findFirst({
    where: { listingId, releaseId: release.id, declarantProfileId: listing.ownerProfileId },
  });
  if (!declaration || verified.envelope.attribution.sourceOwnerId !== listing.owner.accountId)
    throw new CommunityError(
      "COMMUNITY_OWNERSHIP_UNVERIFIED",
      "The release has no matching source ownership declaration.",
    );
  let statements: string[];
  try {
    statements = z.array(z.string()).parse(JSON.parse(declaration.acceptedStatements));
  } catch {
    throw new CommunityError("COMMUNITY_OWNERSHIP_UNVERIFIED", "The ownership declaration is invalid.");
  }
  if (
    !statements.includes("I own or have permission to distribute the included Creator item.") ||
    !statements.includes("I reviewed the exact content, license, and attribution for public distribution.") ||
    listing.spoilerLevel !== "NONE" ||
    release.spoilerSnapshot !== JSON.stringify({ level: "NONE" })
  )
    throw new CommunityError("COMMUNITY_OWNERSHIP_UNVERIFIED", "The Creator rights or spoiler declaration changed.");
  if (sha256(stableJson(verified.manifest.attribution)) !== sha256(stableJson(JSON.parse(release.attributionSnapshot))))
    throw new CommunityError(
      "COMMUNITY_ATTRIBUTION_MISMATCH",
      "The release credits do not match the reviewed package.",
    );
  return { listing, release, record, item, verified, license, statements };
}

export async function reviewCreatorReusablePublication(actor: CommunityModeratorActor, listingId: string) {
  requireModerator(actor);
  const candidate = await loadCandidate(listingId);
  if (actor.accountId === candidate.listing.owner.accountId)
    throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot approve their own release.");
  return {
    listingId,
    releaseId: candidate.release.id,
    packageChecksum: candidate.record.packageChecksum,
    itemType: candidate.listing.itemType,
    title: candidate.listing.title,
    description: candidate.listing.longDescription,
    included: candidate.verified.envelope,
    license: candidate.license,
    ownershipStatements: candidate.statements,
    spoilerLevel: candidate.listing.spoilerLevel,
    attribution: candidate.verified.manifest.attribution,
  };
}

export async function approveCreatorReusablePublication(
  actor: CommunityModeratorActor,
  listingId: string,
  raw: unknown,
) {
  const input = creatorReusableApprovalSchema.parse(raw);
  const candidate = await loadCandidate(listingId);
  requireModerator(actor);
  if (actor.accountId === candidate.listing.owner.accountId)
    throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot approve their own release.");
  if (input.releaseId !== candidate.release.id || input.packageChecksum !== candidate.record.packageChecksum)
    throw new CommunityError("COMMUNITY_REVIEW_STALE", "The release changed after moderation review.");
  return db.$transaction(async (tx) => {
    const changed = await tx.communityListing.updateMany({
      where: {
        id: listingId,
        currentReleaseId: input.releaseId,
        publicationStatus: { in: ["READY_FOR_REVIEW", "IN_REVIEW"] },
        moderationStatus: "ACTIVE",
      },
      data: { publicationStatus: "PUBLISHED", publishedAt: new Date() },
    });
    if (changed.count !== 1)
      throw new CommunityError("COMMUNITY_REVIEW_STALE", "The submission changed before approval.");
    await tx.communityOutboxEvent.create({
      data: {
        eventType: "COMMUNITY_RELEASE_PUBLISHED",
        aggregateType: "COMMUNITY_RELEASE",
        aggregateId: input.releaseId,
        payload: JSON.stringify({ listingId, releaseId: input.releaseId }),
        idempotencyKey: `COMMUNITY_CREATOR_RELEASE_PUBLISHED:${input.releaseId}`,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "USER_ACCOUNT",
        actorId: actor.accountId,
        action: "COMMUNITY_CREATOR_RELEASE_APPROVED",
        resourceType: "COMMUNITY_LISTING",
        resourceId: listingId,
        correlationId: randomUUID(),
        metadata: JSON.stringify({ releaseId: input.releaseId, packageChecksum: input.packageChecksum }),
      },
    });
    return { listingId, releaseId: input.releaseId, publicationStatus: "PUBLISHED" as const };
  });
}
