-- Public-media approval parity; protected bytes and storage keys stay in Sealed Hold.
ALTER TABLE `CommunityVoyageLogMediaConsent`
  ADD COLUMN `approvedOpaqueMediaId` VARCHAR(191) NULL AFTER `purpose`,
  ADD COLUMN `approvedSourceChecksum` VARCHAR(191) NULL AFTER `approvedOpaqueMediaId`,
  ADD COLUMN `approvedDerivativeChecksum` VARCHAR(191) NULL AFTER `approvedSourceChecksum`,
  ADD COLUMN `subjectParticipantId` VARCHAR(191) NULL AFTER `approvedDerivativeChecksum`,
  ADD INDEX `CommunityVoyageLogMediaConsent_subjectParticipantId_idx` (`subjectParticipantId`);
