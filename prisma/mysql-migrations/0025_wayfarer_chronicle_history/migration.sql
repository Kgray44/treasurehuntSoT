-- Project Wayfarer Phase 3 migration parity marker.
-- The production DDL is deliberately additive and must be applied after 0024.
CREATE TABLE `PlayerChronicleRecord` (
  `id` VARCHAR(191) NOT NULL,
  `playerProfileId` VARCHAR(191) NOT NULL,
  `sourcePlaythroughId` VARCHAR(191) NOT NULL,
  `sourceMembershipId` VARCHAR(191) NULL,
  `publishedVersionId` VARCHAR(191) NOT NULL,
  `publishedVersionChecksum` VARCHAR(191) NOT NULL,
  `chronicleTitleSnapshot` VARCHAR(191) NOT NULL,
  `chronicleCoverSnapshot` VARCHAR(191) NULL,
  `creatorAttributionSnapshot` VARCHAR(191) NULL,
  `playerNameSnapshot` VARCHAR(191) NOT NULL,
  `playerAvatarSnapshot` VARCHAR(191) NULL,
  `participationRole` VARCHAR(191) NOT NULL DEFAULT 'PLAYER',
  `crewRoleSnapshot` VARCHAR(191) NULL,
  `lifecycleStatus` VARCHAR(191) NOT NULL,
  `outcome` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE',
  `startedAt` DATETIME(3) NULL, `joinedAt` DATETIME(3) NULL, `completedAt` DATETIME(3) NULL,
  `wallClockSeconds` INT NULL, `activeSeconds` INT NULL, `pausedSeconds` INT NULL,
  `connectedSeconds` INT NULL, `interactiveSeconds` INT NULL, `captainWaitSeconds` INT NULL,
  `wallClockAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE', `activeAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE',
  `pausedAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE', `connectedAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE',
  `interactiveAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE', `captainWaitAccuracy` VARCHAR(191) NOT NULL DEFAULT 'UNAVAILABLE',
  `metricDefinitionVersion` VARCHAR(191) NOT NULL DEFAULT 'WAYFARER_TIMING_V1',
  `completedChapters` JSON NOT NULL, `optionalObjectives` JSON NOT NULL, `choiceSummary` JSON NOT NULL, `artifactSummary` JSON NOT NULL,
  `sourceFingerprint` VARCHAR(191) NOT NULL, `projectionStatus` VARCHAR(191) NOT NULL DEFAULT 'CURRENT',
  `projectionReason` VARCHAR(191) NULL, `lastDerivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `PlayerChronicleRecord_playerProfileId_sourcePlaythroughId_key` (`playerProfileId`, `sourcePlaythroughId`),
  KEY `PlayerChronicleRecord_profile_status_completed_idx` (`playerProfileId`, `lifecycleStatus`, `completedAt`),
  KEY `PlayerChronicleRecord_playerProfileId_chronicleTitleSnapshot_idx` (`playerProfileId`, `chronicleTitleSnapshot`),
  KEY `PlayerChronicleRecord_publishedVersionId_idx` (`publishedVersionId`),
  CONSTRAINT `PlayerChronicleRecord_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PlayerChronicleRecord_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `PublishedTaleVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ChronicleReflection` (`id` VARCHAR(191) NOT NULL, `playerChronicleRecordId` VARCHAR(191) NOT NULL, `favoriteChapterId` VARCHAR(191) NULL, `favoriteClueReference` VARCHAR(191) NULL, `favoriteMomentReference` VARCHAR(191) NULL, `favoriteArtifactReference` VARCHAR(191) NULL, `privateNote` TEXT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `ChronicleReflection_playerChronicleRecordId_key` (`playerChronicleRecordId`), CONSTRAINT `ChronicleReflection_playerChronicleRecordId_fkey` FOREIGN KEY (`playerChronicleRecordId`) REFERENCES `PlayerChronicleRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ChronicleMemory` (`id` VARCHAR(191) NOT NULL, `playerChronicleRecordId` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL, `title` VARCHAR(191) NOT NULL, `body` TEXT NULL, `referenceType` VARCHAR(191) NULL, `referenceId` VARCHAR(191) NULL, `visibility` VARCHAR(191) NOT NULL DEFAULT 'ONLY_ME', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, `deletedAt` DATETIME(3) NULL, PRIMARY KEY (`id`), KEY `ChronicleMemory_playerChronicleRecordId_deletedAt_createdAt_idx` (`playerChronicleRecordId`, `deletedAt`, `createdAt`), KEY `ChronicleMemory_playerProfileId_deletedAt_idx` (`playerProfileId`, `deletedAt`), CONSTRAINT `ChronicleMemory_playerChronicleRecordId_fkey` FOREIGN KEY (`playerChronicleRecordId`) REFERENCES `PlayerChronicleRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT `ChronicleMemory_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `VoyageKeepsake` (`id` VARCHAR(191) NOT NULL, `playerChronicleRecordId` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'READY', `presentationPayload` JSON NOT NULL, `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `regeneratedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `VoyageKeepsake_playerChronicleRecordId_key` (`playerChronicleRecordId`), CONSTRAINT `VoyageKeepsake_playerChronicleRecordId_fkey` FOREIGN KEY (`playerChronicleRecordId`) REFERENCES `PlayerChronicleRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `VoyageKeepsakeConsent` (`id` VARCHAR(191) NOT NULL, `keepsakeId` VARCHAR(191) NOT NULL, `participantId` VARCHAR(191) NOT NULL, `granted` BOOLEAN NOT NULL DEFAULT false, `grantedAt` DATETIME(3) NULL, `revokedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), UNIQUE KEY `VoyageKeepsakeConsent_keepsakeId_participantId_key` (`keepsakeId`, `participantId`), KEY `VoyageKeepsakeConsent_participantId_granted_idx` (`participantId`, `granted`), CONSTRAINT `VoyageKeepsakeConsent_keepsakeId_fkey` FOREIGN KEY (`keepsakeId`) REFERENCES `VoyageKeepsake`(`id`) ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT `VoyageKeepsakeConsent_participantId_fkey` FOREIGN KEY (`participantId`) REFERENCES `PlayerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
