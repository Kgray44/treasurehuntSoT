import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { CommunityError, type listingInputSchema } from "./domain";

type Listing = z.output<typeof listingInputSchema>;
type TargetInput = {
  listingId?: string;
  slug: string;
  itemType: Listing["itemType"];
  ownerProfileId: string;
  sourceId: string;
  sourceVersionId: string;
};

export async function resolveCreatorPublicationTarget(
  client: Pick<Prisma.TransactionClient, "communityListing" | "communityRelease">,
  input: TargetInput,
) {
  const listing = await client.communityListing.findUnique({
    where: { slug: input.slug },
    include: { currentRelease: { include: { sourcePublishedTaleVersion: { select: { taleId: true } } } } },
  });
  if (!input.listingId) {
    if (listing) throw new CommunityError("COMMUNITY_SLUG_TAKEN", "This Community address is already in use.");
    return null;
  }
  const release = listing?.currentRelease;
  if (
    !listing ||
    listing.id !== input.listingId ||
    listing.ownerProfileId !== input.ownerProfileId ||
    listing.itemType !== input.itemType ||
    !release
  )
    throw new CommunityError(
      "COMMUNITY_SOURCE_NOT_OWNED",
      "Select a Community submission you own with this same address and content type.",
    );
  if (
    !["PUBLISHED", "REJECTED"].includes(listing.publicationStatus) ||
    listing.archivedAt ||
    listing.removedAt ||
    listing.moderationStatus !== "ACTIVE" ||
    release.moderationStatus !== "ACTIVE"
  )
    throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "This listing is unavailable for a replacement submission.");
  let sourceId = release.sourcePublishedTaleVersion?.taleId;
  let sourceVersionId = release.sourcePublishedTaleVersionId;
  if (input.itemType !== "CHRONICLE") {
    try {
      const manifest = JSON.parse(release.manifest) as { sourceId?: string; sourceVersionId?: string };
      sourceId = manifest.sourceId;
      sourceVersionId = manifest.sourceVersionId ?? null;
    } catch {
      throw new CommunityError("COMMUNITY_SOURCE_CONFLICT", "The previous release has no verified source.");
    }
  }
  if (sourceId !== input.sourceId || !sourceVersionId)
    throw new CommunityError(
      "COMMUNITY_SOURCE_CONFLICT",
      "A replacement must come from the same saved Creator source.",
    );
  if (listing.publicationStatus === "PUBLISHED" && sourceVersionId === input.sourceVersionId)
    throw new CommunityError(
      "COMMUNITY_SOURCE_CONFLICT",
      "Save a newer source version before replacing an approved release.",
    );
  const count = await client.communityRelease.count({ where: { listingId: listing.id } });
  return {
    listingId: listing.id,
    releaseId: release.id,
    state: listing.publicationStatus,
    semanticVersion: `${count + 1}.0.0`,
  };
}

export async function stageCreatorPublicationListing(
  tx: Prisma.TransactionClient,
  targetInput: TargetInput,
  target: Awaited<ReturnType<typeof resolveCreatorPublicationTarget>>,
  listing: Listing,
  listingId: string,
) {
  const current = await resolveCreatorPublicationTarget(tx, targetInput);
  if (
    current?.releaseId !== target?.releaseId ||
    current?.state !== target?.state ||
    current?.semanticVersion !== target?.semanticVersion
  )
    throw new CommunityError("COMMUNITY_REVIEW_STALE", "The target listing changed. Review the replacement again.");
  const publicationStatus = target?.state === "PUBLISHED" ? "UPDATE_PENDING" : "READY_FOR_REVIEW";
  const data = { ...listing, tags: JSON.stringify(listing.tags), publicationStatus };
  if (!target) {
    await tx.communityListing.create({ data: { ...data, id: listingId, ownerProfileId: targetInput.ownerProfileId } });
  } else {
    const changed = await tx.communityListing.updateMany({
      where: {
        id: target.listingId,
        currentReleaseId: target.releaseId,
        publicationStatus: target.state,
        moderationStatus: "ACTIVE",
        archivedAt: null,
        removedAt: null,
      },
      data,
    });
    if (changed.count !== 1)
      throw new CommunityError("COMMUNITY_REVIEW_STALE", "The target listing changed during submission.");
  }
  return publicationStatus;
}
