CREATE TABLE `ProtectedMedia` (
  `id` VARCHAR(191) NOT NULL, `ownerAccountId` VARCHAR(191) NOT NULL, `ownerProfileId` VARCHAR(191) NULL,
  `sourcePrivateAssetObjectId` VARCHAR(191) NOT NULL, `mediaKind` VARCHAR(32) NOT NULL, `declaredMediaType` VARCHAR(191) NOT NULL,
  `detectedMediaType` VARCHAR(191) NOT NULL, `byteLength` INT NOT NULL, `sha256` VARCHAR(64) NOT NULL, `scanState` VARCHAR(32) NOT NULL,
  `availabilityState` VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE', `privacyClassification` VARCHAR(32) NOT NULL DEFAULT 'PRIVATE',
  `originalFilenameSafeSnapshot` VARCHAR(191) NULL, `accessibilityDescription` TEXT NULL, `withdrawnAt` DATETIME(3) NULL, `archivedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ProtectedMedia_source_owner_key` (`sourcePrivateAssetObjectId`, `ownerAccountId`),
  KEY `ProtectedMedia_owner_idx` (`ownerAccountId`, `createdAt`), KEY `ProtectedMedia_scan_idx` (`scanState`, `availabilityState`),
  CONSTRAINT `ProtectedMedia_source_fk` FOREIGN KEY (`sourcePrivateAssetObjectId`) REFERENCES `PrivateAssetObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ProtectedMediaAssociation` (
  `id` VARCHAR(191) NOT NULL, `protectedMediaId` VARCHAR(191) NOT NULL, `authority` VARCHAR(32) NOT NULL, `subjectKind` VARCHAR(64) NOT NULL,
  `subjectOpaqueId` VARCHAR(191) NOT NULL, `purpose` VARCHAR(64) NOT NULL, `role` VARCHAR(64) NOT NULL, `ordinal` INT NOT NULL DEFAULT 0,
  `ownerAccountId` VARCHAR(191) NOT NULL, `sourceRevision` VARCHAR(191) NOT NULL, `removedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `ProtectedMediaAssociation_subject_key` (`protectedMediaId`, `authority`, `subjectKind`, `subjectOpaqueId`, `purpose`, `role`, `ordinal`),
  KEY `ProtectedMediaAssociation_owner_idx` (`ownerAccountId`, `removedAt`), KEY `ProtectedMediaAssociation_subject_idx` (`authority`, `subjectKind`, `subjectOpaqueId`),
  CONSTRAINT `ProtectedMediaAssociation_media_fk` FOREIGN KEY (`protectedMediaId`) REFERENCES `ProtectedMedia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
