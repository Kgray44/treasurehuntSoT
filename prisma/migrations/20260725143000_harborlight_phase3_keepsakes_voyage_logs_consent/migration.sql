-- CreateTable
CREATE TABLE "CommunityVoyageKeepsake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerAccountId" TEXT NOT NULL,
    "taleSessionId" TEXT NOT NULL,
    "publishedVersionId" TEXT,
    "safeSnapshot" TEXT NOT NULL,
    "favoriteMoment" TEXT,
    "representationChecksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE INDEX "CommunityVoyageKeepsake_taleSessionId_idx" ON "CommunityVoyageKeepsake"("taleSessionId");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageKeepsake_ownerAccountId_taleSessionId_key" ON "CommunityVoyageKeepsake"("ownerAccountId", "taleSessionId");
-- CreateTable
CREATE TABLE "CommunityVoyageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keepsakeId" TEXT NOT NULL,
    "ownerAccountId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "title" TEXT NOT NULL,
    "safeSummary" TEXT,
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NONE',
    "approximateLocation" TEXT,
    "verifiedCompletion" BOOLEAN NOT NULL DEFAULT false,
    "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageLog_keepsakeId_key" ON "CommunityVoyageLog"("keepsakeId");
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageLog_slug_key" ON "CommunityVoyageLog"("slug");
-- CreateIndex
CREATE INDEX "CommunityVoyageLog_visibility_publishedAt_idx" ON "CommunityVoyageLog"("visibility", "publishedAt");
-- CreateTable
CREATE TABLE "CommunityVoyageLogParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageLogId" TEXT NOT NULL,
    "accountId" TEXT,
    "displayNameSnapshot" TEXT NOT NULL,
    "isChild" BOOLEAN NOT NULL DEFAULT false
);
-- CreateIndex
CREATE INDEX "CommunityVoyageLogParticipant_voyageLogId_idx" ON "CommunityVoyageLogParticipant"("voyageLogId");
-- CreateTable
CREATE TABLE "CommunityVoyageLogParticipantConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageLogId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedAt" DATETIME,
    "revokedAt" DATETIME
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageLogParticipantConsent_voyageLogId_participantId_purpose_key" ON "CommunityVoyageLogParticipantConsent"("voyageLogId", "participantId", "purpose");
-- CreateTable
CREATE TABLE "CommunityVoyageLogMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageLogId" TEXT NOT NULL,
    "privateMediaReference" TEXT NOT NULL,
    "derivativeChecksum" TEXT NOT NULL,
    "derivativeStorageReference" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scanStatus" TEXT NOT NULL DEFAULT 'SCAN_NOT_CONFIGURED',
    "exifGpsRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageLogMedia_voyageLogId_derivativeChecksum_key" ON "CommunityVoyageLogMedia"("voyageLogId", "derivativeChecksum");
-- CreateTable
CREATE TABLE "CommunityVoyageLogMediaConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageLogMediaId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "grantedAt" DATETIME,
    "revokedAt" DATETIME
);
-- CreateIndex
CREATE UNIQUE INDEX "CommunityVoyageLogMediaConsent_voyageLogMediaId_accountId_purpose_key" ON "CommunityVoyageLogMediaConsent"("voyageLogMediaId", "accountId", "purpose");
-- CreateTable
CREATE TABLE "CommunityVoyageLogShareRestriction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "voyageLogId" TEXT NOT NULL,
    "restrictionType" TEXT NOT NULL,
    "subjectReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- CreateIndex
CREATE INDEX "CommunityVoyageLogShareRestriction_voyageLogId_restrictionType_idx" ON "CommunityVoyageLogShareRestriction"("voyageLogId", "restrictionType");
