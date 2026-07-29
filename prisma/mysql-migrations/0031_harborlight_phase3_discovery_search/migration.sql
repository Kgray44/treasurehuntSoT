-- CreateTable
CREATE TABLE `CommunityListingDiscoveryMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `themes` VARCHAR(191) NOT NULL DEFAULT '[]',
    `secondaryCategories` VARCHAR(191) NOT NULL DEFAULT '[]',
    `durationMinimum` INTEGER NULL,
    `durationMaximum` INTEGER NULL,
    `minimumPlayerCount` INTEGER NULL,
    `maximumPlayerCount` INTEGER NULL,
    `environment` VARCHAR(191) NOT NULL DEFAULT 'NOT_APPLICABLE',
    `recommendedMinimumAge` INTEGER NULL,
    `recommendedMaximumAge` INTEGER NULL,
    `difficulty` VARCHAR(191) NULL,
    `travelRequirement` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `physicalPropRequirement` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `printingRequirement` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `setupComplexity` VARCHAR(191) NULL,
    `visionWaypointRequired` BOOLEAN NOT NULL DEFAULT false,
    `helperAppRequired` BOOLEAN NOT NULL DEFAULT false,
    `offlineSupport` BOOLEAN NOT NULL DEFAULT false,
    `mobileSupport` BOOLEAN NOT NULL DEFAULT false,
    `representation` VARCHAR(191) NOT NULL DEFAULT 'MIXED',
    `languages` VARCHAR(191) NOT NULL DEFAULT '[]',
    `accessibilityFeatures` VARCHAR(191) NOT NULL DEFAULT '[]',
    `minimumPlatformVersion` VARCHAR(191) NULL,
    `compatibilityFeatures` VARCHAR(191) NOT NULL DEFAULT '[]',
    `maintenanceState` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `freeContent` BOOLEAN NOT NULL DEFAULT true,
    `remixPermission` VARCHAR(191) NOT NULL DEFAULT 'PROHIBITED',
    `lastMeaningfulReleaseUpdate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityListingDiscoveryMetadata_listingId_key`(`listingId`),
    INDEX `CommunityListingDiscoveryMetadata_environment_difficulty_idx`(`environment`, `difficulty`),
    INDEX `CommunityListingDiscoveryMetadata_lastMeaningfulReleaseUpdat_idx`(`lastMeaningfulReleaseUpdate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunitySearchDocument` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `normalizedTitle` VARCHAR(191) NOT NULL,
    `normalizedSummary` VARCHAR(191) NOT NULL,
    `normalizedCreator` VARCHAR(191) NOT NULL,
    `searchableText` VARCHAR(191) NOT NULL,
    `publicProjectionVersion` INTEGER NOT NULL DEFAULT 1,
    `indexedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunitySearchDocument_listingId_key`(`listingId`),
    INDEX `CommunitySearchDocument_normalizedTitle_idx`(`normalizedTitle`),
    INDEX `CommunitySearchDocument_normalizedCreator_idx`(`normalizedCreator`),
    INDEX `CommunitySearchDocument_indexedAt_idx`(`indexedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunitySearchToken` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 1,

    INDEX `CommunitySearchToken_token_weight_idx`(`token`, `weight`),
    UNIQUE INDEX `CommunitySearchToken_documentId_token_key`(`documentId`, `token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityEditorialFeature` (
    `id` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `placement` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityEditorialFeature_placement_active_sortOrder_idx`(`placement`, `active`, `sortOrder`),
    UNIQUE INDEX `CommunityEditorialFeature_placement_subjectType_subjectId_key`(`placement`, `subjectType`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityListingAggregate` (
    `listingId` VARCHAR(191) NOT NULL,
    `installCount` INTEGER NOT NULL DEFAULT 0,
    `saveCount` INTEGER NOT NULL DEFAULT 0,
    `favoriteCount` INTEGER NOT NULL DEFAULT 0,
    `followCount` INTEGER NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `completionCount` INTEGER NOT NULL DEFAULT 0,
    `helpfulVoteCount` INTEGER NOT NULL DEFAULT 0,
    `averageRating` DOUBLE NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`listingId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityTrendBucket` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `bucketDate` DATETIME(3) NOT NULL,
    `installActors` INTEGER NOT NULL DEFAULT 0,
    `completionActors` INTEGER NOT NULL DEFAULT 0,
    `saveActors` INTEGER NOT NULL DEFAULT 0,
    `helpfulActors` INTEGER NOT NULL DEFAULT 0,
    `score` DOUBLE NOT NULL DEFAULT 0,

    INDEX `CommunityTrendBucket_bucketDate_score_idx`(`bucketDate`, `score`),
    UNIQUE INDEX `CommunityTrendBucket_listingId_bucketDate_key`(`listingId`, `bucketDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
