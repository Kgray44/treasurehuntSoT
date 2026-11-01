import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { publishedSourceChecksum } from "@/chronicle/snapshot";
import { CommunityError, stableJson } from "./domain";
import { requireModerator, type CommunityModeratorActor } from "./moderation";
import { sha256 } from "./package";
import { verifyCreatorChroniclePackage } from "./creator-chronicle-publication";

export const creatorChronicleApprovalSchema = z.strictObject({
  releaseId: z.string().min(1),
  packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  packageReviewed: z.literal(true),
});

export async function loadCreatorChronicleCandidate(listingId: string, pendingOnly = true) {
  const listing = await db.communityListing.findUnique({
    where: { id: listingId },
    include: { owner: true, currentRelease: true },
  });
  const release = listing?.currentRelease;
  if (
    !listing ||
    !release ||
    listing.itemType !== "CHRONICLE" ||
    (pendingOnly
      ? !["READY_FOR_REVIEW", "IN_REVIEW"].includes(listing.publicationStatus)
      : listing.publicationStatus !== "PUBLISHED") ||
    listing.visibility !== "COMMUNITY" ||
    listing.moderationStatus !== "ACTIVE" ||
    listing.owner.moderationStatus !== "ACTIVE" ||
    listing.owner.creatorStatus === "SUSPENDED" ||
    listing.archivedAt ||
    listing.removedAt ||
    release.moderationStatus !== "ACTIVE" ||
    release.deprecatedAt
  )
    throw new CommunityError("COMMUNITY_REVIEW_UNAVAILABLE", "This Chronicle release is unavailable.");
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    !record.finalizedAt ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The Chronicle package is not finalized and clean.");
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  if (rows.length !== 1 || rows[0].itemType !== "CHRONICLE")
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The Chronicle package content set is incomplete.");
  const item = rows[0];
  const verified = verifyCreatorChroniclePackage({
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
    sourceVersionId: release.sourcePublishedTaleVersionId,
  });
  const source = release.sourcePublishedTaleVersionId
    ? await db.publishedTaleVersion.findUnique({
        where: { id: release.sourcePublishedTaleVersionId },
        include: { drydockPublishingEvidence: { select: { digest: true, sourceChecksum: true } } },
      })
    : null;
  if (
    !source ||
    source.taleId !== verified.snapshot.tale.id ||
    source.checksum !== publishedSourceChecksum(verified.snapshot) ||
    (source.contentSnapshot !== item.metadata &&
      sha256(stableJson(JSON.parse(source.contentSnapshot))) !== item.checksum) ||
    source.drydockPublishingEvidence?.sourceChecksum !== source.checksum ||
    source.drydockPublishingEvidence.digest !== verified.releaseManifest.evidenceDigest
  )
    throw new CommunityError(
      "COMMUNITY_SOURCE_VERSION_MISMATCH",
      "The Chronicle package lost its immutable Drydock source.",
    );
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
    throw new CommunityError("COMMUNITY_LICENSE_INCOMPATIBLE", "The release license does not permit Community reuse.");
  const declaration = await db.communityOwnershipDeclaration.findFirst({
    where: {
      listingId,
      releaseId: release.id,
      declarantProfileId: listing.ownerProfileId,
    },
  });
  if (!declaration || source.publishedByAccountId !== listing.owner.accountId)
    throw new CommunityError(
      "COMMUNITY_OWNERSHIP_UNVERIFIED",
      "The Chronicle source ownership declaration is missing.",
    );
  let statements: string[];
  try {
    statements = z.array(z.string()).parse(JSON.parse(declaration.acceptedStatements));
  } catch {
    throw new CommunityError("COMMUNITY_OWNERSHIP_UNVERIFIED", "The ownership declaration is invalid.");
  }
  if (
    !statements.includes("I own or may distribute every included Chronicle passage.") ||
    !statements.includes("I reviewed the entire package, license, attribution and spoiler implications.") ||
    listing.spoilerLevel !== "PREVIEW_SAFE" ||
    release.spoilerSnapshot !== JSON.stringify({ level: "PREVIEW_SAFE" })
  )
    throw new CommunityError("COMMUNITY_OWNERSHIP_UNVERIFIED", "The Chronicle rights or spoiler declaration changed.");
  if (sha256(stableJson(verified.manifest.attribution)) !== sha256(stableJson(JSON.parse(release.attributionSnapshot))))
    throw new CommunityError(
      "COMMUNITY_ATTRIBUTION_MISMATCH",
      "The release credits do not match the reviewed package.",
    );
  return { listing, release, record, source, verified, license, statements };
}

export async function reviewCreatorChroniclePublication(actor: CommunityModeratorActor, listingId: string) {
  requireModerator(actor);
  const candidate = await loadCreatorChronicleCandidate(listingId);
  if (actor.accountId === candidate.listing.owner.accountId)
    throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot approve their own release.");
  return {
    listingId,
    releaseId: candidate.release.id,
    packageChecksum: candidate.record.packageChecksum,
    title: candidate.listing.title,
    description: candidate.listing.longDescription,
    included: candidate.verified.snapshot,
    license: candidate.license,
    ownershipStatements: candidate.statements,
    spoilerLevel: candidate.listing.spoilerLevel,
    attribution: candidate.verified.manifest.attribution,
  };
}

export async function approveCreatorChroniclePublication(
  actor: CommunityModeratorActor,
  listingId: string,
  raw: unknown,
) {
  const input = creatorChronicleApprovalSchema.parse(raw);
  requireModerator(actor);
  const candidate = await loadCreatorChronicleCandidate(listingId);
  if (actor.accountId === candidate.listing.owner.accountId)
    throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot approve their own release.");
  if (input.releaseId !== candidate.release.id || input.packageChecksum !== candidate.record.packageChecksum)
    throw new CommunityError("COMMUNITY_REVIEW_STALE", "The Chronicle release changed after review.");
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
        idempotencyKey: `COMMUNITY_CHRONICLE_RELEASE_PUBLISHED:${input.releaseId}`,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "USER_ACCOUNT",
        actorId: actor.accountId,
        action: "COMMUNITY_CHRONICLE_RELEASE_APPROVED",
        resourceType: "COMMUNITY_LISTING",
        resourceId: listingId,
        correlationId: randomUUID(),
        metadata: JSON.stringify({ releaseId: input.releaseId, packageChecksum: input.packageChecksum }),
      },
    });
    return { listingId, releaseId: input.releaseId, publicationStatus: "PUBLISHED" as const };
  });
}
