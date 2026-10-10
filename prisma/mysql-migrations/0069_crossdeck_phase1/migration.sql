-- MySQL 8.0.13+: TEXT defaults require expression syntax, including literal defaults.
-- CreateTable
CREATE TABLE `CrossdeckSurfaceSession` (
    `id` VARCHAR(191) NOT NULL,
    `surfaceId` VARCHAR(191) NOT NULL,
    `accountSessionId` VARCHAR(191) NOT NULL,
    `membershipId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'PRIMARY_STORY',
    `capabilities` LONGTEXT NOT NULL DEFAULT ('{}'),
    `lifecycle` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CrossdeckSurfaceSession_surfaceId_key`(`surfaceId`),
    INDEX `CrossdeckSurfaceSession_membershipId_revokedAt_expiresAt_idx`(`membershipId`, `revokedAt`, `expiresAt`),
    INDEX `CrossdeckSurfaceSession_accountSessionId_revokedAt_idx`(`accountSessionId`, `revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrossdeckPairingChallenge` (
    `id` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `requestedRole` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `claimedSurfaceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CrossdeckPairingChallenge_codeHash_key`(`codeHash`),
    INDEX `CrossdeckPairingChallenge_sourceId_expiresAt_idx`(`sourceId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CrossdeckSurfaceSession` ADD CONSTRAINT `CrossdeckSurfaceSession_accountSessionId_fkey` FOREIGN KEY (`accountSessionId`) REFERENCES `AccountSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrossdeckSurfaceSession` ADD CONSTRAINT `CrossdeckSurfaceSession_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `PlaythroughMembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrossdeckPairingChallenge` ADD CONSTRAINT `CrossdeckPairingChallenge_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `CrossdeckSurfaceSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

