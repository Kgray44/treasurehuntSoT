-- Harborlight Phase 3 collection lifecycle parity.
ALTER TABLE `CommunityCollection`
  ADD COLUMN `coverReference` VARCHAR(191) NULL AFTER `description`,
  ADD COLUMN `archivedAt` DATETIME(3) NULL AFTER `visibility`,
  ADD COLUMN `deletedAt` DATETIME(3) NULL AFTER `archivedAt`,
  ADD INDEX `CommunityCollection_visibility_archivedAt_deletedAt_idx` (`visibility`, `archivedAt`, `deletedAt`);
