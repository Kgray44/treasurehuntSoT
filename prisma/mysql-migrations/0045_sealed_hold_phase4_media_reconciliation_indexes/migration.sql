CREATE TABLE `ProtectedMediaReconciliationRecord` (
  `id` VARCHAR(191) NOT NULL, `mode` VARCHAR(32) NOT NULL, `snapshotDigest` VARCHAR(64) NOT NULL, `findings` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `completedAt` DATETIME(3) NULL, PRIMARY KEY (`id`),
  KEY `ProtectedMediaReconciliationRecord_mode_idx` (`mode`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
