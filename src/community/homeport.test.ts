import { describe, expect, it } from "vitest";
import type { DiscoveryRecord } from "./discovery";
import {
  homeportCardFromDiscovery,
  homeportVariantForItemType,
  parseHomeportDurationFilter,
  parseHomeportPlayerFilter,
} from "./homeport";

function record(itemType: string): DiscoveryRecord {
  return {
    id: `listing-${itemType.toLocaleLowerCase()}`,
    slug: `public-${itemType.toLocaleLowerCase()}`,
    itemType,
    title: "The Lantern Coast",
    safeSummary: "A public summary with no source coordinates.",
    primaryCategory: "MYSTERY",
    creatorId: "creator-public",
    creatorHandle: "captain-rowan",
    creatorDisplayName: "Captain Rowan",
    creatorAccountId: "private-account-id",
    visibility: "COMMUNITY",
    publicationStatus: "PUBLISHED",
    moderationStatus: "ACTIVE",
    locationClass: "PRIVATE_REAL_WORLD",
    archivedAt: null,
    removedAt: null,
    publishedAt: new Date("2026-08-01T12:00:00.000Z"),
    updatedAt: new Date("2026-08-02T12:00:00.000Z"),
    metadata: {
      themes: ["COASTAL_MYSTERY"],
      secondaryCategories: [],
      durationMinimum: 45,
      durationMaximum: 60,
      minimumPlayerCount: 2,
      maximumPlayerCount: 4,
      environment: "MIXED",
      recommendedMinimumAge: 12,
      recommendedMaximumAge: null,
      difficulty: "MODERATE",
      travelRequirement: "NONE",
      physicalPropRequirement: "OPTIONAL",
      visionWaypointRequired: false,
      helperAppRequired: false,
      representation: "NOT_APPLICABLE",
      languages: ["en"],
      accessibilityFeatures: ["CAPTIONS", "REDUCED_MOTION"],
      freeContent: true,
      remixPermission: "ALLOWED_WITH_ATTRIBUTION",
      lastMeaningfulReleaseUpdate: new Date("2026-08-02T12:00:00.000Z"),
    },
    aggregate: {
      installCount: 8,
      saveCount: 13,
      completionCount: 5,
      reviewCount: 4,
      averageRating: 4.5,
    },
  };
}

describe("Homeport public Community projections", () => {
  it.each([
    ["CHRONICLE", "CHRONICLE"],
    ["ARTIFACT_2D", "ARTIFACT"],
    ["ARTIFACT_3D", "ARTIFACT"],
    ["ARTIFACT_COLLECTION", "ARTIFACT"],
    ["CHRONICLE_TEMPLATE", "TEMPLATE"],
    ["STORY_BLOCK_PRESET", "TEMPLATE"],
    ["MAP_PACK", "MAP_OR_LOCATION_PACK"],
    ["LOCATION_PACK", "MAP_OR_LOCATION_PACK"],
    ["AUDIO_PACK", "AUDIO_OR_REVEAL"],
    ["REVEAL_PRESET", "AUDIO_OR_REVEAL"],
    ["INVITATION_STYLE", "AUDIO_OR_REVEAL"],
    ["COMPLETION_STYLE", "AUDIO_OR_REVEAL"],
  ])("maps %s to the governed %s card variant", (itemType, variant) => {
    expect(homeportVariantForItemType(itemType)).toBe(variant);
  });

  it("emits only the allowlisted public card shape with safe fallbacks", () => {
    const card = homeportCardFromDiscovery(record("CHRONICLE"));
    expect(card).toMatchObject({
      variant: "CHRONICLE",
      destination: "/community/public-chronicle",
      imageState: "FALLBACK",
      artwork: { kind: "GOVERNED_FALLBACK", state: "MISSING" },
      creator: { handle: "captain-rowan", displayName: "Captain Rowan" },
      duration: "45-60 min",
      playerCount: "2-4",
      free: true,
      remixable: true,
      primaryAction: { label: "View details", href: "/community/public-chronicle" },
    });
    const wire = JSON.stringify(card);
    expect(wire).not.toContain("private-account-id");
    expect(wire).not.toContain("PRIVATE_REAL_WORLD");
    expect(wire).not.toContain("lastMeaningfulReleaseUpdate");
  });

  it("rejects unsupported internal item types rather than inventing public cards", () => {
    expect(homeportVariantForItemType("GUIDE")).toBeNull();
    expect(homeportCardFromDiscovery(record("GUIDE"))).toBeNull();
  });

  it("translates readable duration and Crew filters to bounded discovery ranges", () => {
    expect(parseHomeportDurationFilter("UNDER_60")).toEqual({ durationMaximum: 60 });
    expect(parseHomeportDurationFilter("ONE_TO_TWO_HOURS")).toEqual({ durationMinimum: 60, durationMaximum: 120 });
    expect(parseHomeportDurationFilter("OVER_TWO_HOURS")).toEqual({ durationMinimum: 121 });
    expect(parseHomeportPlayerFilter("SOLO")).toEqual({ playerMinimum: 1, playerMaximum: 1 });
    expect(parseHomeportPlayerFilter("TWO_TO_FOUR")).toEqual({ playerMinimum: 2, playerMaximum: 4 });
    expect(parseHomeportPlayerFilter("FIVE_PLUS")).toEqual({ playerMinimum: 5 });
  });
});
