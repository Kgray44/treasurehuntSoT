-- CreateTable
CREATE TABLE `CommunityCreatorFollow` (
    `id` VARCHAR(191) NOT NULL,
    `followerAccountId` VARCHAR(191) NOT NULL,
    `creatorProfileId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityCreatorFollow_creatorProfileId_createdAt_idx`(`creatorProfileId`, `createdAt`),
    UNIQUE INDEX `CommunityCreatorFollow_followerAccountId_creatorProfileId_key`(`followerAccountId`, `creatorProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityBlock` (
    `id` VARCHAR(191) NOT NULL,
    `blockerAccountId` VARCHAR(191) NOT NULL,
    `blockedAccountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityBlock_blockedAccountId_idx`(`blockedAccountId`),
    UNIQUE INDEX `CommunityBlock_blockerAccountId_blockedAccountId_key`(`blockerAccountId`, `blockedAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunitySave` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL DEFAULT 'SAVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunitySave_subjectType_subjectId_createdAt_idx`(`subjectType`, `subjectId`, `createdAt`),
    UNIQUE INDEX `CommunitySave_accountId_subjectType_subjectId_kind_key`(`accountId`, `subjectType`, `subjectId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityCollection` (
    `id` VARCHAR(191) NOT NULL,
    `ownerAccountId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityCollection_slug_key`(`slug`),
    INDEX `CommunityCollection_ownerAccountId_visibility_idx`(`ownerAccountId`, `visibility`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityCollectionItem` (
    `id` VARCHAR(191) NOT NULL,
    `collectionId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityCollectionItem_collectionId_position_idx`(`collectionId`, `position`),
    UNIQUE INDEX `CommunityCollectionItem_collectionId_subjectType_subjectId_key`(`collectionId`, `subjectType`, `subjectId`),
    UNIQUE INDEX `CommunityCollectionItem_collectionId_position_key`(`collectionId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityProfileFeaturedItem` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,

    UNIQUE INDEX `CommunityProfileFeaturedItem_profileId_subjectType_subjectId_key`(`profileId`, `subjectType`, `subjectId`),
    UNIQUE INDEX `CommunityProfileFeaturedItem_profileId_position_key`(`profileId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityBadgeDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `grantPolicy` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunityBadgeDefinition_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityProfileBadgeGrant` (
    `id` VARCHAR(191) NOT NULL,
    `profileId` VARCHAR(191) NOT NULL,
    `badgeId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `grantedByAccountId` VARCHAR(191) NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunityProfileBadgeGrant_profileId_badgeId_key`(`profileId`, `badgeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
