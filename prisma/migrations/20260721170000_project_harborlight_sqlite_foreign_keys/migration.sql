-- Harborlight Phase 1 closure: SQLite cannot add foreign keys in place. Rebuild
-- the additive community tables without changing any canonical table.
PRAGMA foreign_keys=OFF;

ALTER TABLE "CommunityProfile" RENAME TO "_CommunityProfile_old";
ALTER TABLE "CommunityListing" RENAME TO "_CommunityListing_old";
ALTER TABLE "CommunityRelease" RENAME TO "_CommunityRelease_old";
ALTER TABLE "CommunityReleaseAttribution" RENAME TO "_CommunityReleaseAttribution_old";
ALTER TABLE "CommunityOwnershipDeclaration" RENAME TO "_CommunityOwnershipDeclaration_old";
ALTER TABLE "CommunityAssetReference" RENAME TO "_CommunityAssetReference_old";

CREATE TABLE "CommunityProfile" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL,
  "normalizedHandle" TEXT NOT NULL, "handle" TEXT NOT NULL, "displayName" TEXT NOT NULL, "biography" TEXT, "visibility" TEXT NOT NULL DEFAULT 'COMMUNITY',
  "creatorStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "moderationStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "supportedLanguages" TEXT NOT NULL DEFAULT '[]', "socialLinks" TEXT NOT NULL DEFAULT '[]', "lastPublishedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CommunityListing" (
  "id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL, "itemType" TEXT NOT NULL, "ownerProfileId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "shortDescription" TEXT, "longDescription" TEXT, "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "moderationStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "spoilerLevel" TEXT NOT NULL DEFAULT 'PREVIEW_SAFE', "locationClass" TEXT NOT NULL DEFAULT 'FICTIONAL',
  "primaryCategory" TEXT, "tags" TEXT NOT NULL DEFAULT '[]', "contentWarnings" TEXT NOT NULL DEFAULT '[]', "currentReleaseId" TEXT,
  "publishedAt" DATETIME, "archivedAt" DATETIME, "removedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("ownerProfileId") REFERENCES "CommunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("currentReleaseId") REFERENCES "CommunityRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "CommunityRelease" (
  "id" TEXT NOT NULL PRIMARY KEY, "listingId" TEXT NOT NULL, "semanticVersion" TEXT NOT NULL, "manifestSchemaVersion" INTEGER NOT NULL DEFAULT 1,
  "minimumPlatformVersion" TEXT, "sourcePublishedTaleVersionId" TEXT, "manifest" TEXT NOT NULL, "manifestChecksum" TEXT NOT NULL, "packageChecksum" TEXT,
  "releaseNotes" TEXT, "compatibility" TEXT NOT NULL DEFAULT '{}', "licenseSnapshot" TEXT NOT NULL, "attributionSnapshot" TEXT NOT NULL DEFAULT '[]',
  "spoilerSnapshot" TEXT NOT NULL DEFAULT '{}', "moderationStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "publishedByProfileId" TEXT NOT NULL,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "deprecatedAt" DATETIME, "replacementReleaseId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("listingId") REFERENCES "CommunityListing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("sourcePublishedTaleVersionId") REFERENCES "PublishedTaleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("publishedByProfileId") REFERENCES "CommunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("replacementReleaseId") REFERENCES "CommunityRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "CommunityReleaseAttribution" (
  "id" TEXT NOT NULL PRIMARY KEY, "releaseId" TEXT NOT NULL, "creditedProfileId" TEXT, "creditedDisplayName" TEXT NOT NULL, "contributionType" TEXT NOT NULL,
  "sourceUrl" TEXT, "requiredCreditText" TEXT, "licenseReference" TEXT, "sortOrder" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("releaseId") REFERENCES "CommunityRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("creditedProfileId") REFERENCES "CommunityProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "CommunityOwnershipDeclaration" (
  "id" TEXT NOT NULL PRIMARY KEY, "listingId" TEXT NOT NULL, "releaseId" TEXT, "declarantProfileId" TEXT NOT NULL, "declarationVersion" INTEGER NOT NULL,
  "acceptedStatements" TEXT NOT NULL, "evidenceReferences" TEXT NOT NULL DEFAULT '[]', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("listingId") REFERENCES "CommunityListing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("releaseId") REFERENCES "CommunityRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("declarantProfileId") REFERENCES "CommunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CommunityAssetReference" (
  "id" TEXT NOT NULL PRIMARY KEY, "ownerProfileId" TEXT NOT NULL, "releaseId" TEXT, "checksum" TEXT NOT NULL, "declaredMimeType" TEXT NOT NULL,
  "detectedMimeType" TEXT, "fileSize" INTEGER NOT NULL, "storageProvider" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
  "scanStatus" TEXT NOT NULL DEFAULT 'SCAN_NOT_CONFIGURED', "processingStatus" TEXT NOT NULL DEFAULT 'UPLOADED', "accessibility" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, "removedAt" DATETIME,
  FOREIGN KEY ("ownerProfileId") REFERENCES "CommunityProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("releaseId") REFERENCES "CommunityRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "CommunityProfile" SELECT * FROM "_CommunityProfile_old";
INSERT INTO "CommunityListing" SELECT * FROM "_CommunityListing_old";
INSERT INTO "CommunityRelease" SELECT * FROM "_CommunityRelease_old";
INSERT INTO "CommunityReleaseAttribution" SELECT * FROM "_CommunityReleaseAttribution_old";
INSERT INTO "CommunityOwnershipDeclaration" SELECT * FROM "_CommunityOwnershipDeclaration_old";
INSERT INTO "CommunityAssetReference" SELECT * FROM "_CommunityAssetReference_old";
DROP TABLE "_CommunityProfile_old"; DROP TABLE "_CommunityListing_old"; DROP TABLE "_CommunityRelease_old";
DROP TABLE "_CommunityReleaseAttribution_old"; DROP TABLE "_CommunityOwnershipDeclaration_old"; DROP TABLE "_CommunityAssetReference_old";

CREATE UNIQUE INDEX "CommunityProfile_accountId_key" ON "CommunityProfile"("accountId");
CREATE UNIQUE INDEX "CommunityProfile_normalizedHandle_key" ON "CommunityProfile"("normalizedHandle");
CREATE INDEX "CommunityProfile_moderationStatus_visibility_idx" ON "CommunityProfile"("moderationStatus", "visibility");
CREATE UNIQUE INDEX "CommunityListing_slug_key" ON "CommunityListing"("slug");
CREATE UNIQUE INDEX "CommunityListing_currentReleaseId_key" ON "CommunityListing"("currentReleaseId");
CREATE INDEX "CommunityListing_ownerProfileId_updatedAt_idx" ON "CommunityListing"("ownerProfileId", "updatedAt");
CREATE INDEX "CommunityListing_publicationStatus_visibility_idx" ON "CommunityListing"("publicationStatus", "visibility");
CREATE UNIQUE INDEX "CommunityRelease_listingId_semanticVersion_key" ON "CommunityRelease"("listingId", "semanticVersion");
CREATE INDEX "CommunityRelease_listingId_publishedAt_idx" ON "CommunityRelease"("listingId", "publishedAt");
CREATE INDEX "CommunityRelease_sourcePublishedTaleVersionId_idx" ON "CommunityRelease"("sourcePublishedTaleVersionId");
CREATE INDEX "CommunityReleaseAttribution_releaseId_sortOrder_idx" ON "CommunityReleaseAttribution"("releaseId", "sortOrder");
CREATE INDEX "CommunityOwnershipDeclaration_listingId_releaseId_idx" ON "CommunityOwnershipDeclaration"("listingId", "releaseId");
CREATE UNIQUE INDEX "CommunityAssetReference_storageKey_key" ON "CommunityAssetReference"("storageKey");
CREATE UNIQUE INDEX "CommunityAssetReference_ownerProfileId_checksum_key" ON "CommunityAssetReference"("ownerProfileId", "checksum");
CREATE INDEX "CommunityAssetReference_releaseId_visibility_idx" ON "CommunityAssetReference"("releaseId", "visibility");
PRAGMA foreign_keys=ON;
