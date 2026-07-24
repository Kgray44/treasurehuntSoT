-- Phase 2 compatibility reconciliation. This migration is additive and rerunnable.
-- The application validates all payloads through the typed V1 contract before use.
INSERT OR IGNORE INTO "ProfilePreferenceSet" ("id", "playerProfileId", "schemaVersion", "payload", "migratedAt", "createdAt", "updatedAt")
SELECT
  'pref_' || lower(hex(randomblob(16))),
  "id",
  1,
  CASE
    WHEN json_valid("preferences") THEN json_object(
      'version', 1,
      'experience', json_object(
        'motion', COALESCE(json_extract("preferences", '$.motionMode'), 'SYSTEM'),
        'textScale', COALESCE(json_extract("preferences", '$.textScale'), 1),
        'theme', 'SYSTEM', 'captions', false, 'transcripts', false, 'audioDescription', false, 'autoplay', true, 'contrast', 'SYSTEM', 'textureIntensity', COALESCE(json_extract("preferences", '$.textureIntensity'), 1), 'lowBandwidthMedia', false
      ),
      'discovery', json_object('searchable', false, 'themes', json_array(), 'contentWarnings', json_array()),
      'social', json_object('invitationPolicy', 'CREW_ONLY', 'providerDiscovery', false),
      'notifications', json_object('email', false, 'product', false, 'invitations', true),
      'privacy', json_object('defaultVisibility', 'REGISTERED_USERS')
    )
    ELSE '{"version":1,"experience":{"motion":"SYSTEM","textScale":1,"theme":"SYSTEM","captions":false,"transcripts":false,"audioDescription":false,"autoplay":true,"contrast":"SYSTEM","textureIntensity":1,"lowBandwidthMedia":false},"discovery":{"searchable":false,"themes":[],"contentWarnings":[]},"social":{"invitationPolicy":"CREW_ONLY","providerDiscovery":false},"notifications":{"email":false,"product":false,"invitations":true},"privacy":{"defaultVisibility":"REGISTERED_USERS"}}'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PlayerProfile";

INSERT OR IGNORE INTO "ProfilePrivacyRule" ("id", "playerProfileId", "section", "visibility", "createdAt", "updatedAt")
SELECT 'privacy_' || lower(hex(randomblob(16))), "id", 'HEADER', 'REGISTERED_USERS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "PlayerProfile";
INSERT OR IGNORE INTO "ProfilePrivacyRule" ("id", "playerProfileId", "section", "visibility", "createdAt", "updatedAt")
SELECT 'privacy_' || lower(hex(randomblob(16))), "id", 'BIOGRAPHY', 'ONLY_ME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "PlayerProfile";
INSERT OR IGNORE INTO "ProfilePrivacyRule" ("id", "playerProfileId", "section", "visibility", "createdAt", "updatedAt")
SELECT 'privacy_' || lower(hex(randomblob(16))), "id", 'PROVIDERS', 'ONLY_ME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "PlayerProfile";
INSERT OR IGNORE INTO "ProfilePrivacyRule" ("id", "playerProfileId", "section", "visibility", "createdAt", "updatedAt")
SELECT 'privacy_' || lower(hex(randomblob(16))), "id", 'CHRONICLE_SUMMARY', 'ONLY_ME', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "PlayerProfile";
