-- CreateTable
CREATE TABLE `VisionWaypoint` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL DEFAULT '',
    `type` VARCHAR(191) NOT NULL,
    `locationTags` LONGTEXT NOT NULL DEFAULT '[]',
    `sharingScope` VARCHAR(191) NOT NULL DEFAULT 'PRIVATE',
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionWaypoint_ownerId_archivedAt_updatedAt_idx`(`ownerId`, `archivedAt`, `updatedAt`),
    INDEX `VisionWaypoint_type_sharingScope_idx`(`type`, `sharingScope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionWaypointVersion` (
    `id` VARCHAR(191) NOT NULL,
    `waypointId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `parentVersionId` VARCHAR(191) NULL,
    `lifecycleStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `verificationProfile` VARCHAR(191) NOT NULL DEFAULT 'BALANCED',
    `packageSchemaVersion` INTEGER NOT NULL DEFAULT 1,
    `draftConfiguration` LONGTEXT NOT NULL DEFAULT '{}',
    `packageArtifactReference` TEXT NULL,
    `compatibilityMetadata` LONGTEXT NOT NULL DEFAULT '{}',
    `certificationReference` TEXT NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `publishedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `deprecatedAt` DATETIME(3) NULL,

    INDEX `VisionWaypointVersion_waypointId_lifecycleStatus_updatedAt_idx`(`waypointId`, `lifecycleStatus`, `updatedAt`),
    INDEX `VisionWaypointVersion_parentVersionId_idx`(`parentVersionId`),
    INDEX `VisionWaypointVersion_publishedAt_deprecatedAt_idx`(`publishedAt`, `deprecatedAt`),
    UNIQUE INDEX `VisionWaypointVersion_waypointId_versionNumber_key`(`waypointId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionWaypointPublication` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `packageHash` VARCHAR(191) NOT NULL,
    `packageSchemaVersion` INTEGER NOT NULL DEFAULT 1,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedBy` VARCHAR(191) NOT NULL,
    `compatibilityRange` LONGTEXT NOT NULL DEFAULT '{}',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',

    UNIQUE INDEX `VisionWaypointPublication_waypointVersionId_key`(`waypointVersionId`),
    INDEX `VisionWaypointPublication_packageHash_idx`(`packageHash`),
    INDEX `VisionWaypointPublication_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionCaptureSession` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `companionVersion` VARCHAR(191) NULL,
    `captureResolution` VARCHAR(191) NULL,
    `frameRate` DOUBLE NULL,
    `durationMs` INTEGER NULL,
    `hardwarePath` VARCHAR(191) NULL,
    `consentFlags` LONGTEXT NOT NULL DEFAULT '{}',
    `retentionPolicy` VARCHAR(191) NOT NULL DEFAULT 'DERIVED_ONLY',
    `status` VARCHAR(191) NOT NULL DEFAULT 'CREATED',
    `failureReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `VisionCaptureSession_waypointVersionId_purpose_createdAt_idx`(`waypointVersionId`, `purpose`, `createdAt`),
    INDEX `VisionCaptureSession_actorType_actorId_createdAt_idx`(`actorType`, `actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionRecordingAsset` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NULL,
    `assetType` VARCHAR(191) NOT NULL,
    `storageReference` TEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `datasetPartition` VARCHAR(191) NOT NULL DEFAULT 'UNASSIGNED',
    `truthLabel` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
    `creatorLabel` VARCHAR(191) NULL,
    `qualitySummary` LONGTEXT NOT NULL DEFAULT '{}',
    `deletionStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `VisionRecordingAsset_captureSessionId_idx`(`captureSessionId`),
    INDEX `VisionRecordingAsset_waypointVersionId_datasetPartition_trut_idx`(`waypointVersionId`, `datasetPartition`, `truthLabel`),
    UNIQUE INDEX `VisionRecordingAsset_waypointVersionId_contentHash_key`(`waypointVersionId`, `contentHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionRegion` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `recordingAssetId` VARCHAR(191) NULL,
    `regionType` VARCHAR(191) NOT NULL,
    `coordinateSpace` VARCHAR(191) NOT NULL DEFAULT 'NORMALIZED_IMAGE',
    `geometry` LONGTEXT NOT NULL,
    `semanticLabel` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionRegion_waypointVersionId_regionType_idx`(`waypointVersionId`, `regionType`),
    INDEX `VisionRegion_recordingAssetId_idx`(`recordingAssetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionPoseRegion` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `coordinateSystem` VARCHAR(191) NOT NULL,
    `shapeType` VARCHAR(191) NOT NULL,
    `parameters` LONGTEXT NOT NULL,
    `classification` VARCHAR(191) NOT NULL,
    `orientationRules` LONGTEXT NOT NULL DEFAULT '{}',
    `targetVisibilityRules` LONGTEXT NOT NULL DEFAULT '{}',
    `authoringSource` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionPoseRegion_waypointVersionId_classification_idx`(`waypointVersionId`, `classification`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionHardNegativeSet` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `classification` VARCHAR(191) NOT NULL,
    `strongestConfuserReference` TEXT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionHardNegativeSet_waypointVersionId_classification_idx`(`waypointVersionId`, `classification`),
    UNIQUE INDEX `VisionHardNegativeSet_waypointVersionId_name_key`(`waypointVersionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionBuildJob` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `executionTarget` VARCHAR(191) NOT NULL DEFAULT 'LOCAL',
    `engineMetadata` LONGTEXT NOT NULL DEFAULT '{}',
    `processingStage` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
    `progress` DOUBLE NOT NULL DEFAULT 0,
    `logSummary` LONGTEXT NOT NULL DEFAULT '[]',
    `outputSummary` LONGTEXT NOT NULL DEFAULT '{}',
    `failureCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `VisionBuildJob_waypointVersionId_status_createdAt_idx`(`waypointVersionId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionBuildArtifact` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `buildJobId` VARCHAR(191) NULL,
    `artifactType` VARCHAR(191) NOT NULL,
    `storageReference` TEXT NOT NULL,
    `contentHash` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VisionBuildArtifact_buildJobId_idx`(`buildJobId`),
    UNIQUE INDEX `VisionBuildArtifact_waypointVersionId_contentHash_artifactTy_key`(`waypointVersionId`, `contentHash`, `artifactType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionCertificationRun` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `buildArtifactId` VARCHAR(191) NULL,
    `validationPartitionHash` VARCHAR(191) NOT NULL,
    `lockedTestPartitionHash` VARCHAR(191) NOT NULL,
    `thresholds` LONGTEXT NOT NULL DEFAULT '{}',
    `profile` VARCHAR(191) NOT NULL,
    `metrics` LONGTEXT NOT NULL DEFAULT '{}',
    `observedFalseResults` LONGTEXT NOT NULL DEFAULT '{}',
    `reliabilityGrade` VARCHAR(191) NOT NULL,
    `approvedRuntimeModes` LONGTEXT NOT NULL DEFAULT '[]',
    `reviewerId` VARCHAR(191) NULL,
    `reportReference` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `VisionCertificationRun_waypointVersionId_createdAt_idx`(`waypointVersionId`, `createdAt`),
    INDEX `VisionCertificationRun_buildArtifactId_idx`(`buildArtifactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionWaypointTestRun` (
    `id` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `certificationRunId` VARCHAR(191) NULL,
    `testType` VARCHAR(191) NOT NULL,
    `expectedResult` VARCHAR(191) NOT NULL,
    `actualResult` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `evidenceReference` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    INDEX `VisionWaypointTestRun_waypointVersionId_testType_status_idx`(`waypointVersionId`, `testType`, `status`),
    INDEX `VisionWaypointTestRun_certificationRunId_idx`(`certificationRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionWaypointVerificationProfile` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `requirements` LONGTEXT NOT NULL DEFAULT '{}',
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionWaypointVerificationProfile_ownerId_archivedAt_idx`(`ownerId`, `archivedAt`),
    UNIQUE INDEX `VisionWaypointVerificationProfile_ownerId_name_key`(`ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryWaypointBinding` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `blockId` VARCHAR(191) NOT NULL,
    `waypointId` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `runtimeMode` VARCHAR(191) NOT NULL DEFAULT 'DEVELOPMENT_MOCK',
    `scanInteraction` LONGTEXT NOT NULL DEFAULT '{}',
    `successEvent` VARCHAR(191) NOT NULL DEFAULT 'vision.verification_succeeded',
    `retryMessageConfiguration` LONGTEXT NOT NULL DEFAULT '{}',
    `failureMessageConfiguration` LONGTEXT NOT NULL DEFAULT '{}',
    `captainFallbackPolicy` LONGTEXT NOT NULL DEFAULT '{}',
    `offlineBehavior` VARCHAR(191) NOT NULL DEFAULT 'CAPTAIN_FALLBACK',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StoryWaypointBinding_blockId_key`(`blockId`),
    INDEX `StoryWaypointBinding_storyId_waypointVersionId_idx`(`storyId`, `waypointVersionId`),
    INDEX `StoryWaypointBinding_waypointId_updatedAt_idx`(`waypointId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `storyId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `playerId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `verificationRequestId` VARCHAR(191) NULL,
    `waypointId` VARCHAR(191) NOT NULL,
    `waypointVersionId` VARCHAR(191) NOT NULL,
    `attemptState` VARCHAR(191) NOT NULL DEFAULT 'IDLE',
    `result` VARCHAR(191) NULL,
    `guidanceCode` VARCHAR(191) NULL,
    `evidenceDigest` VARCHAR(191) NULL,
    `platform` VARCHAR(191) NOT NULL,
    `adapterType` VARCHAR(191) NOT NULL,
    `eventDeliveryStatus` VARCHAR(191) NOT NULL DEFAULT 'NOT_DELIVERED',
    `captainAction` VARCHAR(191) NULL,
    `mockScenario` VARCHAR(191) NULL,
    `protocolVersion` VARCHAR(191) NOT NULL DEFAULT '1.0',
    `protocolMessageId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `staleResultRejected` BOOLEAN NOT NULL DEFAULT false,
    `duplicateResultRejected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    UNIQUE INDEX `VerificationAttempt_idempotencyKey_key`(`idempotencyKey`),
    INDEX `VerificationAttempt_sessionId_stageId_createdAt_idx`(`sessionId`, `stageId`, `createdAt`),
    INDEX `VerificationAttempt_waypointVersionId_result_createdAt_idx`(`waypointVersionId`, `result`, `createdAt`),
    INDEX `VerificationAttempt_playerId_attemptState_createdAt_idx`(`playerId`, `attemptState`, `createdAt`),
    INDEX `VerificationAttempt_verificationRequestId_idx`(`verificationRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationAttemptTransition` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `fromState` VARCHAR(191) NULL,
    `toState` VARCHAR(191) NOT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VerificationAttemptTransition_attemptId_createdAt_idx`(`attemptId`, `createdAt`),
    UNIQUE INDEX `VerificationAttemptTransition_attemptId_sequence_key`(`attemptId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionEvidenceBundle` (
    `id` VARCHAR(191) NOT NULL,
    `attemptId` VARCHAR(191) NOT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `retentionPolicy` VARCHAR(191) NOT NULL DEFAULT 'DERIVED_ONLY',
    `storageReference` TEXT NULL,
    `contentHash` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `VisionEvidenceBundle_attemptId_createdAt_idx`(`attemptId`, `createdAt`),
    INDEX `VisionEvidenceBundle_expiresAt_deletedAt_idx`(`expiresAt`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanionDevice` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `instanceId` VARCHAR(191) NOT NULL,
    `protocolVersion` VARCHAR(191) NOT NULL,
    `capabilities` LONGTEXT NOT NULL DEFAULT '{}',
    `lastSeenAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CompanionDevice_instanceId_key`(`instanceId`),
    INDEX `CompanionDevice_ownerId_revokedAt_lastSeenAt_idx`(`ownerId`, `revokedAt`, `lastSeenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PairingSession` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `companionDeviceId` VARCHAR(191) NOT NULL,
    `pairingCodeHash` VARCHAR(191) NOT NULL,
    `sessionSecretHash` VARCHAR(191) NOT NULL,
    `allowedOrigin` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `pairedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PairingSession_pairingCodeHash_key`(`pairingCodeHash`),
    UNIQUE INDEX `PairingSession_sessionSecretHash_key`(`sessionSecretHash`),
    INDEX `PairingSession_ownerId_expiresAt_revokedAt_idx`(`ownerId`, `expiresAt`, `revokedAt`),
    INDEX `PairingSession_companionDeviceId_expiresAt_idx`(`companionDeviceId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VisionWaypoint` ADD CONSTRAINT `VisionWaypoint_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `GameMasterUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointVersion` ADD CONSTRAINT `VisionWaypointVersion_waypointId_fkey` FOREIGN KEY (`waypointId`) REFERENCES `VisionWaypoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointVersion` ADD CONSTRAINT `VisionWaypointVersion_parentVersionId_fkey` FOREIGN KEY (`parentVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointVersion` ADD CONSTRAINT `VisionWaypointVersion_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `GameMasterUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointVersion` ADD CONSTRAINT `VisionWaypointVersion_publishedBy_fkey` FOREIGN KEY (`publishedBy`) REFERENCES `GameMasterUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointPublication` ADD CONSTRAINT `VisionWaypointPublication_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointPublication` ADD CONSTRAINT `VisionWaypointPublication_publishedBy_fkey` FOREIGN KEY (`publishedBy`) REFERENCES `GameMasterUser`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionCaptureSession` ADD CONSTRAINT `VisionCaptureSession_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionRecordingAsset` ADD CONSTRAINT `VisionRecordingAsset_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionRecordingAsset` ADD CONSTRAINT `VisionRecordingAsset_captureSessionId_fkey` FOREIGN KEY (`captureSessionId`) REFERENCES `VisionCaptureSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionRegion` ADD CONSTRAINT `VisionRegion_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionRegion` ADD CONSTRAINT `VisionRegion_recordingAssetId_fkey` FOREIGN KEY (`recordingAssetId`) REFERENCES `VisionRecordingAsset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionPoseRegion` ADD CONSTRAINT `VisionPoseRegion_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionHardNegativeSet` ADD CONSTRAINT `VisionHardNegativeSet_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionBuildJob` ADD CONSTRAINT `VisionBuildJob_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionBuildArtifact` ADD CONSTRAINT `VisionBuildArtifact_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionBuildArtifact` ADD CONSTRAINT `VisionBuildArtifact_buildJobId_fkey` FOREIGN KEY (`buildJobId`) REFERENCES `VisionBuildJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionCertificationRun` ADD CONSTRAINT `VisionCertificationRun_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionCertificationRun` ADD CONSTRAINT `VisionCertificationRun_buildArtifactId_fkey` FOREIGN KEY (`buildArtifactId`) REFERENCES `VisionBuildArtifact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointTestRun` ADD CONSTRAINT `VisionWaypointTestRun_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointTestRun` ADD CONSTRAINT `VisionWaypointTestRun_certificationRunId_fkey` FOREIGN KEY (`certificationRunId`) REFERENCES `VisionCertificationRun`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionWaypointVerificationProfile` ADD CONSTRAINT `VisionWaypointVerificationProfile_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `GameMasterUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryWaypointBinding` ADD CONSTRAINT `StoryWaypointBinding_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `TallTale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryWaypointBinding` ADD CONSTRAINT `StoryWaypointBinding_blockId_fkey` FOREIGN KEY (`blockId`) REFERENCES `StoryBlock`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryWaypointBinding` ADD CONSTRAINT `StoryWaypointBinding_waypointId_fkey` FOREIGN KEY (`waypointId`) REFERENCES `VisionWaypoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryWaypointBinding` ADD CONSTRAINT `StoryWaypointBinding_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `TallTale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TaleSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_playerId_fkey` FOREIGN KEY (`playerId`) REFERENCES `PlayerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_verificationRequestId_fkey` FOREIGN KEY (`verificationRequestId`) REFERENCES `TaleVerificationRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_waypointId_fkey` FOREIGN KEY (`waypointId`) REFERENCES `VisionWaypoint`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttempt` ADD CONSTRAINT `VerificationAttempt_waypointVersionId_fkey` FOREIGN KEY (`waypointVersionId`) REFERENCES `VisionWaypointVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VerificationAttemptTransition` ADD CONSTRAINT `VerificationAttemptTransition_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `VerificationAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionEvidenceBundle` ADD CONSTRAINT `VisionEvidenceBundle_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `VerificationAttempt`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanionDevice` ADD CONSTRAINT `CompanionDevice_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `GameMasterUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PairingSession` ADD CONSTRAINT `PairingSession_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `GameMasterUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PairingSession` ADD CONSTRAINT `PairingSession_companionDeviceId_fkey` FOREIGN KEY (`companionDeviceId`) REFERENCES `CompanionDevice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
