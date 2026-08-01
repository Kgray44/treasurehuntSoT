import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const fixtureVersion = "homeport-phase0-synthetic-v1";
const fixtureIdentity = {
  version: fixtureVersion,
  accountDisplayName: "Homeport Synthetic Mariner",
  playerUsername: "homeport-player",
  profileHandle: "homeport-mariner",
  communityHandle: "homeport-shipwright",
  listingSlug: "homeport-synthetic-chronicle",
  guideSlug: "homeport-synthetic-guide",
};

const checksum = createHash("sha256").update(JSON.stringify(fixtureIdentity)).digest("hex");

async function seed() {
  const account = await db.userAccount.findFirst({
    where: { legacyGameMasterId: { not: null }, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!account) throw new Error("HOMEPORT_FIXTURE_REQUIRES_SEEDED_STAFF_ACCOUNT");

  const player = await db.playerProfile.findUnique({ where: { username: fixtureIdentity.playerUsername } });
  if (!player) throw new Error("HOMEPORT_FIXTURE_REQUIRES_SEEDED_PLAYER_PROFILE");
  await db.playerProfile.update({
    where: { id: player.id },
    data: {
      accountId: account.id,
      displayName: fixtureIdentity.accountDisplayName,
      handle: fixtureIdentity.profileHandle,
      normalizedHandle: fixtureIdentity.profileHandle,
      biography: "Synthetic, non-personal profile used only for Project Homeport Phase 0 inspection.",
      defaultVisibility: "PUBLIC",
      claimedAt: player.claimedAt ?? new Date(),
    },
  });

  const communityProfile = await db.communityProfile.upsert({
    where: { accountId: account.id },
    update: {
      handle: fixtureIdentity.communityHandle,
      normalizedHandle: fixtureIdentity.communityHandle,
      displayName: "Homeport Synthetic Shipwright",
      biography: "Synthetic public-safe creator profile for current-product audit evidence.",
      visibility: "COMMUNITY",
      creatorStatus: "ACTIVE",
      moderationStatus: "ACTIVE",
      lastPublishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    create: {
      accountId: account.id,
      handle: fixtureIdentity.communityHandle,
      normalizedHandle: fixtureIdentity.communityHandle,
      displayName: "Homeport Synthetic Shipwright",
      biography: "Synthetic public-safe creator profile for current-product audit evidence.",
      visibility: "COMMUNITY",
      creatorStatus: "ACTIVE",
      moderationStatus: "ACTIVE",
      lastPublishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  const listing = await db.communityListing.upsert({
    where: { slug: fixtureIdentity.listingSlug },
    update: {
      ownerProfileId: communityProfile.id,
      title: "The Homeport Practice Chronicle",
      shortDescription: "Synthetic public Community content for Phase 0 product-reality inspection.",
      longDescription: "A harmless fictional harbor exercise containing no private Chronicle prose.",
      visibility: "COMMUNITY",
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
      primaryCategory: "adventure",
      tags: JSON.stringify(["synthetic", "audit", "accessible"]),
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    create: {
      slug: fixtureIdentity.listingSlug,
      itemType: "CHRONICLE",
      ownerProfileId: communityProfile.id,
      title: "The Homeport Practice Chronicle",
      shortDescription: "Synthetic public Community content for Phase 0 product-reality inspection.",
      longDescription: "A harmless fictional harbor exercise containing no private Chronicle prose.",
      visibility: "COMMUNITY",
      publicationStatus: "PUBLISHED",
      moderationStatus: "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: "FICTIONAL",
      primaryCategory: "adventure",
      tags: JSON.stringify(["synthetic", "audit", "accessible"]),
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  await db.communityListingDiscoveryMetadata.upsert({
    where: { listingId: listing.id },
    update: {
      themes: JSON.stringify(["adventure", "mystery"]),
      languages: JSON.stringify(["en"]),
      accessibilityFeatures: JSON.stringify(["keyboard", "reduced-motion"]),
      difficulty: "BEGINNER",
      mobileSupport: true,
      freeContent: true,
    },
    create: {
      listingId: listing.id,
      themes: JSON.stringify(["adventure", "mystery"]),
      languages: JSON.stringify(["en"]),
      accessibilityFeatures: JSON.stringify(["keyboard", "reduced-motion"]),
      difficulty: "BEGINNER",
      mobileSupport: true,
      freeContent: true,
    },
  });
  await db.communityListingAggregate.upsert({
    where: { listingId: listing.id },
    update: { installCount: 4, saveCount: 2, reviewCount: 1, averageRating: 4.5 },
    create: { listingId: listing.id, installCount: 4, saveCount: 2, reviewCount: 1, averageRating: 4.5 },
  });
  await db.communitySearchDocument.upsert({
    where: { listingId: listing.id },
    update: {
      normalizedTitle: "the homeport practice chronicle",
      normalizedSummary: "synthetic public community content for phase 0 product reality inspection",
      normalizedCreator: fixtureIdentity.communityHandle,
      searchableText: "homeport practice chronicle synthetic adventure mystery accessible",
    },
    create: {
      listingId: listing.id,
      normalizedTitle: "the homeport practice chronicle",
      normalizedSummary: "synthetic public community content for phase 0 product reality inspection",
      normalizedCreator: fixtureIdentity.communityHandle,
      searchableText: "homeport practice chronicle synthetic adventure mystery accessible",
    },
  });
  await db.communityGuideContent.upsert({
    where: { slug: fixtureIdentity.guideSlug },
    update: {
      ownerProfileId: communityProfile.id,
      title: "Homeport Practice Guide",
      safeSummary: "A synthetic guide used to inspect populated Community district behavior.",
      sanitizedBody: "Prepare fictional materials, review accessibility needs, and use only synthetic data.",
      category: "Preparation",
      status: "PUBLISHED",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
    create: {
      ownerProfileId: communityProfile.id,
      slug: fixtureIdentity.guideSlug,
      title: "Homeport Practice Guide",
      safeSummary: "A synthetic guide used to inspect populated Community district behavior.",
      sanitizedBody: "Prepare fictional materials, review accessibility needs, and use only synthetic data.",
      category: "Preparation",
      status: "PUBLISHED",
      publishedAt: new Date("2026-08-01T00:00:00.000Z"),
    },
  });

  console.log(JSON.stringify({ status: "HOMEPORT_PHASE0_FIXTURE_READY", fixtureVersion, checksum }, null, 2));
}

seed()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
