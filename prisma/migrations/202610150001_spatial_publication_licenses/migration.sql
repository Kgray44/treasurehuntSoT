-- Harborlight's existing license table is the authority for spatial publication.
-- These built-in policies are explicit platform labels, not claims of external
-- Creative Commons certification. Existing owner-customized rows are preserved.
INSERT OR IGNORE INTO "CommunityLicensePolicy" ("id", "key", "displayName", "policyVersion", "allowsPrivateUse", "allowsPublicUse", "allowsModification", "allowsRedistribution", "allowsCommercialUse", "requiresAttribution", "requiresSourceLink", "shareAlike", "active", "createdAt", "updatedAt") VALUES
('spatial-license-use-v1', 'USE_IN_CHRONICLES_WITH_ATTRIBUTION', 'Use in Chronicles with attribution', 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spatial-license-remix-v1', 'REMIX_WITH_ATTRIBUTION', 'Remix with attribution', 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('spatial-license-noncommercial-v1', 'NONCOMMERCIAL_REMIX_WITH_ATTRIBUTION', 'Noncommercial remix with attribution', 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
