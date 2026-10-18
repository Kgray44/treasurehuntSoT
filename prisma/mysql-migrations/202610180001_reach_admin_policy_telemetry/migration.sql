-- Reach-owned policy and automatic numeric aggregate reports. No camera or user identity data.
CREATE TABLE `ReachRuntimePolicy` (
  `id` VARCHAR(64) NOT NULL,
  `revision` INTEGER NOT NULL,
  `policy` LONGTEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReachPolicyPreview` (
  `id` VARCHAR(36) NOT NULL,
  `actorAccountId` VARCHAR(191) NOT NULL,
  `accountSessionId` VARCHAR(191) NOT NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `expectedRevision` INTEGER NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `ReachPolicyPreview_expiresAt_idx` (`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReachPolicyChange` (
  `id` VARCHAR(36) NOT NULL,
  `actorAccountId` VARCHAR(191) NOT NULL,
  `accountSessionId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `expectedRevision` INTEGER NOT NULL,
  `resultingRevision` INTEGER NOT NULL,
  `beforeState` LONGTEXT NOT NULL,
  `afterState` LONGTEXT NOT NULL,
  `reason` VARCHAR(240) NOT NULL,
  `correlationId` VARCHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReachPolicyChange_idempotencyKey_key` (`idempotencyKey`),
  INDEX `ReachPolicyChange_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ReachTelemetryReport` (
  `id` VARCHAR(36) NOT NULL,
  `idempotencyKey` VARCHAR(36) NOT NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `reportVersion` INTEGER NOT NULL,
  `report` LONGTEXT NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReachTelemetryReport_idempotencyKey_key` (`idempotencyKey`),
  INDEX `ReachTelemetryReport_receivedAt_idx` (`receivedAt`),
  INDEX `ReachTelemetryReport_expiresAt_idx` (`expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
