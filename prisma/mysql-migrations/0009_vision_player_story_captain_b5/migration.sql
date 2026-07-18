ALTER TABLE `StoryWaypointBinding`
  ADD COLUMN `assignmentPolicy` LONGTEXT NULL,
  ADD COLUMN `accessibilityPolicy` LONGTEXT NULL,
  ADD COLUMN `guidanceConfiguration` LONGTEXT NULL,
  ADD COLUMN `scanConfiguration` LONGTEXT NULL;
UPDATE `StoryWaypointBinding` SET
  `assignmentPolicy` = '{}',
  `accessibilityPolicy` = '{}',
  `guidanceConfiguration` = '{}',
  `scanConfiguration` = '{}';
ALTER TABLE `StoryWaypointBinding`
  MODIFY COLUMN `assignmentPolicy` LONGTEXT NOT NULL,
  MODIFY COLUMN `accessibilityPolicy` LONGTEXT NOT NULL,
  MODIFY COLUMN `guidanceConfiguration` LONGTEXT NOT NULL,
  MODIFY COLUMN `scanConfiguration` LONGTEXT NOT NULL;

ALTER TABLE `VerificationAttempt`
  ADD COLUMN `publishedVersionId` VARCHAR(191) NULL,
  ADD COLUMN `storyBindingId` VARCHAR(191) NULL,
  ADD COLUMN `publishedBindingId` VARCHAR(191) NULL,
  ADD COLUMN `packageId` VARCHAR(191) NULL,
  ADD COLUMN `packageHash` VARCHAR(191) NULL,
  ADD COLUMN `runtimeMode` VARCHAR(191) NOT NULL DEFAULT 'DEVELOPMENT_MOCK',
  ADD COLUMN `effectiveRuntimeMode` VARCHAR(191) NOT NULL DEFAULT 'DEVELOPMENT_MOCK',
  ADD COLUMN `stageTokenHash` VARCHAR(191) NULL,
  ADD COLUMN `stageTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `storyStateVersion` INTEGER NULL,
  ADD COLUMN `companionInstanceId` VARCHAR(191) NULL,
  ADD COLUMN `failedGates` LONGTEXT NULL,
  ADD COLUMN `diagnostics` LONGTEXT NULL,
  ADD COLUMN `engineVersion` VARCHAR(191) NULL,
  ADD COLUMN `modelBundleVersion` VARCHAR(191) NULL,
  ADD COLUMN `provider` VARCHAR(191) NULL,
  ADD COLUMN `providerFallbackUsed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `capturedFrameCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `usableFrameCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `passingFrameCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `durationMs` INTEGER NULL,
  ADD COLUMN `rawFramesRetained` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `captainDecisionStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `presentationStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN `offlineEventStatus` VARCHAR(191) NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN `resultReceivedAt` DATETIME(3) NULL,
  ADD COLUMN `progressionAppliedAt` DATETIME(3) NULL,
  ADD INDEX `VerificationAttempt_storyBindingId_runtimeMode_createdAt_idx`(`storyBindingId`, `runtimeMode`, `createdAt`),
  ADD INDEX `VerificationAttempt_publishedVersionId_stageId_createdAt_idx`(`publishedVersionId`, `stageId`, `createdAt`);
UPDATE `VerificationAttempt` SET `failedGates` = '[]', `diagnostics` = '{}';
ALTER TABLE `VerificationAttempt`
  MODIFY COLUMN `failedGates` LONGTEXT NOT NULL,
  MODIFY COLUMN `diagnostics` LONGTEXT NOT NULL;
ALTER TABLE `VerificationAttempt`
  ADD INDEX `VerificationAttempt_publishedBindingId_createdAt_idx`(`publishedBindingId`, `createdAt`);

CREATE TABLE `VisionPublishedBinding` (
  `id` VARCHAR(191) NOT NULL,
  `bindingKey` VARCHAR(191) NOT NULL,
  `publishedVersionId` VARCHAR(191) NOT NULL,
  `storyId` VARCHAR(191) NOT NULL,
  `stageId` VARCHAR(191) NOT NULL,
  `waypointId` VARCHAR(191) NOT NULL,
  `waypointVersionId` VARCHAR(191) NOT NULL,
  `runtimeMode` VARCHAR(191) NOT NULL,
  `scanInteraction` LONGTEXT NOT NULL,
  `scanConfiguration` LONGTEXT NOT NULL,
  `successEvent` VARCHAR(191) NOT NULL,
  `guidanceConfiguration` LONGTEXT NOT NULL,
  `captainFallbackPolicy` LONGTEXT NOT NULL,
  `offlineBehavior` VARCHAR(191) NOT NULL,
  `assignmentPolicy` LONGTEXT NOT NULL,
  `accessibilityPolicy` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisionPublishedBinding_bindingKey_key`(`bindingKey`),
  UNIQUE INDEX `VisionPublishedBinding_publishedVersionId_stageId_key`(`publishedVersionId`, `stageId`),
  INDEX `VisionPublishedBinding_storyId_stageId_idx`(`storyId`, `stageId`),
  INDEX `VisionPublishedBinding_waypointVersionId_runtimeMode_idx`(`waypointVersionId`, `runtimeMode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionCaptainDecision` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `truthLabel` VARCHAR(191) NULL,
  `evidenceSummary` LONGTEXT NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisionCaptainDecision_idempotencyKey_key`(`idempotencyKey`),
  INDEX `VisionCaptainDecision_attemptId_createdAt_idx`(`attemptId`, `createdAt`),
  INDEX `VisionCaptainDecision_truthLabel_createdAt_idx`(`truthLabel`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionRuntimeControl` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `storyBindingId` VARCHAR(191) NULL,
  `stageId` VARCHAR(191) NOT NULL,
  `configuredMode` VARCHAR(191) NOT NULL,
  `effectiveMode` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `automaticPaused` BOOLEAN NOT NULL DEFAULT false,
  `certificationRunId` VARCHAR(191) NULL,
  `fieldEvidenceStatus` VARCHAR(191) NOT NULL DEFAULT 'MISSING',
  `demotionReason` TEXT NULL,
  `updatedBy` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `VisionRuntimeControl_sessionId_stageId_key`(`sessionId`, `stageId`),
  INDEX `VisionRuntimeControl_storyBindingId_effectiveMode_idx`(`storyBindingId`, `effectiveMode`),
  INDEX `VisionRuntimeControl_automaticPaused_updatedAt_idx`(`automaticPaused`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionPresentationRun` (
  `id` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NOT NULL,
  `storyEventKey` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `errorCode` VARCHAR(191) NULL,
  `recoveryAction` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `VisionPresentationRun_attemptId_storyEventKey_key`(`attemptId`, `storyEventKey`),
  INDEX `VisionPresentationRun_status_updatedAt_idx`(`status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionPendingEvent` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `attemptId` VARCHAR(191) NULL,
  `eventId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `storyStateVersion` INTEGER NOT NULL,
  `payloadHash` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `conflictReason` VARCHAR(191) NULL,
  `observedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `syncedAt` DATETIME(3) NULL,
  UNIQUE INDEX `VisionPendingEvent_eventId_key`(`eventId`),
  UNIQUE INDEX `VisionPendingEvent_idempotencyKey_key`(`idempotencyKey`),
  INDEX `VisionPendingEvent_sessionId_status_createdAt_idx`(`sessionId`, `status`, `createdAt`),
  INDEX `VisionPendingEvent_attemptId_createdAt_idx`(`attemptId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `VerificationAttempt`
  ADD CONSTRAINT `VerificationAttempt_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `PublishedTaleVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `VerificationAttempt_storyBindingId_fkey` FOREIGN KEY (`storyBindingId`) REFERENCES `StoryWaypointBinding`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `VerificationAttempt_publishedBindingId_fkey` FOREIGN KEY (`publishedBindingId`) REFERENCES `VisionPublishedBinding`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `VisionPublishedBinding` ADD CONSTRAINT `VisionPublishedBinding_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `PublishedTaleVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VisionPublishedBinding` ADD CONSTRAINT `VisionPublishedBinding_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `TallTale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VisionPublishedBinding` ADD CONSTRAINT `VisionPublishedBinding_waypointId_fkey` FOREIGN KEY (`waypointId`) REFERENCES `VisionWaypoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VisionPublishedBinding` ADD CONSTRAINT `VisionPublishedBinding_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VisionCaptainDecision` ADD CONSTRAINT `VisionCaptainDecision_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `VerificationAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VisionRuntimeControl` ADD CONSTRAINT `VisionRuntimeControl_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VisionRuntimeControl` ADD CONSTRAINT `VisionRuntimeControl_storyBindingId_fkey` FOREIGN KEY (`storyBindingId`) REFERENCES `StoryWaypointBinding`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `VisionPresentationRun` ADD CONSTRAINT `VisionPresentationRun_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `VerificationAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VisionPendingEvent` ADD CONSTRAINT `VisionPendingEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `VisionPendingEvent` ADD CONSTRAINT `VisionPendingEvent_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `VerificationAttempt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
