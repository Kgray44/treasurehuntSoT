ALTER TABLE "GameMasterUser" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'CAPTAIN_CREATOR';
ALTER TABLE "GameMasterUser" ADD COLUMN "capabilities" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE "TallTale" (
    "id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT NOT NULL, "title" TEXT NOT NULL, "subtitle" TEXT,
    "shortDescription" TEXT, "longDescription" TEXT, "coverAssetId" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'CARTOGRAPHERS_TABLE', "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "creatorId" TEXT NOT NULL,
    "currentDraftRevisionId" TEXT, "latestPublishedVersionId" TEXT,
    "playerCountMin" INTEGER NOT NULL DEFAULT 1, "playerCountMax" INTEGER NOT NULL DEFAULT 4,
    "estimatedDuration" INTEGER, "contentWarnings" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false, "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TallTale_slug_key" ON "TallTale"("slug");
CREATE INDEX "TallTale_status_visibility_sortOrder_idx" ON "TallTale"("status", "visibility", "sortOrder");
CREATE INDEX "TallTale_creatorId_updatedAt_idx" ON "TallTale"("creatorId", "updatedAt");

CREATE TABLE "TaleDraft" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "basedOnPublishedVersionId" TEXT, "createdBy" TEXT NOT NULL, "autosaveVersion" INTEGER NOT NULL DEFAULT 1,
    "validationState" TEXT NOT NULL DEFAULT 'NOT_VALIDATED', "validationSummary" TEXT NOT NULL DEFAULT '{}',
    "lastValidatedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaleDraft_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleDraft_taleId_updatedAt_idx" ON "TaleDraft"("taleId", "updatedAt");
CREATE UNIQUE INDEX "TaleDraft_taleId_revisionNumber_key" ON "TaleDraft"("taleId", "revisionNumber");

CREATE TABLE "TaleChapter" (
    "id" TEXT NOT NULL PRIMARY KEY, "draftRevisionId" TEXT NOT NULL, "title" TEXT NOT NULL, "subtitle" TEXT,
    "description" TEXT, "orderIndex" INTEGER NOT NULL, "coverAssetId" TEXT, "estimatedDuration" INTEGER,
    "entryBlockId" TEXT, "completionBlockId" TEXT, "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "metadata" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaleChapter_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleChapter_draftRevisionId_idx" ON "TaleChapter"("draftRevisionId");
CREATE UNIQUE INDEX "TaleChapter_draftRevisionId_orderIndex_key" ON "TaleChapter"("draftRevisionId", "orderIndex");

CREATE TABLE "StoryBlock" (
    "id" TEXT NOT NULL PRIMARY KEY, "chapterId" TEXT NOT NULL, "blockType" TEXT NOT NULL, "title" TEXT NOT NULL,
    "internalLabel" TEXT, "orderIndex" INTEGER NOT NULL, "configuration" TEXT NOT NULL DEFAULT '{}',
    "presentation" TEXT NOT NULL DEFAULT '{}', "completion" TEXT NOT NULL DEFAULT '{}', "nextBlockId" TEXT,
    "creatorNotes" TEXT, "isEnabled" BOOLEAN NOT NULL DEFAULT true, "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryBlock_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "TaleChapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StoryBlock_chapterId_blockType_idx" ON "StoryBlock"("chapterId", "blockType");
CREATE UNIQUE INDEX "StoryBlock_chapterId_orderIndex_key" ON "StoryBlock"("chapterId", "orderIndex");

CREATE TABLE "BlockConnection" (
    "id" TEXT NOT NULL PRIMARY KEY, "sourceBlockId" TEXT NOT NULL, "targetBlockId" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL DEFAULT 'DEFAULT', "conditionExpression" TEXT, "label" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockConnection_sourceBlockId_fkey" FOREIGN KEY ("sourceBlockId") REFERENCES "StoryBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlockConnection_targetBlockId_fkey" FOREIGN KEY ("targetBlockId") REFERENCES "StoryBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BlockConnection_targetBlockId_idx" ON "BlockConnection"("targetBlockId");
CREATE UNIQUE INDEX "BlockConnection_sourceBlockId_targetBlockId_connectionType_key" ON "BlockConnection"("sourceBlockId", "targetBlockId", "connectionType");

CREATE TABLE "PublishedTaleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL, "versionLabel" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "publishedBy" TEXT NOT NULL, "releaseNotes" TEXT,
    "contentSnapshot" TEXT NOT NULL, "schemaVersion" INTEGER NOT NULL DEFAULT 1, "checksum" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PublishedTaleVersion_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PublishedTaleVersion_taleId_isCurrent_idx" ON "PublishedTaleVersion"("taleId", "isCurrent");
CREATE UNIQUE INDEX "PublishedTaleVersion_taleId_versionNumber_key" ON "PublishedTaleVersion"("taleId", "versionNumber");

CREATE TABLE "TaleAsset" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "displayName" TEXT NOT NULL,
    "description" TEXT, "originalFilename" TEXT NOT NULL, "currentVariantId" TEXT, "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL, "width" INTEGER, "height" INTEGER, "duration" REAL, "checksum" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "TaleAsset_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleAsset_taleId_mediaType_deletedAt_idx" ON "TaleAsset"("taleId", "mediaType", "deletedAt");
CREATE UNIQUE INDEX "TaleAsset_taleId_checksum_key" ON "TaleAsset"("taleId", "checksum");

CREATE TABLE "TaleAssetVariant" (
    "id" TEXT NOT NULL PRIMARY KEY, "assetId" TEXT NOT NULL, "role" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL, "fileSize" INTEGER NOT NULL, "width" INTEGER, "height" INTEGER, "duration" REAL,
    "checksum" TEXT NOT NULL, "processingState" TEXT NOT NULL DEFAULT 'READY', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleAssetVariant_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TaleAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleAssetVariant_storageKey_key" ON "TaleAssetVariant"("storageKey");
CREATE INDEX "TaleAssetVariant_assetId_role_createdAt_idx" ON "TaleAssetVariant"("assetId", "role", "createdAt");

CREATE TABLE "TaleAssetTag" ("id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "TaleAssetTag_taleId_name_key" ON "TaleAssetTag"("taleId", "name");
CREATE TABLE "TaleAssetTagLink" (
    "assetId" TEXT NOT NULL, "tagId" TEXT NOT NULL, PRIMARY KEY ("assetId", "tagId"),
    CONSTRAINT "TaleAssetTagLink_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TaleAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaleAssetTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "TaleAssetTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleAssetTagLink_tagId_idx" ON "TaleAssetTagLink"("tagId");
CREATE TABLE "TaleAssetRole" (
    "id" TEXT NOT NULL PRIMARY KEY, "assetId" TEXT NOT NULL, "role" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleAssetRole_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TaleAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleAssetRole_assetId_role_key" ON "TaleAssetRole"("assetId", "role");

CREATE TABLE "TaleAssetCollection" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
    "collectionType" TEXT NOT NULL DEFAULT 'GENERAL', "locationId" TEXT, "artifactId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaleAssetCollection_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleAssetCollection_taleId_name_key" ON "TaleAssetCollection"("taleId", "name");
CREATE TABLE "TaleAssetCollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY, "collectionId" TEXT NOT NULL, "assetId" TEXT NOT NULL, "label" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0, "metadata" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleAssetCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "TaleAssetCollection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaleAssetCollectionItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "TaleAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleAssetCollectionItem_assetId_idx" ON "TaleAssetCollectionItem"("assetId");
CREATE UNIQUE INDEX "TaleAssetCollectionItem_collectionId_assetId_label_key" ON "TaleAssetCollectionItem"("collectionId", "assetId", "label");

CREATE TABLE "TaleLocation" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
    "region" TEXT, "generalDescription" TEXT, "playerFacingDescription" TEXT, "captainNotes" TEXT,
    "mapAssetId" TEXT, "displayAssetId" TEXT, "referenceCollectionId" TEXT, "verificationProfile" TEXT NOT NULL DEFAULT '{}',
    "orderIndex" INTEGER NOT NULL DEFAULT 0, "archivedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaleLocation_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleLocation_taleId_orderIndex_idx" ON "TaleLocation"("taleId", "orderIndex");
CREATE UNIQUE INDEX "TaleLocation_taleId_slug_key" ON "TaleLocation"("taleId", "slug");

CREATE TABLE "TaleArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "name" TEXT NOT NULL, "shortDescription" TEXT,
    "loreDescription" TEXT, "ordinaryGameObjectLabel" TEXT, "artworkAssetId" TEXT, "revealVideoAssetId" TEXT,
    "modelAssetId" TEXT, "inventoryCategory" TEXT NOT NULL DEFAULT 'RELIC', "collectionGroup" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0, "persistentAfterUnlock" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TaleArtifact_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleArtifact_taleId_sortOrder_idx" ON "TaleArtifact"("taleId", "sortOrder");

CREATE TABLE "TaleSession" (
    "id" TEXT NOT NULL PRIMARY KEY, "taleId" TEXT NOT NULL, "publishedVersionId" TEXT, "ownerLabel" TEXT,
    "captainId" TEXT, "accessTokenHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentChapterId" TEXT, "currentBlockId" TEXT, "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "previewMode" BOOLEAN NOT NULL DEFAULT false, "draftRevisionId" TEXT, "previewSnapshot" TEXT,
    "variables" TEXT NOT NULL DEFAULT '{}', "inventory" TEXT NOT NULL DEFAULT '[]',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME, "expiresAt" DATETIME, "lastHeartbeatAt" DATETIME,
    CONSTRAINT "TaleSession_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaleSession_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleSession_accessTokenHash_key" ON "TaleSession"("accessTokenHash");
CREATE INDEX "TaleSession_taleId_status_previewMode_idx" ON "TaleSession"("taleId", "status", "previewMode");
CREATE INDEX "TaleSession_publishedVersionId_status_idx" ON "TaleSession"("publishedVersionId", "status");

CREATE TABLE "TaleSessionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "publishedVersionId" TEXT NOT NULL, "blockId" TEXT,
    "eventType" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT, "idempotencyKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}', "sequence" INTEGER NOT NULL, "correlationId" TEXT,
    "verificationRequestId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleSessionEvent_idempotencyKey_key" ON "TaleSessionEvent"("idempotencyKey");
CREATE INDEX "TaleSessionEvent_sessionId_createdAt_idx" ON "TaleSessionEvent"("sessionId", "createdAt");
CREATE UNIQUE INDEX "TaleSessionEvent_sessionId_sequence_key" ON "TaleSessionEvent"("sessionId", "sequence");

CREATE TABLE "TaleVerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "blockId" TEXT NOT NULL, "providerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME, "expiresAt" DATETIME, "configurationSnapshot" TEXT NOT NULL DEFAULT '{}',
    "providerCorrelationId" TEXT, "satisfiedByEventId" TEXT,
    CONSTRAINT "TaleVerificationRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaleVerificationRequest_sessionId_status_requestedAt_idx" ON "TaleVerificationRequest"("sessionId", "status", "requestedAt");
CREATE INDEX "TaleVerificationRequest_blockId_status_idx" ON "TaleVerificationRequest"("blockId", "status");
CREATE TABLE "TaleVerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL, "eventId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1, "providerType" TEXT NOT NULL, "providerInstanceId" TEXT,
    "result" TEXT NOT NULL, "confidence" REAL, "evidence" TEXT NOT NULL DEFAULT '{}', "observedAt" DATETIME NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false, "rejectionReason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleVerificationEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TaleVerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleVerificationEvent_eventId_key" ON "TaleVerificationEvent"("eventId");
CREATE UNIQUE INDEX "TaleVerificationEvent_idempotencyKey_key" ON "TaleVerificationEvent"("idempotencyKey");
CREATE INDEX "TaleVerificationEvent_requestId_createdAt_idx" ON "TaleVerificationEvent"("requestId", "createdAt");

CREATE TABLE "TaleHelperPairing" (
    "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE', "expiresAt" DATETIME NOT NULL, "lastSeenAt" DATETIME,
    "revokedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaleHelperPairing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleHelperPairing_tokenHash_key" ON "TaleHelperPairing"("tokenHash");
CREATE INDEX "TaleHelperPairing_sessionId_status_idx" ON "TaleHelperPairing"("sessionId", "status");
