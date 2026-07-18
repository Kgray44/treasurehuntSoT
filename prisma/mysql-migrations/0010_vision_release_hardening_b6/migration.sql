ALTER TABLE `VisionWaypointVersion`
  ADD COLUMN `certificationStatus` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `compatibilityStatus` VARCHAR(191) NOT NULL DEFAULT 'NEEDS_RETEST',
  ADD COLUMN `certifiedPackageHash` VARCHAR(191) NULL,
  ADD COLUMN `certifiedDatasetRevision` VARCHAR(191) NULL;

CREATE TABLE `VisionRelease` (
  `id` VARCHAR(191) NOT NULL,
  `version` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'EXPERIMENTAL',
  `sourceCommit` VARCHAR(191) NOT NULL,
  `buildId` VARCHAR(191) NOT NULL,
  `readinessStatus` VARCHAR(191) NOT NULL DEFAULT 'NO_GO',
  `releaseManifest` LONGTEXT NOT NULL,
  `evidenceSummary` LONGTEXT NOT NULL,
  `knownLimitations` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `publishedAt` DATETIME(3) NULL,
  UNIQUE INDEX `VisionRelease_version_channel_key`(`version`, `channel`),
  INDEX `VisionRelease_channel_status_updatedAt_idx`(`channel`, `status`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionReleaseIssue` (
  `id` VARCHAR(191) NOT NULL,
  `releaseId` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `severity` VARCHAR(191) NOT NULL,
  `component` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `reproductionSteps` LONGTEXT NOT NULL,
  `affectedVersions` LONGTEXT NOT NULL,
  `owner` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
  `fixCommit` VARCHAR(191) NULL,
  `regressionTest` TEXT NULL,
  `releaseBlocking` BOOLEAN NOT NULL DEFAULT true,
  `evidence` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NULL,
  INDEX `VisionReleaseIssue_releaseId_status_releaseBlocking_idx`(`releaseId`, `status`, `releaseBlocking`),
  INDEX `VisionReleaseIssue_severity_status_idx`(`severity`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisionReleaseIssue_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `VisionRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionDatasetManifest` (
  `id` VARCHAR(191) NOT NULL,
  `revision` VARCHAR(191) NOT NULL,
  `evidenceClass` VARCHAR(191) NOT NULL,
  `waypointVersionId` VARCHAR(191) NULL,
  `manifestHash` VARCHAR(191) NOT NULL,
  `manifest` LONGTEXT NOT NULL,
  `lockedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisionDatasetManifest_revision_key`(`revision`),
  INDEX `VisionDatasetManifest_waypointVersionId_evidenceClass_idx`(`waypointVersionId`, `evidenceClass`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionReliabilityRun` (
  `id` VARCHAR(191) NOT NULL,
  `releaseId` VARCHAR(191) NOT NULL,
  `datasetManifestId` VARCHAR(191) NOT NULL,
  `engineVersion` VARCHAR(191) NOT NULL,
  `modelBundleVersion` VARCHAR(191) NOT NULL,
  `packageHashes` LONGTEXT NOT NULL,
  `deterministicSeed` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `resultSummary` LONGTEXT NOT NULL,
  `reportHash` VARCHAR(191) NOT NULL,
  `reportReference` TEXT NOT NULL,
  `falseAccepts` INTEGER NOT NULL DEFAULT 0,
  `firstAttemptSuccess` DOUBLE NULL,
  `twoAttemptSuccess` DOUBLE NULL,
  `p95DurationMs` DOUBLE NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  INDEX `VisionReliabilityRun_releaseId_status_createdAt_idx`(`releaseId`, `status`, `createdAt`),
  INDEX `VisionReliabilityRun_datasetManifestId_createdAt_idx`(`datasetManifestId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisionReliabilityRun_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `VisionRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `VisionReliabilityRun_datasetManifestId_fkey` FOREIGN KEY (`datasetManifestId`) REFERENCES `VisionDatasetManifest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionCompatibilityRule` (
  `id` VARCHAR(191) NOT NULL,
  `releaseId` VARCHAR(191) NOT NULL,
  `component` VARCHAR(191) NOT NULL,
  `currentVersion` VARCHAR(191) NOT NULL,
  `minimumVersion` VARCHAR(191) NULL,
  `maximumVersion` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL,
  `reason` TEXT NOT NULL,
  `metadata` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisionCompatibilityRule_releaseId_component_key`(`releaseId`, `component`),
  INDEX `VisionCompatibilityRule_component_status_idx`(`component`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisionCompatibilityRule_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `VisionRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionReleaseArtifact` (
  `id` VARCHAR(191) NOT NULL,
  `releaseId` VARCHAR(191) NOT NULL,
  `artifactType` VARCHAR(191) NOT NULL,
  `version` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `architecture` VARCHAR(191) NOT NULL,
  `contentHash` VARCHAR(191) NOT NULL,
  `fileSize` INTEGER NOT NULL,
  `signatureStatus` VARCHAR(191) NOT NULL,
  `signatureIdentity` VARCHAR(191) NULL,
  `provenance` LONGTEXT NOT NULL,
  `rollbackTarget` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `VisionReleaseArtifact_releaseId_artifactType_platform_architecture_key`(`releaseId`, `artifactType`, `platform`, `architecture`),
  INDEX `VisionReleaseArtifact_contentHash_idx`(`contentHash`),
  INDEX `VisionReleaseArtifact_signatureStatus_createdAt_idx`(`signatureStatus`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisionReleaseArtifact_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `VisionRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionReleaseTestRun` (
  `id` VARCHAR(191) NOT NULL,
  `releaseId` VARCHAR(191) NOT NULL,
  `suite` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `environment` LONGTEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `evidence` LONGTEXT NOT NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `VisionReleaseTestRun_releaseId_category_status_idx`(`releaseId`, `category`, `status`),
  INDEX `VisionReleaseTestRun_suite_createdAt_idx`(`suite`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `VisionReleaseTestRun_releaseId_fkey` FOREIGN KEY (`releaseId`) REFERENCES `VisionRelease`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionUpdateState` (
  `id` VARCHAR(191) NOT NULL,
  `installationId` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `currentVersion` VARCHAR(191) NOT NULL,
  `targetVersion` VARCHAR(191) NULL,
  `phase` VARCHAR(191) NOT NULL DEFAULT 'IDLE',
  `manifestHash` VARCHAR(191) NULL,
  `stagedArtifactHash` VARCHAR(191) NULL,
  `rollbackVersion` VARCHAR(191) NULL,
  `lastHealthStatus` VARCHAR(191) NULL,
  `errorCode` VARCHAR(191) NULL,
  `state` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `VisionUpdateState_installationId_key`(`installationId`),
  INDEX `VisionUpdateState_channel_phase_updatedAt_idx`(`channel`, `phase`, `updatedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `VisionImprovementCandidate` (
  `id` VARCHAR(191) NOT NULL,
  `sourceAttemptId` VARCHAR(191) NOT NULL,
  `waypointVersionId` VARCHAR(191) NOT NULL,
  `humanTruthLabel` VARCHAR(191) NOT NULL,
  `candidateReason` TEXT NOT NULL,
  `evidenceDigest` VARCHAR(191) NULL,
  `derivedDiagnostics` LONGTEXT NOT NULL,
  `proposedPartition` VARCHAR(191) NOT NULL,
  `rawFramesRetained` BOOLEAN NOT NULL DEFAULT false,
  `consentReference` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'QUEUED',
  `dispositionReason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  UNIQUE INDEX `VisionImprovementCandidate_sourceAttemptId_key`(`sourceAttemptId`),
  INDEX `VisionImprovementCandidate_waypointVersionId_status_createdAt_idx`(`waypointVersionId`, `status`, `createdAt`),
  INDEX `VisionImprovementCandidate_humanTruthLabel_status_idx`(`humanTruthLabel`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
