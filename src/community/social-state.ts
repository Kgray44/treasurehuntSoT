import type { PrismaClient } from "@prisma/client";

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
export type SocialStateDatabase = Pick<
  PrismaClient,
  | "communityListing"
  | "communityProfile"
  | "communityGuideContent"
  | "communityCollection"
  | "communityBlock"
  | "communitySave"
  | "communityCreatorFollow"
>;

export class CommunitySocialStateUnavailable extends Error {
  readonly code = "COMMUNITY_SOCIAL_STATE_UNAVAILABLE";
  constructor() {
    super("Community relationship state is temporarily unavailable.");
  }
}

/**
 * Resolves a bounded set of already-visible Community subjects in grouped
 * queries. It does not expose target account IDs or block-list rows.
 */
export async function getSocialRelationshipStates(
  accountId: string | null,
  requested: readonly SocialStateSubject[],
  database: SocialStateDatabase = db,
): Promise<readonly SocialRelationshipState[]> {
  try {
    return await readSocialRelationshipStates(accountId, requested, database);
  } catch (cause) {
    if (cause instanceof CommunitySocialStateUnavailable) throw cause;
    throw new CommunitySocialStateUnavailable();
  }
}

async function readSocialRelationshipStates(
  accountId: string | null,
  requested: readonly SocialStateSubject[],
  database: SocialStateDatabase,
): Promise<readonly SocialRelationshipState[]> {
  const deduplicated = [
    ...new Map(requested.map((subject) => [`${subject.subjectType}:${subject.subjectId}`, subject])).values(),
  ].slice(0, 48);
  if (!deduplicated.length) return [];
  const idsByType = new Map<SocialStateSubjectType, string[]>();
  for (const subject of deduplicated) {
    const ids = idsByType.get(subject.subjectType) ?? [];
    ids.push(subject.subjectId);
    idsByType.set(subject.subjectType, ids);
  }
  const listingIds = idsByType.get("LISTING") ?? [];
  const creatorIds = idsByType.get("CREATOR") ?? [];
  const guideIds = idsByType.get("GUIDE") ?? [];
  const collectionIds = idsByType.get("COLLECTION") ?? [];

  const [listings, creators, guides, collections] = await Promise.all([
    listingIds.length
      ? database.communityListing.findMany({
          where: {
            id: { in: listingIds },
            publicationStatus: "PUBLISHED",
            moderationStatus: "ACTIVE",
            visibility: { in: ["COMMUNITY", "FEATURED"] },
          },
          select: { id: true, ownerProfileId: true, owner: { select: { accountId: true } } },
        })
      : Promise.resolve([]),
    creatorIds.length
      ? database.communityProfile.findMany({
          where: {
            id: { in: creatorIds },
            visibility: "COMMUNITY",
            moderationStatus: "ACTIVE",
            creatorStatus: { not: "SUSPENDED" },
          },
          select: { id: true, accountId: true },
        })
      : Promise.resolve([]),
    guideIds.length
      ? database.communityGuideContent.findMany({
          where: { id: { in: guideIds }, status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null },
          select: { id: true, ownerProfileId: true },
        })
      : Promise.resolve([]),
    collectionIds.length
      ? database.communityCollection.findMany({
          where: { id: { in: collectionIds }, visibility: "COMMUNITY" },
          select: { id: true, ownerAccountId: true },
        })
      : Promise.resolve([]),
  ]);
  const guideOwnerIds = guides.map((guide) => guide.ownerProfileId);
  const guideOwners = guideOwnerIds.length
    ? await database.communityProfile.findMany({
        where: { id: { in: guideOwnerIds } },
        select: { id: true, accountId: true },
      })
    : [];
  const guideOwnerById = new Map(guideOwners.map((profile) => [profile.id, profile.accountId]));
  const visible = new Map<string, { ownerAccountId: string; creatorProfileId?: string }>();
  for (const listing of listings)
    visible.set(`LISTING:${listing.id}`, {
      ownerAccountId: listing.owner.accountId,
      creatorProfileId: listing.ownerProfileId,
    });
  for (const creator of creators)
    visible.set(`CREATOR:${creator.id}`, { ownerAccountId: creator.accountId, creatorProfileId: creator.id });
  for (const guide of guides) {
    const ownerAccountId = guideOwnerById.get(guide.ownerProfileId);
    if (ownerAccountId) visible.set(`GUIDE:${guide.id}`, { ownerAccountId });
  }
  for (const collection of collections)
    visible.set(`COLLECTION:${collection.id}`, { ownerAccountId: collection.ownerAccountId });

  if (!accountId)
    return deduplicated.flatMap((subject) =>
      visible.has(`${subject.subjectType}:${subject.subjectId}`)
        ? [{ ...subject, following: false, saved: false, favorited: false, blocked: false, canInteract: false }]
        : [],
    );

  const visibleEntries = [...visible.entries()];
  const ownerIds = [...new Set(visibleEntries.map(([, target]) => target.ownerAccountId))];
  const followableCreatorIds = [
    ...new Set(visibleEntries.flatMap(([, target]) => (target.creatorProfileId ? [target.creatorProfileId] : []))),
  ];
  const subjectClauses = visibleEntries.map(([key]) => {
    const [subjectType, subjectId] = key.split(":");
    return { subjectType, subjectId };
  });
  const [blocks, saves, follows] = await Promise.all([
    ownerIds.length
      ? database.communityBlock.findMany({
          where: {
            OR: [
              { blockerAccountId: accountId, blockedAccountId: { in: ownerIds } },
              { blockedAccountId: accountId, blockerAccountId: { in: ownerIds } },
            ],
          },
          select: { blockerAccountId: true, blockedAccountId: true },
        })
      : Promise.resolve([]),
    subjectClauses.length
      ? database.communitySave.findMany({
          where: { accountId, OR: subjectClauses },
          select: { subjectType: true, subjectId: true, kind: true },
        })
      : Promise.resolve([]),
    followableCreatorIds.length
      ? database.communityCreatorFollow.findMany({
          where: { followerAccountId: accountId, creatorProfileId: { in: followableCreatorIds } },
          select: { creatorProfileId: true },
        })
      : Promise.resolve([]),
  ]);
  const blockedOwners = new Set(
    blocks.map((block) => (block.blockerAccountId === accountId ? block.blockedAccountId : block.blockerAccountId)),
  );
  const saved = new Set(
    saves.filter((save) => save.kind === "SAVE").map((save) => `${save.subjectType}:${save.subjectId}`),
  );
  const favorited = new Set(
    saves.filter((save) => save.kind === "FAVORITE").map((save) => `${save.subjectType}:${save.subjectId}`),
  );
  const followed = new Set(follows.map((follow) => follow.creatorProfileId));

  return deduplicated.flatMap((subject) => {
    const target = visible.get(`${subject.subjectType}:${subject.subjectId}`);
    if (!target) return [];
    const blocked = blockedOwners.has(target.ownerAccountId);
    return [
      {
        ...subject,
        following: Boolean(target.creatorProfileId && followed.has(target.creatorProfileId)),
        saved: saved.has(`${subject.subjectType}:${subject.subjectId}`),
        favorited: favorited.has(`${subject.subjectType}:${subject.subjectId}`),
        blocked,
        canInteract: !blocked,
        ...(blocked ? { denialReason: "INTERACTION_UNAVAILABLE" as const } : {}),
      },
    ];
  });
}
