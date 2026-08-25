ALTER TABLE `DrydockScenarioSuite` ADD COLUMN `revision` INT NOT NULL DEFAULT 1;

CREATE TABLE `DrydockScenarioSuiteEvidence` (
  `id` VARCHAR(191) NOT NULL,
  `draftId` VARCHAR(191) NOT NULL,
  `suiteRecordId` VARCHAR(191) NOT NULL,
  `suiteRevision` INT NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL,
  `schemaRegistryVersion` INT NOT NULL,
  `ruleCatalogVersion` INT NOT NULL,
  `runtimeAdapterVersion` VARCHAR(128) NOT NULL,
  `requiredSuitePolicyVersion` VARCHAR(128) NOT NULL,
  `compatibilityPolicyVersion` VARCHAR(128) NOT NULL,
  `runIds` LONGTEXT NOT NULL,
  `coverageDigest` VARCHAR(64) NOT NULL,
  `proofStatus` VARCHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `DrydockScenarioSuiteEvidence_draftId_sourceChecksum_createdAt_idx` (`draftId`, `sourceChecksum`, `createdAt`),
  KEY `DrydockScenarioSuiteEvidence_suiteRecordId_suiteRevision_createdAt_idx` (`suiteRecordId`, `suiteRevision`, `createdAt`),
  KEY `DrydockScenarioSuiteEvidence_sourceChecksum_proofStatus_idx` (`sourceChecksum`, `proofStatus`),
  CONSTRAINT `DrydockScenarioSuiteEvidence_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DrydockScenarioSuiteEvidence_suiteRecordId_fkey` FOREIGN KEY (`suiteRecordId`) REFERENCES `DrydockScenarioSuite` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
