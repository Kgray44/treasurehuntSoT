-- Phase 3 repair actions retain a non-sensitive reason code for exact execution policy.
ALTER TABLE `PrivateRepairAction` ADD COLUMN `reason` VARCHAR(64) NOT NULL DEFAULT 'REVIEW';
