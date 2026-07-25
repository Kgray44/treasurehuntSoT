-- Harborlight Phase 3 parity: retain legacy rows while adding opaque Wayfarer
-- source provenance for public-sharing preparation.
ALTER TABLE `CommunityVoyageKeepsake`
  MODIFY COLUMN `taleSessionId` VARCHAR(191) NULL,
  ADD COLUMN `wayfarerKeepsakeId` VARCHAR(191) NULL AFTER `taleSessionId`,
  ADD COLUMN `sourceWatermark` VARCHAR(191) NULL AFTER `wayfarerKeepsakeId`,
  ADD COLUMN `sourceProjectionChecksum` VARCHAR(191) NULL AFTER `sourceWatermark`,
  ADD COLUMN `preparationState` VARCHAR(191) NOT NULL DEFAULT 'PENDING_SOURCE' AFTER `sourceProjectionChecksum`,
  ADD UNIQUE INDEX `CommunityVoyageKeepsake_ownerAccountId_wayfarerKeepsakeId_key` (`ownerAccountId`, `wayfarerKeepsakeId`),
  ADD INDEX `CommunityVoyageKeepsake_wayfarerKeepsakeId_idx` (`wayfarerKeepsakeId`);
