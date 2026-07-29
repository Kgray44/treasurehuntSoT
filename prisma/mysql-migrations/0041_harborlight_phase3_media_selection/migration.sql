ALTER TABLE `CommunityVoyageLogMedia`
  ADD COLUMN `sourceChecksum` VARCHAR(191) NOT NULL DEFAULT '' AFTER `privateMediaReference`,
  ADD COLUMN `subjectParticipantId` VARCHAR(191) NULL AFTER `sourceChecksum`,
  ADD COLUMN `detectedMediaType` VARCHAR(191) NOT NULL DEFAULT 'application/octet-stream' AFTER `subjectParticipantId`,
  ADD UNIQUE INDEX `CommunityVoyageLogMedia_voyageLogId_privateMediaReference_key` (`voyageLogId`, `privateMediaReference`);
