-- CreateTable
CREATE TABLE "CommunityListingDiscoveryMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "themes" TEXT NOT NULL DEFAULT '[]',
    "secondaryCategories" TEXT NOT NULL DEFAULT '[]',
    "durationMinimum" INTEGER,
    "durationMaximum" INTEGER,
    "minimumPlayerCount" INTEGER,
    "maximumPlayerCount" INTEGER,
    "environment" TEXT NOT NULL DEFAULT 'NOT_APPLICABLE',
    "recommendedMinimumAge" INTEGER,
    "recommendedMaximumAge" INTEGER,
    "difficulty" TEXT,
    "travelRequirement" TEXT NOT NULL DEFAULT 'NONE',
    "physicalPropRequirement" TEXT NOT NULL DEFAULT 'NONE',
    "printingRequirement" TEXT NOT NULL DEFAULT 'NONE',
    "setupComplexity" TEXT,
    "visionWaypointRequired" BOOLEAN NOT NULL DEFAULT false,
    "helperAppRequired" BOOLEAN NOT NULL DEFAULT false,
    "offlineSupport" BOOLEAN NOT NULL DEFAULT false,
    "mobileSupport" BOOLEAN NOT NULL DEFAULT false,
    "representation" TEXT NOT NULL DEFAULT 'MIXED',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "accessibilityFeatures" TEXT NOT NULL DEFAULT '[]',
    "minimumPlatformVersion" TEXT,
    "compatibilityFeatures" TEXT NOT NULL DEFAULT '[]',
    "maintenanceState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "freeContent" BOOLEAN NOT NULL DEFAULT true,
    "remixPermission" TEXT NOT NULL DEFAULT 'PROHIBITED',
    "lastMeaningfulReleaseUpdate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityListingDiscoveryMetadata_listingId_key" ON "CommunityListingDiscoveryMetadata"("listingId");
-- CreateIndex
CREATE INDEX "CommunityListingDiscoveryMetadata_environment_difficulty_idx" ON "CommunityListingDiscoveryMetadata"("environment", "difficulty");
-- CreateIndex
CREATE INDEX "CommunityListingDiscoveryMetadata_lastMeaningfulReleaseUpdate_idx" ON "CommunityListingDiscoveryMetadata"("lastMeaningfulReleaseUpdate");
-- CreateTable
CREATE TABLE "CommunitySearchDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedSummary" TEXT NOT NULL,
    "normalizedCreator" TEXT NOT NULL,
    "searchableText" TEXT NOT NULL,
    "publicProjectionVersion" INTEGER NOT NULL DEFAULT 1,
    "indexedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunitySearchDocument_listingId_key" ON "CommunitySearchDocument"("listingId");
-- CreateIndex
CREATE INDEX "CommunitySearchDocument_normalizedTitle_idx" ON "CommunitySearchDocument"("normalizedTitle");
-- CreateIndex
CREATE INDEX "CommunitySearchDocument_normalizedCreator_idx" ON "CommunitySearchDocument"("normalizedCreator");
-- CreateIndex
CREATE INDEX "CommunitySearchDocument_indexedAt_idx" ON "CommunitySearchDocument"("indexedAt");
-- CreateTable
CREATE TABLE "CommunitySearchToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1
);
-- CreateIndex
CREATE INDEX "CommunitySearchToken_token_weight_idx" ON "CommunitySearchToken"("token", "weight");
-- CreateIndex
CREATE UNIQUE INDEX "CommunitySearchToken_documentId_token_key" ON "CommunitySearchToken"("documentId", "token");
-- CreateTable
CREATE TABLE "CommunityEditorialFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityEditorialFeature_placement_active_sortOrder_idx" ON "CommunityEditorialFeature"("placement", "active", "sortOrder");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityEditorialFeature_placement_subjectType_subjectId_key" ON "CommunityEditorialFeature"("placement", "subjectType", "subjectId");
-- CreateTable
CREATE TABLE "CommunityListingAggregate" (
    "listingId" TEXT NOT NULL PRIMARY KEY,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "followCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulVoteCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" REAL,
    "updatedAt" DATETIME NOT NULL
);
-- CreateTable
CREATE TABLE "CommunityTrendBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "bucketDate" DATETIME NOT NULL,
    "installActors" INTEGER NOT NULL DEFAULT 0,
    "completionActors" INTEGER NOT NULL DEFAULT 0,
    "saveActors" INTEGER NOT NULL DEFAULT 0,
    "helpfulActors" INTEGER NOT NULL DEFAULT 0,
    "score" REAL NOT NULL DEFAULT 0
);
-- CreateIndex
CREATE INDEX "CommunityTrendBucket_bucketDate_score_idx" ON "CommunityTrendBucket"("bucketDate", "score");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityTrendBucket_listingId_bucketDate_key" ON "CommunityTrendBucket"("listingId", "bucketDate");
