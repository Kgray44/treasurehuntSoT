ALTER TABLE `SupportAccessRequest` ADD COLUMN `requestedRepairIds` LONGTEXT NOT NULL DEFAULT '[]' AFTER `requestedScopes`;
ALTER TABLE `SupportAccessGrant` ADD COLUMN `grantedRepairIds` LONGTEXT NOT NULL DEFAULT '[]' AFTER `grantedScopes`, ADD COLUMN `maximumRiskClass` VARCHAR(8) NOT NULL DEFAULT 'R0' AFTER `grantedRepairIds`;
ALTER TABLE `SupportCase` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1 AFTER `status`;

ALTER TABLE `SupportExecutionGrant`
  ADD COLUMN `permittedRepairIds` LONGTEXT NOT NULL DEFAULT '[]' AFTER `riskCeiling`,
  ADD COLUMN `maximumRiskClass` VARCHAR(8) NOT NULL DEFAULT 'R0' AFTER `permittedRepairIds`,
  ADD COLUMN `maximumCommands` INTEGER NOT NULL DEFAULT 0 AFTER `maximumRiskClass`,
  ADD COLUMN `remainingCommands` INTEGER NOT NULL DEFAULT 0 AFTER `maximumCommands`,
  ADD COLUMN `maximumAffectedRecords` INTEGER NOT NULL DEFAULT 0 AFTER `remainingCommands`,
  ADD COLUMN `remainingAffectedRecords` INTEGER NOT NULL DEFAULT 0 AFTER `maximumAffectedRecords`,
  ADD COLUMN `maximumDomains` INTEGER NOT NULL DEFAULT 0 AFTER `remainingAffectedRecords`,
  ADD COLUMN `usedDomains` LONGTEXT NOT NULL DEFAULT '[]' AFTER `maximumDomains`;

ALTER TABLE `SupportRepairProposal`
  ADD COLUMN `repairId` VARCHAR(128) NULL AFTER `proposalType`,
  ADD COLUMN `targetType` VARCHAR(96) NULL AFTER `repairId`,
  ADD COLUMN `targetId` VARCHAR(191) NULL AFTER `targetType`,
  ADD COLUMN `targetRevision` VARCHAR(191) NULL AFTER `targetId`,
  ADD COLUMN `proposalRevision` INTEGER NULL AFTER `targetRevision`,
  ADD COLUMN `preview` LONGTEXT NULL AFTER `proposalRevision`,
  ADD COLUMN `requiresHumanApproval` BOOLEAN NOT NULL DEFAULT false AFTER `state`;

CREATE TABLE `SupportRepairExecution` (
  `id` VARCHAR(191) NOT NULL,
  `supportCaseId` VARCHAR(191) NOT NULL,
  `supportExecutionGrantId` VARCHAR(191) NOT NULL,
  `supportRepairProposalId` VARCHAR(191) NOT NULL,
  `repairId` VARCHAR(128) NOT NULL,
  `registrySchemaVersion` VARCHAR(32) NOT NULL,
  `targetType` VARCHAR(96) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `targetRevision` VARCHAR(191) NOT NULL,
  `proposalRevision` INTEGER NOT NULL,
  `idempotencyKey` VARCHAR(128) NOT NULL,
  `state` VARCHAR(48) NOT NULL DEFAULT 'PENDING',
  `verificationState` VARCHAR(64) NOT NULL DEFAULT 'PENDING',
  `rollbackState` VARCHAR(64) NOT NULL DEFAULT 'NOT_REQUIRED',
  `affectedRecords` INTEGER NOT NULL,
  `ownerReceipt` LONGTEXT NULL,
  `resultSummary` LONGTEXT NOT NULL,
  `failureCode` VARCHAR(96) NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `committedAt` DATETIME(3) NULL,
  `verifiedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `SupportRepairExecution_idempotencyKey_key` (`idempotencyKey`),
  UNIQUE INDEX `SupportRepairExecution_correlationId_key` (`correlationId`),
  INDEX `SupportRepairExecution_supportCaseId_state_startedAt_idx` (`supportCaseId`, `state`, `startedAt`),
  INDEX `SupportRepairExecution_supportExecutionGrantId_state_startedAt_idx` (`supportExecutionGrantId`, `state`, `startedAt`),
  INDEX `SupportRepairExecution_targetType_targetId_state_idx` (`targetType`, `targetId`, `state`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportRepairExecution_supportCaseId_fkey` FOREIGN KEY (`supportCaseId`) REFERENCES `SupportCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportRepairExecution_supportExecutionGrantId_fkey` FOREIGN KEY (`supportExecutionGrantId`) REFERENCES `SupportExecutionGrant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `SupportRepairExecution_supportRepairProposalId_fkey` FOREIGN KEY (`supportRepairProposalId`) REFERENCES `SupportRepairProposal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SupportRepairLease` (
  `id` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(96) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `supportCaseId` VARCHAR(191) NOT NULL,
  `supportRepairExecutionId` VARCHAR(191) NULL,
  `leaseToken` VARCHAR(191) NOT NULL,
  `acquiredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt` DATETIME(3) NOT NULL,
  `releasedAt` DATETIME(3) NULL,
  UNIQUE INDEX `SupportRepairLease_targetType_targetId_key` (`targetType`, `targetId`),
  UNIQUE INDEX `SupportRepairLease_supportRepairExecutionId_key` (`supportRepairExecutionId`),
  UNIQUE INDEX `SupportRepairLease_leaseToken_key` (`leaseToken`),
  INDEX `SupportRepairLease_supportCaseId_expiresAt_idx` (`supportCaseId`, `expiresAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `SupportRepairLease_supportCaseId_fkey` FOREIGN KEY (`supportCaseId`) REFERENCES `SupportCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
