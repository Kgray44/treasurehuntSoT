-- Additive review/Creator-response presentation snapshots. Nullable columns
-- preserve historical rows without fabricating an author identity.
ALTER TABLE `CommunityReview`
  ADD COLUMN `authorDisplayName` VARCHAR(191) NULL,
  ADD COLUMN `authorHandle` VARCHAR(191) NULL,
  ADD COLUMN `reviewedReleaseId` VARCHAR(191) NULL;

ALTER TABLE `CommunityCreatorResponse`
  ADD COLUMN `creatorDisplayName` VARCHAR(191) NULL,
  ADD COLUMN `creatorHandle` VARCHAR(191) NULL,
  ADD COLUMN `spoilerBody` LONGTEXT NULL,
  ADD COLUMN `spoilerLevel` VARCHAR(191) NOT NULL DEFAULT 'NONE';

ALTER TABLE `CommunityComment`
  ADD COLUMN `authorDisplayName` VARCHAR(191) NULL,
  ADD COLUMN `authorHandle` VARCHAR(191) NULL;
