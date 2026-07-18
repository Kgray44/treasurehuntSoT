-- AlterTable
ALTER TABLE `VisionCaptureSession`
    ADD COLUMN `sessionKey` VARCHAR(191) NULL,
    ADD COLUMN `protocolVersion` VARCHAR(191) NULL,
    ADD COLUMN `captureApi` VARCHAR(191) NULL,
    ADD COLUMN `targetMetadata` LONGTEXT NOT NULL DEFAULT '{}',
    ADD COLUMN `qualitySummary` LONGTEXT NOT NULL DEFAULT '{}',
    ADD COLUMN `interruptionSummary` LONGTEXT NOT NULL DEFAULT '{}',
    ADD COLUMN `manifestVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `VisionRecordingAsset`
    ADD COLUMN `mediaType` VARCHAR(191) NOT NULL DEFAULT 'video/webm',
    ADD COLUMN `manifestVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `artifactManifest` LONGTEXT NOT NULL DEFAULT '{}',
    ADD COLUMN `durationMs` INTEGER NULL;

-- CreateTable
CREATE TABLE `VisionCaptureInterruption` (
    `id` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `recoverable` BOOLEAN NOT NULL DEFAULT true,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VisionCaptureInterruption_captureSessionId_occurredAt_idx`(`captureSessionId`, `occurredAt`),
    INDEX `VisionCaptureInterruption_code_occurredAt_idx`(`code`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionDiagnosticBundle` (
    `id` VARCHAR(191) NOT NULL,
    `captureSessionId` VARCHAR(191) NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `bundleReference` TEXT NOT NULL,
    `contentHash` VARCHAR(191) NULL,
    `fileSize` INTEGER NOT NULL,
    `metadata` LONGTEXT NOT NULL DEFAULT '{}',
    `containsRawFrames` BOOLEAN NOT NULL DEFAULT false,
    `consentAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    INDEX `VisionDiagnosticBundle_captureSessionId_createdAt_idx`(`captureSessionId`, `createdAt`),
    INDEX `VisionDiagnosticBundle_actorType_actorId_createdAt_idx`(`actorType`, `actorId`, `createdAt`),
    INDEX `VisionDiagnosticBundle_expiresAt_deletedAt_idx`(`expiresAt`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VisionCapturePreference` (
    `id` VARCHAR(191) NOT NULL,
    `ownerType` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `deviceInstanceId` VARCHAR(191) NOT NULL,
    `rememberTarget` BOOLEAN NOT NULL DEFAULT false,
    `selectedTargetHash` VARCHAR(191) NULL,
    `hotkeyBinding` VARCHAR(191) NOT NULL DEFAULT 'Control+Alt+F9',
    `hotkeyInteraction` VARCHAR(191) NOT NULL DEFAULT 'HOLD',
    `hotkeyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `previewEnabled` BOOLEAN NOT NULL DEFAULT true,
    `diagnosticRetention` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VisionCapturePreference_ownerType_ownerId_updatedAt_idx`(`ownerType`, `ownerId`, `updatedAt`),
    UNIQUE INDEX `VisionCapturePreference_ownerType_ownerId_deviceInstanceId_key`(`ownerType`, `ownerId`, `deviceInstanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `VisionCaptureSession_sessionKey_key` ON `VisionCaptureSession`(`sessionKey`);

-- AddForeignKey
ALTER TABLE `VisionCaptureInterruption` ADD CONSTRAINT `VisionCaptureInterruption_captureSessionId_fkey` FOREIGN KEY (`captureSessionId`) REFERENCES `VisionCaptureSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VisionDiagnosticBundle` ADD CONSTRAINT `VisionDiagnosticBundle_captureSessionId_fkey` FOREIGN KEY (`captureSessionId`) REFERENCES `VisionCaptureSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
