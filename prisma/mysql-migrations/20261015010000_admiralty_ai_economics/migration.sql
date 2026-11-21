ALTER TABLE `AIUsageLedger` ADD COLUMN `capabilityId` VARCHAR(191) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE `AIUsageLedger` ADD COLUMN `capabilityVersion` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `userPolicyRevision` INTEGER;
ALTER TABLE `AIUsageLedger` ADD COLUMN `policySnapshot` LONGTEXT;
ALTER TABLE `AIUsageLedger` ADD COLUMN `logicalParentId` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `outcome` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE `AIUsageLedger` ADD COLUMN `outcomeAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `generatedAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `previewedAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `rejectedAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `undoneAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `outcomeEvidence` LONGTEXT;
ALTER TABLE `AIUsageLedger` ADD COLUMN `acceptedResourceId` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `acceptedVersion` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `acceptedAt` DATETIME(3);
ALTER TABLE `AIUsageLedger` ADD COLUMN `applicationVersion` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `utcDay` VARCHAR(191);
ALTER TABLE `AIUsageLedger` ADD COLUMN `costBasis` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE `AIUsageLedger` ADD COLUMN `confirmedCostNano` BIGINT;
UPDATE `AIUsageLedger` SET `capabilityId` = CASE WHEN `operationCategory` = 'ROOM_RECONSTRUCTION' THEN 'ROOM_RECONSTRUCTION' WHEN `operationCategory` = 'AUTHORING' AND `mode` = 'ADVANCED' THEN 'ADVANCED_ASSISTANT' WHEN `operationCategory` = 'AUTHORING' THEN 'GROUNDED_ASSISTANT_EDIT' ELSE 'OTHER_AI_OPERATIONS' END,
`costBasis` = CASE WHEN `status` = 'SETTLED' AND `settledCostNano` IS NOT NULL THEN 'CALCULATED' WHEN `status` = 'RELEASED' AND `settledCostNano` = 0 THEN 'NO_CHARGE' ELSE 'UNKNOWN' END,
`outcome` = CASE WHEN `appliedAt` IS NOT NULL THEN 'APPLIED' ELSE 'UNKNOWN' END, `outcomeAt` = `appliedAt`;
UPDATE `AIUsageLedger` SET `utcDay` = DATE_FORMAT(`createdAt`, '%Y-%m-%d');

CREATE TABLE `AIProviderAttempt` (
`id` VARCHAR(191) NOT NULL PRIMARY KEY, `operationId` VARCHAR(191) NOT NULL, `sequence` INTEGER NOT NULL,
`provider` VARCHAR(191) NOT NULL, `model` VARCHAR(191) NOT NULL, `pricingRevision` VARCHAR(191) NOT NULL, `pricing` LONGTEXT NOT NULL,
`status` VARCHAR(191) NOT NULL, `costBasis` VARCHAR(191) NOT NULL DEFAULT 'UNKNOWN', `costNano` BIGINT, `exposureNano` BIGINT NOT NULL,
`usage` LONGTEXT, `providerResponseId` VARCHAR(191), `failureCode` VARCHAR(191), `startedAt` DATETIME(3) NOT NULL, `completedAt` DATETIME(3), `reconciledAt` DATETIME(3),
CONSTRAINT `AIProviderAttempt_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `AIUsageLedger`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AIUsageLedger_capabilityId_createdAt_idx` ON `AIUsageLedger`(`capabilityId`, `createdAt`);
CREATE INDEX `AIUsageLedger_accountId_capabilityId_period_status_idx` ON `AIUsageLedger`(`accountId`, `capabilityId`, `period`, `status`);
CREATE INDEX `AIUsageLedger_utcDay_capabilityId_outcome_idx` ON `AIUsageLedger`(`utcDay`, `capabilityId`, `outcome`);
CREATE INDEX `AIUsageLedger_accountId_definitionId_outcome_idx` ON `AIUsageLedger`(`accountId`, `definitionId`, `outcome`);
CREATE INDEX `AIUsageLedger_accountId_acceptedResourceId_outcome_idx` ON `AIUsageLedger`(`accountId`, `acceptedResourceId`, `outcome`);
CREATE INDEX `AIUsageLedger_settledCostNano_id_idx` ON `AIUsageLedger`(`settledCostNano`, `id`);
CREATE UNIQUE INDEX `AIProviderAttempt_operationId_sequence_key` ON `AIProviderAttempt`(`operationId`, `sequence`);
CREATE INDEX `AIProviderAttempt_startedAt_provider_model_idx` ON `AIProviderAttempt`(`startedAt`, `provider`, `model`);
CREATE INDEX `AIProviderAttempt_status_startedAt_idx` ON `AIProviderAttempt`(`status`, `startedAt`);
