-- Project One Voyage Phase 2: durable, privacy-safe compatibility observation.
-- This table deliberately has no raw request, source payload, or credential.
CREATE TABLE `CompatibilityObservation` (
  `id` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NOT NULL,
  `operation` VARCHAR(191) NOT NULL,
  `routeKey` VARCHAR(191) NOT NULL,
  `disposition` VARCHAR(191) NOT NULL,
  `canonicalSessionId` VARCHAR(191) NULL,
  `canonicalAccountId` VARCHAR(191) NULL,
  `testTraffic` BOOLEAN NOT NULL DEFAULT false,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CompatibilityObservation_operation_occurredAt_idx` (`operation`, `occurredAt`),
  INDEX `CompatibilityObservation_canonicalSessionId_occurredAt_idx` (`canonicalSessionId`, `occurredAt`),
  INDEX `CompatibilityObservation_correlationId_idx` (`correlationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
