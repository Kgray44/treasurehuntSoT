-- Atomic reviewed-application metadata without additional authored or credential content.
ALTER TABLE `AIUsageLedger`
  ADD COLUMN `applicationKey` VARCHAR(191) NULL,
  ADD COLUMN `applicationFingerprint` VARCHAR(191) NULL,
  ADD COLUMN `applicationRevision` INTEGER NULL,
  ADD COLUMN `applicationChecksum` VARCHAR(191) NULL,
  ADD COLUMN `appliedAt` DATETIME(3) NULL;
CREATE UNIQUE INDEX `AIUsageLedger_accountId_applicationKey_key` ON `AIUsageLedger`(`accountId`, `applicationKey`);
