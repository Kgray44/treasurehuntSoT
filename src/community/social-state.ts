import { db } from "@/lib/db";

export const socialStateSubjectTypes = ["LISTING", "CREATOR", "GUIDE", "COLLECTION"] as const;
export type SocialStateSubjectType = (typeof socialStateSubjectTypes)[number];
export type SocialStateSubject = Readonly<{ subjectType: SocialStateSubjectType; subjectId: string }>;
export type SocialRelationshipState = Readonly<{
  subjectType: SocialStateSubjectType;
  subjectId: string;
  following: boolean;
  saved: boolean;
  favorited: boolean;
  blocked: boolean;
  canInteract: boolean;
  denialReason?: "INTERACTION_UNAVAILABLE";
}>;

const socialStateDb = db as any;

/**
 * Resolves a bounded set of already-visible Community subjects in grouped
 * queries. It does not expose target account IDs or block-list rows.
 */
export async function getSocialRelationshipStates(
  accountId: string | null,
  requested: readonly SocialStateSubject[],
): Promise<readonly SocialRelationshipState[]> {
  const deduplicated = [...new Map(requested.map((subject) => [`${subject.subjectType}:${subject.subjectId}`, subject])).values()].slice(0, 48);
  if (!deduplicated.length) return [];
  const idsByType = new Map<SocialStateSubjectType, string[]>();
  for (const subject of deduplicated) (idsByType.get(subject.subjectType) ?? (idsByType.set(subject.subjectType, []), idsByType.get(subject.subjectType)!)).push(subject.subjectId);

  const [listings, creators, guides, collections] = await Promise.all([
    idsByType.get("LISTING")?.length
      ? socialStateDb.communityListing.findMany({
          where: { id: { in: idsByType.get("LISTING") }, publicationStatus: "PUBLISHED", moderationStatus: "ACTIVE", visibility: { in: ["COMMUNITY", "FEATURED"] } },
          select: { id: true, ownerProfileId: true, owner: { select: { accountId: true } } },
        })
      : [],
    idsByType.get("CREATOR")?.length
      ? socialStateDb.communityProfile.findMany({
          where: { id: { in: idsByType.get("CREATOR") }, visibility: "COMMUNITY", moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
          select: { id: true, accountId: true },
        })
      : [],
    idsByType.get("GUIDE")?.length
      ? socialStateDb.communityGuideContent.findMany({
          where: { id: { in: idsByType.get("GUIDE") }, status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null },
          select: { id: true, ownerProfileId: true },
        })
      : [],
    idsByType.get("COLLECTION")?.length
      ? socialStateDb.communityCollection.findMany({
          where: { id: { in: idsByType.get("COLLECTION") }, visibility: "COMMUNITY" },
          select: { id: true, ownerAccountId: true },
        })
      : [],
  ]);

  const guideOwnerIds = guides.map((guide: any) => guide.ownerProfileId);
  const guideOwners = guideOwnerIds.length
    ? await socialStateDb.communityProfile.findMany({ where: { id: { in: guideOwnerIds } }, select: { id: true, accountId: true } })
    : [];
  const guideOwnerById = new Map<string, string>(
    guideOwners.map((profile: any) => [String(profile.id), String(profile.accountId)]),
  );
  const visible = new Map<string, { ownerAccountId: string; creatorProfileId?: string }>();
  for (const listing of listings) visible.set(`LISTING:${listing.id}`, { ownerAccountId: listing.owner.accountId, creatorProfileId: listing.ownerProfileId });
  for (const creator of creators) visible.set(`CREATOR:${creator.id}`, { ownerAccountId: creator.accountId, creatorProfileId: creator.id });
  for (const guide of guides) {
    const ownerAccountId = guideOwnerById.get(guide.ownerProfileId);
    if (ownerAccountId) visible.set(`GUIDE:${guide.id}`, { ownerAccountId });
  }
  for (const collection of collections) visible.set(`COLLECTION:${collection.id}`, { ownerAccountId: collection.ownerAccountId });

  if (!accountId)
    return deduplicated.flatMap((subject) =>
      visible.has(`${subject.subjectType}:${subject.subjectId}`)
        ? [{ ...subject, following: false, saved: false, favorited: false, blocked: false, canInteract: false }]
        : [],
    );

  const visibleEntries = [...visible.entries()];
  const ownerIds = [...new Set(visibleEntries.map(([, target]) => target.ownerAccountId))];
  const creatorIds = [...new Set(visibleEntries.flatMap(([, target]) => (target.creatorProfileId ? [target.creatorProfileId] : [])))];
  const subjectClauses = visibleEntries.map(([key]) => {
    const [subjectType, subjectId] = key.split(":");
    return { subjectType, subjectId };
  });
  const [blocks, saves, follows] = await Promise.all([
    ownerIds.length
      ? socialStateDb.communityBlock.findMany({
          where: { OR: [{ blockerAccountId: accountId, blockedAccountId: { in: ownerIds } }, { blockedAccountId: accountId, blockerAccountId: { in: ownerIds } }] },
          select: { blockerAccountId: true, blockedAccountId: true },
        })
      : [],
    subjectClauses.length
      ? socialStateDb.communitySave.findMany({
          where: { accountId, OR: subjectClauses },
          select: { subjectType: true, subjectId: true, kind: true },
        })
      : [],
    creatorIds.length
      ? socialStateDb.communityCreatorFollow.findMany({
          where: { followerAccountId: accountId, creatorProfileId: { in: creatorIds } },
          select: { creatorProfileId: true },
        })
      : [],
  ]);
  const blockedOwners = new Set(blocks.flatMap((block: any) => [block.blockerAccountId === accountId ? block.blockedAccountId : block.blockerAccountId]));
  const saved = new Set(saves.filter((save: any) => save.kind === "SAVE").map((save: any) => `${save.subjectType}:${save.subjectId}`));
  const favorited = new Set(saves.filter((save: any) => save.kind === "FAVORITE").map((save: any) => `${save.subjectType}:${save.subjectId}`));
  const followed = new Set(follows.map((follow: any) => follow.creatorProfileId));

  return deduplicated.flatMap((subject) => {
    const target = visible.get(`${subject.subjectType}:${subject.subjectId}`);
    if (!target) return [];
    const blocked = blockedOwners.has(target.ownerAccountId);
    return [{
      ...subject,
      following: Boolean(target.creatorProfileId && followed.has(target.creatorProfileId)),
      saved: saved.has(`${subject.subjectType}:${subject.subjectId}`),
      favorited: favorited.has(`${subject.subjectType}:${subject.subjectId}`),
      blocked,
      canInteract: !blocked,
      ...(blocked ? { denialReason: "INTERACTION_UNAVAILABLE" as const } : {}),
    }];
  });
}
