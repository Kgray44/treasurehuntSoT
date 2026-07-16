ALTER TABLE `Campaign`
  ADD COLUMN `finaleState` VARCHAR(191) NOT NULL DEFAULT 'SEALED',
  ADD COLUMN `finaleTeaser` LONGTEXT NULL,
  ADD COLUMN `finaleRequirements` LONGTEXT NOT NULL DEFAULT ('[]');

ALTER TABLE `Chapter`
  ADD COLUMN `safeTeaser` LONGTEXT NULL,
  ADD COLUMN `relatedMapKey` VARCHAR(191) NULL,
  ADD COLUMN `relatedArtifactKey` VARCHAR(191) NULL,
  ADD COLUMN `relatedSideQuestKey` VARCHAR(191) NULL;

ALTER TABLE `Artifact`
  ADD COLUMN `safeName` VARCHAR(191) NULL,
  ADD COLUMN `state` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'RELIC',
  ADD COLUMN `discoveryText` LONGTEXT NULL,
  ADD COLUMN `silhouetteLabel` VARCHAR(191) NULL,
  ADD COLUMN `displayX` DOUBLE NOT NULL DEFAULT 50,
  ADD COLUMN `displayY` DOUBLE NOT NULL DEFAULT 50,
  ADD COLUMN `assemblyGroup` VARCHAR(191) NULL,
  ADD COLUMN `assemblyPosition` VARCHAR(191) NULL,
  ADD COLUMN `connectedArtifactKey` VARCHAR(191) NULL,
  ADD COLUMN `chapterOrdinal` INTEGER NULL;

ALTER TABLE `SideQuest`
  ADD COLUMN `safeTeaser` LONGTEXT NULL,
  ADD COLUMN `description` LONGTEXT NULL,
  ADD COLUMN `rewardType` VARCHAR(191) NULL,
  ADD COLUMN `rewardLabel` VARCHAR(191) NULL,
  ADD COLUMN `completionSummary` LONGTEXT NULL,
  ADD COLUMN `chapterOrdinal` INTEGER NULL,
  ADD COLUMN `mapLocationKey` VARCHAR(191) NULL,
  ADD COLUMN `artifactKey` VARCHAR(191) NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL;

ALTER TABLE `JournalEntry`
  ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'ANNOTATION',
  ADD COLUMN `eventId` VARCHAR(191) NULL,
  ADD COLUMN `chapterOrdinal` INTEGER NULL,
  ADD UNIQUE INDEX `JournalEntry_eventId_key` (`eventId`);

ALTER TABLE `MapLocation`
  ADD COLUMN `safeLabel` VARCHAR(191) NULL,
  ADD COLUMN `locationType` VARCHAR(191) NOT NULL DEFAULT 'STORY',
  ADD COLUMN `state` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `description` LONGTEXT NULL,
  ADD COLUMN `exactness` VARCHAR(191) NOT NULL DEFAULT 'APPROXIMATE',
  ADD COLUMN `chapterOrdinal` INTEGER NULL,
  ADD COLUMN `sideQuestKey` VARCHAR(191) NULL,
  ADD COLUMN `mobileX` DOUBLE NULL,
  ADD COLUMN `mobileY` DOUBLE NULL,
  ADD COLUMN `completedAt` DATETIME(3) NULL;

ALTER TABLE `AudioPreference`
  ADD COLUMN `motionMode` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN `textScale` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN `ambientEffects` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `textureIntensity` DOUBLE NOT NULL DEFAULT 1,
  ADD COLUMN `fullscreenPreferred` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `MapRoute` (
  `id` VARCHAR(191) NOT NULL,
  `campaignId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `fromKey` VARCHAR(191) NOT NULL,
  `toKey` VARCHAR(191) NOT NULL,
  `ordinal` INTEGER NOT NULL,
  `state` VARCHAR(191) NOT NULL DEFAULT 'HIDDEN',
  `annotation` LONGTEXT NULL,
  `revealedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `MapRoute_campaignId_key_key` (`campaignId`, `key`),
  INDEX `MapRoute_campaignId_ordinal_idx` (`campaignId`, `ordinal`),
  CONSTRAINT `MapRoute_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ViewedContent` (
  `id` VARCHAR(191) NOT NULL,
  `playerAccessId` VARCHAR(191) NOT NULL,
  `contentType` VARCHAR(191) NOT NULL,
  `contentKey` VARCHAR(191) NOT NULL,
  `viewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ViewedContent_playerAccessId_contentType_contentKey_key` (`playerAccessId`, `contentType`, `contentKey`),
  INDEX `ViewedContent_playerAccessId_viewedAt_idx` (`playerAccessId`, `viewedAt`),
  CONSTRAINT `ViewedContent_playerAccessId_fkey` FOREIGN KEY (`playerAccessId`) REFERENCES `PlayerAccess` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
