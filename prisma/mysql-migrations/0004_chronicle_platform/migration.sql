-- Tall Tale Platform additive identity, library, invitation, and history domain.
ALTER TABLE `TallTale`
  ADD COLUMN `forkedFromTaleId` VARCHAR(191) NULL,
  ADD COLUMN `forkedFromVersionId` VARCHAR(191) NULL;

ALTER TABLE `TaleSession`
  ADD COLUMN `voyageName` VARCHAR(191) NULL,
  ADD COLUMN `captainMode` VARCHAR(191) NOT NULL DEFAULT 'CAPTAIN_CONTROLLED',
  ADD COLUMN `configuration` LONGTEXT NULL,
  ADD COLUMN `scheduleTimezone` VARCHAR(191) NULL,
  ADD COLUMN `plannedStartAt` DATETIME(3) NULL,
  ADD COLUMN `launchedAt` DATETIME(3) NULL,
  ADD COLUMN `cancelledAt` DATETIME(3) NULL,
  ADD COLUMN `abandonedAt` DATETIME(3) NULL,
  ADD COLUMN `concurrencyVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `historicalHidden` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `archiveMetadata` LONGTEXT NULL;

UPDATE `TaleSession`
SET `voyageName` = COALESCE(`ownerLabel`, 'Legacy voyage'),
    `configuration` = '{}',
    `archiveMetadata` = '{}',
    `launchedAt` = CASE WHEN `previewMode` = false THEN `startedAt` ELSE NULL END;

ALTER TABLE `TaleSession`
  MODIFY COLUMN `configuration` LONGTEXT NOT NULL DEFAULT '{}',
  MODIFY COLUMN `archiveMetadata` LONGTEXT NOT NULL DEFAULT '{}';

CREATE TABLE `PlayerProfile` (
  `id` VARCHAR(191) NOT NULL, `username` VARCHAR(191) NULL, `passwordHash` VARCHAR(191) NULL,
  `displayName` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `preferences` LONGTEXT NOT NULL DEFAULT '{}', `claimedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  `lastSeenAt` DATETIME(3) NULL,
  UNIQUE INDEX `PlayerProfile_username_key`(`username`),
  INDEX `PlayerProfile_status_displayName_idx`(`status`, `displayName`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlayerIdentitySession` (
  `id` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL, `tokenHash` VARCHAR(191) NOT NULL, `csrfToken` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `revokedAt` DATETIME(3) NULL,
  UNIQUE INDEX `PlayerIdentitySession_tokenHash_key`(`tokenHash`),
  INDEX `PlayerIdentitySession_playerProfileId_expiresAt_idx`(`playerProfileId`, `expiresAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformRoleAssignment` (
  `id` VARCHAR(191) NOT NULL, `accountId` VARCHAR(191) NOT NULL, `role` VARCHAR(191) NOT NULL,
  `scopeType` VARCHAR(191) NOT NULL DEFAULT 'GLOBAL', `scopeId` VARCHAR(191) NULL, `grantedBy` VARCHAR(191) NULL,
  `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `revokedAt` DATETIME(3) NULL,
  UNIQUE INDEX `PlatformRoleAssignment_accountId_role_scopeType_scopeId_key`(`accountId`, `role`, `scopeType`, `scopeId`),
  INDEX `PlatformRoleAssignment_role_scopeType_scopeId_revokedAt_idx`(`role`, `scopeType`, `scopeId`, `revokedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlaythroughMembership` (
  `id` VARCHAR(191) NOT NULL, `playthroughId` VARCHAR(191) NOT NULL, `playerProfileId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NOT NULL DEFAULT 'PLAYER', `status` VARCHAR(191) NOT NULL DEFAULT 'INVITED',
  `crewRole` VARCHAR(191) NULL, `joinedAt` DATETIME(3) NULL, `removedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL, `pinnedAt` DATETIME(3) NULL, `hiddenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `PlaythroughMembership_playthroughId_playerProfileId_key`(`playthroughId`, `playerProfileId`),
  INDEX `PlaythroughMembership_playerProfileId_status_updatedAt_idx`(`playerProfileId`, `status`, `updatedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Invitation` (
  `id` VARCHAR(191) NOT NULL, `playthroughId` VARCHAR(191) NOT NULL, `intendedPlayerId` VARCHAR(191) NULL,
  `tokenHash` VARCHAR(191) NOT NULL, `tokenPrefix` VARCHAR(191) NOT NULL,
  `shortCodeHash` VARCHAR(191) NOT NULL, `shortCodePrefix` VARCHAR(191) NOT NULL, `pinHash` VARCHAR(191) NULL,
  `recipientName` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'CREATED',
  `deliveryMethods` LONGTEXT NOT NULL DEFAULT '[]', `expiresAt` DATETIME(3) NOT NULL, `maxRedemptions` INTEGER NOT NULL DEFAULT 1,
  `redemptionCount` INTEGER NOT NULL DEFAULT 0, `viewedAt` DATETIME(3) NULL, `acceptedAt` DATETIME(3) NULL,
  `declinedAt` DATETIME(3) NULL, `revokedAt` DATETIME(3) NULL, `lastValidatedAt` DATETIME(3) NULL,
  `replacesInvitationId` VARCHAR(191) NULL, `createdBy` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Invitation_tokenHash_key`(`tokenHash`), UNIQUE INDEX `Invitation_shortCodeHash_key`(`shortCodeHash`),
  UNIQUE INDEX `Invitation_replacesInvitationId_key`(`replacesInvitationId`),
  INDEX `Invitation_playthroughId_status_expiresAt_idx`(`playthroughId`, `status`, `expiresAt`),
  INDEX `Invitation_intendedPlayerId_status_idx`(`intendedPlayerId`, `status`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InvitationEvent` (
  `id` VARCHAR(191) NOT NULL, `invitationId` VARCHAR(191) NOT NULL, `eventType` VARCHAR(191) NOT NULL,
  `actorType` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NULL, `metadata` LONGTEXT NOT NULL DEFAULT '{}',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `InvitationEvent_invitationId_createdAt_idx`(`invitationId`, `createdAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RevealState` (
  `id` VARCHAR(191) NOT NULL, `playthroughId` VARCHAR(191) NOT NULL, `contentType` VARCHAR(191) NOT NULL,
  `contentKey` VARCHAR(191) NOT NULL, `status` VARCHAR(191) NOT NULL DEFAULT 'REVEALED', `revealedBy` VARCHAR(191) NULL,
  `revealedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `RevealState_playthroughId_contentType_contentKey_key`(`playthroughId`, `contentType`, `contentKey`),
  INDEX `RevealState_playthroughId_revealedAt_idx`(`playthroughId`, `revealedAt`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlatformAuditEvent` (
  `id` VARCHAR(191) NOT NULL, `actorType` VARCHAR(191) NOT NULL, `actorId` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL, `resourceType` VARCHAR(191) NOT NULL, `resourceId` VARCHAR(191) NOT NULL,
  `outcome` VARCHAR(191) NOT NULL DEFAULT 'SUCCEEDED', `correlationId` VARCHAR(191) NOT NULL,
  `metadata` LONGTEXT NOT NULL DEFAULT '{}', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `PlatformAuditEvent_resourceType_resourceId_createdAt_idx`(`resourceType`, `resourceId`, `createdAt`),
  INDEX `PlatformAuditEvent_actorType_actorId_createdAt_idx`(`actorType`, `actorId`, `createdAt`),
  INDEX `PlatformAuditEvent_correlationId_idx`(`correlationId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PlayerIdentitySession` ADD CONSTRAINT `PlayerIdentitySession_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlatformRoleAssignment` ADD CONSTRAINT `PlatformRoleAssignment_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `GameMasterUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlaythroughMembership` ADD CONSTRAINT `PlaythroughMembership_playthroughId_fkey` FOREIGN KEY (`playthroughId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlaythroughMembership` ADD CONSTRAINT `PlaythroughMembership_playerProfileId_fkey` FOREIGN KEY (`playerProfileId`) REFERENCES `PlayerProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_playthroughId_fkey` FOREIGN KEY (`playthroughId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_intendedPlayerId_fkey` FOREIGN KEY (`intendedPlayerId`) REFERENCES `PlayerProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Invitation` ADD CONSTRAINT `Invitation_replacesInvitationId_fkey` FOREIGN KEY (`replacesInvitationId`) REFERENCES `Invitation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `InvitationEvent` ADD CONSTRAINT `InvitationEvent_invitationId_fkey` FOREIGN KEY (`invitationId`) REFERENCES `Invitation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RevealState` ADD CONSTRAINT `RevealState_playthroughId_fkey` FOREIGN KEY (`playthroughId`) REFERENCES `TaleSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
