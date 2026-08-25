CREATE TABLE `WayfarerAdminCommandReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `commandType` VARCHAR(64) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `actorAccountId` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(64) NOT NULL,
    `targetId` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `result` LONGTEXT NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `WayfarerAdminCommandReceipt_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `WayfarerAdminCommandReceipt_correlationId_key`(`correlationId`),
    INDEX `WayfarerAdminCommandReceipt_commandType_actorAccountId_completedAt_idx`(`commandType`, `actorAccountId`, `completedAt`),
    INDEX `WayfarerAdminCommandReceipt_targetType_targetId_completedAt_idx`(`targetType`, `targetId`, `completedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
