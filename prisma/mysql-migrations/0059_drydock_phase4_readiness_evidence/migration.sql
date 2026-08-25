CREATE TABLE `DrydockCompatibilityRun` (
  `id` VARCHAR(191) NOT NULL,
  `draftId` VARCHAR(191) NOT NULL,
  `runId` VARCHAR(191) NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL,
  `policyVersion` VARCHAR(128) NOT NULL,
  `status` VARCHAR(64) NOT NULL,
  `digest` VARCHAR(64) NOT NULL,
  `result` LONGTEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `DrydockCompatibilityRun_runId_key` (`runId`),
  KEY `DrydockCompatibilityRun_draftId_createdAt_idx` (`draftId`, `createdAt`),
  KEY `DrydockCompatibilityRun_sourceChecksum_status_idx` (`sourceChecksum`, `status`),
  CONSTRAINT `DrydockCompatibilityRun_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockExternalEvidenceReference` (
  `id` VARCHAR(191) NOT NULL,
  `draftId` VARCHAR(191) NOT NULL,
  `providerId` VARCHAR(128) NOT NULL,
  `providerVersion` VARCHAR(128) NOT NULL,
  `evidenceKind` VARCHAR(128) NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL,
  `status` VARCHAR(64) NOT NULL,
  `safeSummary` TEXT NOT NULL,
  `sourceReference` TEXT NULL,
  `checkedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `DrydockExternalEvidenceReference_identity_key` (`draftId`, `providerId`, `providerVersion`, `evidenceKind`, `sourceChecksum`),
  KEY `DrydockExternalEvidenceReference_draftId_sourceChecksum_idx` (`draftId`, `sourceChecksum`),
  KEY `DrydockExternalEvidenceReference_status_expiresAt_idx` (`status`, `expiresAt`),
  CONSTRAINT `DrydockExternalEvidenceReference_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockPublishingEvidence` (
  `id` VARCHAR(191) NOT NULL,
  `publishedVersionId` VARCHAR(191) NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL,
  `schemaVersion` INT NOT NULL,
  `schemaRegistryVersion` INT NOT NULL,
  `ruleCatalogVersion` INT NOT NULL,
  `validationRunId` VARCHAR(191) NOT NULL,
  `requiredSuitePolicyVersion` VARCHAR(128) NOT NULL,
  `compatibilityPolicyVersion` VARCHAR(128) NOT NULL,
  `compatibilityDigest` VARCHAR(64) NOT NULL,
  `externalEvidenceDigest` VARCHAR(64) NOT NULL,
  `evidence` LONGTEXT NOT NULL,
  `digest` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `DrydockPublishingEvidence_publishedVersionId_key` (`publishedVersionId`), UNIQUE KEY `DrydockPublishingEvidence_digest_key` (`digest`),
  KEY `DrydockPublishingEvidence_sourceChecksum_idx` (`sourceChecksum`),
  KEY `DrydockPublishingEvidence_createdAt_idx` (`createdAt`),
  CONSTRAINT `DrydockPublishingEvidence_publishedVersionId_fkey` FOREIGN KEY (`publishedVersionId`) REFERENCES `PublishedTaleVersion` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
