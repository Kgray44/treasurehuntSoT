CREATE TABLE `SupportCase` (
  `id` VARCHAR(191) NOT NULL,
  `caseNumber` VARCHAR(64) NOT NULL,
  `requestingOperatorId` VARCHAR(191) NOT NULL,
  `targetAccountId` VARCHAR(191) NOT NULL,
  `supportAccessRequestId` VARCHAR(191) NULL,
  `title` VARCHAR(160) NOT NULL,
  `safeSummary` VARCHAR(480) NOT NULL,
  `status` VARCHAR(48) NOT NULL DEFAULT 'AWAITING_CONSENT',
  `correlationId` VARCHAR(191) NOT NULL,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `SupportCase_caseNumber_key` (`caseNumber`),
  UNIQUE INDEX `SupportCase_supportAccessRequestId_key` (`supportAccessRequestId`),
  UNIQUE INDEX `SupportCase_correlationId_key` (`correlationId`),
  INDEX `SupportCase_requestingOperatorId_status_openedAt_idx` (`requestingOperatorId`, `status`, `openedAt`),
  INDEX `SupportCase_targetAccountId_status_openedAt_idx` (`targetAccountId`, `status`, `openedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportCase_requestingOperatorId_fkey` FOREIGN KEY (`requestingOperatorId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportCase_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportCase_supportAccessRequestId_fkey` FOREIGN KEY (`supportAccessRequestId`) REFERENCES `SupportAccessRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportExecutionGrant` (
  `id` VARCHAR(191) NOT NULL,
  `supportCaseId` VARCHAR(191) NOT NULL,
  `parentSupportGrantId` VARCHAR(191) NOT NULL,
  `operatorAccountId` VARCHAR(191) NOT NULL,
  `targetAccountId` VARCHAR(191) NOT NULL,
  `grantedScopes` LONGTEXT NOT NULL,
  `dataClasses` LONGTEXT NOT NULL,
  `riskCeiling` VARCHAR(32) NOT NULL DEFAULT 'READ_ONLY',
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupportExecutionGrant_correlationId_key` (`correlationId`),
  INDEX `SupportExecutionGrant_supportCaseId_status_expiresAt_idx` (`supportCaseId`, `status`, `expiresAt`),
  INDEX `SupportExecutionGrant_operatorAccountId_targetAccountId_status_expiresAt_idx` (`operatorAccountId`, `targetAccountId`, `status`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportExecutionGrant_supportCaseId_fkey` FOREIGN KEY (`supportCaseId`) REFERENCES `SupportCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportExecutionGrant_parentSupportGrantId_fkey` FOREIGN KEY (`parentSupportGrantId`) REFERENCES `SupportAccessGrant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportExecutionGrant_operatorAccountId_fkey` FOREIGN KEY (`operatorAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportExecutionGrant_targetAccountId_fkey` FOREIGN KEY (`targetAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportExecutionSession` (
  `id` VARCHAR(191) NOT NULL,
  `supportCaseId` VARCHAR(191) NOT NULL,
  `supportExecutionGrantId` VARCHAR(191) NULL,
  `operatorAccountId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
  `queriedDomains` LONGTEXT NOT NULL DEFAULT '[]',
  `dataClasses` LONGTEXT NOT NULL DEFAULT '[]',
  `redactionCount` INTEGER NOT NULL DEFAULT 0,
  `deniedAccessCount` INTEGER NOT NULL DEFAULT 0,
  `denialCode` VARCHAR(96) NULL,
  `receiptDigest` CHAR(64) NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completedAt` DATETIME(3) NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupportExecutionSession_correlationId_key` (`correlationId`),
  INDEX `SupportExecutionSession_supportCaseId_startedAt_idx` (`supportCaseId`, `startedAt`),
  INDEX `SupportExecutionSession_supportExecutionGrantId_startedAt_idx` (`supportExecutionGrantId`, `startedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportExecutionSession_supportCaseId_fkey` FOREIGN KEY (`supportCaseId`) REFERENCES `SupportCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportExecutionSession_supportExecutionGrantId_fkey` FOREIGN KEY (`supportExecutionGrantId`) REFERENCES `SupportExecutionGrant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `SupportExecutionSession_operatorAccountId_fkey` FOREIGN KEY (`operatorAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportObservation` (
  `id` VARCHAR(191) NOT NULL,
  `supportExecutionSessionId` VARCHAR(191) NOT NULL,
  `domain` VARCHAR(64) NOT NULL,
  `scope` VARCHAR(64) NOT NULL,
  `dataClassification` VARCHAR(64) NOT NULL,
  `sourceType` VARCHAR(128) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `sourceDigest` CHAR(64) NOT NULL,
  `safeSummary` VARCHAR(480) NOT NULL,
  `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SupportObservation_supportExecutionSessionId_domain_observedAt_idx` (`supportExecutionSessionId`, `domain`, `observedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportObservation_supportExecutionSessionId_fkey` FOREIGN KEY (`supportExecutionSessionId`) REFERENCES `SupportExecutionSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportEvidenceReference` (
  `id` VARCHAR(191) NOT NULL,
  `supportExecutionSessionId` VARCHAR(191) NOT NULL,
  `supportObservationId` VARCHAR(191) NULL,
  `sourceDomain` VARCHAR(64) NOT NULL,
  `sourceReference` VARCHAR(191) NOT NULL,
  `dataClassification` VARCHAR(64) NOT NULL,
  `digest` CHAR(64) NOT NULL,
  `sanitizedExcerpt` VARCHAR(480) NOT NULL,
  `redacted` BOOLEAN NOT NULL DEFAULT false,
  `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SupportEvidenceReference_supportExecutionSessionId_sourceDomain_observedAt_idx` (`supportExecutionSessionId`, `sourceDomain`, `observedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportEvidenceReference_supportExecutionSessionId_fkey` FOREIGN KEY (`supportExecutionSessionId`) REFERENCES `SupportExecutionSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SupportEvidenceReference_supportObservationId_fkey` FOREIGN KEY (`supportObservationId`) REFERENCES `SupportObservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportFinding` (
  `id` VARCHAR(191) NOT NULL,
  `supportExecutionSessionId` VARCHAR(191) NOT NULL,
  `code` VARCHAR(96) NOT NULL,
  `summary` VARCHAR(480) NOT NULL,
  `confidence` VARCHAR(16) NOT NULL,
  `uncertainty` VARCHAR(480) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SupportFinding_supportExecutionSessionId_confidence_idx` (`supportExecutionSessionId`, `confidence`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportFinding_supportExecutionSessionId_fkey` FOREIGN KEY (`supportExecutionSessionId`) REFERENCES `SupportExecutionSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportFindingEvidence` (
  `supportFindingId` VARCHAR(191) NOT NULL,
  `supportEvidenceReferenceId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`supportFindingId`, `supportEvidenceReferenceId`),
  CONSTRAINT `SupportFindingEvidence_supportFindingId_fkey` FOREIGN KEY (`supportFindingId`) REFERENCES `SupportFinding`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `SupportFindingEvidence_supportEvidenceReferenceId_fkey` FOREIGN KEY (`supportEvidenceReferenceId`) REFERENCES `SupportEvidenceReference`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportDiagnosis` (
  `id` VARCHAR(191) NOT NULL,
  `supportExecutionSessionId` VARCHAR(191) NOT NULL,
  `primaryCause` VARCHAR(480) NOT NULL,
  `confidence` VARCHAR(16) NOT NULL,
  `uncertainty` VARCHAR(480) NOT NULL,
  `unresolvedQuestions` LONGTEXT NOT NULL,
  `evidenceDigest` CHAR(64) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupportDiagnosis_supportExecutionSessionId_key` (`supportExecutionSessionId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportDiagnosis_supportExecutionSessionId_fkey` FOREIGN KEY (`supportExecutionSessionId`) REFERENCES `SupportExecutionSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportRepairProposal` (
  `id` VARCHAR(191) NOT NULL,
  `supportExecutionSessionId` VARCHAR(191) NOT NULL,
  `proposalType` VARCHAR(96) NOT NULL,
  `summary` VARCHAR(480) NOT NULL,
  `requiredUserConsent` BOOLEAN NOT NULL DEFAULT false,
  `requiresAdministrator` BOOLEAN NOT NULL DEFAULT true,
  `state` VARCHAR(48) NOT NULL DEFAULT 'INFORMATION_ONLY',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `SupportRepairProposal_supportExecutionSessionId_state_idx` (`supportExecutionSessionId`, `state`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportRepairProposal_supportExecutionSessionId_fkey` FOREIGN KEY (`supportExecutionSessionId`) REFERENCES `SupportExecutionSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
