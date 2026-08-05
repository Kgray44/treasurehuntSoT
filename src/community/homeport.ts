import { db } from "@/lib/db";
import {
  communityFacetCounts,
  databaseCommunitySearchProvider,
  sortCommunityDiscovery,
  type CommunityDiscoveryFilters,
  type CommunitySearchRequest,
  type CommunitySortMode,
  type DiscoveryRecord,
} from "./discovery";
import { communityItemTypes, type CommunityItemType } from "./domain";
import { readPublicVoyageLogs } from "./voyage-log-public";

export const homeportCardVariants = [
  "CHRONICLE",
  "ARTIFACT",
  "TEMPLATE",
  "MAP_OR_LOCATION_PACK",
  "AUDIO_OR_REVEAL",
  "CREATOR",
  "COLLECTION",
  "GUIDE",
  "VOYAGE_LOG",
] as const;

export type HomeportCardVariant = (typeof homeportCardVariants)[number];
export type HomeportSocialSubject = Readonly<{
  subjectType: "LISTING" | "CREATOR" | "GUIDE" | "COLLECTION";
  subjectId: string;
}>;
export type HomeportCommunityCard = Readonly<{
  id: string;
  variant: HomeportCardVariant;
  itemType: string;
  contentType: string;
  destination: string;
  artwork: {
    kind: "GOVERNED_FALLBACK";
    state: "MISSING" | "PENDING" | "FAILED" | "QUARANTINED" | "UNAVAILABLE" | "REMOVED";
    motif: HomeportCardVariant;
    label: string;
  };
  imageState: "FALLBACK";
  title: string;
  summary?: string;
  creator?: {
    id: string;
    handle: string;
    displayName: string;
    destination: string;
  };
  category?: string;
  themes?: readonly string[];
  difficulty?: string;
  duration?: string;
  playerCount?: string;
  accessibility?: readonly string[];
  language?: readonly string[];
  warnings?: readonly string[];
  spoiler?: "NONE" | "PREVIEW_SAFE";
  license?: string;
  remixable?: boolean;
  free?: boolean;
  publishedAt?: string;
  updatedAt?: string;
  engagement?: { rating?: number; reviewCount?: number; saveCount?: number; installCount?: number };
  badges?: readonly string[];
  socialSubject?: HomeportSocialSubject;
  primaryAction: { label: string; href: string };
}>;

export type HomeportDiscoveryResult = Readonly<{
  items: readonly HomeportCommunityCard[];
  facets: ReturnType<typeof communityFacetCounts>;
  nextCursor?: string;
}>;

export type HomeportHarborShelves = Readonly<{
  featured: readonly HomeportCommunityCard[];
  recentlyLaunched: readonly HomeportCommunityCard[];
  recentlyUpdated: readonly HomeportCommunityCard[];
  creatorHighlights: readonly HomeportCommunityCard[];
  totalEligible: number;
}>;

export type HomeportListingDetail = Readonly<{
  card: HomeportCommunityCard;
  longDescription?: string;
  tags: readonly string[];
  warnings: readonly string[];
  release?: {
    semanticVersion: string;
    license: string;
    minimumPlatformVersion?: string;
    publishedAt: string;
  };
  useAction:
    | { kind: "LINK"; label: string; href: string; detail: string }
    | { kind: "UNAVAILABLE"; label: string; detail: string };
}>;

export type HomeportCreatorDetail = Readonly<{
  card: HomeportCommunityCard;
  handle: string;
  biography?: string;
  languages: readonly string[];
  badges: readonly string[];
  followers: number;
  work: readonly HomeportCommunityCard[];
  collections: readonly HomeportCommunityCard[];
}>;

export type HomeportCollectionDetail = Readonly<{
  card: HomeportCommunityCard;
  items: readonly HomeportCommunityCard[];
}>;

const listingTypesByVariant: Readonly<Record<HomeportCardVariant, readonly CommunityItemType[]>> = {
  CHRONICLE: ["CHRONICLE"],
  ARTIFACT: ["ARTIFACT_2D", "ARTIFACT_3D", "ARTIFACT_COLLECTION"],
  TEMPLATE: ["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"],
  MAP_OR_LOCATION_PACK: ["MAP_PACK", "LOCATION_PACK"],
  AUDIO_OR_REVEAL: ["AUDIO_PACK", "REVEAL_PRESET", "INVITATION_STYLE", "COMPLETION_STYLE"],
  CREATOR: [],
  COLLECTION: [],
  GUIDE: [],
  VOYAGE_LOG: [],
};

const typeLabels: Readonly<Record<string, string>> = {
  CHRONICLE: "Chronicle",
  CHRONICLE_TEMPLATE: "Chronicle template",
  STORY_BLOCK_PRESET: "Passage preset",
  ARTIFACT_2D: "2D Artifact",
  ARTIFACT_3D: "3D Artifact",
  ARTIFACT_COLLECTION: "Artifact collection",
  MAP_PACK: "Map pack",
  LOCATION_PACK: "Location pack",
  AUDIO_PACK: "Audio pack",
  REVEAL_PRESET: "Reveal preset",
  INVITATION_STYLE: "Invitation style",
  COMPLETION_STYLE: "Completion style",
  COMMUNITY_PROFILE: "Creator",
  COMMUNITY_COLLECTION: "Collection",
  COMMUNITY_GUIDE: "Guide",
  PUBLIC_VOYAGE_LOG: "Voyage Log",
};

export function homeportVariantForItemType(itemType: string): HomeportCardVariant | null {
  if (itemType === "CHRONICLE") return "CHRONICLE";
  if (["ARTIFACT_2D", "ARTIFACT_3D", "ARTIFACT_COLLECTION"].includes(itemType)) return "ARTIFACT";
  if (["CHRONICLE_TEMPLATE", "STORY_BLOCK_PRESET"].includes(itemType)) return "TEMPLATE";
  if (["MAP_PACK", "LOCATION_PACK"].includes(itemType)) return "MAP_OR_LOCATION_PACK";
  if (["AUDIO_PACK", "REVEAL_PRESET", "INVITATION_STYLE", "COMPLETION_STYLE"].includes(itemType))
    return "AUDIO_OR_REVEAL";
  return null;
}

export async function searchHomeportCommunity(
  input: CommunitySearchRequest & { viewerAccountId?: string | null },
): Promise<HomeportDiscoveryResult> {
  const page = await databaseCommunitySearchProvider.search({ ...input, pageSize: input.pageSize ?? 48 });
  const visible = await removeBlockedRecords(page.items, input.viewerAccountId);
  return {
    items: visible.flatMap((record) => {
      const card = homeportCardFromDiscovery(record);
      return card ? [card] : [];
    }),
    facets: communityFacetCounts(visible),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

export async function getHomeportHarborShelves(viewerAccountId?: string | null): Promise<HomeportHarborShelves> {
  const page = await databaseCommunitySearchProvider.search({ sort: "FEATURED", pageSize: 48 });
  const visible = await removeBlockedRecords(page.items, viewerAccountId);
  const [creators, collections, guides, voyageLogs] = await Promise.all([
    listHomeportCreatorCards(viewerAccountId),
    listHomeportCollectionCards(viewerAccountId),
    listHomeportGuideCards(viewerAccountId),
    listHomeportVoyageLogCards(),
  ]);
  const cards = (records: readonly DiscoveryRecord[]) =>
    records.flatMap((record) => {
      const card = homeportCardFromDiscovery(record);
      return card ? [card] : [];
    });
  return {
    featured: cards(
      sortCommunityDiscovery(
        visible.filter((record) => record.featured),
        "FEATURED",
      ).slice(0, 6),
    ),
    recentlyLaunched: cards(sortCommunityDiscovery(visible, "NEWEST").slice(0, 6)),
    recentlyUpdated: cards(sortCommunityDiscovery(visible, "RECENTLY_UPDATED").slice(0, 6)),
    creatorHighlights: creators.slice(0, 3),
    totalEligible: visible.length + creators.length + collections.length + guides.length + voyageLogs.length,
  };
}

export async function listHomeportListingCards(
  variant: Extract<
    HomeportCardVariant,
    "CHRONICLE" | "ARTIFACT" | "TEMPLATE" | "MAP_OR_LOCATION_PACK" | "AUDIO_OR_REVEAL"
  >,
  options: { viewerAccountId?: string | null; sort?: CommunitySortMode } = {},
) {
  return (
    await searchHomeportCommunity({
      filters: { itemTypes: listingTypesByVariant[variant] },
      sort: options.sort ?? "RECENTLY_UPDATED",
      pageSize: 48,
      viewerAccountId: options.viewerAccountId,
    })
  ).items;
}

export async function listHomeportCreatorCards(viewerAccountId?: string | null) {
  const profiles = await db.communityProfile.findMany({
    where: {
      visibility: "COMMUNITY",
      moderationStatus: "ACTIVE",
      creatorStatus: { not: "SUSPENDED" },
    },
    select: {
      id: true,
      accountId: true,
      handle: true,
      displayName: true,
      biography: true,
      verificationStatus: true,
      supportedLanguages: true,
      lastPublishedAt: true,
      updatedAt: true,
    },
    orderBy: [{ lastPublishedAt: "desc" }, { id: "asc" }],
    take: 48,
  });
  const visible = await removeBlockedOwners(profiles, viewerAccountId);
  const counts = visible.length
    ? await db.communityListing.groupBy({
        by: ["ownerProfileId"],
        where: {
          ownerProfileId: { in: visible.map((profile) => profile.id) },
          publicationStatus: "PUBLISHED",
          visibility: { in: ["COMMUNITY", "FEATURED"] },
          moderationStatus: "ACTIVE",
          archivedAt: null,
          removedAt: null,
          locationClass: { not: "PRIVATE_REAL_WORLD" },
        },
        _count: { _all: true },
      })
    : [];
  const workCounts = new Map(counts.map((count) => [count.ownerProfileId, count._count._all]));
  return visible.map((profile) => creatorCard(profile, workCounts.get(profile.id) ?? 0));
}

export async function getHomeportCreatorDetail(handle: string, viewerAccountId?: string | null) {
  const profile = await db.communityProfile.findFirst({
    where: {
      normalizedHandle: handle.normalize("NFKC").toLocaleLowerCase("en-US"),
      visibility: "COMMUNITY",
      moderationStatus: "ACTIVE",
      creatorStatus: { not: "SUSPENDED" },
    },
    select: {
      id: true,
      accountId: true,
      handle: true,
      displayName: true,
      biography: true,
      verificationStatus: true,
      supportedLanguages: true,
      lastPublishedAt: true,
      updatedAt: true,
    },
  });
  if (!profile || (await isBlocked(viewerAccountId, profile.accountId))) return null;
  const [records, badgeGrants, followers, collections] = await Promise.all([
    databaseCommunitySearchProvider.search({
      filters: { creatorId: profile.id },
      sort: "RECENTLY_UPDATED",
      pageSize: 24,
    }),
    db.communityProfileBadgeGrant.findMany({
      where: { profileId: profile.id },
      select: { badgeId: true },
      take: 12,
    }),
    db.communityCreatorFollow.count({ where: { creatorProfileId: profile.id } }),
    db.communityCollection.findMany({
      where: { ownerAccountId: profile.accountId, visibility: "COMMUNITY", archivedAt: null, deletedAt: null },
      select: { id: true, slug: true, title: true, description: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 12,
    }),
  ]);
  const work = records.items.flatMap((record) => {
    const card = homeportCardFromDiscovery(record);
    return card ? [card] : [];
  });
  const badgeDefinitions = badgeGrants.length
    ? await db.communityBadgeDefinition.findMany({
        where: { id: { in: badgeGrants.map((badge) => badge.badgeId) }, active: true },
        select: { id: true, displayName: true },
      })
    : [];
  const badgeNames = new Map(badgeDefinitions.map((badge) => [badge.id, badge.displayName]));
  return {
    card: creatorCard(profile, work.length),
    handle: profile.handle,
    ...(profile.biography ? { biography: profile.biography } : {}),
    languages: parseStringArray(profile.supportedLanguages),
    badges: badgeGrants.flatMap((badge) => {
      const displayName = badgeNames.get(badge.badgeId);
      return displayName ? [displayName] : [];
    }),
    followers,
    work,
    collections: collections.map(collectionCard),
  } satisfies HomeportCreatorDetail;
}

export async function listHomeportCollectionCards(viewerAccountId?: string | null) {
  const collections = await db.communityCollection.findMany({
    where: { visibility: "COMMUNITY", archivedAt: null, deletedAt: null },
    select: { id: true, ownerAccountId: true, slug: true, title: true, description: true, updatedAt: true },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 48,
  });
  return (await removeBlockedOwners(collections, viewerAccountId)).map(collectionCard);
}

export async function getHomeportCollectionDetail(slug: string, viewerAccountId?: string | null) {
  const collection = await db.communityCollection.findFirst({
    where: { slug, visibility: "COMMUNITY", archivedAt: null, deletedAt: null },
    select: { id: true, ownerAccountId: true, slug: true, title: true, description: true, updatedAt: true },
  });
  if (!collection || (await isBlocked(viewerAccountId, collection.ownerAccountId))) return null;
  const references = await db.communityCollectionItem.findMany({
    where: { collectionId: collection.id },
    select: { subjectType: true, subjectId: true, position: true },
    orderBy: { position: "asc" },
    take: 100,
  });
  const listingIds = references.filter((item) => item.subjectType === "LISTING").map((item) => item.subjectId);
  const discovery = listingIds.length
    ? await databaseCommunitySearchProvider.search({ sort: "RECENTLY_UPDATED", pageSize: 48 })
    : { items: [] as DiscoveryRecord[] };
  const byId = new Map(
    (
      await removeBlockedRecords(
        discovery.items.filter((record) => listingIds.includes(record.id)),
        viewerAccountId,
      )
    ).map((record) => [record.id, record]),
  );
  const items = references.flatMap((reference) => {
    if (reference.subjectType !== "LISTING") return [];
    const record = byId.get(reference.subjectId);
    const card = record ? homeportCardFromDiscovery(record) : null;
    return card ? [card] : [];
  });
  return { card: collectionCard(collection), items } satisfies HomeportCollectionDetail;
}

export async function listHomeportGuideCards(viewerAccountId?: string | null) {
  const guides = await db.communityGuideContent.findMany({
    where: { status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null },
    select: {
      id: true,
      ownerProfileId: true,
      slug: true,
      title: true,
      safeSummary: true,
      category: true,
      publishedAt: true,
      updatedAt: true,
    },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: 48,
  });
  const owners = guides.length
    ? await db.communityProfile.findMany({
        where: {
          id: { in: guides.map((guide) => guide.ownerProfileId) },
          visibility: "COMMUNITY",
          moderationStatus: "ACTIVE",
          creatorStatus: { not: "SUSPENDED" },
        },
        select: { id: true, accountId: true, handle: true, displayName: true },
      })
    : [];
  const visibleOwners = await removeBlockedOwners(owners, viewerAccountId);
  const ownerById = new Map(visibleOwners.map((owner) => [owner.id, owner]));
  return guides.flatMap((guide) => {
    const owner = ownerById.get(guide.ownerProfileId);
    return owner ? [guideCard(guide, owner)] : [];
  });
}

export async function getHomeportGuideDetail(slug: string, viewerAccountId?: string | null) {
  const guide = await db.communityGuideContent.findFirst({
    where: { slug, status: "PUBLISHED", publishedAt: { not: null }, deprecatedAt: null },
    select: {
      id: true,
      ownerProfileId: true,
      slug: true,
      title: true,
      safeSummary: true,
      sanitizedBody: true,
      category: true,
      publishedAt: true,
      updatedAt: true,
    },
  });
  if (!guide) return null;
  const owner = await db.communityProfile.findFirst({
    where: {
      id: guide.ownerProfileId,
      visibility: "COMMUNITY",
      moderationStatus: "ACTIVE",
      creatorStatus: { not: "SUSPENDED" },
    },
    select: { id: true, accountId: true, handle: true, displayName: true },
  });
  if (!owner || (await isBlocked(viewerAccountId, owner.accountId))) return null;
  return { card: guideCard(guide, owner), body: guide.sanitizedBody };
}

export async function listHomeportVoyageLogCards() {
  return (await readPublicVoyageLogs()).map(voyageLogCard);
}

export async function getHomeportListingDetail(slug: string, viewerAccountId?: string | null) {
  const listing = await db.communityListing.findFirst({
    where: {
      slug,
      publicationStatus: "PUBLISHED",
      visibility: { in: ["COMMUNITY", "FEATURED"] },
      moderationStatus: "ACTIVE",
      archivedAt: null,
      removedAt: null,
      locationClass: { not: "PRIVATE_REAL_WORLD" },
      owner: { visibility: "COMMUNITY", moderationStatus: "ACTIVE", creatorStatus: { not: "SUSPENDED" } },
    },
    select: {
      id: true,
      slug: true,
      itemType: true,
      title: true,
      shortDescription: true,
      longDescription: true,
      primaryCategory: true,
      tags: true,
      contentWarnings: true,
      spoilerLevel: true,
      publishedAt: true,
      updatedAt: true,
      owner: { select: { id: true, accountId: true, handle: true, normalizedHandle: true, displayName: true } },
      currentRelease: {
        select: {
          semanticVersion: true,
          minimumPlatformVersion: true,
          licenseSnapshot: true,
          moderationStatus: true,
          deprecatedAt: true,
          publishedAt: true,
          sourcePublishedTaleVersion: { select: { tale: { select: { slug: true, status: true, visibility: true } } } },
        },
      },
    },
  });
  if (!listing || (await isBlocked(viewerAccountId, listing.owner.accountId))) return null;
  const [metadata, aggregate] = await Promise.all([
    db.communityListingDiscoveryMetadata.findUnique({ where: { listingId: listing.id } }),
    db.communityListingAggregate.findUnique({ where: { listingId: listing.id } }),
  ]);
  const record: DiscoveryRecord = {
    id: listing.id,
    slug: listing.slug,
    itemType: listing.itemType,
    title: listing.title,
    safeSummary: listing.shortDescription,
    primaryCategory: listing.primaryCategory,
    creatorId: listing.owner.id,
    creatorHandle: listing.owner.normalizedHandle,
    creatorDisplayName: listing.owner.displayName,
    creatorAccountId: listing.owner.accountId,
    visibility: "COMMUNITY",
    publicationStatus: "PUBLISHED",
    moderationStatus: "ACTIVE",
    locationClass: "FICTIONAL",
    archivedAt: null,
    removedAt: null,
    publishedAt: listing.publishedAt,
    updatedAt: listing.updatedAt,
    ...(metadata
      ? {
          metadata: {
            themes: parseStringArray(metadata.themes),
            secondaryCategories: parseStringArray(metadata.secondaryCategories),
            durationMinimum: metadata.durationMinimum,
            durationMaximum: metadata.durationMaximum,
            minimumPlayerCount: metadata.minimumPlayerCount,
            maximumPlayerCount: metadata.maximumPlayerCount,
            environment: metadata.environment,
            recommendedMinimumAge: metadata.recommendedMinimumAge,
            recommendedMaximumAge: metadata.recommendedMaximumAge,
            difficulty: metadata.difficulty,
            travelRequirement: metadata.travelRequirement,
            physicalPropRequirement: metadata.physicalPropRequirement,
            visionWaypointRequired: metadata.visionWaypointRequired,
            helperAppRequired: metadata.helperAppRequired,
            representation: metadata.representation,
            languages: parseStringArray(metadata.languages),
            accessibilityFeatures: parseStringArray(metadata.accessibilityFeatures),
            freeContent: metadata.freeContent,
            remixPermission: metadata.remixPermission,
            lastMeaningfulReleaseUpdate: metadata.lastMeaningfulReleaseUpdate,
          },
        }
      : {}),
    ...(aggregate
      ? {
          aggregate: {
            installCount: aggregate.installCount,
            saveCount: aggregate.saveCount,
            completionCount: aggregate.completionCount,
            reviewCount: aggregate.reviewCount,
            averageRating: aggregate.averageRating,
          },
        }
      : {}),
  };
  const card = homeportCardFromDiscovery(record);
  if (!card) return null;
  const release =
    listing.currentRelease &&
    listing.currentRelease.moderationStatus === "ACTIVE" &&
    !listing.currentRelease.deprecatedAt
      ? {
          semanticVersion: listing.currentRelease.semanticVersion,
          license: safeLicenseLabel(listing.currentRelease.licenseSnapshot),
          ...(listing.currentRelease.minimumPlatformVersion
            ? { minimumPlatformVersion: listing.currentRelease.minimumPlatformVersion }
            : {}),
          publishedAt: listing.currentRelease.publishedAt.toISOString(),
        }
      : undefined;
  const tale = listing.currentRelease?.sourcePublishedTaleVersion?.tale;
  const useAction =
    listing.itemType === "CHRONICLE" && tale?.status === "PUBLISHED" && tale.visibility === "PUBLIC"
      ? {
          kind: "LINK" as const,
          label: "Start Chronicle",
          href: `/play/${encodeURIComponent(tale.slug)}`,
          detail: "Begin preparation using the published Chronicle version shown in this preview.",
        }
      : {
          kind: "UNAVAILABLE" as const,
          label: "Install or remix unavailable",
          detail:
            "This public detail is available to review, but no accepted install or remix handoff is available here yet.",
        };
  return {
    card: {
      ...card,
      ...(parseStringArray(listing.contentWarnings).length
        ? { warnings: parseStringArray(listing.contentWarnings) }
        : {}),
      spoiler: listing.spoilerLevel === "NONE" ? "NONE" : "PREVIEW_SAFE",
      ...(release ? { license: release.license } : {}),
    },
    ...(listing.longDescription ? { longDescription: listing.longDescription } : {}),
    tags: parseStringArray(listing.tags),
    warnings: parseStringArray(listing.contentWarnings),
    ...(release ? { release } : {}),
    useAction,
  } satisfies HomeportListingDetail;
}

export function homeportCardFromDiscovery(record: DiscoveryRecord): HomeportCommunityCard | null {
  const variant = homeportVariantForItemType(record.itemType);
  if (!variant || !(record.itemType in communityItemTypes)) return null;
  const metadata = record.metadata;
  const creatorHandle = record.creatorHandle;
  const destination = `/community/${encodeURIComponent(record.slug ?? record.id)}`;
  return {
    id: record.id,
    variant,
    itemType: record.itemType,
    contentType: typeLabels[record.itemType] ?? "Community resource",
    destination,
    artwork: fallbackArtwork(variant),
    imageState: "FALLBACK",
    title: record.title,
    ...(record.safeSummary ? { summary: record.safeSummary } : {}),
    creator: {
      id: record.creatorId,
      handle: creatorHandle,
      displayName: record.creatorDisplayName || creatorHandle,
      destination: `/community/creators/${encodeURIComponent(creatorHandle)}`,
    },
    ...(record.primaryCategory ? { category: humanize(record.primaryCategory) } : {}),
    ...(metadata?.themes.length ? { themes: metadata.themes.map(humanize) } : {}),
    ...(metadata?.difficulty && metadata.difficulty !== "NOT_APPLICABLE"
      ? { difficulty: humanize(metadata.difficulty) }
      : {}),
    ...durationFields(metadata?.durationMinimum ?? null, metadata?.durationMaximum ?? null),
    ...playerFields(metadata?.minimumPlayerCount ?? null, metadata?.maximumPlayerCount ?? null),
    ...(metadata?.accessibilityFeatures.length ? { accessibility: metadata.accessibilityFeatures.map(humanize) } : {}),
    ...(metadata?.languages.length ? { language: metadata.languages } : {}),
    ...(metadata ? { remixable: metadata.remixPermission !== "PROHIBITED", free: metadata.freeContent } : {}),
    ...(record.publishedAt ? { publishedAt: record.publishedAt.toISOString() } : {}),
    updatedAt: record.updatedAt.toISOString(),
    ...(record.aggregate
      ? {
          engagement: {
            ...(record.aggregate.averageRating !== null ? { rating: record.aggregate.averageRating } : {}),
            ...(record.aggregate.reviewCount ? { reviewCount: record.aggregate.reviewCount } : {}),
            ...(record.aggregate.saveCount ? { saveCount: record.aggregate.saveCount } : {}),
            ...(record.aggregate.installCount ? { installCount: record.aggregate.installCount } : {}),
          },
        }
      : {}),
    socialSubject: { subjectType: "LISTING", subjectId: record.id },
    primaryAction: { label: "View details", href: destination },
  };
}

function creatorCard(
  profile: {
    id: string;
    handle: string;
    displayName: string;
    biography: string | null;
    verificationStatus: string;
    supportedLanguages: string;
    lastPublishedAt: Date | null;
    updatedAt: Date;
  },
  workCount: number,
): HomeportCommunityCard {
  const destination = `/community/creators/${encodeURIComponent(profile.handle)}`;
  return {
    id: profile.id,
    variant: "CREATOR",
    itemType: "COMMUNITY_PROFILE",
    contentType: "Creator",
    destination,
    artwork: fallbackArtwork("CREATOR"),
    imageState: "FALLBACK",
    title: profile.displayName,
    ...(profile.biography ? { summary: profile.biography } : {}),
    language: parseStringArray(profile.supportedLanguages),
    badges: [
      ...(profile.verificationStatus === "VERIFIED" ? ["Verified Creator"] : []),
      `${workCount} public ${workCount === 1 ? "work" : "works"}`,
    ],
    ...(profile.lastPublishedAt ? { publishedAt: profile.lastPublishedAt.toISOString() } : {}),
    updatedAt: profile.updatedAt.toISOString(),
    socialSubject: { subjectType: "CREATOR", subjectId: profile.id },
    primaryAction: { label: "View Creator Profile", href: destination },
  };
}

function collectionCard(collection: {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  updatedAt: Date;
}): HomeportCommunityCard {
  const destination = `/community/collections/${encodeURIComponent(collection.slug)}`;
  return {
    id: collection.id,
    variant: "COLLECTION",
    itemType: "COMMUNITY_COLLECTION",
    contentType: "Collection",
    destination,
    artwork: fallbackArtwork("COLLECTION"),
    imageState: "FALLBACK",
    title: collection.title,
    ...(collection.description ? { summary: collection.description } : {}),
    updatedAt: collection.updatedAt.toISOString(),
    socialSubject: { subjectType: "COLLECTION", subjectId: collection.id },
    primaryAction: { label: "Open collection", href: destination },
  };
}

function guideCard(
  guide: {
    id: string;
    slug: string;
    title: string;
    safeSummary: string;
    category: string;
    publishedAt: Date | null;
    updatedAt: Date;
  },
  owner: { id: string; handle: string; displayName: string },
): HomeportCommunityCard {
  const destination = `/community/guides/${encodeURIComponent(guide.slug)}`;
  return {
    id: guide.id,
    variant: "GUIDE",
    itemType: "COMMUNITY_GUIDE",
    contentType: "Guide",
    destination,
    artwork: fallbackArtwork("GUIDE"),
    imageState: "FALLBACK",
    title: guide.title,
    summary: guide.safeSummary,
    category: guide.category,
    creator: {
      id: owner.id,
      handle: owner.handle,
      displayName: owner.displayName,
      destination: `/community/creators/${encodeURIComponent(owner.handle)}`,
    },
    ...(guide.publishedAt ? { publishedAt: guide.publishedAt.toISOString() } : {}),
    updatedAt: guide.updatedAt.toISOString(),
    socialSubject: { subjectType: "GUIDE", subjectId: guide.id },
    primaryAction: { label: "Read Guide", href: destination },
  };
}

function voyageLogCard(log: { slug: string; title: string; safeSummary?: string; spoilerLevel: string }) {
  const destination = `/community/voyage-logs/${encodeURIComponent(log.slug)}`;
  return {
    id: `voyage-log:${log.slug}`,
    variant: "VOYAGE_LOG",
    itemType: "PUBLIC_VOYAGE_LOG",
    contentType: "Voyage Log",
    destination,
    artwork: fallbackArtwork("VOYAGE_LOG"),
    imageState: "FALLBACK",
    title: log.title,
    ...(log.safeSummary ? { summary: log.safeSummary } : {}),
    spoiler: log.spoilerLevel === "NONE" ? ("NONE" as const) : ("PREVIEW_SAFE" as const),
    badges: ["Verified completion", "Consent checked"],
    primaryAction: { label: "Read Voyage Log", href: destination },
  } satisfies HomeportCommunityCard;
}

function fallbackArtwork(variant: HomeportCardVariant): HomeportCommunityCard["artwork"] {
  return {
    kind: "GOVERNED_FALLBACK",
    state: "MISSING",
    motif: variant,
    label: `${humanize(variant)} artwork unavailable`,
  };
}

async function removeBlockedRecords(records: readonly DiscoveryRecord[], viewerAccountId?: string | null) {
  if (!viewerAccountId || !records.length) return [...records];
  const blocked = await blockedAccountIds(
    viewerAccountId,
    records.map((record) => record.creatorAccountId),
  );
  return records.filter((record) => !blocked.has(record.creatorAccountId));
}

async function removeBlockedOwners<T extends { accountId?: string; ownerAccountId?: string }>(
  records: readonly T[],
  viewerAccountId?: string | null,
) {
  if (!viewerAccountId || !records.length) return [...records];
  const ownerIds = records.flatMap((record) => record.accountId ?? record.ownerAccountId ?? []);
  const blocked = await blockedAccountIds(viewerAccountId, ownerIds);
  return records.filter((record) => !blocked.has(record.accountId ?? record.ownerAccountId ?? ""));
}

async function isBlocked(viewerAccountId: string | null | undefined, ownerAccountId: string) {
  return viewerAccountId ? (await blockedAccountIds(viewerAccountId, [ownerAccountId])).has(ownerAccountId) : false;
}

async function blockedAccountIds(viewerAccountId: string, ownerAccountIds: readonly string[]) {
  const unique = [...new Set(ownerAccountIds.filter(Boolean))];
  if (!unique.length) return new Set<string>();
  const rows = await db.communityBlock.findMany({
    where: {
      OR: [
        { blockerAccountId: viewerAccountId, blockedAccountId: { in: unique } },
        { blockedAccountId: viewerAccountId, blockerAccountId: { in: unique } },
      ],
    },
    select: { blockerAccountId: true, blockedAccountId: true },
  });
  return new Set(
    rows.map((row) => (row.blockerAccountId === viewerAccountId ? row.blockedAccountId : row.blockerAccountId)),
  );
}

function durationFields(minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null) return {};
  return { duration: minimum === maximum ? `${minimum} min` : `${minimum}-${maximum} min` };
}

function playerFields(minimum: number | null, maximum: number | null) {
  if (minimum === null || maximum === null) return {};
  return { playerCount: minimum === maximum ? `${minimum}` : `${minimum}-${maximum}` };
}

function parseStringArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

function safeLicenseLabel(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "License information available";
    const record = parsed as Record<string, unknown>;
    for (const field of ["displayName", "name", "key"]) {
      const candidate = record[field];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 120);
    }
  } catch {
    // Use the same non-sensitive fallback for malformed historical snapshots.
  }
  return "License information available";
}

function humanize(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replaceAll("_", " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-US"));
}

export function parseHomeportDurationFilter(
  value: string | null,
): Pick<CommunityDiscoveryFilters, "durationMinimum" | "durationMaximum"> {
  if (value === "UNDER_60") return { durationMaximum: 60 };
  if (value === "ONE_TO_TWO_HOURS") return { durationMinimum: 60, durationMaximum: 120 };
  if (value === "OVER_TWO_HOURS") return { durationMinimum: 121 };
  return {};
}

export function parseHomeportPlayerFilter(
  value: string | null,
): Pick<CommunityDiscoveryFilters, "playerMinimum" | "playerMaximum"> {
  if (value === "SOLO") return { playerMinimum: 1, playerMaximum: 1 };
  if (value === "TWO_TO_FOUR") return { playerMinimum: 2, playerMaximum: 4 };
  if (value === "FIVE_PLUS") return { playerMinimum: 5 };
  return {};
}
