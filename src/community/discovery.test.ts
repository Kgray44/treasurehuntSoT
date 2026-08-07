import { describe, expect, it } from "vitest";

import {
  calculateCommunityTrendingScore,
  communityFacetCounts,
  decodeCommunityCursor,
  encodeCommunityCursor,
  isPublicDiscoveryEligible,
  matchesCommunityDiscoveryFilters,
  normalizeCommunitySearchQuery,
  selectBoundedCommunityRecommendations,
  sortCommunityDiscovery,
} from "./discovery";

const publicRecord = {
  id: "a",
  itemType: "CHRONICLE",
  title: "A safe public voyage",
  safeSummary: "A safe summary",
  primaryCategory: "adventure",
  creatorId: "creator-a",
  creatorHandle: "captain-a",
  creatorDisplayName: "Captain A",
  creatorAccountId: "account-a",
  visibility: "COMMUNITY",
  publicationStatus: "PUBLISHED",
  moderationStatus: "ACTIVE",
  locationClass: "FICTIONAL",
  archivedAt: null,
  removedAt: null,
  publishedAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-02T00:00:00.000Z"),
  metadata: {
    themes: ["adventure"],
    secondaryCategories: [],
    durationMinimum: 30,
    durationMaximum: 60,
    minimumPlayerCount: 2,
    maximumPlayerCount: 6,
    environment: "OUTDOOR",
    recommendedMinimumAge: 10,
    recommendedMaximumAge: 99,
    difficulty: "MODERATE",
    travelRequirement: "LOCAL",
    physicalPropRequirement: "OPTIONAL",
    visionWaypointRequired: true,
    helperAppRequired: false,
    representation: "MIXED",
    languages: ["en-US"],
    accessibilityFeatures: ["CAPTIONS"],
    freeContent: true,
    remixPermission: "PERMITTED",
    lastMeaningfulReleaseUpdate: new Date("2026-07-02T00:00:00.000Z"),
  },
  aggregate: { installCount: 5, saveCount: 4, completionCount: 3, reviewCount: 3, averageRating: 4.5 },
} as const;

describe("Community discovery core", () => {
  it("normalizes Unicode and removes invisible controls without discarding non-English text", () => {
    const query = normalizeCommunitySearchQuery("  CAFÉ\u200b  航海  ");
    expect(query.normalized).toBe("café 航海");
    expect(query.accentFolded).toBe("cafe 航海");
    expect(query.tokens).toEqual(["café", "航海"]);
    expect(() => normalizeCommunitySearchQuery("drop; table")).toThrow("operator");
  });

  it("binds opaque cursors to the query, filters, and sort", () => {
    const cursor = encodeCommunityCursor({
      version: 1,
      queryFingerprint: "a".repeat(64),
      filterFingerprint: "b".repeat(64),
      sort: "NEWEST",
      primarySortValue: 1,
      secondarySortValue: null,
      subjectId: "safe-public-subject",
    });
    expect(
      decodeCommunityCursor(cursor, {
        queryFingerprint: "a".repeat(64),
        filterFingerprint: "b".repeat(64),
        sort: "NEWEST",
      })?.subjectId,
    ).toBe("safe-public-subject");
    expect(() =>
      decodeCommunityCursor(cursor, {
        queryFingerprint: "c".repeat(64),
        filterFingerprint: "b".repeat(64),
        sort: "NEWEST",
      }),
    ).toThrow("does not belong");
    expect(() =>
      decodeCommunityCursor("!not-a-cursor", {
        queryFingerprint: "a".repeat(64),
        filterFingerprint: "b".repeat(64),
        sort: "NEWEST",
      }),
    ).toThrow("malformed");
  });

  it("fails closed for every non-public discovery state and excludes it from facets", () => {
    const hidden = { ...publicRecord, id: "hidden", visibility: "UNLISTED" };
    const quarantined = { ...publicRecord, id: "quarantined", moderationStatus: "QUARANTINED" };
    const archived = { ...publicRecord, id: "archived", archivedAt: new Date("2026-07-03T00:00:00.000Z") };
    const removed = { ...publicRecord, id: "removed", removedAt: new Date("2026-07-03T00:00:00.000Z") };
    expect(isPublicDiscoveryEligible(publicRecord)).toBe(true);
    expect(isPublicDiscoveryEligible(hidden)).toBe(false);
    expect(isPublicDiscoveryEligible(quarantined)).toBe(false);
    expect(isPublicDiscoveryEligible(archived)).toBe(false);
    expect(isPublicDiscoveryEligible(removed)).toBe(false);
    expect(communityFacetCounts([publicRecord, hidden, quarantined, archived, removed]).itemTypes).toEqual({
      CHRONICLE: 1,
    });
  });

  it("enforces range and independent technology filters against public metadata", () => {
    expect(
      matchesCommunityDiscoveryFilters(publicRecord, {
        itemTypes: [],
        themes: ["adventure"],
        primaryCategories: [],
        durationMinimum: 45,
        durationMaximum: 90,
        playerMinimum: 4,
        playerMaximum: 8,
        ageMinimum: 12,
        ageMaximum: 18,
        environments: ["OUTDOOR"],
        difficulties: ["MODERATE"],
        travelRequirements: ["LOCAL"],
        physicalPropRequirements: ["OPTIONAL"],
        representations: ["MIXED"],
        languages: ["en-US"],
        accessibilityFeatures: ["CAPTIONS"],
        requiresVisionWaypoint: true,
        requiresHelperApp: false,
        freeOnly: true,
        remixable: true,
      }),
    ).toBe(true);
    expect(
      matchesCommunityDiscoveryFilters(publicRecord, {
        itemTypes: [],
        themes: [],
        primaryCategories: [],
        environments: [],
        difficulties: [],
        travelRequirements: [],
        physicalPropRequirements: [],
        representations: [],
        languages: [],
        accessibilityFeatures: [],
        requiresHelperApp: true,
      }),
    ).toBe(false);
  });

  it("uses stable ties and an abuse-bounded, decaying trending score", () => {
    const tied = { ...publicRecord, id: "b" };
    expect(sortCommunityDiscovery([tied, publicRecord], "MOST_SAVED").map((record) => record.id)).toEqual(["a", "b"]);
    const normal = calculateCommunityTrendingScore({
      verifiedInstalls: 100,
      verifiedCompletions: 75,
      saves: 200,
      eligibleReviews: 50,
      helpfulVotes: 100,
      distinctProfiles: 8,
      ageInDays: 0,
    });
    const abusive = calculateCommunityTrendingScore({
      verifiedInstalls: 100_000,
      verifiedCompletions: 100_000,
      saves: 100_000,
      eligibleReviews: 100_000,
      helpfulVotes: 100_000,
      distinctProfiles: 100_000,
      ageInDays: 0,
    });
    expect(abusive).toBe(normal);
    expect(
      calculateCommunityTrendingScore({
        verifiedInstalls: 100,
        verifiedCompletions: 75,
        saves: 200,
        eligibleReviews: 50,
        helpfulVotes: 100,
        distinctProfiles: 8,
        ageInDays: 60,
      }),
    ).toBeLessThan(normal);
  });

  it("keeps deterministic recommendations bounded and diverse", () => {
    const results = selectBoundedCommunityRecommendations(
      Array.from({ length: 20 }, (_, index) => ({
        id: `item-${index}`,
        creatorId: `creator-${Math.floor(index / 5)}`,
        itemType: index < 10 ? "CHRONICLE" : "GUIDE",
        score: 20 - index,
        reason: "SIMILAR_CATEGORY" as const,
      })),
      "item-0",
    );
    expect(results).toHaveLength(8);
    expect(results.some((item) => item.id === "item-0")).toBe(false);
    expect(results.filter((item) => item.creatorId === "creator-1").length).toBeLessThanOrEqual(3);
  });
});
