CREATE TABLE `ProtectedMediaConsentAssertion` (
  `id` VARCHAR(191) NOT NULL, `authority` VARCHAR(32) NOT NULL, `authorityRecordOpaqueId` VARCHAR(191) NOT NULL, `authorityRevision` VARCHAR(191) NOT NULL,
  `subjectOpaqueId` VARCHAR(191) NOT NULL, `subjectParticipantOpaqueId` VARCHAR(191) NULL, `consumingAggregateKind` VARCHAR(64) NOT NULL,
  `consumingAggregateOpaqueId` VARCHAR(191) NOT NULL, `purpose` VARCHAR(64) NOT NULL, `scopes` TEXT NOT NULL, `state` VARCHAR(32) NOT NULL,
  `sourceProtectedMediaId` VARCHAR(191) NOT NULL, `sourceChecksum` VARCHAR(64) NOT NULL, `requestedTransformationPolicy` VARCHAR(191) NOT NULL,
  `derivativeId` VARCHAR(191) NULL, `derivativeChecksum` VARCHAR(64) NULL, `validFrom` DATETIME(3) NOT NULL, `validUntil` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL, `sourceWatermark` VARCHAR(191) NOT NULL, `assertionDigest` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE KEY `ProtectedMediaConsentAssertion_digest_key` (`assertionDigest`),
  KEY `ProtectedMediaConsentAssertion_authority_idx` (`authority`, `authorityRecordOpaqueId`, `authorityRevision`), KEY `ProtectedMediaConsentAssertion_source_idx` (`sourceProtectedMediaId`, `state`),
  CONSTRAINT `ProtectedMediaConsentAssertion_media_fk` FOREIGN KEY (`sourceProtectedMediaId`) REFERENCES `ProtectedMedia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
