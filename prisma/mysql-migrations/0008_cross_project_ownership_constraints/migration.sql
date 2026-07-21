-- Applied only after 0005 One Voyage, 0006 Wayfarer, and 0007 Sealed Hold.
ALTER TABLE `PrivateContentImport`
  ADD COLUMN `ownerAccountId` VARCHAR(191) NULL,
  ADD INDEX `PrivateContentImport_ownerAccountId_createdAt_idx` (`ownerAccountId`, `createdAt`),
  ADD INDEX `PrivateContentImport_sourceTaleId_idx` (`sourceTaleId`),
  ADD CONSTRAINT `PrivateContentImport_ownerAccountId_fkey` FOREIGN KEY (`ownerAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PrivateContentImport_sourceTaleId_fkey` FOREIGN KEY (`sourceTaleId`) REFERENCES `Chronicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PrivateAssetReference`
  ADD COLUMN `ownerAccountId` VARCHAR(191) NULL,
  ADD INDEX `PrivateAssetReference_ownerAccountId_idx` (`ownerAccountId`),
  ADD INDEX `PrivateAssetReference_taleId_idx` (`taleId`),
  ADD CONSTRAINT `PrivateAssetReference_ownerAccountId_fkey` FOREIGN KEY (`ownerAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PrivateAssetReference_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `Chronicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `PrivateAssetReference_playthroughId_fkey` FOREIGN KEY (`playthroughId`) REFERENCES `TaleSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
