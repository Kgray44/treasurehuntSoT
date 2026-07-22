-- Project Wayfarer Phase 2 additive profile/provider schema. Run only through the reviewed MySQL migration sequence.
ALTER TABLE `PlayerProfile`
  ADD COLUMN `handle` VARCHAR(64) NULL,
  ADD COLUMN `normalizedHandle` VARCHAR(64) NULL,
  ADD COLUMN `biography` TEXT NULL,
  ADD COLUMN `avatarMediaId` VARCHAR(191) NULL,
  ADD COLUMN `bannerMediaId` VARCHAR(191) NULL,
  ADD COLUMN `defaultVisibility` VARCHAR(32) NOT NULL DEFAULT 'REGISTERED_USERS',
  ADD UNIQUE KEY `PlayerProfile_normalizedHandle_key` (`normalizedHandle`),
  ADD UNIQUE KEY `PlayerProfile_avatarMediaId_key` (`avatarMediaId`),
  ADD UNIQUE KEY `PlayerProfile_bannerMediaId_key` (`bannerMediaId`),
  ADD KEY `PlayerProfile_normalizedHandle_status_idx` (`normalizedHandle`, `status`);

CREATE TABLE `ProfileHandleHistory` (
  `id` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL, `handle` VARCHAR(64) NOT NULL, `normalizedHandle` VARCHAR(64) NOT NULL, `changedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `releasedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ProfileHandleHistory_normalizedHandle_key` (`normalizedHandle`), KEY `ProfileHandleHistory_playerProfileId_changedAt_idx` (`playerProfileId`, `changedAt`),
  CONSTRAINT `ProfileHandleHistory_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ProfileMedia` (
  `id` VARCHAR(191) NOT NULL, `profileId` VARCHAR(191) NOT NULL, `kind` VARCHAR(16) NOT NULL, `storageKey` VARCHAR(255) NOT NULL, `mimeType` VARCHAR(191) NOT NULL, `byteLength` INT NOT NULL, `width` INT NULL, `height` INT NULL, `altText` VARCHAR(240) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `removedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ProfileMedia_storageKey_key` (`storageKey`), KEY `ProfileMedia_profileId_kind_removedAt_idx` (`profileId`, `kind`, `removedAt`),
  CONSTRAINT `ProfileMedia_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `PlayerProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ExternalIdentity` (
  `id` VARCHAR(191) NOT NULL, `accountId` VARCHAR(191) NOT NULL, `provider` VARCHAR(64) NOT NULL, `providerAccountId` VARCHAR(191) NOT NULL, `providerDisplayName` VARCHAR(191) NULL, `avatarReference` TEXT NULL, `allowedScopes` LONGTEXT NOT NULL, `useForLogin` BOOLEAN NOT NULL DEFAULT false, `visibility` VARCHAR(32) NOT NULL DEFAULT 'ONLY_ME', `status` VARCHAR(32) NOT NULL DEFAULT 'LINKED', `encryptedToken` LONGTEXT NULL, `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `lastVerifiedAt` DATETIME(3) NULL, `refreshedAt` DATETIME(3) NULL, `revokedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ExternalIdentity_provider_providerAccountId_key` (`provider`, `providerAccountId`), KEY `ExternalIdentity_accountId_status_visibility_idx` (`accountId`, `status`, `visibility`),
  CONSTRAINT `ExternalIdentity_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `UserAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ProviderLinkAttempt` (
  `id` VARCHAR(191) NOT NULL, `accountId` VARCHAR(191) NOT NULL, `provider` VARCHAR(64) NOT NULL, `stateHash` CHAR(64) NOT NULL, `pkceVerifier` VARCHAR(191) NOT NULL, `nonceHash` CHAR(64) NOT NULL, `redirectPath` VARCHAR(255) NOT NULL DEFAULT '/passport/providers', `expiresAt` DATETIME(3) NOT NULL, `consumedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `ProviderLinkAttempt_stateHash_key` (`stateHash`), KEY `ProviderLinkAttempt_accountId_provider_expiresAt_idx` (`accountId`, `provider`, `expiresAt`),
  CONSTRAINT `ProviderLinkAttempt_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `UserAccount` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ProfilePreferenceSet` (
  `id` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL, `schemaVersion` INT NOT NULL DEFAULT 1, `payload` LONGTEXT NOT NULL, `migratedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ProfilePreferenceSet_playerProfileId_key` (`playerProfileId`),
  CONSTRAINT `ProfilePreferenceSet_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE `ProfilePrivacyRule` (
  `id` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL, `section` VARCHAR(64) NOT NULL, `visibility` VARCHAR(32) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `ProfilePrivacyRule_playerProfileId_section_key` (`playerProfileId`, `section`), KEY `ProfilePrivacyRule_playerProfileId_visibility_idx` (`playerProfileId`, `visibility`),
  CONSTRAINT `ProfilePrivacyRule_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
