CREATE TABLE `VoyageCrewMessage` (
 `id` INTEGER NOT NULL AUTO_INCREMENT,
 `voyageId` VARCHAR(191) NOT NULL,
 `senderAccountId` VARCHAR(191) NOT NULL,
 `senderName` VARCHAR(191) NOT NULL,
 `body` TEXT NOT NULL,
 `clientMessageId` VARCHAR(191) NOT NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE INDEX `VoyageCrewMessage_voyageId_senderAccountId_clientMessageId_key` (`voyageId`, `senderAccountId`, `clientMessageId`),
 INDEX `VoyageCrewMessage_voyageId_id_idx` (`voyageId`, `id`),
 INDEX `VoyageCrewMessage_voyageId_senderAccountId_createdAt_idx` (`voyageId`, `senderAccountId`, `createdAt`),
 CONSTRAINT `VoyageCrewMessage_voyageId_fkey` FOREIGN KEY (`voyageId`) REFERENCES `TaleSession` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `VoyageCrewMessage_senderAccountId_fkey` FOREIGN KEY (`senderAccountId`) REFERENCES `UserAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
