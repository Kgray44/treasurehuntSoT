import { randomUUID } from "node:crypto";
import { z } from "zod";
import { writeAdministrativeAudit } from "@/admiralty/audit";
import { db } from "@/lib/db";
import { CommunityError, assertTransition, stableJson } from "./domain";
import { requireModerator, type CommunityModeratorActor } from "./moderation";
import { communityPackageManifestSchema, sha256, verifyCommunityPackage, type CommunityPackageFile } from "./package";

const spatialTypes = ["SPATIAL_ASSET", "SPATIAL_SCENE", "SPATIAL_ENVIRONMENT"] as const;
const pendingStates = ["READY_FOR_REVIEW", "IN_REVIEW", "UPDATE_PENDING"] as const;

export const spatialModerationApprovalSchema = z.strictObject({
  releaseId: z.string().min(1).max(128),
  packageChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  packageReviewed: z.literal(true),
});

async function loadCandidate(listingId: string) {
  const listing = await db.communityListing.findUnique({
    where: { id: listingId },
    include: { owner: true, currentRelease: true },
  });
  if (
    !listing ||
    !spatialTypes.includes(listing.itemType as (typeof spatialTypes)[number]) ||
    !pendingStates.includes(listing.publicationStatus as (typeof pendingStates)[number]) ||
    listing.moderationStatus !== "ACTIVE" ||
    listing.archivedAt ||
    listing.removedAt ||
    listing.owner.moderationStatus !== "ACTIVE" ||
    listing.owner.creatorStatus === "SUSPENDED" ||
    !listing.currentRelease ||
    listing.currentRelease.moderationStatus !== "ACTIVE"
  )
    throw new CommunityError("COMMUNITY_SPATIAL_REVIEW_UNAVAILABLE", "This spatial release is not awaiting review.");

  const release = listing.currentRelease;
  const record = await db.communityPackage.findUnique({ where: { releaseId: release.id } });
  if (
    !record ||
    record.storageStatus !== "READY" ||
    record.scanStatus !== "CLEAN" ||
    record.packageChecksum !== release.packageChecksum
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_RECEIPT_INVALID",
      "The spatial release package is not finalized and clean.",
    );
  const rows = await db.communityPackageItem.findMany({ where: { packageId: record.id } });
  const files: CommunityPackageFile[] = rows.map((item) => ({
    path: item.relativePath,
    mediaType: item.mediaType,
    bytes: new TextEncoder().encode(item.metadata),
  }));
  if (
    files.some((file) => file.mediaType !== "application/json") ||
    files.some((file) => !["items/spatial.json", "items/environment.json"].includes(file.path))
  )
    throw new CommunityError(
      "COMMUNITY_PACKAGE_FORBIDDEN_CONTENT",
      "Spatial moderation accepts reviewed JSON content only.",
    );
  const expectedPaths =
    listing.itemType === "SPATIAL_ENVIRONMENT"
      ? ["items/environment.json"]
      : listing.itemType === "SPATIAL_SCENE"
        ? ["items/environment.json", "items/spatial.json"]
        : ["items/spatial.json"];
  if (files.length !== expectedPaths.length || expectedPaths.some((path) => !files.some((file) => file.path === path)))
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The spatial package content set is incomplete.");
  const manifest = communityPackageManifestSchema.parse(JSON.parse(record.manifest));
  const verified = verifyCommunityPackage(manifest, files);
  const releaseManifest = JSON.parse(release.manifest) as { sourceId?: string; sourceKind?: string };
  if (
    manifest.releaseId !== release.id ||
    manifest.packageId !== record.id ||
    verified.checksum !== record.packageChecksum ||
    release.manifestChecksum !== sha256(stableJson(releaseManifest)) ||
    releaseManifest.sourceId === undefined ||
    releaseManifest.sourceKind === undefined
  )
    throw new CommunityError("COMMUNITY_PACKAGE_RECEIPT_INVALID", "The spatial release does not match its package.");
  const license = JSON.parse(release.licenseSnapshot) as {
    key?: string;
    version?: number;
    allowsPublicUse?: boolean;
  };
  if (!license.allowsPublicUse || license.key !== manifest.license.key || license.version !== manifest.license.version)
    throw new CommunityError(
      "COMMUNITY_LICENSE_INCOMPATIBLE",
      "The spatial release license is not valid for public use.",
    );
  const declaration = await db.communityOwnershipDeclaration.findFirst({
    where: { listingId, releaseId: release.id, declarantProfileId: listing.ownerProfileId },
  });
  if (!declaration)
    throw new CommunityError("COMMUNITY_OWNERSHIP_UNVERIFIED", "The release has no matching ownership declaration.");
  return { listing, release, record, manifest, files, declaration };
}

function authorize(actor: CommunityModeratorActor, ownerAccountId: string) {
  requireModerator(actor);
  if (actor.accountId === ownerAccountId)
    throw new CommunityError("COMMUNITY_SELF_MODERATION_FORBIDDEN", "A moderator cannot approve their own release.");
}

export async function reviewSpatialPublicationForModeration(actor: CommunityModeratorActor, listingId: string) {
  requireModerator(actor);
  const candidate = await loadCandidate(listingId);
  authorize(actor, candidate.listing.owner.accountId);
  return {
    listingId,
    slug: candidate.listing.slug,
    title: candidate.listing.title,
    description: candidate.listing.longDescription ?? candidate.listing.shortDescription ?? "",
    tags: z.array(z.string()).parse(JSON.parse(candidate.listing.tags)),
    locationClass: candidate.listing.locationClass,
    category: candidate.listing.primaryCategory,
    itemType: candidate.listing.itemType,
    publicationStatus: candidate.listing.publicationStatus,
    creator: candidate.listing.owner.displayName,
    releaseId: candidate.release.id,
    semanticVersion: candidate.release.semanticVersion,
    packageChecksum: candidate.record.packageChecksum,
    license: candidate.manifest.license,
    attribution: candidate.manifest.attribution,
    rightsDeclaration: z.array(z.string()).parse(JSON.parse(candidate.declaration.acceptedStatements)),
    included: candidate.files.map((file) => ({
      path: file.path,
      preview: JSON.parse(new TextDecoder().decode(file.bytes)),
    })),
    warnings: candidate.files.some((file) => file.path === "items/environment.json")
      ? ["A layout can remain sensitive even when photographs are absent. Review the full geometry before approval."]
      : [],
  };
}

export async function approveSpatialPublication(
  actor: CommunityModeratorActor & { authorizationBasis: string; accountSessionId?: string },
  listingId: string,
  raw: unknown,
) {
  const input = spatialModerationApprovalSchema.parse(raw);
  const candidate = await loadCandidate(listingId);
  authorize(actor, candidate.listing.owner.accountId);
  if (candidate.release.id !== input.releaseId || candidate.record.packageChecksum !== input.packageChecksum)
    throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The release changed. Review the current package again.");

  const now = new Date();
  const correlationId = randomUUID();
  return db.$transaction(async (tx) => {
    const current = await tx.communityListing.findUnique({ where: { id: listingId } });
    if (
      !current ||
      current.currentReleaseId !== input.releaseId ||
      current.publicationStatus !== candidate.listing.publicationStatus ||
      current.moderationStatus !== "ACTIVE"
    )
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The listing changed. Review the current release again.");
    if (current.publicationStatus === "READY_FOR_REVIEW") {
      assertTransition("READY_FOR_REVIEW", "IN_REVIEW");
      assertTransition("IN_REVIEW", "PUBLISHED");
    } else if (current.publicationStatus === "IN_REVIEW") {
      assertTransition("IN_REVIEW", "PUBLISHED");
    } else {
      assertTransition("UPDATE_PENDING", "PUBLISHED");
    }
    const changed = await tx.communityListing.updateMany({
      where: {
        id: listingId,
        currentReleaseId: input.releaseId,
        publicationStatus: current.publicationStatus,
        moderationStatus: "ACTIVE",
      },
      data: { publicationStatus: "PUBLISHED", publishedAt: now },
    });
    if (changed.count !== 1)
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The listing changed during approval.");
    await tx.communityRelease.update({ where: { id: input.releaseId }, data: { publishedAt: now } });
    await tx.communityOutboxEvent.create({
      data: {
        eventType: "COMMUNITY_PUBLICATION_STATE_CHANGED",
        aggregateType: "COMMUNITY_LISTING",
        aggregateId: listingId,
        payload: JSON.stringify({ status: "PUBLISHED", releaseId: input.releaseId }),
        idempotencyKey: `COMMUNITY_SPATIAL_RELEASE_APPROVED:${input.releaseId}`,
      },
    });
    await writeAdministrativeAudit(
      {
        actorAccountId: actor.accountId,
        actorRole: actor.roles.includes("ADMINISTRATOR") ? "ADMINISTRATOR" : "MODERATOR",
        capability: "COMMUNITY_MODERATE",
        action: "COMMUNITY_SPATIAL_RELEASE_APPROVED",
        targetType: "CommunityRelease",
        targetId: input.releaseId,
        reason: "Reviewed the exact spatial package, rights declaration, license and privacy warnings.",
        authorizationBasis: actor.authorizationBasis,
        accountSessionId: actor.accountSessionId,
        correlationId,
        beforeSummary: { publicationStatus: current.publicationStatus },
        afterSummary: { publicationStatus: "PUBLISHED" },
      },
      tx,
    );
    return { listingId, releaseId: input.releaseId, publicationStatus: "PUBLISHED" as const, correlationId };
  });
}
