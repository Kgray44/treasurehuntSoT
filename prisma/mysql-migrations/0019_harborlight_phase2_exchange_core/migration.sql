CREATE TABLE `CommunityPackage` (
  `id` VARCHAR(191) NOT NULL, `releaseId` VARCHAR(191) NOT NULL, `packageSchema` INTEGER NOT NULL DEFAULT 1,
  `packageChecksum` VARCHAR(191) NOT NULL, `manifest` LONGTEXT NOT NULL, `byteLength` INTEGER NOT NULL,
  `storageStatus` VARCHAR(191) NOT NULL DEFAULT 'STAGED', `scanStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `finalizedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `CommunityPackage_releaseId_key` (`releaseId`), UNIQUE INDEX `CommunityPackage_packageChecksum_key` (`packageChecksum`),
  INDEX `CommunityPackage_storageStatus_scanStatus_idx` (`storageStatus`,`scanStatus`),
  CONSTRAINT `CommunityPackage_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `CommunityRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
