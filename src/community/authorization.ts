import { db } from "@/lib/db";
import { CommunityError } from "./domain";
import type { CommunityActor } from "./services";

export async function canViewCommunityListing(actor: CommunityActor | null, listingId: string, unlistedSlug?: string) {
  const listing = await db.communityListing.findUnique({ where: { id: listingId }, include: { currentRelease: true } });
  if (!listing || listing.moderationStatus !== "ACTIVE" || listing.publicationStatus !== "PUBLISHED") return false;
  const profile = actor
    ? await db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } })
    : null;
  if (profile?.id === listing.ownerProfileId || actor?.role === "MODERATOR" || actor?.role === "ADMIN") return true;
  if (listing.visibility === "COMMUNITY" || listing.visibility === "FEATURED") return true;
  if (listing.visibility === "UNLISTED") return Boolean(unlistedSlug && unlistedSlug === listing.slug);
  if (listing.visibility !== "CREW_ONLY" || !actor || !listing.currentRelease?.sourcePublishedTaleVersionId)
    return false;
  const source = await db.publishedTaleVersion.findUnique({
    where: { id: listing.currentRelease.sourcePublishedTaleVersionId },
    select: { taleId: true },
  });
  return Boolean(
    source &&
      (await db.playthroughMembership.findFirst({
        where: {
          playerProfileId: actor.playerProfileId,
          status: { in: ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
          playthrough: { taleId: source.taleId },
        },
        select: { id: true },
      })),
  );
}
export async function requireListingOwner(actor: CommunityActor, listingId: string) {
  const profile = await db.communityProfile.findUnique({ where: { playerProfileId: actor.playerProfileId } });
  const allowed =
    profile &&
    (await db.communityListing.findFirst({
      where: { id: listingId, ownerProfileId: profile.id },
      select: { id: true },
    }));
  if (!allowed) throw new CommunityError("COMMUNITY_ACCESS_DENIED", "You cannot access this listing.");
  return profile;
}
