CREATE TABLE `CommunityOperationalPolicy` (
  `id` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `dispatchEnabled` BOOLEAN NOT NULL DEFAULT true,
  `batchSize` INTEGER NOT NULL DEFAULT 25,
  `pollIntervalMs` INTEGER NOT NULL DEFAULT 1000,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `CommunityOperationalPolicy_key_key`(`key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommunityOperationalPolicyChange` (
  `id` VARCHAR(191) NOT NULL,
  `policyKey` VARCHAR(191) NOT NULL,
  `actorAccountId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `requestFingerprint` VARCHAR(128) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `expectedRevision` INTEGER NOT NULL,
  `resultingRevision` INTEGER NOT NULL,
  `beforeState` TEXT NOT NULL,
  `afterState` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CommunityOperationalPolicyChange_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `CommunityOperationalPolicyChange_correlationId_key`(`correlationId`),
  INDEX `CommunityOperationalPolicyChange_policyKey_createdAt_idx`(`policyKey`, `createdAt`),
  INDEX `CommunityOperationalPolicyChange_actorAccountId_createdAt_idx`(`actorAccountId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CommunityOperationalCommandReceipt` (
  `id` VARCHAR(191) NOT NULL,
  `commandType` VARCHAR(96) NOT NULL,
  `actorAccountId` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(96) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `result` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CommunityOperationalCommandReceipt_idempotencyKey_key`(`idempotencyKey`),
  UNIQUE INDEX `CommunityOperationalCommandReceipt_correlationId_key`(`correlationId`),
  INDEX `CommunityOperationalCommandReceipt_commandType_actorAccountId_createdAt_idx`(`commandType`, `actorAccountId`, `createdAt`),
  INDEX `CommunityOperationalCommandReceipt_targetType_targetId_createdAt_idx`(`targetType`, `targetId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
