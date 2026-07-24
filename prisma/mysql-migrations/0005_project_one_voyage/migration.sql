-- Project One Voyage: retain installed authored data while renaming the
-- canonical aggregate and adding deterministic legacy migration provenance.
RENAME TABLE `TallTale` TO `Chronicle`;

CREATE TABLE `LegacyEntityReference` (
    `id` VARCHAR(191) NOT NULL,
    `sourceDomain` VARCHAR(64) NOT NULL,
    `sourceModel` VARCHAR(64) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `canonicalModel` VARCHAR(64) NOT NULL,
    `canonicalId` VARCHAR(191) NOT NULL,
    `migrationVersion` VARCHAR(64) NOT NULL,
    `sourceChecksum` VARCHAR(191) NOT NULL,
    `migratedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `verifiedAt` DATETIME(3) NULL,
    UNIQUE INDEX `LegacyEntityReference_source_mapping_key`(`sourceDomain`, `sourceModel`, `sourceId`, `canonicalModel`, `migrationVersion`),
    INDEX `LegacyEntityReference_canonicalModel_canonicalId_idx`(`canonicalModel`, `canonicalId`),
    INDEX `LegacyEntityReference_sourceDomain_sourceModel_sourceId_idx`(`sourceDomain`, `sourceModel`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LegacyMigrationRun` (
    `id` VARCHAR(191) NOT NULL,
    `migrationVersion` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `sourceSelector` VARCHAR(191) NULL,
    `report` LONGTEXT NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    INDEX `LegacyMigrationRun_migrationVersion_startedAt_idx`(`migrationVersion`, `startedAt`),
    INDEX `LegacyMigrationRun_status_startedAt_idx`(`status`, `startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TaleLocation`
  ADD COLUMN `legacyKey` VARCHAR(191) NULL,
  ADD COLUMN `locationType` VARCHAR(191) NOT NULL DEFAULT 'STORY',
  ADD COLUMN `safeLabel` VARCHAR(191) NULL,
  ADD COLUMN `exactness` VARCHAR(191) NOT NULL DEFAULT 'APPROXIMATE',
  ADD COLUMN `mapX` DOUBLE NULL,
  ADD COLUMN `mapY` DOUBLE NULL,
  ADD COLUMN `mobileMapX` DOUBLE NULL,
  ADD COLUMN `mobileMapY` DOUBLE NULL,
  ADD UNIQUE INDEX `TaleLocation_taleId_legacyKey_key`(`taleId`, `legacyKey`);

ALTER TABLE `TaleArtifact`
  ADD COLUMN `legacyKey` VARCHAR(191) NULL,
  ADD COLUMN `safeName` VARCHAR(191) NULL,
  ADD COLUMN `silhouetteLabel` VARCHAR(191) NULL,
  ADD COLUMN `displayX` DOUBLE NULL,
  ADD COLUMN `displayY` DOUBLE NULL,
  ADD COLUMN `assemblyPosition` VARCHAR(191) NULL,
  ADD COLUMN `connectedArtifactKey` VARCHAR(191) NULL,
  ADD COLUMN `sourceChapterOrdinal` INTEGER NULL,
  ADD UNIQUE INDEX `TaleArtifact_taleId_legacyKey_key`(`taleId`, `legacyKey`);

CREATE TABLE `TaleSideQuest` (
  `id` VARCHAR(191) NOT NULL,
  `taleId` VARCHAR(191) NOT NULL,
  `legacyKey` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `safeTeaser` VARCHAR(191) NULL,
  `description` TEXT NULL,
  `rewardType` VARCHAR(191) NULL,
  `rewardLabel` VARCHAR(191) NULL,
  `completionSummary` TEXT NULL,
  `sourceChapterOrdinal` INTEGER NULL,
  `mapLocationKey` VARCHAR(191) NULL,
  `artifactKey` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TaleSideQuest_taleId_legacyKey_key`(`taleId`, `legacyKey`),
  INDEX `TaleSideQuest_taleId_sourceChapterOrdinal_idx`(`taleId`, `sourceChapterOrdinal`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TaleSideQuest_taleId_fkey` FOREIGN KEY (`taleId`) REFERENCES `Chronicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `TaleSideQuestObjective` (
  `id` VARCHAR(191) NOT NULL,
  `sideQuestId` VARCHAR(191) NOT NULL,
  `ordinal` INTEGER NOT NULL,
  `body` TEXT NOT NULL,
  UNIQUE INDEX `TaleSideQuestObjective_sideQuestId_ordinal_key`(`sideQuestId`, `ordinal`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TaleSideQuestObjective_sideQuestId_fkey` FOREIGN KEY (`sideQuestId`) REFERENCES `TaleSideQuest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
