-- CreateTable
CREATE TABLE "CommunityCreatorFollow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerAccountId" TEXT NOT NULL,
    "creatorProfileId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityCreatorFollow_creatorProfileId_createdAt_idx" ON "CommunityCreatorFollow"("creatorProfileId", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityCreatorFollow_followerAccountId_creatorProfileId_key" ON "CommunityCreatorFollow"("followerAccountId", "creatorProfileId");
-- CreateTable
CREATE TABLE "CommunityBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerAccountId" TEXT NOT NULL,
    "blockedAccountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityBlock_blockedAccountId_idx" ON "CommunityBlock"("blockedAccountId");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityBlock_blockerAccountId_blockedAccountId_key" ON "CommunityBlock"("blockerAccountId", "blockedAccountId");
-- CreateTable
CREATE TABLE "CommunitySave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SAVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunitySave_subjectType_subjectId_createdAt_idx" ON "CommunitySave"("subjectType", "subjectId", "createdAt");
-- CreateIndex
CREATE UNIQUE INDEX "CommunitySave_accountId_subjectType_subjectId_kind_key" ON "CommunitySave"("accountId", "subjectType", "subjectId", "kind");
-- CreateTable
CREATE TABLE "CommunityCollection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerAccountId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityCollection_slug_key" ON "CommunityCollection"("slug");
-- CreateIndex
CREATE INDEX "CommunityCollection_ownerAccountId_visibility_idx" ON "CommunityCollection"("ownerAccountId", "visibility");
-- CreateTable
CREATE TABLE "CommunityCollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collectionId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityCollectionItem_collectionId_position_idx" ON "CommunityCollectionItem"("collectionId", "position");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityCollectionItem_collectionId_subjectType_subjectId_key" ON "CommunityCollectionItem"("collectionId", "subjectType", "subjectId");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityCollectionItem_collectionId_position_key" ON "CommunityCollectionItem"("collectionId", "position");
-- CreateTable
CREATE TABLE "CommunityProfileFeaturedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfileFeaturedItem_profileId_subjectType_subjectId_key" ON "CommunityProfileFeaturedItem"("profileId", "subjectType", "subjectId");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfileFeaturedItem_profileId_position_key" ON "CommunityProfileFeaturedItem"("profileId", "position");
-- CreateTable
CREATE TABLE "CommunityBadgeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "grantPolicy" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityBadgeDefinition_key_key" ON "CommunityBadgeDefinition"("key");
-- CreateTable
CREATE TABLE "CommunityProfileBadgeGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedByAccountId" TEXT,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityProfileBadgeGrant_profileId_badgeId_key" ON "CommunityProfileBadgeGrant"("profileId", "badgeId");
