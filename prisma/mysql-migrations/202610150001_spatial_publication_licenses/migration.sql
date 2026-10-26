-- Preserve existing Harborlight policy rows while adding the built-in
-- redistribution choices used by spatial publication.
INSERT IGNORE INTO `CommunityLicensePolicy` (`id`, `key`, `displayName`, `policyVersion`, `allowsPrivateUse`, `allowsPublicUse`, `allowsModification`, `allowsRedistribution`, `allowsCommercialUse`, `requiresAttribution`, `requiresSourceLink`, `shareAlike`, `active`, `createdAt`, `updatedAt`) VALUES
('spatial-license-use-v1', 'USE_IN_CHRONICLES_WITH_ATTRIBUTION', 'Use in Chronicles with attribution', 1, TRUE, TRUE, FALSE, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('spatial-license-remix-v1', 'REMIX_WITH_ATTRIBUTION', 'Remix with attribution', 1, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
('spatial-license-noncommercial-v1', 'NONCOMMERCIAL_REMIX_WITH_ATTRIBUTION', 'Noncommercial remix with attribution', 1, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));
