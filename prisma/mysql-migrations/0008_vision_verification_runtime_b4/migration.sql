ALTER TABLE `VisionBuildJob`
  ADD COLUMN `packageId` VARCHAR(191) NULL,
  ADD COLUMN `packageHash` VARCHAR(191) NULL,
  ADD COLUMN `report` LONGTEXT NULL,
  ADD COLUMN `providerMetadata` LONGTEXT NULL,
  ADD COLUMN `reliabilityGrade` VARCHAR(191) NULL,
  ADD COLUMN `automaticEligibility` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lastHeartbeatAt` DATETIME(3) NULL,
  ADD COLUMN `cancellationRequestedAt` DATETIME(3) NULL;

UPDATE `VisionBuildJob` SET `report` = '{}' WHERE `report` IS NULL;
UPDATE `VisionBuildJob` SET `providerMetadata` = '{}' WHERE `providerMetadata` IS NULL;
ALTER TABLE `VisionBuildJob`
  MODIFY COLUMN `report` LONGTEXT NOT NULL,
  MODIFY COLUMN `providerMetadata` LONGTEXT NOT NULL;

CREATE TABLE `VisionShadowAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `waypointId` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `packageHash` VARCHAR(191) NULL,
    `stageTokenHash` VARCHAR(191) NOT NULL,
    `result` VARCHAR(191) NOT NULL,
    `guidanceCode` VARCHAR(191) NULL,
    `failedGates` LONGTEXT NOT NULL,
    `evidenceDigest` VARCHAR(191) NULL,
    `engineVersion` VARCHAR(191) NOT NULL,
    `modelBundleVersion` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerFallbackUsed` BOOLEAN NOT NULL DEFAULT false,
    `capturedFrameCount` INTEGER NOT NULL DEFAULT 0,
    `usableFrameCount` INTEGER NOT NULL DEFAULT 0,
    `passingFrameCount` INTEGER NOT NULL DEFAULT 0,
    `durationMs` INTEGER NOT NULL,
    `diagnostics` LONGTEXT NOT NULL,
    `humanTruthLabel` VARCHAR(191) NULL,
    `captainDisposition` VARCHAR(191) NULL,
    `rebuildDisposition` VARCHAR(191) NULL,
    `rebuildParentAttemptId` VARCHAR(191) NULL,
    `shadowMode` BOOLEAN NOT NULL DEFAULT true,
    `automaticProgression` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,
    UNIQUE INDEX `VisionShadowAttempt_attemptId_key`(`attemptId`),
    INDEX `VisionShadowAttempt_waypointVersionId_result_createdAt_idx`(`waypointVersionId`, `result`, `createdAt`),
    INDEX `VisionShadowAttempt_humanTruthLabel_createdAt_idx`(`humanTruthLabel`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VisionShadowAttempt` ADD CONSTRAINT `VisionShadowAttempt_waypointId_fkey` FOREIGN KEY (`waypointId`) REFERENCES `VisionWaypoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VisionShadowAttempt` ADD CONSTRAINT `VisionShadowAttempt_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
