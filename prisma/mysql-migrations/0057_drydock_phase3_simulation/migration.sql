CREATE TABLE `DrydockScenario` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `scenarioId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `currentRevision` INTEGER NOT NULL DEFAULT 1,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `DrydockScenario_draftId_scenarioId_key` (`draftId`, `scenarioId`),
    INDEX `DrydockScenario_draftId_archivedAt_updatedAt_idx` (`draftId`, `archivedAt`, `updatedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DrydockScenario_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockScenarioRevision` (
    `id` VARCHAR(191) NOT NULL,
    `scenarioRecordId` VARCHAR(191) NOT NULL,
    `revision` INTEGER NOT NULL,
    `sourceChecksum` VARCHAR(191) NOT NULL,
    `scenarioSchemaVersion` INTEGER NOT NULL,
    `scenarioDigest` VARCHAR(191) NOT NULL,
    `scenario` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `DrydockScenarioRevision_scenarioRecordId_revision_key` (`scenarioRecordId`, `revision`),
    INDEX `DrydockScenarioRevision_sourceChecksum_createdAt_idx` (`sourceChecksum`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DrydockScenarioRevision_scenarioRecordId_fkey` FOREIGN KEY (`scenarioRecordId`) REFERENCES `DrydockScenario` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockScenarioSuite` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `suiteId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `sourceChecksum` VARCHAR(191) NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `DrydockScenarioSuite_draftId_suiteId_key` (`draftId`, `suiteId`),
    INDEX `DrydockScenarioSuite_draftId_archivedAt_updatedAt_idx` (`draftId`, `archivedAt`, `updatedAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DrydockScenarioSuite_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockScenarioSuiteMember` (
    `id` VARCHAR(191) NOT NULL,
    `suiteRecordId` VARCHAR(191) NOT NULL,
    `scenarioRevisionId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `DrydockScenarioSuiteMember_suiteRecordId_scenarioRevisionId_key` (`suiteRecordId`, `scenarioRevisionId`),
    UNIQUE INDEX `DrydockScenarioSuiteMember_suiteRecordId_orderIndex_key` (`suiteRecordId`, `orderIndex`),
    INDEX `DrydockScenarioSuiteMember_scenarioRevisionId_idx` (`scenarioRevisionId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DrydockScenarioSuiteMember_suiteRecordId_fkey` FOREIGN KEY (`suiteRecordId`) REFERENCES `DrydockScenarioSuite` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `DrydockScenarioSuiteMember_scenarioRevisionId_fkey` FOREIGN KEY (`scenarioRevisionId`) REFERENCES `DrydockScenarioRevision` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DrydockSimulationRun` (
    `id` VARCHAR(191) NOT NULL,
    `draftId` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `scenarioRevisionId` VARCHAR(191) NULL,
    `sourceChecksum` VARCHAR(191) NOT NULL,
    `sourceRevision` INTEGER NOT NULL,
    `engineVersion` VARCHAR(191) NOT NULL,
    `adapterVersion` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `resultDigest` VARCHAR(191) NULL,
    `coverageDigest` VARCHAR(191) NULL,
    `sourceSnapshot` LONGTEXT NOT NULL,
    `result` LONGTEXT NOT NULL,
    `trace` LONGTEXT NOT NULL,
    `checkpoint` LONGTEXT NOT NULL,
    `completedInputs` INTEGER NOT NULL DEFAULT 0,
    `cancellationRequestedAt` DATETIME(3) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `DrydockSimulationRun_runId_key` (`runId`),
    INDEX `DrydockSimulationRun_draftId_createdAt_idx` (`draftId`, `createdAt`),
    INDEX `DrydockSimulationRun_sourceChecksum_status_idx` (`sourceChecksum`, `status`),
    INDEX `DrydockSimulationRun_scenarioRevisionId_createdAt_idx` (`scenarioRevisionId`, `createdAt`),
    INDEX `DrydockSimulationRun_leaseExpiresAt_idx` (`leaseExpiresAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DrydockSimulationRun_draftId_fkey` FOREIGN KEY (`draftId`) REFERENCES `TaleDraft` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `DrydockSimulationRun_scenarioRevisionId_fkey` FOREIGN KEY (`scenarioRevisionId`) REFERENCES `DrydockScenarioRevision` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
