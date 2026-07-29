import { db } from "@/lib/db";
import { CommunityError } from "./domain";

export type ModerationSubjectResolution = {
  type: string;
  id: string;
  ownerAccountId: string | null;
  tombstone: Record<string, string | boolean>;
};

/** Central resolver for the scalar polymorphic moderation subject pair. A
 * missing source is represented by a bounded tombstone rather than allowing a
 * caller to substitute another subject or silently lose the historical case. */
export async function resolveModerationSubject(type: string, id: string): Promise<ModerationSubjectResolution> {
  if (type === "LISTING") {
    const value = await db.communityListing.findUnique({ where: { id }, include: { owner: true } });
    if (value)
      return { type, id, ownerAccountId: value.owner.accountId, tombstone: { state: "LIVE", visibility: value.visibility } };
  } else if (type === "RELEASE") {
    const value = await db.communityRelease.findUnique({ where: { id }, include: { listing: { include: { owner: true } } } });
    if (value)
      return { type, id, ownerAccountId: value.listing.owner.accountId, tombstone: { state: "LIVE", status: value.moderationStatus } };
  } else if (type === "PROFILE" || type === "CREATOR") {
    const value = await db.communityProfile.findUnique({ where: { id } });
    if (value) return { type, id, ownerAccountId: value.accountId, tombstone: { state: "LIVE", status: value.moderationStatus } };
  } else if (type === "REVIEW") {
    const value = await db.communityReview.findUnique({ where: { id } });
    if (value) return { type, id, ownerAccountId: value.authorAccountId, tombstone: { state: "LIVE" } };
  } else if (type === "COMMENT") {
    const value = await db.communityComment.findUnique({ where: { id } });
    if (value) return { type, id, ownerAccountId: value.authorAccountId, tombstone: { state: "LIVE" } };
  } else if (type === "COLLECTION") {
    const value = await db.communityCollection.findUnique({ where: { id } });
    if (value) return { type, id, ownerAccountId: value.ownerAccountId, tombstone: { state: "LIVE", visibility: value.visibility } };
  } else if (type === "VOYAGE_LOG") {
    const value = await db.communityVoyageLog.findUnique({ where: { id } });
    if (value) return { type, id, ownerAccountId: value.ownerAccountId, tombstone: { state: "LIVE", stateValue: value.lifecycleState } };
  } else if (type === "GUIDE") {
    const value = await db.communityGuideContent.findUnique({ where: { id } });
    if (value) {
      const owner = await db.communityProfile.findUnique({ where: { id: value.ownerProfileId }, select: { accountId: true } });
      return { type, id, ownerAccountId: owner?.accountId ?? null, tombstone: { state: "LIVE", status: value.status } };
    }
  }
  return { type, id, ownerAccountId: null, tombstone: { state: "REMOVED", subjectType: type } };
}

export async function requireLiveModerationSubject(type: string, id: string) {
  const resolved = await resolveModerationSubject(type, id);
  if (resolved.tombstone.state !== "LIVE")
    throw new CommunityError("COMMUNITY_MODERATION_SUBJECT_UNAVAILABLE", "This moderation target is unavailable.");
  return resolved;
}
