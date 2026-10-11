CREATE TABLE `ParallaxResolutionDecision` (
  `id` VARCHAR(191) NOT NULL, `scopeKey` VARCHAR(191) NOT NULL,
  `definitionId` VARCHAR(191) NOT NULL, `versionId` VARCHAR(191) NOT NULL,
  `versionChecksum` VARCHAR(191) NOT NULL, `policy` VARCHAR(191) NOT NULL, `seed` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `ParallaxResolutionDecision_scopeKey_key` (`scopeKey`),
  INDEX `ParallaxResolutionDecision_definitionId_versionId_idx` (`definitionId`, `versionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ParallaxFieldObservation` (
  `id` VARCHAR(191) NOT NULL, `definitionId` VARCHAR(191) NOT NULL, `versionId` VARCHAR(191) NOT NULL,
  `versionChecksum` VARCHAR(191) NOT NULL, `sessionId` VARCHAR(191) NOT NULL, `blockId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL, `idempotencyKey` VARCHAR(191) NOT NULL, `digest` VARCHAR(191) NOT NULL,
  `metadata` LONGTEXT NOT NULL, `provenance` VARCHAR(191) NOT NULL, `consentRevision` INTEGER NOT NULL DEFAULT 1,
  `expiresAt` DATETIME(3) NOT NULL, `withdrawnAt` DATETIME(3), `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE INDEX `ParallaxFieldObservation_sessionId_actorId_idempotencyKey_key` (`sessionId`, `actorId`, `idempotencyKey`),
  INDEX `ParallaxFieldObservation_definitionId_expiresAt_idx` (`definitionId`, `expiresAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ParallaxCalibrationReview` (
  `id` VARCHAR(191) NOT NULL, `definitionId` VARCHAR(191) NOT NULL, `versionId` VARCHAR(191) NOT NULL,
  `ownerAccountId` VARCHAR(191) NOT NULL, `evidenceId` VARCHAR(191) NOT NULL, `recipeDigest` VARCHAR(191) NOT NULL,
  `maturity` VARCHAR(191) NOT NULL, `revision` INTEGER NOT NULL DEFAULT 1, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `ParallaxCalibrationReview_definitionId_ownerAccountId_idx` (`definitionId`, `ownerAccountId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ParallaxFieldAudit` (
  `id` VARCHAR(191) NOT NULL, `recordId` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), INDEX `ParallaxFieldAudit_recordId_createdAt_idx` (`recordId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
