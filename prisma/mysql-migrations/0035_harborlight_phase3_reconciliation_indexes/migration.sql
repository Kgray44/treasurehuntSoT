-- CreateTable
CREATE TABLE `CommunityGuideContent` (
    `id` VARCHAR(191) NOT NULL,
    `ownerProfileId` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `safeSummary` VARCHAR(191) NOT NULL,
    `sanitizedBody` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `deprecatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CommunityGuideContent_slug_key`(`slug`),
    INDEX `CommunityGuideContent_status_category_publishedAt_idx`(`status`, `category`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
