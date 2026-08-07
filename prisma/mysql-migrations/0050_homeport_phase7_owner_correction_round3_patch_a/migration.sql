-- Project Homeport Phase 7 owner correction Round 3 Patch A.
-- Existing rows remain nullable; new account registration populates the
-- concurrency-safe normalized display-name key.
ALTER TABLE `PlayerProfile`
  ADD COLUMN `normalizedDisplayName` VARCHAR(80) NULL,
  ADD UNIQUE INDEX `PlayerProfile_normalizedDisplayName_key` (`normalizedDisplayName`);
