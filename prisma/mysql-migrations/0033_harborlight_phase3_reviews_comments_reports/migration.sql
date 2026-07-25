-- CreateTable
CREATE TABLE `CommunityReview` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `authorAccountId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `spoilerFreeBody` VARCHAR(191) NULL,
    `spoilerBody` VARCHAR(191) NULL,
    `spoilerLevel` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `verifiedInstallation` BOOLEAN NOT NULL DEFAULT false,
    `verifiedCompletion` BOOLEAN NOT NULL DEFAULT false,
    `completionSessionId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CommunityReview_listingId_status_createdAt_idx`(`listingId`, `status`, `createdAt`),
    UNIQUE INDEX `CommunityReview_listingId_authorAccountId_key`(`listingId`, `authorAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityReviewDimension` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `dimension` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,

    UNIQUE INDEX `CommunityReviewDimension_reviewId_dimension_key`(`reviewId`, `dimension`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityReviewHelpfulVote` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunityReviewHelpfulVote_reviewId_accountId_key`(`reviewId`, `accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityCreatorResponse` (
    `id` VARCHAR(191) NOT NULL,
    `reviewId` VARCHAR(191) NOT NULL,
    `creatorAccountId` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CommunityCreatorResponse_reviewId_key`(`reviewId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityComment` (
    `id` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `authorAccountId` VARCHAR(191) NOT NULL,
    `parentCommentId` VARCHAR(191) NULL,
    `depth` INTEGER NOT NULL DEFAULT 0,
    `body` VARCHAR(191) NOT NULL,
    `spoilerBody` VARCHAR(191) NULL,
    `spoilerLevel` VARCHAR(191) NOT NULL DEFAULT 'NONE',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `editedAt` DATETIME(3) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityComment_subjectType_subjectId_createdAt_idx`(`subjectType`, `subjectId`, `createdAt`),
    INDEX `CommunityComment_parentCommentId_idx`(`parentCommentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateTable
CREATE TABLE `CommunityReport` (
    `id` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `reporterAccountId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `detail` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommunityReport_subjectType_subjectId_status_idx`(`subjectType`, `subjectId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
