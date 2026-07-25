import { createHash } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";

import { CommunityError, communityItemTypes, stableJson } from "./domain";

export const communitySortModes = [
  "FEATURED",
  "NEWEST",
  "RECENTLY_UPDATED",
  "TRENDING",
  "MOST_INSTALLED",
  "HIGHEST_RATED",
  "MOST_COMPLETED",
  "MOST_SAVED",
] as const;
export type CommunitySortMode = (typeof communitySortModes)[number];

export const discoveryEnvironments = ["INDOOR", "OUTDOOR", "MIXED", "NOT_APPLICABLE"] as const;
export const discoveryDifficulties = ["EASY", "MODERATE", "CHALLENGING", "EXPERT", "NOT_APPLICABLE"] as const;
export const discoveryTravelRequirements = ["NONE", "LOCAL", "MULTI_STOP", "REGIONAL", "NOT_APPLICABLE"] as const;
export const discoveryPhysicalPropRequirements = ["NONE", "OPTIONAL", "REQUIRED"] as const;
export const discoveryRepresentations = ["TWO_DIMENSIONAL", "THREE_DIMENSIONAL", "MIXED", "NOT_APPLICABLE"] as const;
export const discoveryAccessibilityFeatures = [
  "CAPTIONS",
  "TRANSCRIPT",
  "NON_3D_FALLBACK",
  "REDUCED_MOTION",
  "KEYBOARD_ONLY",
  "HIGH_CONTRAST",
  "SCREEN_READER_SUMMARY",
  "NO_AUDIO_REQUIRED",
  "NO_TRAVEL_REQUIRED",
  "LOW_SETUP",
] as const;

const maxFilterValues = 12;
const maxCandidateRows = 384;
const maxPageSize = 48;
const defaultPageSize = 24;
const invisibleOrControl = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const sqlOperatorSyntax = /(?:--|\/\*|\*\/|;)/u;

const boundedStringArray = <T extends z.ZodType<string>>(schema: T) => z.array(schema).max(maxFilterValues).default([]);
const optionalBoolean = z.boolean().optional();
const optionalInteger = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum).optional();

export const communityDiscoveryFiltersSchema = z
  .object({
    itemTypes: boundedStringArray(
      z.enum(Object.keys(communityItemTypes) as [keyof typeof communityItemTypes, ...string[]]),
    ),
    themes: boundedStringArray(z.string().min(1).max(48)),
    primaryCategories: boundedStringArray(z.string().min(1).max(48)),
    durationMinimum: optionalInteger(0, 100_800),
    durationMaximum: optionalInteger(0, 100_800),
    playerMinimum: optionalInteger(1, 500),
    playerMaximum: optionalInteger(1, 500),
    ageMinimum: optionalInteger(0, 120),
    ageMaximum: optionalInteger(0, 120),
    environments: boundedStringArray(z.enum(discoveryEnvironments)),
    difficulties: boundedStringArray(z.enum(discoveryDifficulties)),
    travelRequirements: boundedStringArray(z.enum(discoveryTravelRequirements)),
    physicalPropRequirements: boundedStringArray(z.enum(discoveryPhysicalPropRequirements)),
    representations: boundedStringArray(z.enum(discoveryRepresentations)),
    languages: boundedStringArray(z.string().min(2).max(35)),
    accessibilityFeatures: boundedStringArray(z.enum(discoveryAccessibilityFeatures)),
    requiresVisionWaypoint: optionalBoolean,
    requiresHelperApp: optionalBoolean,
    freeOnly: optionalBoolean,
    remixable: optionalBoolean,
    creatorId: z.string().min(1).max(128).optional(),
    creatorHandle: z.string().min(3).max(32).optional(),
    minimumRating: z.number().min(0).max(5).optional(),
    updatedSince: z.coerce.date().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [minimum, maximum, name] of [
      [value.durationMinimum, value.durationMaximum, "duration"],
      [value.playerMinimum, value.playerMaximum, "player count"],
      [value.ageMinimum, value.ageMaximum, "age"],
    ] as const) {
      if (minimum !== undefined && maximum !== undefined && minimum > maximum)
        context.addIssue({ code: "custom", message: `Invalid ${name} range.`, path: ["${name}Minimum"] });
    }
  });
export type CommunityDiscoveryFilters = z.infer<typeof communityDiscoveryFiltersSchema>;

export type NormalizedCommunityQuery = {
  normalized: string;
  accentFolded: string;
  tokens: string[];
  fingerprint: string;
};

/** Central query normalization. It intentionally never logs the caller's query. */
export function normalizeCommunitySearchQuery(query?: string | null): NormalizedCommunityQuery {
  if (query === undefined || query === null)
    return { normalized: "", accentFolded: "", tokens: [], fingerprint: fingerprint("") };
  if (Array.from(query).length > 160)
    throw new CommunityError("COMMUNITY_SEARCH_QUERY_INVALID", "Search queries may contain at most 160 characters.");
  if (sqlOperatorSyntax.test(query))
    throw new CommunityError("COMMUNITY_SEARCH_QUERY_INVALID", "Search operator syntax is not accepted.");

  const normalized = query
    .normalize("NFKC")
    .replace(invisibleOrControl, " ")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("en-US");
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length > 12 || tokens.some((token) => Array.from(token).length > 48))
    throw new CommunityError("COMMUNITY_SEARCH_QUERY_INVALID", "Search queries contain too many or too-long terms.");
  return {
    normalized,
    accentFolded: normalized.normalize("NFD").replace(/\p{M}/gu, ""),
    tokens,
    fingerprint: fingerprint(normalized),
  };
}

export type CommunityCursorV1 = {
  version: 1;
  queryFingerprint: string;
  filterFingerprint: string;
  sort: CommunitySortMode;
  primarySortValue: string | number | null;
  secondarySortValue: string | number | null;
  subjectId: string;
};

export function encodeCommunityCursor(cursor: CommunityCursorV1) {
  const parsed = communityCursorSchema.parse(cursor);
  return Buffer.from(stableJson(parsed), "utf8").toString("base64url");
}

export function decodeCommunityCursor(
  value: string | undefined,
  expected: Pick<CommunityCursorV1, "queryFingerprint" | "filterFingerprint" | "sort">,
) {
  if (!value) return undefined;
  if (value.length > 1024) throw cursorError("The pagination cursor is too long.");
  try {
    const cursor = communityCursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (
      cursor.queryFingerprint !== expected.queryFingerprint ||
      cursor.filterFingerprint !== expected.filterFingerprint ||
      cursor.sort !== expected.sort
    )
      throw cursorError("The pagination cursor does not belong to this search.");
    return cursor;
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    throw cursorError("The pagination cursor is malformed.");
  }
}

const communityCursorSchema = z
  .object({
    version: z.literal(1),
    queryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    filterFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    sort: z.enum(communitySortModes),
    primarySortValue: z.union([z.string().max(256), z.number().finite(), z.null()]),
    secondarySortValue: z.union([z.string().max(256), z.number().finite(), z.null()]),
    subjectId: z.string().min(1).max(128),
  })
  .strict();

export type CommunityTrendSignals = {
  verifiedInstalls: number;
  verifiedCompletions: number;
  saves: number;
  eligibleReviews: number;
  helpfulVotes: number;
  distinctProfiles: number;
  ageInDays: number;
};

/** The documented Phase 3 formula, bounded before logarithmic scoring. */
export function calculateCommunityTrendingScore(input: CommunityTrendSignals) {
  const count = (value: number, maximum: number) => Math.min(Math.max(0, finite(value)), maximum);
  const signal =
    2 * count(input.verifiedInstalls, 100) +
    3 * count(input.verifiedCompletions, 75) +
    count(input.saves, 200) +
    1.5 * count(input.eligibleReviews, 50) +
    0.25 * count(input.helpfulVotes, 100);
  const confidence = 0.35 + 0.65 * Math.min(1, count(input.distinctProfiles, 8) / 8);
  const freshness = 0.55 + 0.45 * 2 ** (-Math.max(0, finite(input.ageInDays)) / 14);
  return round6(Math.log1p(signal) * confidence * freshness);
}

export type CommunityRecommendationCandidate = {
  id: string;
  creatorId: string;
  itemType: string;
  score: number;
  reason: "SIMILAR_CATEGORY" | "SAVED_BY_FOLLOWED_CREATOR" | "POPULAR_WITH_COMPATIBLE_ITEMS" | "RECENTLY_UPDATED";
};

/** Deterministic, explainable and deliberately small; no behavioural or private inputs are accepted. */
export function selectBoundedCommunityRecommendations(
  candidates: readonly CommunityRecommendationCandidate[],
  currentSubjectId?: string,
) {
  const creatorCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  return [...candidates]
    .filter((candidate) => candidate.id !== currentSubjectId)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .flatMap((candidate) => {
      if ((creatorCounts.get(candidate.creatorId) ?? 0) >= 3 || (typeCounts.get(candidate.itemType) ?? 0) >= 4)
        return [];
      creatorCounts.set(candidate.creatorId, (creatorCounts.get(candidate.creatorId) ?? 0) + 1);
      typeCounts.set(candidate.itemType, (typeCounts.get(candidate.itemType) ?? 0) + 1);
      return [candidate];
    })
    .slice(0, 12);
}

export type DiscoveryRecord = {
  id: string;
  slug?: string;
  itemType: string;
  title: string;
  safeSummary: string | null;
  primaryCategory: string | null;
  creatorId: string;
  creatorHandle: string;
  visibility: string;
  publicationStatus: string;
  moderationStatus: string;
  locationClass: string;
  publishedAt: Date | null;
  updatedAt: Date;
  metadata?: {
    themes: readonly string[];
    secondaryCategories: readonly string[];
    durationMinimum: number | null;
    durationMaximum: number | null;
    minimumPlayerCount: number | null;
    maximumPlayerCount: number | null;
    environment: string;
    recommendedMinimumAge: number | null;
    recommendedMaximumAge: number | null;
    difficulty: string | null;
    travelRequirement: string;
    physicalPropRequirement: string;
    visionWaypointRequired: boolean;
    helperAppRequired: boolean;
    representation: string;
    languages: readonly string[];
    accessibilityFeatures: readonly string[];
    freeContent: boolean;
    remixPermission: string;
    lastMeaningfulReleaseUpdate: Date | null;
  };
  aggregate?: {
    installCount: number;
    saveCount: number;
    completionCount: number;
    reviewCount: number;
    averageRating: number | null;
    trendingScore?: number;
  };
  featured?: { sortOrder: number; startsAt: Date | null };
};

/** This check is intentionally duplicated at search return time: documents are caches, never authorization. */
export function isPublicDiscoveryEligible(
  record: Pick<DiscoveryRecord, "visibility" | "publicationStatus" | "moderationStatus" | "locationClass">,
) {
  return (
    record.publicationStatus === "PUBLISHED" &&
    (record.visibility === "COMMUNITY" || record.visibility === "FEATURED") &&
    record.moderationStatus === "ACTIVE" &&
    record.locationClass !== "PRIVATE_REAL_WORLD"
  );
}

export function matchesCommunityDiscoveryFilters(record: DiscoveryRecord, filters: CommunityDiscoveryFilters) {
  const metadata = record.metadata;
  if (!isPublicDiscoveryEligible(record)) return false;
  if (filters.itemTypes.length && !filters.itemTypes.includes(record.itemType as never)) return false;
  if (
    filters.primaryCategories.length &&
    (!record.primaryCategory || !filters.primaryCategories.includes(record.primaryCategory))
  )
    return false;
  if (filters.creatorId && filters.creatorId !== record.creatorId) return false;
  if (filters.creatorHandle && normalizeHandleForSearch(filters.creatorHandle) !== record.creatorHandle) return false;
  if (!metadata) return noMetadataFilters(filters);
  if (filters.themes.length && !filters.themes.some((theme) => metadata.themes.includes(normalizeFacetKey(theme))))
    return false;
  if (!overlaps(metadata.durationMinimum, metadata.durationMaximum, filters.durationMinimum, filters.durationMaximum))
    return false;
  if (!overlaps(metadata.minimumPlayerCount, metadata.maximumPlayerCount, filters.playerMinimum, filters.playerMaximum))
    return false;
  if (!overlaps(metadata.recommendedMinimumAge, metadata.recommendedMaximumAge, filters.ageMinimum, filters.ageMaximum))
    return false;
  if (filters.environments.length && !filters.environments.includes(metadata.environment as never)) return false;
  if (filters.difficulties.length && !filters.difficulties.includes((metadata.difficulty ?? "NOT_APPLICABLE") as never))
    return false;
  if (filters.travelRequirements.length && !filters.travelRequirements.includes(metadata.travelRequirement as never))
    return false;
  if (
    filters.physicalPropRequirements.length &&
    !filters.physicalPropRequirements.includes(metadata.physicalPropRequirement as never)
  )
    return false;
  if (filters.representations.length && !filters.representations.includes(metadata.representation as never))
    return false;
  if (
    filters.requiresVisionWaypoint !== undefined &&
    filters.requiresVisionWaypoint !== metadata.visionWaypointRequired
  )
    return false;
  if (filters.requiresHelperApp !== undefined && filters.requiresHelperApp !== metadata.helperAppRequired) return false;
  if (filters.freeOnly && !metadata.freeContent) return false;
  if (filters.remixable && metadata.remixPermission === "PROHIBITED") return false;
  if (
    filters.languages.length &&
    !filters.languages.some((language) => metadata.languages.includes(normalizeLanguageTag(language)))
  )
    return false;
  if (
    filters.accessibilityFeatures.length &&
    !filters.accessibilityFeatures.every((feature) => metadata.accessibilityFeatures.includes(feature))
  )
    return false;
  if (
    filters.updatedSince &&
    (!metadata.lastMeaningfulReleaseUpdate || metadata.lastMeaningfulReleaseUpdate < filters.updatedSince)
  )
    return false;
  if (filters.minimumRating !== undefined && (record.aggregate?.averageRating ?? 0) < filters.minimumRating)
    return false;
  return true;
}

export function sortCommunityDiscovery(records: readonly DiscoveryRecord[], sort: CommunitySortMode) {
  return [...records].sort(
    (left, right) => compareSortTuple(sortTuple(right, sort), sortTuple(left, sort)) || left.id.localeCompare(right.id),
  );
}

export function communityFacetCounts(records: readonly DiscoveryRecord[]) {
  const eligible = records.filter(isPublicDiscoveryEligible);
  const count = (values: readonly string[]) =>
    Object.fromEntries(values.map((value) => [value, values.filter((candidate) => candidate === value).length]));
  return {
    itemTypes: count(eligible.map((record) => record.itemType)),
    categories: count(eligible.flatMap((record) => (record.primaryCategory ? [record.primaryCategory] : []))),
    themes: count(eligible.flatMap((record) => record.metadata?.themes ?? [])),
  };
}

export type CommunitySearchRequest = {
  query?: string | null;
  filters?: unknown;
  sort?: CommunitySortMode;
  cursor?: string;
  pageSize?: number;
};
export type CommunitySearchPage = {
  items: DiscoveryRecord[];
  facets: ReturnType<typeof communityFacetCounts>;
  nextCursor?: string;
  query: NormalizedCommunityQuery;
};
export type CommunitySearchSubject = { listingId: string };
export type CommunitySearchReconciliationResult = { indexed: number; removed: number };

export interface CommunitySearchProvider {
  search(input: CommunitySearchRequest): Promise<CommunitySearchPage>;
  rebuildSubject(input: CommunitySearchSubject): Promise<void>;
  removeSubject(input: CommunitySearchSubject): Promise<void>;
  reconcile(): Promise<CommunitySearchReconciliationResult>;
}

export const databaseCommunitySearchProvider: CommunitySearchProvider = {
  async search(input) {
    const query = normalizeCommunitySearchQuery(input.query);
    const filters = normalizeFilters(input.filters);
    const sort = input.sort ?? "FEATURED";
    const filterFingerprint = fingerprint(stableJson(filters));
    const pageSize = parsePageSize(input.pageSize);
    const cursor = decodeCommunityCursor(input.cursor, {
      queryFingerprint: query.fingerprint,
      filterFingerprint,
      sort,
    });
    const listings = await db.communityListing.findMany({
      where: {
        publicationStatus: "PUBLISHED",
        visibility: { in: ["COMMUNITY", "FEATURED"] },
        moderationStatus: "ACTIVE",
        locationClass: { not: "PRIVATE_REAL_WORLD" },
      },
      include: { owner: true },
      take: maxCandidateRows,
    });
    const ids = listings.map((listing) => listing.id);
    const [metadataRows, aggregateRows, documentRows, featureRows] = await Promise.all([
      db.communityListingDiscoveryMetadata.findMany({ where: { listingId: { in: ids } } }),
      db.communityListingAggregate.findMany({ where: { listingId: { in: ids } } }),
      db.communitySearchDocument.findMany({ where: { listingId: { in: ids } } }),
      db.communityEditorialFeature.findMany({
        where: { subjectType: "COMMUNITY_LISTING", subjectId: { in: ids }, active: true },
      }),
    ]);
    const metadata = new Map(metadataRows.map((row) => [row.listingId, toMetadata(row)]));
    const aggregates = new Map(
      aggregateRows.map((row) => [
        row.listingId,
        {
          installCount: row.installCount,
          saveCount: row.saveCount,
          completionCount: row.completionCount,
          reviewCount: row.reviewCount,
          averageRating: row.averageRating,
        },
      ]),
    );
    const documents = new Map(documentRows.map((row) => [row.listingId, row]));
    const feature = new Map(
      featureRows.map((row) => [row.subjectId, { sortOrder: row.sortOrder, startsAt: row.startsAt }]),
    );
    const matching = listings
      .map((listing) =>
        toDiscoveryRecord(listing, metadata.get(listing.id), aggregates.get(listing.id), feature.get(listing.id)),
      )
      .filter(
        (record) => matchesQuery(documents.get(record.id), query) && matchesCommunityDiscoveryFilters(record, filters),
      );
    const ordered = sortCommunityDiscovery(matching, sort);
    const afterCursor = cursor
      ? ordered.filter(
          (record) =>
            compareSortTuple(sortTuple(record, sort), [cursor.primarySortValue, cursor.secondarySortValue]) < 0 ||
            (compareSortTuple(sortTuple(record, sort), [cursor.primarySortValue, cursor.secondarySortValue]) === 0 &&
              record.id > cursor.subjectId),
        )
      : ordered;
    const items = afterCursor.slice(0, pageSize);
    const finalItem = items.at(-1);
    const hasMore = afterCursor.length > items.length;
    return {
      items,
      facets: communityFacetCounts(matching),
      ...(hasMore && finalItem
        ? {
            nextCursor: encodeCommunityCursor({
              version: 1,
              queryFingerprint: query.fingerprint,
              filterFingerprint,
              sort,
              primarySortValue: sortTuple(finalItem, sort)[0],
              secondarySortValue: sortTuple(finalItem, sort)[1],
              subjectId: finalItem.id,
            }),
          }
        : {}),
      query,
    };
  },
  async rebuildSubject({ listingId }) {
    const listing = await db.communityListing.findUnique({ where: { id: listingId }, include: { owner: true } });
    if (!listing || !isPublicDiscoveryEligible(listing)) return this.removeSubject({ listingId });
    const title = normalizeCommunitySearchQuery(listing.title).normalized;
    const summary = normalizeCommunitySearchQuery(listing.shortDescription ?? "").normalized;
    const creator = normalizeHandleForSearch(listing.owner.normalizedHandle);
    const searchableText = [title, summary, creator].filter(Boolean).join(" ");
    const document = await db.communitySearchDocument.upsert({
      where: { listingId },
      create: {
        listingId,
        normalizedTitle: title,
        normalizedSummary: summary,
        normalizedCreator: creator,
        searchableText,
      },
      update: {
        normalizedTitle: title,
        normalizedSummary: summary,
        normalizedCreator: creator,
        searchableText,
        indexedAt: new Date(),
      },
    });
    const tokens = [...new Set(normalizeCommunitySearchQuery(searchableText).tokens)];
    await db.$transaction([
      db.communitySearchToken.deleteMany({ where: { documentId: document.id } }),
      db.communitySearchToken.createMany({ data: tokens.map((token) => ({ documentId: document.id, token })) }),
    ]);
  },
  async removeSubject({ listingId }) {
    const document = await db.communitySearchDocument.findUnique({ where: { listingId }, select: { id: true } });
    if (!document) return;
    await db.$transaction([
      db.communitySearchToken.deleteMany({ where: { documentId: document.id } }),
      db.communitySearchDocument.delete({ where: { id: document.id } }),
    ]);
  },
  async reconcile() {
    const listings = await db.communityListing.findMany({ select: { id: true } });
    let indexed = 0;
    for (const listing of listings.slice(0, maxCandidateRows)) {
      await this.rebuildSubject({ listingId: listing.id });
      indexed++;
    }
    return { indexed, removed: 0 };
  },
};

function normalizeFilters(input: unknown): CommunityDiscoveryFilters {
  try {
    const parsed = communityDiscoveryFiltersSchema.parse(input ?? {});
    return {
      ...parsed,
      themes: parsed.themes.map(normalizeFacetKey).sort(),
      primaryCategories: parsed.primaryCategories.map(normalizeFacetKey).sort(),
      languages: parsed.languages.map(normalizeLanguageTag).sort(),
      creatorHandle: parsed.creatorHandle ? normalizeHandleForSearch(parsed.creatorHandle) : undefined,
    };
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "One or more discovery filters are invalid.");
  }
}

function toDiscoveryRecord(
  listing: any,
  metadata: DiscoveryRecord["metadata"],
  aggregate: DiscoveryRecord["aggregate"],
  featured: DiscoveryRecord["featured"],
): DiscoveryRecord {
  return {
    id: listing.id,
    slug: listing.slug,
    itemType: listing.itemType,
    title: listing.title,
    safeSummary: listing.shortDescription,
    primaryCategory: listing.primaryCategory,
    creatorId: listing.ownerProfileId,
    creatorHandle: listing.owner.normalizedHandle,
    visibility: listing.visibility,
    publicationStatus: listing.publicationStatus,
    moderationStatus: listing.moderationStatus,
    locationClass: listing.locationClass,
    publishedAt: listing.publishedAt,
    updatedAt: listing.updatedAt,
    metadata,
    aggregate,
    featured,
  };
}

function toMetadata(row: any): NonNullable<DiscoveryRecord["metadata"]> {
  return {
    themes: parseStringArray(row.themes),
    secondaryCategories: parseStringArray(row.secondaryCategories),
    durationMinimum: row.durationMinimum,
    durationMaximum: row.durationMaximum,
    minimumPlayerCount: row.minimumPlayerCount,
    maximumPlayerCount: row.maximumPlayerCount,
    environment: row.environment,
    recommendedMinimumAge: row.recommendedMinimumAge,
    recommendedMaximumAge: row.recommendedMaximumAge,
    difficulty: row.difficulty,
    travelRequirement: row.travelRequirement,
    physicalPropRequirement: row.physicalPropRequirement,
    visionWaypointRequired: row.visionWaypointRequired,
    helperAppRequired: row.helperAppRequired,
    representation: row.representation,
    languages: parseStringArray(row.languages).map(normalizeLanguageTag),
    accessibilityFeatures: parseStringArray(row.accessibilityFeatures),
    freeContent: row.freeContent,
    remixPermission: row.remixPermission,
    lastMeaningfulReleaseUpdate: row.lastMeaningfulReleaseUpdate,
  };
}

function matchesQuery(document: { searchableText: string } | undefined, query: NormalizedCommunityQuery) {
  if (!query.tokens.length) return true;
  if (!document) return false;
  const value = document.searchableText.normalize("NFD").replace(/\p{M}/gu, "");
  return query.tokens.every((token) => value.includes(token.normalize("NFD").replace(/\p{M}/gu, "")));
}

function sortTuple(record: DiscoveryRecord, sort: CommunitySortMode): [string | number | null, string | number | null] {
  const aggregate = record.aggregate;
  switch (sort) {
    case "FEATURED":
      return [
        record.featured?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        record.featured?.startsAt?.getTime() ?? record.publishedAt?.getTime() ?? 0,
      ];
    case "NEWEST":
      return [record.publishedAt?.getTime() ?? 0, null];
    case "RECENTLY_UPDATED":
      return [record.metadata?.lastMeaningfulReleaseUpdate?.getTime() ?? record.publishedAt?.getTime() ?? 0, null];
    case "TRENDING":
      return [
        aggregate?.trendingScore ??
          calculateCommunityTrendingScore({
            verifiedInstalls: aggregate?.installCount ?? 0,
            verifiedCompletions: aggregate?.completionCount ?? 0,
            saves: aggregate?.saveCount ?? 0,
            eligibleReviews: aggregate?.reviewCount ?? 0,
            helpfulVotes: 0,
            distinctProfiles: aggregate?.saveCount ?? 0,
            ageInDays: (Date.now() - (record.publishedAt?.getTime() ?? Date.now())) / 86_400_000,
          }),
        null,
      ];
    case "MOST_INSTALLED":
      return [aggregate?.installCount ?? 0, null];
    case "HIGHEST_RATED":
      return [aggregate?.averageRating ?? 0, aggregate?.reviewCount ?? 0];
    case "MOST_COMPLETED":
      return [aggregate?.completionCount ?? 0, null];
    case "MOST_SAVED":
      return [aggregate?.saveCount ?? 0, null];
  }
}

function compareSortTuple(left: readonly (string | number | null)[], right: readonly (string | number | null)[]) {
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a === b) continue;
    return a > b ? 1 : -1;
  }
  return 0;
}
function noMetadataFilters(filters: CommunityDiscoveryFilters) {
  return !Object.entries(filters).some(
    ([key, value]) =>
      key !== "itemTypes" &&
      key !== "primaryCategories" &&
      key !== "creatorId" &&
      key !== "creatorHandle" &&
      (Array.isArray(value) ? value.length : value !== undefined),
  );
}
function overlaps(
  recordMinimum: number | null,
  recordMaximum: number | null,
  requestedMinimum?: number,
  requestedMaximum?: number,
) {
  if (requestedMinimum === undefined && requestedMaximum === undefined) return true;
  if (recordMinimum === null || recordMaximum === null) return false;
  return (
    (requestedMaximum === undefined || recordMinimum <= requestedMaximum) &&
    (requestedMinimum === undefined || recordMaximum >= requestedMinimum)
  );
}
function parseStringArray(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, maxFilterValues)
      : [];
  } catch {
    return [];
  }
}
function normalizeFacetKey(value: string) {
  return normalizeCommunitySearchQuery(value).normalized.replace(/\s+/gu, "-");
}
function normalizeHandleForSearch(value: string) {
  return normalizeCommunitySearchQuery(value).normalized;
}
function normalizeLanguageTag(value: string) {
  try {
    return new Intl.Locale(value).toString();
  } catch {
    throw new CommunityError("COMMUNITY_DISCOVERY_FILTER_INVALID", "Language tags must use BCP 47 syntax.");
  }
}
function parsePageSize(value?: number) {
  if (value === undefined) return defaultPageSize;
  if (!Number.isInteger(value) || value < 1 || value > maxPageSize)
    throw new CommunityError("COMMUNITY_DISCOVERY_PAGE_INVALID", "Page size must be between 1 and 48.");
  return value;
}
function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function cursorError(message: string) {
  return new CommunityError("COMMUNITY_CURSOR_INVALID", message);
}
function finite(value: number) {
  return Number.isFinite(value) ? value : 0;
}
function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
