-- Project Homeport Phase 7 owner correction Round 3: verification, workspace entry, media crop lifecycle, and provider receipts.
ALTER TABLE `UserAccount`
  ADD COLUMN `ordinaryWorkspaceEntryAt` DATETIME(3) NULL;

ALTER TABLE `AccountToken`
  ADD COLUMN `attemptCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `maxAttempts` INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN `lastAttemptAt` DATETIME(3) NULL;

ALTER TABLE `AccountSession`
  ADD COLUMN `sessionType` VARCHAR(32) NOT NULL DEFAULT 'ORDINARY';

CREATE TABLE `TransactionalEmailDelivery` (
  `id` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `accountTokenId` VARCHAR(191) NULL,
  `purpose` VARCHAR(64) NOT NULL,
  `provider` VARCHAR(32) NOT NULL,
  `recipientHash` CHAR(64) NOT NULL,
  `providerMessageId` VARCHAR(191) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `submittedAt` DATETIME(3) NULL,
  `deliveredAt` DATETIME(3) NULL,
  `bouncedAt` DATETIME(3) NULL,
  `failureCode` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TransactionalEmailDelivery_accountTokenId_key`(`accountTokenId`),
  UNIQUE INDEX `TransactionalEmailDelivery_providerMessageId_key`(`providerMessageId`),
  INDEX `TransactionalEmailDelivery_accountId_purpose_createdAt_idx`(`accountId`, `purpose`, `createdAt`),
  INDEX `TransactionalEmailDelivery_status_createdAt_idx`(`status`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TransactionalEmailDelivery_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TransactionalEmailDelivery_accountTokenId_fkey` FOREIGN KEY (`accountTokenId`) REFERENCES `AccountToken`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TransactionalEmailEvent` (
  `id` VARCHAR(191) NOT NULL,
  `providerEventKey` VARCHAR(255) NOT NULL,
  `providerMessageId` VARCHAR(191) NOT NULL,
  `recordType` VARCHAR(32) NOT NULL,
  `payloadChecksum` CHAR(64) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `TransactionalEmailEvent_providerEventKey_key`(`providerEventKey`),
  INDEX `TransactionalEmailEvent_providerMessageId_recordType_idx`(`providerMessageId`, `recordType`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProfileMedia`
  ADD COLUMN `ownerAccountId` VARCHAR(191) NULL,
  ADD COLUMN `originalStorageKey` VARCHAR(255) NULL,
  ADD COLUMN `originalMimeType` VARCHAR(191) NULL,
  ADD COLUMN `originalByteLength` INTEGER NULL,
  ADD COLUMN `originalWidth` INTEGER NULL,
  ADD COLUMN `originalHeight` INTEGER NULL,
  ADD COLUMN `checksum` CHAR(64) NULL,
  ADD COLUMN `cropCenterX` DOUBLE NOT NULL DEFAULT 0.5,
  ADD COLUMN `cropCenterY` DOUBLE NOT NULL DEFAULT 0.5,
  ADD COLUMN `cropScale` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN `cropAspect` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN `sourceOrientation` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `rotation` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `processingState` VARCHAR(32) NOT NULL DEFAULT 'READY',
  ADD COLUMN `scanState` VARCHAR(32) NOT NULL DEFAULT 'LOCAL_VALIDATED',
  ADD COLUMN `replacesMediaId` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD UNIQUE INDEX `ProfileMedia_originalStorageKey_key`(`originalStorageKey`),
  ADD INDEX `ProfileMedia_ownerAccountId_processingState_scanState_idx`(`ownerAccountId`, `processingState`, `scanState`),
  ADD CONSTRAINT `ProfileMedia_ownerAccountId_fkey` FOREIGN KEY (`ownerAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `ProfileMedia_replacesMediaId_fkey` FOREIGN KEY (`replacesMediaId`) REFERENCES `ProfileMedia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `ProfileMedia` AS media
INNER JOIN `PlayerProfile` AS profile ON profile.`id` = media.`profileId`
SET media.`ownerAccountId` = profile.`accountId`,
    media.`cropAspect` = CASE WHEN media.`kind` = 'BANNER' THEN 2.5 ELSE 1 END;
