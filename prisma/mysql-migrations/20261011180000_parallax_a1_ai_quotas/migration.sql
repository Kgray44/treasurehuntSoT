-- CreateTable
CREATE TABLE `AIQuotaCommandPreview` (
    `id` VARCHAR(191) NOT NULL,
    `actorAccountId` VARCHAR(191) NOT NULL,
    `accountSessionId` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NULL,
    `expectedRevision` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIQuotaCommandPreview_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIQuotaControl` (
    `id` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `lockVersion` INTEGER NOT NULL DEFAULT 0,
    `policy` LONGTEXT NOT NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastFailureCode` VARCHAR(191) NULL,
    `lastFailureAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIQuotaUserPolicy` (
    `accountId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 0,
    `policy` LONGTEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`accountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIQuotaPolicyRevision` (
    `id` VARCHAR(191) NOT NULL,
    `targetAccountId` VARCHAR(191) NULL,
    `actorAccountId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `previousRevision` INTEGER NOT NULL,
    `resultingRevision` INTEGER NOT NULL,
    `beforeState` LONGTEXT NOT NULL,
    `afterState` LONGTEXT NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIQuotaPolicyRevision_idempotencyKey_key`(`idempotencyKey`),
    INDEX `AIQuotaPolicyRevision_targetAccountId_createdAt_idx`(`targetAccountId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIUsageLedger` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `fingerprint` VARCHAR(191) NOT NULL,
    `definitionId` VARCHAR(191) NOT NULL,
    `operationCategory` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `pricingRevision` VARCHAR(191) NOT NULL,
    `pricing` LONGTEXT NOT NULL,
    `policyRevision` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `reservationNano` BIGINT NOT NULL,
    `exposureNano` BIGINT NOT NULL,
    `settledCostNano` BIGINT NULL,
    `inputTokens` INTEGER NULL,
    `cachedInputTokens` INTEGER NULL,
    `cacheWriteTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `reasoningTokens` INTEGER NULL,
    `providerResponseId` VARCHAR(191) NULL,
    `failureCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dispatchedAt` DATETIME(3) NULL,
    `settledAt` DATETIME(3) NULL,
    `leaseExpiresAt` DATETIME(3) NOT NULL,
    `result` LONGTEXT NULL,
    `resultExpiresAt` DATETIME(3) NULL,
    `timings` LONGTEXT NULL,

    INDEX `AIUsageLedger_period_accountId_status_idx`(`period`, `accountId`, `status`),
    INDEX `AIUsageLedger_createdAt_status_idx`(`createdAt`, `status`),
    INDEX `AIUsageLedger_leaseExpiresAt_status_idx`(`leaseExpiresAt`, `status`),
    UNIQUE INDEX `AIUsageLedger_accountId_idempotencyKey_key`(`accountId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
