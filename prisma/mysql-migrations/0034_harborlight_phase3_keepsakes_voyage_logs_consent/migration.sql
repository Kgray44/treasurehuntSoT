-- CreateTable
CREATE TABLE `CommunityVoyageKeepsake` (
    `id` VARCHAR(191) NOT NULL,
    `ownerAccountId` VARCHAR(191) NOT NULL,
    `taleSessionId` VARCHAR(191) NOT NULL,
    `publishedVersionId` VARCHAR(191) NULL,
    `safeSnapshot` VARCHAR(191) NOT NULL,
    `favoriteMoment` VARCHAR(191) NULL,
    `representationChecksum` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'READY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunityVoyageKeepsake_taleSessionId_idx`(`taleSessionId`),
    UNIQUE INDEX `CommunityVoyageKeepsake_ownerAccountId_taleSessionId_key`(`ownerAccountId`, `taleSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLog` (
    `id` VARCHAR(191) NOT NULL,
    `keepsakeId` VARCHAR(191) NOT NULL,
    `ownerAccountId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `visibility` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `title` VARCHAR(191) NOT NULL,
    `safeSummary` VARCHAR(191) NULL,
    `spoilerLevel` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `approximateLocation` VARCHAR(191) NULL,
    `verifiedCompletion` BOOLEAN NOT NULL DEFAULT false,
    `commentsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityVoyageLog_keepsakeId_key`(`keepsakeId`),
    UNIQUE INDEX `CommunityVoyageLog_slug_key`(`slug`),
    INDEX `CommunityVoyageLog_visibility_publishedAt_idx`(`visibility`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLogParticipant` (
    `id` VARCHAR(191) NOT NULL,
    `voyageLogId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NULL,
    `displayNameSnapshot` VARCHAR(191) NOT NULL,
    `isChild` BOOLEAN NOT NULL DEFAULT false,

    INDEX `CommunityVoyageLogParticipant_voyageLogId_idx`(`voyageLogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLogParticipantConsent` (
    `id` VARCHAR(191) NOT NULL,
    `voyageLogId` VARCHAR(191) NOT NULL,
    `participantId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `grantedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CommunityVoyageLogParticipantConsent_voyageLogId_participant_key`(`voyageLogId`, `participantId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLogMedia` (
    `id` VARCHAR(191) NOT NULL,
    `voyageLogId` VARCHAR(191) NOT NULL,
    `privateMediaReference` VARCHAR(191) NOT NULL,
    `derivativeChecksum` VARCHAR(191) NOT NULL,
    `derivativeStorageReference` VARCHAR(191) NOT NULL,
    `processingStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `scanStatus` VARCHAR(191) NOT NULL DEFAULT 'SCAN_NOT_CONFIGURED',
    `exifGpsRemoved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunityVoyageLogMedia_voyageLogId_derivativeChecksum_key`(`voyageLogId`, `derivativeChecksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLogMediaConsent` (
    `id` VARCHAR(191) NOT NULL,
    `voyageLogMediaId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `grantedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CommunityVoyageLogMediaConsent_voyageLogMediaId_accountId_pu_key`(`voyageLogMediaId`, `accountId`, `purpose`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityVoyageLogShareRestriction` (
    `id` VARCHAR(191) NOT NULL,
    `voyageLogId` VARCHAR(191) NOT NULL,
    `restrictionType` VARCHAR(191) NOT NULL,
    `subjectReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityVoyageLogShareRestriction_voyageLogId_restrictionTy_idx`(`voyageLogId`, `restrictionType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
