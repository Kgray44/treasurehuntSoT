CREATE TABLE `ProtectedMediaDerivative` (
  `id` VARCHAR(191) NOT NULL, `sourceProtectedMediaId` VARCHAR(191) NOT NULL, `sourcePrivateAssetObjectId` VARCHAR(191) NOT NULL, `derivativeObjectId` VARCHAR(191) NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL, `transformationPolicy` VARCHAR(191) NOT NULL, `transformationPolicyVersion` INT NOT NULL, `purpose` VARCHAR(64) NOT NULL,
  `mediaKind` VARCHAR(32) NOT NULL, `outputMediaType` VARCHAR(191) NOT NULL, `outputByteLength` INT NOT NULL, `outputChecksum` VARCHAR(64) NOT NULL,
  `width` INT NULL, `height` INT NULL, `durationMilliseconds` INT NULL, `storageNamespace` VARCHAR(32) NOT NULL DEFAULT 'derivatives',
  `storageOpaqueReference` VARCHAR(191) NOT NULL, `wrappedKeyReference` VARCHAR(191) NULL, `scanState` VARCHAR(32) NOT NULL, `state` VARCHAR(32) NOT NULL,
  `operationId` VARCHAR(191) NOT NULL, `supersedesDerivativeId` VARCHAR(191) NULL, `verifiedAt` DATETIME(3) NULL, `readyAt` DATETIME(3) NULL,
  `withdrawnAt` DATETIME(3) NULL, `failureCode` VARCHAR(64) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE KEY `ProtectedMediaDerivative_reference_key` (`storageOpaqueReference`), UNIQUE KEY `ProtectedMediaDerivative_identity_key` (`sourceProtectedMediaId`, `purpose`, `transformationPolicy`, `transformationPolicyVersion`, `outputChecksum`),
  KEY `ProtectedMediaDerivative_state_idx` (`state`, `scanState`, `createdAt`), KEY `ProtectedMediaDerivative_operation_idx` (`operationId`),
  CONSTRAINT `ProtectedMediaDerivative_media_fk` FOREIGN KEY (`sourceProtectedMediaId`) REFERENCES `ProtectedMedia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaDerivative_source_fk` FOREIGN KEY (`sourcePrivateAssetObjectId`) REFERENCES `PrivateAssetObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaDerivative_object_fk` FOREIGN KEY (`derivativeObjectId`) REFERENCES `PrivateAssetObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaDerivative_operation_fk` FOREIGN KEY (`operationId`) REFERENCES `PrivateContentOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ProtectedMediaGrant` (
  `id` VARCHAR(191) NOT NULL, `protectedMediaId` VARCHAR(191) NOT NULL, `derivativeId` VARCHAR(191) NULL, `associationId` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(64) NOT NULL, `audience` VARCHAR(32) NOT NULL, `consumingAuthority` VARCHAR(32) NOT NULL, `consumingAggregateKind` VARCHAR(64) NOT NULL,
  `consumingAggregateOpaqueId` VARCHAR(191) NOT NULL, `authorizationRevision` VARCHAR(191) NOT NULL, `consentAssertionId` VARCHAR(191) NULL,
  `state` VARCHAR(32) NOT NULL, `activeFrom` DATETIME(3) NOT NULL, `expiresAt` DATETIME(3) NULL, `revokedAt` DATETIME(3) NULL,
  `revocationReasonCode` VARCHAR(64) NULL, `createdByAccountId` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `ProtectedMediaGrant_derivative_idx` (`derivativeId`, `state`), KEY `ProtectedMediaGrant_consumer_idx` (`consumingAuthority`, `consumingAggregateKind`, `consumingAggregateOpaqueId`),
  CONSTRAINT `ProtectedMediaGrant_media_fk` FOREIGN KEY (`protectedMediaId`) REFERENCES `ProtectedMedia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaGrant_derivative_fk` FOREIGN KEY (`derivativeId`) REFERENCES `ProtectedMediaDerivative`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaGrant_association_fk` FOREIGN KEY (`associationId`) REFERENCES `ProtectedMediaAssociation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaGrant_consent_fk` FOREIGN KEY (`consentAssertionId`) REFERENCES `ProtectedMediaConsentAssertion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ProtectedMediaTransformationReceipt` (
  `id` VARCHAR(191) NOT NULL, `derivativeId` VARCHAR(191) NOT NULL, `sourceProtectedMediaOpaqueId` VARCHAR(191) NOT NULL,
  `sourceChecksum` VARCHAR(64) NOT NULL, `policyName` VARCHAR(191) NOT NULL, `policyVersion` INT NOT NULL, `outputChecksum` VARCHAR(64) NOT NULL,
  `outputByteLength` INT NOT NULL, `outputMediaType` VARCHAR(191) NOT NULL, `safeMetadata` TEXT NOT NULL, `scanReceiptOpaqueId` VARCHAR(191) NULL,
  `operationCorrelation` VARCHAR(191) NOT NULL, `startedAt` DATETIME(3) NOT NULL, `completedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), UNIQUE KEY `ProtectedMediaTransformationReceipt_derivative_key` (`derivativeId`),
  CONSTRAINT `ProtectedMediaTransformationReceipt_derivative_fk` FOREIGN KEY (`derivativeId`) REFERENCES `ProtectedMediaDerivative`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `ProtectedMediaWithdrawal` (
  `id` VARCHAR(191) NOT NULL, `protectedMediaId` VARCHAR(191) NOT NULL, `derivativeId` VARCHAR(191) NULL, `reasonCode` VARCHAR(64) NOT NULL,
  `actorAccountId` VARCHAR(191) NULL, `consumerInvalidationState` VARCHAR(32) NOT NULL DEFAULT 'PENDING', `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  KEY `ProtectedMediaWithdrawal_derivative_idx` (`derivativeId`, `occurredAt`), KEY `ProtectedMediaWithdrawal_media_idx` (`protectedMediaId`, `occurredAt`),
  CONSTRAINT `ProtectedMediaWithdrawal_media_fk` FOREIGN KEY (`protectedMediaId`) REFERENCES `ProtectedMedia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProtectedMediaWithdrawal_derivative_fk` FOREIGN KEY (`derivativeId`) REFERENCES `ProtectedMediaDerivative`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
