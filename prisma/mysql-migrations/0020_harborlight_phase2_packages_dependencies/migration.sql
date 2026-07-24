CREATE TABLE `CommunityPackageItem` (
  `id` VARCHAR(191) NOT NULL, `packageId` VARCHAR(191) NOT NULL, `logicalId` VARCHAR(191) NOT NULL, `itemType` VARCHAR(191) NOT NULL,
  `relativePath` VARCHAR(191) NOT NULL, `checksum` VARCHAR(191) NOT NULL, `mediaType` VARCHAR(191) NOT NULL, `byteLength` INTEGER NOT NULL,
  `metadata` LONGTEXT NOT NULL, `accessibility` LONGTEXT NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `CommunityPackageItem_packageId_logicalId_key` (`packageId`,`logicalId`), UNIQUE INDEX `CommunityPackageItem_packageId_relativePath_key` (`packageId`,`relativePath`), INDEX `CommunityPackageItem_packageId_itemType_idx` (`packageId`,`itemType`),
  CONSTRAINT `CommunityPackageItem_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `CommunityPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `CommunityPackageDependency` (
  `id` VARCHAR(191) NOT NULL, `packageId` VARCHAR(191) NOT NULL, `dependentLogicalId` VARCHAR(191) NOT NULL, `requiredPackageId` VARCHAR(191) NULL, `requiredLogicalId` VARCHAR(191) NOT NULL, `versionRange` VARCHAR(191) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `CommunityPackageDependency_packageId_dependentLogicalId_requiredLogicalId_key` (`packageId`,`dependentLogicalId`,`requiredLogicalId`), INDEX `CommunityPackageDependency_packageId_idx` (`packageId`),
  CONSTRAINT `CommunityPackageDependency_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `CommunityPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
