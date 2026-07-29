-- Harborlight purpose-specific public-publication consent parity. Wayfarer
-- private consent remains external and is never copied into this schema.
ALTER TABLE `CommunityVoyageLog`
  ADD COLUMN `lifecycleState` VARCHAR(191) NOT NULL DEFAULT 'DRAFT' AFTER `commentsEnabled`,
  ADD COLUMN `consentRevision` INT NOT NULL DEFAULT 0 AFTER `lifecycleState`,
  ADD COLUMN `projectionChecksum` VARCHAR(191) NULL AFTER `consentRevision`,
  ADD COLUMN `searchIndexedAt` DATETIME(3) NULL AFTER `projectionChecksum`,
  ADD COLUMN `openGraphInvalidatedAt` DATETIME(3) NULL AFTER `searchIndexedAt`;
UPDATE `CommunityVoyageLog` SET `lifecycleState` = 'PUBLISHED' WHERE `publishedAt` IS NOT NULL AND `visibility` = 'COMMUNITY';

ALTER TABLE `CommunityVoyageLogParticipantConsent`
  ADD COLUMN `state` VARCHAR(191) NOT NULL DEFAULT 'PENDING' AFTER `purpose`,
  ADD COLUMN `requestedAt` DATETIME(3) NULL AFTER `state`,
  ADD COLUMN `expiresAt` DATETIME(3) NULL AFTER `requestedAt`,
  ADD COLUMN `updatedAt` DATETIME(3) NULL AFTER `revokedAt`;
UPDATE `CommunityVoyageLogParticipantConsent`
  SET `state` = CASE WHEN `revokedAt` IS NOT NULL THEN 'REVOKED' WHEN `grantedAt` IS NOT NULL THEN 'APPROVED' ELSE 'PENDING' END,
      `updatedAt` = CURRENT_TIMESTAMP(3);

CREATE TABLE `CommunityVoyageLogConsentAudit` (
  `id` VARCHAR(191) NOT NULL,
  `voyageLogId` VARCHAR(191) NOT NULL,
  `participantId` VARCHAR(191) NULL,
  `actorAccountId` VARCHAR(191) NOT NULL,
  `purpose` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `state` VARCHAR(191) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `CommunityVoyageLogConsentAudit_voyageLogId_occurredAt_idx`(`voyageLogId`, `occurredAt`),
  INDEX `CommunityVoyageLogConsentAudit_participantId_occurredAt_idx`(`participantId`, `occurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
