import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(
  repositoryRoot,
  "Development_Docs",
  "Projects",
  "Project_Homeport",
  "Project_Homeport_Phase_4_Fixture_Manifest.json",
);
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const fixtureChecksum = createHash("sha256").update(manifestBytes).digest("hex");
const databaseUrl = process.env.DATABASE_URL ?? "";
const taskRoot = path.resolve(process.env.HOMEPORT_PHASE4_TASK_ROOT ?? "");
const canonicalDatabase = path.resolve("C:/Users/kkids/Documents/Codex_TreasureHunt/prisma/dev.db");
const databasePath = databaseUrl.startsWith("file:") ? path.resolve(databaseUrl.slice(5)) : "";

if (!databasePath || !taskRoot || taskRoot === repositoryRoot)
  throw new Error("HOMEPORT_PHASE4_FIXTURE_REQUIRES_TASK_OWNED_DATABASE_AND_ROOT");
if (databasePath === canonicalDatabase || !databasePath.startsWith(taskRoot + path.sep))
  throw new Error(`HOMEPORT_PHASE4_FIXTURE_REFUSES_UNOWNED_DATABASE:${databasePath}`);
if (manifest.fixtureVersion !== "homeport-phase4-synthetic-v1")
  throw new Error("HOMEPORT_PHASE4_FIXTURE_VERSION_MISMATCH");

const db = new PrismaClient();
const fixedPasswordHash = "$2b$10$qSVnOqQ8nRZ0rHIzCi1obur67WspOHIJO0zqXaZULcqozenSPuQji";
const createdAt = new Date("2026-08-01T12:00:00.000Z");

async function identity({ key, username, displayName, accountStatus = "ACTIVE", roles = ["PLAYER"], creator }) {
  const gm = await db.gameMasterUser.upsert({
    where: { username },
    update: { passwordHash: fixedPasswordHash, role: "CAPTAIN_CREATOR", capabilities: "[]" },
    create: {
      id: `hp4-gm-${key}`,
      username,
      passwordHash: fixedPasswordHash,
      role: "CAPTAIN_CREATOR",
      capabilities: "[]",
      createdAt,
    },
  });
  const account = await db.userAccount.upsert({
    where: { id: `hp4-account-${key}` },
    update: {
      status: accountStatus,
      legacyGameMasterId: gm.id,
      claimedAt: createdAt,
      ordinaryWorkspaceEntryAt: createdAt,
    },
    create: {
      id: `hp4-account-${key}`,
      status: accountStatus,
      legacyGameMasterId: gm.id,
      claimedAt: createdAt,
      ordinaryWorkspaceEntryAt: createdAt,
      createdAt,
    },
  });
  await db.playerProfile.upsert({
    where: { accountId: account.id },
    update: {
      displayName,
      handle: `hp4-${key}`,
      normalizedHandle: `hp4-${key}`,
      biography: "Synthetic Project Homeport fixture identity.",
      defaultVisibility: "PUBLIC",
      status: accountStatus === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      claimedAt: createdAt,
    },
    create: {
      id: `hp4-player-${key}`,
      accountId: account.id,
      displayName,
      handle: `hp4-${key}`,
      normalizedHandle: `hp4-${key}`,
      biography: "Synthetic Project Homeport fixture identity.",
      defaultVisibility: "PUBLIC",
      status: accountStatus === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
      claimedAt: createdAt,
      createdAt,
    },
  });
  for (const role of roles)
    await db.accountRoleAssignment.upsert({
      where: { id: `hp4-role-${key}-${role.toLocaleLowerCase()}` },
      update: { accountId: account.id, role, revokedAt: null },
      create: { id: `hp4-role-${key}-${role.toLocaleLowerCase()}`, accountId: account.id, role, grantedAt: createdAt },
    });
  if (!creator) return { account };
  const profile = await db.communityProfile.upsert({
    where: { accountId: account.id },
    update: {
      handle: creator.handle,
      normalizedHandle: creator.handle,
      displayName: creator.displayName,
      biography: creator.biography,
      visibility: "COMMUNITY",
      creatorStatus: "ACTIVE",
      moderationStatus: "ACTIVE",
      verificationStatus: creator.verified ? "VERIFIED" : "UNVERIFIED",
      supportedLanguages: '["en"]',
      lastPublishedAt: creator.lastPublishedAt ?? null,
    },
    create: {
      id: `hp4-profile-${key}`,
      accountId: account.id,
      handle: creator.handle,
      normalizedHandle: creator.handle,
      displayName: creator.displayName,
      biography: creator.biography,
      visibility: "COMMUNITY",
      creatorStatus: "ACTIVE",
      moderationStatus: "ACTIVE",
      verificationStatus: creator.verified ? "VERIFIED" : "UNVERIFIED",
      supportedLanguages: '["en"]',
      lastPublishedAt: creator.lastPublishedAt ?? null,
      createdAt,
    },
  });
  return { account, profile };
}

async function listing(input) {
  const record = await db.communityListing.upsert({
    where: { id: input.id },
    update: {
      slug: input.slug,
      itemType: input.itemType,
      ownerProfileId: input.ownerProfileId,
      title: input.title,
      shortDescription: input.summary,
      longDescription: input.description ?? `${input.summary} This is harmless, fictional fixture material.`,
      visibility: input.visibility ?? "COMMUNITY",
      publicationStatus: input.publicationStatus ?? "PUBLISHED",
      moderationStatus: input.moderationStatus ?? "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: input.locationClass ?? "FICTIONAL",
      primaryCategory: input.category ?? "adventure",
      tags: JSON.stringify(input.themes ?? []),
      contentWarnings: JSON.stringify(input.warnings ?? []),
      publishedAt: input.publishedAt ?? createdAt,
      archivedAt: input.archivedAt ?? null,
      removedAt: input.removedAt ?? null,
      updatedAt: input.updatedAt ?? createdAt,
    },
    create: {
      id: input.id,
      slug: input.slug,
      itemType: input.itemType,
      ownerProfileId: input.ownerProfileId,
      title: input.title,
      shortDescription: input.summary,
      longDescription: input.description ?? `${input.summary} This is harmless, fictional fixture material.`,
      visibility: input.visibility ?? "COMMUNITY",
      publicationStatus: input.publicationStatus ?? "PUBLISHED",
      moderationStatus: input.moderationStatus ?? "ACTIVE",
      spoilerLevel: "PREVIEW_SAFE",
      locationClass: input.locationClass ?? "FICTIONAL",
      primaryCategory: input.category ?? "adventure",
      tags: JSON.stringify(input.themes ?? []),
      contentWarnings: JSON.stringify(input.warnings ?? []),
      publishedAt: input.publishedAt ?? createdAt,
      archivedAt: input.archivedAt ?? null,
      removedAt: input.removedAt ?? null,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
    },
  });
  await db.communityListingDiscoveryMetadata.upsert({
    where: { listingId: record.id },
    update: {
      themes: JSON.stringify(input.themes ?? []),
      durationMinimum: input.duration?.[0] ?? null,
      durationMaximum: input.duration?.[1] ?? null,
      minimumPlayerCount: input.players?.[0] ?? null,
      maximumPlayerCount: input.players?.[1] ?? null,
      environment: input.environment ?? "NOT_APPLICABLE",
      difficulty: input.difficulty ?? "NOT_APPLICABLE",
      languages: '["en"]',
      accessibilityFeatures: JSON.stringify(input.accessibility ?? []),
      freeContent: input.free ?? true,
      remixPermission: input.remix ?? "PROHIBITED",
      lastMeaningfulReleaseUpdate: input.updatedAt ?? createdAt,
      mobileSupport: true,
    },
    create: {
      id: `${record.id}-metadata`,
      listingId: record.id,
      themes: JSON.stringify(input.themes ?? []),
      durationMinimum: input.duration?.[0] ?? null,
      durationMaximum: input.duration?.[1] ?? null,
      minimumPlayerCount: input.players?.[0] ?? null,
      maximumPlayerCount: input.players?.[1] ?? null,
      environment: input.environment ?? "NOT_APPLICABLE",
      difficulty: input.difficulty ?? "NOT_APPLICABLE",
      languages: '["en"]',
      accessibilityFeatures: JSON.stringify(input.accessibility ?? []),
      freeContent: input.free ?? true,
      remixPermission: input.remix ?? "PROHIBITED",
      lastMeaningfulReleaseUpdate: input.updatedAt ?? createdAt,
      mobileSupport: true,
      createdAt,
    },
  });
  await db.communityListingAggregate.upsert({
    where: { listingId: record.id },
    update: input.aggregate ?? { installCount: 0, saveCount: 0, reviewCount: 0, averageRating: null },
    create: { listingId: record.id, ...(input.aggregate ?? {}) },
  });
  await db.communitySearchDocument.upsert({
    where: { listingId: record.id },
    update: {
      normalizedTitle: input.title.toLocaleLowerCase(),
      normalizedSummary: input.summary.toLocaleLowerCase(),
      normalizedCreator: "synthetic creator",
      searchableText: `${input.title} ${input.summary} ${(input.themes ?? []).join(" ")}`.toLocaleLowerCase(),
      indexedAt: createdAt,
    },
    create: {
      id: `${record.id}-search`,
      listingId: record.id,
      normalizedTitle: input.title.toLocaleLowerCase(),
      normalizedSummary: input.summary.toLocaleLowerCase(),
      normalizedCreator: "synthetic creator",
      searchableText: `${input.title} ${input.summary} ${(input.themes ?? []).join(" ")}`.toLocaleLowerCase(),
      indexedAt: createdAt,
    },
  });
  return record;
}

async function release(listingRecord, ownerProfileId, options = {}) {
  const record = await db.communityRelease.upsert({
    where: { id: `${listingRecord.id}-release` },
    update: {
      listingId: listingRecord.id,
      sourcePublishedTaleVersionId: options.publishedVersionId ?? null,
      licenseSnapshot: JSON.stringify({ displayName: options.license ?? "Synthetic Community License" }),
      moderationStatus: "ACTIVE",
      deprecatedAt: null,
    },
    create: {
      id: `${listingRecord.id}-release`,
      listingId: listingRecord.id,
      semanticVersion: "1.0.0",
      sourcePublishedTaleVersionId: options.publishedVersionId ?? null,
      manifest: '{"fixture":true}',
      manifestChecksum: createHash("sha256").update(listingRecord.id).digest("hex"),
      licenseSnapshot: JSON.stringify({ displayName: options.license ?? "Synthetic Community License" }),
      publishedByProfileId: ownerProfileId,
      publishedAt: listingRecord.publishedAt ?? createdAt,
      createdAt,
    },
  });
  await db.communityListing.update({ where: { id: listingRecord.id }, data: { currentReleaseId: record.id } });
  return record;
}

async function seed() {
  const player = await identity({ key: "player", username: "hp4-player", displayName: "Mara Testwake" });
  const creator = await identity({
    key: "creator",
    username: "hp4-creator",
    displayName: "Captain Almanac",
    roles: ["PLAYER", "CREATOR"],
    creator: {
      handle: "captain-almanac",
      displayName: "Captain Almanac",
      biography: "A fictional fixture Creator who charts accessible tabletop Voyages.",
      verified: true,
      lastPublishedAt: new Date("2026-08-03T01:00:00.000Z"),
    },
  });
  const emptyCreator = await identity({
    key: "empty-creator",
    username: "hp4-empty-creator",
    displayName: "Maker Lumen",
    roles: ["PLAYER", "CREATOR"],
    creator: {
      handle: "maker-lumen",
      displayName: "Maker Lumen",
      biography: "A synthetic public Creator Profile deliberately containing no published work.",
      verified: false,
      lastPublishedAt: null,
    },
  });
  await identity({
    key: "moderator",
    username: "hp4-moderator",
    displayName: "Harbor Moderator Test",
    roles: ["PLAYER", "MODERATOR"],
  });
  await identity({
    key: "restricted",
    username: "hp4-restricted",
    displayName: "Restricted Mariner Test",
    accountStatus: "SUSPENDED",
  });
  const blockedCreator = await identity({
    key: "blocked",
    username: "hp4-blocked",
    displayName: "Fog Bank Maker",
    roles: ["PLAYER", "CREATOR"],
    creator: {
      handle: "fog-bank-maker",
      displayName: "Fog Bank Maker",
      biography: "Synthetic profile used only to verify block filtering.",
      verified: false,
      lastPublishedAt: createdAt,
    },
  });

  const tale = await db.chronicle.upsert({
    where: { id: "hp4-tale-lantern-coast" },
    update: {
      slug: "hp4-lantern-coast",
      title: "The Lantern Coast",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      creatorId: "hp4-creator",
      creatorAccountId: creator.account.id,
    },
    create: {
      id: "hp4-tale-lantern-coast",
      slug: "hp4-lantern-coast",
      title: "The Lantern Coast",
      shortDescription: "A synthetic published Chronicle handoff target.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      creatorId: "hp4-creator",
      creatorAccountId: creator.account.id,
      playerCountMin: 2,
      playerCountMax: 4,
      estimatedDuration: 60,
      createdAt,
    },
  });
  const publishedVersion = await db.publishedTaleVersion.upsert({
    where: { id: "hp4-version-lantern-coast" },
    update: { contentSnapshot: '{"fixture":true}', checksum: "1".repeat(64), isCurrent: true },
    create: {
      id: "hp4-version-lantern-coast",
      taleId: tale.id,
      versionNumber: 1,
      versionLabel: "1.0.0",
      publishedAt: createdAt,
      publishedBy: "hp4-creator",
      publishedByAccountId: creator.account.id,
      contentSnapshot: '{"fixture":true}',
      checksum: "1".repeat(64),
      isCurrent: true,
    },
  });
  await db.chronicle.update({ where: { id: tale.id }, data: { latestPublishedVersionId: publishedVersion.id } });

  const definitions = [
    {
      id: "hp4-listing-lantern-coast",
      slug: "lantern-coast-chronicle",
      itemType: "CHRONICLE",
      title: "The Lantern Coast",
      summary: "Follow a fictional beacon trail through a paper harbor.",
      themes: ["coastal mystery", "lanterns"],
      duration: [45, 60],
      players: [2, 4],
      difficulty: "MODERATE",
      environment: "MIXED",
      accessibility: ["CAPTIONS", "SCREEN_READER_SUMMARY", "REDUCED_MOTION"],
      warnings: ["flashing-light alternative supplied"],
      free: true,
      remix: "ALLOWED_WITH_ATTRIBUTION",
      publishedAt: new Date("2026-08-01T12:00:00.000Z"),
      updatedAt: new Date("2026-08-02T12:00:00.000Z"),
      aggregate: { installCount: 18, saveCount: 12, reviewCount: 6, averageRating: 4.8 },
    },
    {
      id: "hp4-listing-paper-stars",
      slug: "paper-stars-chronicle",
      itemType: "CHRONICLE",
      title: "Paper Stars at First Bell",
      summary: "A short solo synthetic Chronicle about arranging paper constellations.",
      themes: ["paper craft", "stars"],
      duration: [25, 35],
      players: [1, 1],
      difficulty: "EASY",
      environment: "INDOOR",
      accessibility: ["TRANSCRIPT", "NO_AUDIO_REQUIRED"],
      free: false,
      remix: "PROHIBITED",
      publishedAt: new Date("2026-08-03T00:30:00.000Z"),
      updatedAt: new Date("2026-08-03T00:30:00.000Z"),
      aggregate: { installCount: 3, saveCount: 2, reviewCount: 1, averageRating: 4 },
    },
    {
      id: "hp4-listing-clockwork-reef",
      slug: "clockwork-reef-chronicle",
      itemType: "CHRONICLE",
      title: "Clockwork Reef Almanac",
      summary: "A longer five-player synthetic expedition through a mechanical reef.",
      themes: ["clockwork", "reef"],
      duration: [150, 190],
      players: [5, 8],
      difficulty: "CHALLENGING",
      environment: "MIXED",
      accessibility: ["KEYBOARD_ONLY", "REDUCED_MOTION"],
      warnings: ["mechanical peril"],
      free: true,
      remix: "ALLOWED",
      publishedAt: new Date("2026-07-20T12:00:00.000Z"),
      updatedAt: new Date("2026-08-03T01:00:00.000Z"),
      aggregate: { installCount: 9, saveCount: 7, reviewCount: 3, averageRating: 4.4 },
    },
    {
      id: "hp4-listing-signal-flag",
      slug: "signal-flag-artifact",
      itemType: "ARTIFACT_2D",
      title: "Signal Flag Worksheet",
      summary: "A printable fictional signal flag Artifact.",
      themes: ["signals"],
      accessibility: ["NON_3D_FALLBACK"],
      free: true,
      remix: "ALLOWED",
    },
    {
      id: "hp4-listing-paper-compass",
      slug: "paper-compass-artifact",
      itemType: "ARTIFACT_2D",
      title: "Paper Compass Dial",
      summary: "A second synthetic 2D Artifact for card-grid comparison.",
      themes: ["paper craft"],
      free: true,
      remix: "ALLOWED_WITH_ATTRIBUTION",
    },
    {
      id: "hp4-listing-glass-beacon",
      slug: "glass-beacon-artifact",
      itemType: "ARTIFACT_3D",
      title: "Glass Beacon Model",
      summary: "A synthetic 3D Artifact whose media deliberately uses a governed fallback.",
      themes: ["beacons"],
      accessibility: ["NON_3D_FALLBACK"],
      free: false,
      remix: "PROHIBITED",
    },
    {
      id: "hp4-listing-quiet-watch-template",
      slug: "quiet-watch-template",
      itemType: "CHRONICLE_TEMPLATE",
      title: "Quiet Watch Template",
      summary: "A reusable synthetic Chronicle structure with clear remix terms.",
      themes: ["quiet play"],
      duration: [30, 60],
      players: [1, 4],
      difficulty: "EASY",
      accessibility: ["NO_AUDIO_REQUIRED"],
      free: true,
      remix: "ALLOWED_WITH_ATTRIBUTION",
    },
    {
      id: "hp4-listing-crescent-map",
      slug: "fictional-crescent-map-pack",
      itemType: "MAP_PACK",
      title: "Fictional Crescent Map Pack",
      summary: "A wholly fictional map pack containing no real location or coordinates.",
      themes: ["fictional maps"],
      environment: "NOT_APPLICABLE",
      accessibility: ["SCREEN_READER_SUMMARY"],
      free: true,
      remix: "ALLOWED",
    },
    {
      id: "hp4-listing-harbor-bell-audio",
      slug: "harbor-bell-audio-pack",
      itemType: "AUDIO_PACK",
      title: "Harbor Bell Audio Cues",
      summary: "Silent-by-default synthetic cue descriptions with transcript metadata.",
      themes: ["harbor ambience"],
      accessibility: ["CAPTIONS", "TRANSCRIPT", "NO_AUDIO_REQUIRED"],
      free: true,
      remix: "ALLOWED_WITH_ATTRIBUTION",
    },
  ];
  const publicListings = [];
  for (const definition of definitions) {
    const record = await listing({ ...definition, ownerProfileId: creator.profile.id });
    publicListings.push(record);
    await release(record, creator.profile.id, {
      license: definition.remix === "PROHIBITED" ? "Synthetic review-only license" : "Synthetic attribution license",
      ...(record.id === "hp4-listing-lantern-coast" ? { publishedVersionId: publishedVersion.id } : {}),
    });
  }

  await db.communityEditorialFeature.upsert({
    where: {
      placement_subjectType_subjectId: {
        placement: "HARBOR_HOME",
        subjectType: "COMMUNITY_LISTING",
        subjectId: "hp4-listing-lantern-coast",
      },
    },
    update: { active: true, sortOrder: 1, startsAt: createdAt, endsAt: null },
    create: {
      id: "hp4-feature-lantern-coast",
      placement: "HARBOR_HOME",
      subjectType: "COMMUNITY_LISTING",
      subjectId: "hp4-listing-lantern-coast",
      sortOrder: 1,
      startsAt: createdAt,
      active: true,
      createdAt,
    },
  });

  const failedRelease = await db.communityRelease.findUniqueOrThrow({
    where: { id: "hp4-listing-glass-beacon-release" },
  });
  await db.communityAssetReference.upsert({
    where: { id: "hp4-asset-failed-glass-beacon" },
    update: { scanStatus: "CLEAN", processingStatus: "FAILED", removedAt: null },
    create: {
      id: "hp4-asset-failed-glass-beacon",
      ownerProfileId: creator.profile.id,
      releaseId: failedRelease.id,
      checksum: "2".repeat(64),
      declaredMimeType: "model/gltf-binary",
      detectedMimeType: "model/gltf-binary",
      fileSize: 1024,
      storageProvider: "SYNTHETIC_FIXTURE",
      storageKey: "homeport-phase4-synthetic/failed-glass-beacon.glb",
      visibility: "COMMUNITY",
      scanStatus: "CLEAN",
      processingStatus: "FAILED",
      accessibility: '{"fallback":"A text description is available."}',
      createdAt,
    },
  });

  const ineligibleDefinitions = [
    { id: "hp4-listing-private", slug: "sealed-drawer-private", visibility: "PRIVATE", moderationStatus: "ACTIVE" },
    { id: "hp4-listing-unlisted", slug: "unlisted-moon-chart", visibility: "UNLISTED", moderationStatus: "ACTIVE" },
    {
      id: "hp4-listing-quarantined",
      slug: "quarantined-signal",
      visibility: "COMMUNITY",
      moderationStatus: "QUARANTINED",
    },
    {
      id: "hp4-listing-removed",
      slug: "removed-old-chart",
      visibility: "COMMUNITY",
      moderationStatus: "ACTIVE",
      removedAt: new Date("2026-08-02T00:00:00.000Z"),
    },
    {
      id: "hp4-listing-archived",
      slug: "archived-superseded-chart",
      visibility: "COMMUNITY",
      moderationStatus: "ACTIVE",
      archivedAt: new Date("2026-08-02T00:00:00.000Z"),
    },
  ];
  for (const entry of ineligibleDefinitions)
    await listing({
      ...entry,
      itemType: "CHRONICLE",
      ownerProfileId: creator.profile.id,
      title: `Hidden fixture ${entry.slug}`,
      summary: "This synthetic row must never enumerate through public Community projection.",
      themes: ["hidden"],
      free: true,
    });

  const blockedListing = await listing({
    id: "hp4-listing-blocked",
    slug: "fog-bank-blocked-chronicle",
    itemType: "CHRONICLE",
    ownerProfileId: blockedCreator.profile.id,
    title: "Fog Bank Blocked Chronicle",
    summary: "A synthetic listing hidden only from the account with the governed block relationship.",
    themes: ["blocked"],
    duration: [30, 45],
    players: [2, 4],
    difficulty: "MODERATE",
  });
  await release(blockedListing, blockedCreator.profile.id);

  const collection = await db.communityCollection.upsert({
    where: { id: "hp4-collection-starters" },
    update: {
      ownerAccountId: creator.account.id,
      slug: "harbor-starters",
      title: "Harbor Starter Charts",
      description: "A synthetic collection of approachable public Community entries.",
      visibility: "COMMUNITY",
      archivedAt: null,
      deletedAt: null,
    },
    create: {
      id: "hp4-collection-starters",
      ownerAccountId: creator.account.id,
      slug: "harbor-starters",
      title: "Harbor Starter Charts",
      description: "A synthetic collection of approachable public Community entries.",
      visibility: "COMMUNITY",
      createdAt,
    },
  });
  for (const [position, subjectId] of ["hp4-listing-lantern-coast", "hp4-listing-signal-flag"].entries())
    await db.communityCollectionItem.upsert({
      where: { id: `hp4-collection-item-${position + 1}` },
      update: { collectionId: collection.id, subjectType: "LISTING", subjectId, position },
      create: {
        id: `hp4-collection-item-${position + 1}`,
        collectionId: collection.id,
        subjectType: "LISTING",
        subjectId,
        position,
        createdAt,
      },
    });
  await db.communityCollection.upsert({
    where: { id: "hp4-collection-empty" },
    update: {
      ownerAccountId: emptyCreator.account.id,
      slug: "empty-chart-case",
      title: "Empty Chart Case",
      description: "A deliberate public empty collection fixture.",
      visibility: "COMMUNITY",
      archivedAt: null,
      deletedAt: null,
    },
    create: {
      id: "hp4-collection-empty",
      ownerAccountId: emptyCreator.account.id,
      slug: "empty-chart-case",
      title: "Empty Chart Case",
      description: "A deliberate public empty collection fixture.",
      visibility: "COMMUNITY",
      createdAt,
    },
  });
  await db.communityCollection.upsert({
    where: { id: "hp4-collection-private" },
    update: {
      ownerAccountId: creator.account.id,
      slug: "private-curator-notes",
      title: "Private Curator Notes",
      visibility: "PRIVATE",
    },
    create: {
      id: "hp4-collection-private",
      ownerAccountId: creator.account.id,
      slug: "private-curator-notes",
      title: "Private Curator Notes",
      visibility: "PRIVATE",
      createdAt,
    },
  });

  for (const guide of [
    {
      id: "hp4-guide-weathered-chart",
      slug: "reading-the-weathered-chart",
      title: "Reading the Weathered Chart",
      category: "Preparation",
      summary: "A synthetic Guide to planning accessible, fictional Voyages.",
    },
    {
      id: "hp4-guide-shipwright",
      slug: "shipwrights-accessibility-check",
      title: "Shipwright's Accessibility Check",
      category: "shipwrights-workshop",
      summary: "A synthetic Workshop Guide for captions, transcripts, and non-3D alternatives.",
    },
  ])
    await db.communityGuideContent.upsert({
      where: { id: guide.id },
      update: {
        ownerProfileId: creator.profile.id,
        slug: guide.slug,
        title: guide.title,
        safeSummary: guide.summary,
        sanitizedBody: "Review the public metadata, offer a readable fallback, and test keyboard access.",
        category: guide.category,
        status: "PUBLISHED",
        publishedAt: createdAt,
        deprecatedAt: null,
      },
      create: {
        id: guide.id,
        slug: guide.slug,
        title: guide.title,
        category: guide.category,
        ownerProfileId: creator.profile.id,
        safeSummary: guide.summary,
        sanitizedBody: "Review the public metadata, offer a readable fallback, and test keyboard access.",
        status: "PUBLISHED",
        publishedAt: createdAt,
        createdAt,
      },
    });

  const keepsake = await db.communityVoyageKeepsake.upsert({
    where: { id: "hp4-keepsake-lantern-voyage" },
    update: {
      ownerAccountId: player.account.id,
      wayfarerKeepsakeId: "hp4-opaque-keepsake-lantern-voyage",
      preparationState: "READY",
      safeSnapshot: '{"title":"Fictional Lantern Voyage"}',
      status: "READY",
    },
    create: {
      id: "hp4-keepsake-lantern-voyage",
      ownerAccountId: player.account.id,
      wayfarerKeepsakeId: "hp4-opaque-keepsake-lantern-voyage",
      sourceWatermark: "hp4-synthetic-watermark",
      sourceProjectionChecksum: "3".repeat(64),
      preparationState: "READY",
      safeSnapshot: '{"title":"Fictional Lantern Voyage"}',
      status: "READY",
      createdAt,
    },
  });
  await db.communityVoyageLog.upsert({
    where: { id: "hp4-voyage-log-lantern" },
    update: {
      keepsakeId: keepsake.id,
      ownerAccountId: player.account.id,
      slug: "fictional-lantern-voyage",
      visibility: "COMMUNITY",
      title: "Fictional Lantern Voyage Log",
      safeSummary: "A consent-safe synthetic memory with no participant or location detail.",
      spoilerLevel: "NONE",
      approximateLocation: "fictional harbor district",
      verifiedCompletion: true,
      lifecycleState: "PUBLISHED",
      projectionChecksum: "4".repeat(64),
      searchIndexedAt: createdAt,
      publishedAt: createdAt,
    },
    create: {
      id: "hp4-voyage-log-lantern",
      keepsakeId: keepsake.id,
      ownerAccountId: player.account.id,
      slug: "fictional-lantern-voyage",
      visibility: "COMMUNITY",
      title: "Fictional Lantern Voyage Log",
      safeSummary: "A consent-safe synthetic memory with no participant or location detail.",
      spoilerLevel: "NONE",
      approximateLocation: "fictional harbor district",
      verifiedCompletion: true,
      lifecycleState: "PUBLISHED",
      projectionChecksum: "4".repeat(64),
      searchIndexedAt: createdAt,
      publishedAt: createdAt,
      createdAt,
    },
  });

  await db.communityBadgeDefinition.upsert({
    where: { id: "hp4-badge-accessible-cartographer" },
    update: {
      key: "hp4-accessible-cartographer",
      displayName: "Accessible Cartographer",
      description: "Synthetic fixture badge.",
      grantPolicy: "FIXTURE_ONLY",
      active: true,
    },
    create: {
      id: "hp4-badge-accessible-cartographer",
      key: "hp4-accessible-cartographer",
      displayName: "Accessible Cartographer",
      description: "Synthetic fixture badge.",
      grantPolicy: "FIXTURE_ONLY",
      active: true,
      createdAt,
    },
  });
  await db.communityProfileBadgeGrant.upsert({
    where: { id: "hp4-badge-grant-creator" },
    update: { profileId: creator.profile.id, badgeId: "hp4-badge-accessible-cartographer", source: "FIXTURE_ONLY" },
    create: {
      id: "hp4-badge-grant-creator",
      profileId: creator.profile.id,
      badgeId: "hp4-badge-accessible-cartographer",
      source: "FIXTURE_ONLY",
      grantedAt: createdAt,
    },
  });
  await db.communitySave.upsert({
    where: { id: "hp4-save-player-lantern" },
    update: {
      accountId: player.account.id,
      subjectType: "LISTING",
      subjectId: "hp4-listing-lantern-coast",
      kind: "SAVE",
    },
    create: {
      id: "hp4-save-player-lantern",
      accountId: player.account.id,
      subjectType: "LISTING",
      subjectId: "hp4-listing-lantern-coast",
      kind: "SAVE",
      createdAt,
    },
  });
  await db.communityCreatorFollow.upsert({
    where: { id: "hp4-follow-player-creator" },
    update: { followerAccountId: player.account.id, creatorProfileId: creator.profile.id },
    create: {
      id: "hp4-follow-player-creator",
      followerAccountId: player.account.id,
      creatorProfileId: creator.profile.id,
      createdAt,
    },
  });
  await db.communityBlock.upsert({
    where: { id: "hp4-block-player-blocked" },
    update: { blockerAccountId: player.account.id, blockedAccountId: blockedCreator.account.id },
    create: {
      id: "hp4-block-player-blocked",
      blockerAccountId: player.account.id,
      blockedAccountId: blockedCreator.account.id,
      createdAt,
    },
  });

  process.stdout.write(
    `${JSON.stringify({
      status: "HOMEPORT_PHASE4_FIXTURE_READY",
      fixtureVersion: manifest.fixtureVersion,
      fixtureChecksum,
      databasePath,
      counts: {
        accounts: manifest.accounts.length,
        publicListings: definitions.length + 1,
        ineligibleListings: ineligibleDefinitions.length,
        creators: manifest.publicCreators.length,
        collections: manifest.collections.length,
        guides: manifest.guides.length,
        voyageLogs: manifest.voyageLogs.length,
      },
    })}\n`,
  );
}

seed()
  .catch((error) => {
    console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
