-- Project Homeport Phase 7 owner correction Round 1: additive account and participation lifecycle gaps.
ALTER TABLE `AccountToken`
  ADD COLUMN `pendingNormalizedEmail` VARCHAR(254) NULL,
  ADD COLUMN `pendingDisplayEmail` VARCHAR(254) NULL;

ALTER TABLE `PlaythroughMembership`
  ADD COLUMN `participationAlias` VARCHAR(80) NULL,
  ADD COLUMN `participationAliasEditedAt` DATETIME(3) NULL;

CREATE TABLE `AccountDataExport` (
  `id` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `state` VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
  `schemaVersion` INTEGER NOT NULL DEFAULT 1,
  `manifest` LONGTEXT NOT NULL,
  `payload` LONGTEXT NULL,
  `checksum` CHAR(64) NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `buildingAt` DATETIME(3) NULL,
  `readyAt` DATETIME(3) NULL,
  `failedAt` DATETIME(3) NULL,
  `expiresAt` DATETIME(3) NULL,
  `downloadedAt` DATETIME(3) NULL,
  `failureSummary` VARCHAR(500) NULL,
  INDEX `AccountDataExport_accountId_requestedAt_idx`(`accountId`, `requestedAt`),
  INDEX `AccountDataExport_state_expiresAt_idx`(`state`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AccountDataExport_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AccountLifecycleRequest` (
  `id` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(32) NOT NULL,
  `state` VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
  `schemaVersion` INTEGER NOT NULL DEFAULT 1,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `scheduledFor` DATETIME(3) NULL,
  `cancellableUntil` DATETIME(3) NULL,
  `canceledAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `reason` VARCHAR(500) NULL,
  INDEX `AccountLifecycleRequest_accountId_kind_state_idx`(`accountId`, `kind`, `state`),
  INDEX `AccountLifecycleRequest_kind_state_scheduledFor_idx`(`kind`, `state`, `scheduledFor`),
  PRIMARY KEY (`id`),
  CONSTRAINT `AccountLifecycleRequest_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
