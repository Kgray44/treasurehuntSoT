ALTER TABLE `AdminAuditLog`
  ADD COLUMN `correlationId` VARCHAR(191) NULL,
  ADD COLUMN `outcome` VARCHAR(191) NOT NULL DEFAULT 'SUCCEEDED',
  ADD COLUMN `reason` TEXT NULL;

CREATE TABLE `PlayerPresence` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `playerAccessId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `route` VARCHAR(191) NULL,
  `visibility` VARCHAR(191) NULL,
  `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastHeartbeatAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `disconnectedAt` DATETIME(3) NULL,
  `acknowledgedSequence` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `PlayerPresence_campaignId_deviceId_key`(`campaignId`, `deviceId`),
  INDEX `PlayerPresence_campaignId_lastHeartbeatAt_idx`(`campaignId`, `lastHeartbeatAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PlayerPresence_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PlayerPresence_playerAccessId_fkey` FOREIGN KEY (`playerAccessId`) REFERENCES `PlayerAccess`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PreparedAction` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `command` VARCHAR(191) NOT NULL,
  `targetKey` VARCHAR(191) NULL,
  `payload` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PREPARED',
  `expectedSequence` INTEGER NOT NULL,
  `scheduledFor` DATETIME(3) NULL,
  `preparedBy` VARCHAR(191) NOT NULL,
  `preparedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `executedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  INDEX `PreparedAction_campaignId_status_scheduledFor_idx`(`campaignId`, `status`, `scheduledFor`),
  PRIMARY KEY (`id`),
  CONSTRAINT `PreparedAction_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommandExecution` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `command` VARCHAR(191) NOT NULL,
  `expectedSequence` INTEGER NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `result` LONGTEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  UNIQUE INDEX `CommandExecution_campaignId_idempotencyKey_key`(`campaignId`, `idempotencyKey`),
  INDEX `CommandExecution_campaignId_createdAt_idx`(`campaignId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CommandExecution_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
