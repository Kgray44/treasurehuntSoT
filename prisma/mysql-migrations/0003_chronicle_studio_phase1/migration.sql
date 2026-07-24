-- AlterTable
ALTER TABLE `GameMasterUser` ADD COLUMN `capabilities` LONGTEXT NOT NULL DEFAULT ('[]'),
    ADD COLUMN `role` VARCHAR(191) NOT NULL DEFAULT 'CAPTAIN_CREATOR';

-- CreateTable
CREATE TABLE `TallTale` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NULL,
    `shortDescription` TEXT NULL,
    `longDescription` LONGTEXT NULL,
    `coverAssetId` VARCHAR(191) NULL,
    `theme` VARCHAR(191) NOT NULL DEFAULT 'CARTOGRAPHERS_TABLE',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `creatorId` VARCHAR(191) NOT NULL,
    `currentDraftRevisionId` VARCHAR(191) NULL,
    `latestPublishedVersionId` VARCHAR(191) NULL,
    `playerCountMin` INTEGER NOT NULL DEFAULT 1,
    `playerCountMax` INTEGER NOT NULL DEFAULT 4,
    `estimatedDuration` INTEGER NULL,
    `contentWarnings` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TallTale_slug_key`(`slug`),
    INDEX `TallTale_status_visibility_sortOrder_idx`(`status`, `visibility`, `sortOrder`),
    INDEX `TallTale_creatorId_updatedAt_idx`(`creatorId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleDraft` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `revisionNumber` INTEGER NOT NULL DEFAULT 1,
    `basedOnPublishedVersionId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `autosaveVersion` INTEGER NOT NULL DEFAULT 1,
    `validationState` VARCHAR(191) NOT NULL DEFAULT 'NOT_VALIDATED',
    `validationSummary` LONGTEXT NOT NULL DEFAULT ('{}'),
    `lastValidatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaleDraft_taleId_updatedAt_idx`(`taleId`, `updatedAt`),
    UNIQUE INDEX `TaleDraft_taleId_revisionNumber_key`(`taleId`, `revisionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleChapter` (
    `id` VARCHAR(191) NOT NULL,
    `draftRevisionId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `orderIndex` INTEGER NOT NULL,
    `coverAssetId` VARCHAR(191) NULL,
    `estimatedDuration` INTEGER NULL,
    `entryBlockId` VARCHAR(191) NULL,
    `completionBlockId` VARCHAR(191) NULL,
    `isOptional` BOOLEAN NOT NULL DEFAULT false,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaleChapter_draftRevisionId_idx`(`draftRevisionId`),
    UNIQUE INDEX `TaleChapter_draftRevisionId_orderIndex_key`(`draftRevisionId`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryBlock` (
    `id` VARCHAR(191) NOT NULL,
    `chapterId` VARCHAR(191) NOT NULL,
    `blockType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `internalLabel` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL,
    `configuration` LONGTEXT NOT NULL DEFAULT ('{}'),
    `presentation` LONGTEXT NOT NULL DEFAULT ('{}'),
    `completion` LONGTEXT NOT NULL DEFAULT ('{}'),
    `nextBlockId` VARCHAR(191) NULL,
    `creatorNotes` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StoryBlock_chapterId_blockType_idx`(`chapterId`, `blockType`),
    UNIQUE INDEX `StoryBlock_chapterId_orderIndex_key`(`chapterId`, `orderIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlockConnection` (
    `id` VARCHAR(191) NOT NULL,
    `sourceBlockId` VARCHAR(191) NOT NULL,
    `targetBlockId` VARCHAR(191) NOT NULL,
    `connectionType` VARCHAR(191) NOT NULL DEFAULT 'DEFAULT',
    `conditionExpression` TEXT NULL,
    `label` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BlockConnection_targetBlockId_idx`(`targetBlockId`),
    UNIQUE INDEX `BlockConnection_sourceBlockId_targetBlockId_connectionType_key`(`sourceBlockId`, `targetBlockId`, `connectionType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublishedTaleVersion` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `versionLabel` VARCHAR(191) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedBy` VARCHAR(191) NOT NULL,
    `releaseNotes` TEXT NULL,
    `contentSnapshot` LONGTEXT NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `checksum` VARCHAR(191) NOT NULL,
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,

    INDEX `PublishedTaleVersion_taleId_isCurrent_idx`(`taleId`, `isCurrent`),
    UNIQUE INDEX `PublishedTaleVersion_taleId_versionNumber_key`(`taleId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAsset` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `mediaType` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `originalFilename` VARCHAR(191) NOT NULL,
    `currentVariantId` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` DOUBLE NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `TaleAsset_taleId_mediaType_deletedAt_idx`(`taleId`, `mediaType`, `deletedAt`),
    UNIQUE INDEX `TaleAsset_taleId_checksum_key`(`taleId`, `checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetVariant` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration` DOUBLE NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `processingState` VARCHAR(191) NOT NULL DEFAULT 'READY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleAssetVariant_storageKey_key`(`storageKey`),
    INDEX `TaleAssetVariant_assetId_role_createdAt_idx`(`assetId`, `role`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetTag` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleAssetTag_taleId_name_key`(`taleId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetTagLink` (
    `assetId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,

    INDEX `TaleAssetTagLink_tagId_idx`(`tagId`),
    PRIMARY KEY (`assetId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetRole` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleAssetRole_assetId_role_key`(`assetId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetCollection` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `collectionType` VARCHAR(191) NOT NULL DEFAULT 'GENERAL',
    `locationId` VARCHAR(191) NULL,
    `artifactId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TaleAssetCollection_taleId_name_key`(`taleId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleAssetCollectionItem` (
    `id` VARCHAR(191) NOT NULL,
    `collectionId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `metadata` LONGTEXT NOT NULL DEFAULT ('{}'),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaleAssetCollectionItem_assetId_idx`(`assetId`),
    UNIQUE INDEX `TaleAssetCollectionItem_collectionId_assetId_label_key`(`collectionId`, `assetId`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleLocation` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `generalDescription` TEXT NULL,
    `playerFacingDescription` LONGTEXT NULL,
    `captainNotes` LONGTEXT NULL,
    `mapAssetId` VARCHAR(191) NULL,
    `displayAssetId` VARCHAR(191) NULL,
    `referenceCollectionId` VARCHAR(191) NULL,
    `verificationProfile` LONGTEXT NOT NULL DEFAULT ('{}'),
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaleLocation_taleId_orderIndex_idx`(`taleId`, `orderIndex`),
    UNIQUE INDEX `TaleLocation_taleId_slug_key`(`taleId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortDescription` TEXT NULL,
    `loreDescription` LONGTEXT NULL,
    `ordinaryGameObjectLabel` VARCHAR(191) NULL,
    `artworkAssetId` VARCHAR(191) NULL,
    `revealVideoAssetId` VARCHAR(191) NULL,
    `modelAssetId` VARCHAR(191) NULL,
    `inventoryCategory` VARCHAR(191) NOT NULL DEFAULT 'RELIC',
    `collectionGroup` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `persistentAfterUnlock` BOOLEAN NOT NULL DEFAULT true,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaleArtifact_taleId_sortOrder_idx`(`taleId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleSession` (
    `id` VARCHAR(191) NOT NULL,
    `taleId` VARCHAR(191) NOT NULL,
    `publishedVersionId` VARCHAR(191) NULL,
    `ownerLabel` VARCHAR(191) NULL,
    `captainId` VARCHAR(191) NULL,
    `accessTokenHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `currentChapterId` VARCHAR(191) NULL,
    `currentBlockId` VARCHAR(191) NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `previewMode` BOOLEAN NOT NULL DEFAULT false,
    `draftRevisionId` VARCHAR(191) NULL,
    `previewSnapshot` LONGTEXT NULL,
    `variables` LONGTEXT NOT NULL DEFAULT ('{}'),
    `inventory` LONGTEXT NOT NULL DEFAULT ('[]'),
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `lastHeartbeatAt` DATETIME(3) NULL,

    UNIQUE INDEX `TaleSession_accessTokenHash_key`(`accessTokenHash`),
    INDEX `TaleSession_taleId_status_previewMode_idx`(`taleId`, `status`, `previewMode`),
    INDEX `TaleSession_publishedVersionId_status_idx`(`publishedVersionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleSessionEvent` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `publishedVersionId` VARCHAR(191) NOT NULL,
    `blockId` VARCHAR(191) NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL DEFAULT ('{}'),
    `sequence` INTEGER NOT NULL,
    `correlationId` VARCHAR(191) NULL,
    `verificationRequestId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleSessionEvent_idempotencyKey_key`(`idempotencyKey`),
    INDEX `TaleSessionEvent_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    UNIQUE INDEX `TaleSessionEvent_sessionId_sequence_key`(`sessionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleVerificationRequest` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `blockId` VARCHAR(191) NOT NULL,
    `providerType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `configurationSnapshot` LONGTEXT NOT NULL DEFAULT ('{}'),
    `providerCorrelationId` VARCHAR(191) NULL,
    `satisfiedByEventId` VARCHAR(191) NULL,

    INDEX `TaleVerificationRequest_sessionId_status_requestedAt_idx`(`sessionId`, `status`, `requestedAt`),
    INDEX `TaleVerificationRequest_blockId_status_idx`(`blockId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleVerificationEvent` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `providerType` VARCHAR(191) NOT NULL,
    `providerInstanceId` VARCHAR(191) NULL,
    `result` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NULL,
    `evidence` LONGTEXT NOT NULL DEFAULT ('{}'),
    `observedAt` DATETIME(3) NOT NULL,
    `accepted` BOOLEAN NOT NULL DEFAULT false,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleVerificationEvent_eventId_key`(`eventId`),
    UNIQUE INDEX `TaleVerificationEvent_idempotencyKey_key`(`idempotencyKey`),
    INDEX `TaleVerificationEvent_requestId_createdAt_idx`(`requestId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaleHelperPairing` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TaleHelperPairing_tokenHash_key`(`tokenHash`),
    INDEX `TaleHelperPairing_sessionId_status_idx`(`sessionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TaleDraft` ADD CONSTRAINT `TaleDraft_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleChapter` ADD CONSTRAINT `TaleChapter_draftRevisionId_fkey` FOREIGN KEY (`draftRevisionId`) REFERENCES `TaleDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryBlock` ADD CONSTRAINT `StoryBlock_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `TaleChapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlockConnection` ADD CONSTRAINT `BlockConnection_sourceBlockId_fkey` FOREIGN KEY (`sourceBlockId`) REFERENCES `StoryBlock`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlockConnection` ADD CONSTRAINT `BlockConnection_targetBlockId_fkey` FOREIGN KEY (`targetBlockId`) REFERENCES `StoryBlock`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PublishedTaleVersion` ADD CONSTRAINT `PublishedTaleVersion_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAsset` ADD CONSTRAINT `TaleAsset_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetVariant` ADD CONSTRAINT `TaleAssetVariant_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `TaleAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetTagLink` ADD CONSTRAINT `TaleAssetTagLink_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `TaleAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetTagLink` ADD CONSTRAINT `TaleAssetTagLink_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `TaleAssetTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetRole` ADD CONSTRAINT `TaleAssetRole_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `TaleAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetCollection` ADD CONSTRAINT `TaleAssetCollection_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetCollectionItem` ADD CONSTRAINT `TaleAssetCollectionItem_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `TaleAssetCollection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleAssetCollectionItem` ADD CONSTRAINT `TaleAssetCollectionItem_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `TaleAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleLocation` ADD CONSTRAINT `TaleLocation_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleArtifact` ADD CONSTRAINT `TaleArtifact_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleSession` ADD CONSTRAINT `TaleSession_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleSession` ADD CONSTRAINT `TaleSession_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `PublishedTaleVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleSessionEvent` ADD CONSTRAINT `TaleSessionEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleVerificationRequest` ADD CONSTRAINT `TaleVerificationRequest_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleVerificationEvent` ADD CONSTRAINT `TaleVerificationEvent_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `TaleVerificationRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaleHelperPairing` ADD CONSTRAINT `TaleHelperPairing_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
