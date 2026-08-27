ALTER TABLE `TaleSession` ADD COLUMN `captainAuthorityState` VARCHAR(32) NOT NULL DEFAULT 'ASSIGNED';
CREATE INDEX `TaleSession_captainAuthorityState_status_idx` ON `TaleSession` (`captainAuthorityState`, `status`);

CREATE TABLE `VoyageCaptainAuthorityReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `voyageId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `previousCaptainAccountId` VARCHAR(191) NULL,
  `nextCaptainAccountId` VARCHAR(191) NULL,
  `authorityState` VARCHAR(32) NOT NULL,
  `sourceConcurrencyVersion` INT NOT NULL,
  `sourceSequence` INT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `safeReason` VARCHAR(191) NULL,
  `committedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VoyageCaptainAuthorityReceipt_idempotencyKey_key` (`idempotencyKey`),
  UNIQUE KEY `VoyageCaptainAuthorityReceipt_correlationId_key` (`correlationId`),
  KEY `VoyageCaptainAuthorityReceipt_voyageId_committedAt_idx` (`voyageId`, `committedAt`),
  KEY `VoyageCaptainAuthorityReceipt_nextCaptainAccountId_committedAt_idx` (`nextCaptainAccountId`, `committedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VoyageForkLineage` (
  `id` VARCHAR(191) NOT NULL,
  `parentVoyageId` VARCHAR(191) NOT NULL,
  `childVoyageId` VARCHAR(191) NOT NULL,
  `sourceConcurrencyVersion` INT NOT NULL,
  `sourceSequence` INT NOT NULL,
  `requesterPlayerProfileId` VARCHAR(191) NOT NULL,
  `requesterAccountId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VoyageForkLineage_childVoyageId_key` (`childVoyageId`),
  UNIQUE KEY `VoyageForkLineage_idempotencyKey_key` (`idempotencyKey`),
  UNIQUE KEY `VoyageForkLineage_correlationId_key` (`correlationId`),
  KEY `VoyageForkLineage_parentVoyageId_createdAt_idx` (`parentVoyageId`, `createdAt`),
  KEY `VoyageForkLineage_requesterPlayerProfileId_createdAt_idx` (`requesterPlayerProfileId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
