CREATE TABLE `ReusableAuthoringItem` (
  `id` VARCHAR(191) NOT NULL,
  `ownerAccountId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` LONGTEXT NOT NULL,
  `tags` LONGTEXT NOT NULL,
  `status` VARCHAR(64) NOT NULL DEFAULT 'ACTIVE',
  `currentVersionNumber` INT NOT NULL DEFAULT 1,
  `archivedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ReusableAuthoringItem_ownerAccountId_status_updatedAt_idx` (`ownerAccountId`, `status`, `updatedAt`),
  INDEX `ReusableAuthoringItem_ownerAccountId_kind_updatedAt_idx` (`ownerAccountId`, `kind`, `updatedAt`),
  CONSTRAINT `ReusableAuthoringItem_ownerAccountId_fkey` FOREIGN KEY (`ownerAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE `ReusableAuthoringItemVersion` (
  `id` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `versionNumber` INT NOT NULL,
  `envelope` LONGTEXT NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReusableAuthoringItemVersion_itemId_versionNumber_key` (`itemId`, `versionNumber`),
  INDEX `ReusableAuthoringItemVersion_checksum_idx` (`checksum`),
  CONSTRAINT `ReusableAuthoringItemVersion_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ReusableAuthoringItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ReusableAuthoringUsage` (
  `id` VARCHAR(191) NOT NULL,
  `draftId` VARCHAR(191) NOT NULL,
  `itemId` VARCHAR(191) NOT NULL,
  `versionId` VARCHAR(191) NOT NULL,
  `sourceKind` VARCHAR(64) NOT NULL,
  `insertedBlockIds` LONGTEXT NOT NULL,
  `insertedChapterIds` LONGTEXT NOT NULL,
  `provenance` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ReusableAuthoringUsage_draftId_createdAt_idx` (`draftId`, `createdAt`),
  INDEX `ReusableAuthoringUsage_itemId_createdAt_idx` (`itemId`, `createdAt`),
  INDEX `ReusableAuthoringUsage_versionId_idx` (`versionId`),
  CONSTRAINT `ReusableAuthoringUsage_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ReusableAuthoringUsage_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `ReusableAuthoringItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ReusableAuthoringUsage_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `ReusableAuthoringItemVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
);
