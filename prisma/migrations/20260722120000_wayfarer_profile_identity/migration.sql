-- Project Wayfarer Phase 2: canonical public profile and provider foundation.
-- Additive only. Existing PlayerProfile preferences and Harborlight snapshots remain intact.
ALTER TABLE "PlayerProfile" ADD COLUMN "handle" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "normalizedHandle" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "biography" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "avatarMediaId" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "bannerMediaId" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "defaultVisibility" TEXT NOT NULL DEFAULT 'REGISTERED_USERS';

CREATE UNIQUE INDEX "PlayerProfile_normalizedHandle_key" ON "PlayerProfile"("normalizedHandle");
CREATE UNIQUE INDEX "PlayerProfile_avatarMediaId_key" ON "PlayerProfile"("avatarMediaId");
CREATE UNIQUE INDEX "PlayerProfile_bannerMediaId_key" ON "PlayerProfile"("bannerMediaId");
CREATE INDEX "PlayerProfile_normalizedHandle_status_idx" ON "PlayerProfile"("normalizedHandle", "status");

CREATE TABLE "ProfileHandleHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerProfileId" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "normalizedHandle" TEXT NOT NULL,
  "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" DATETIME,
  CONSTRAINT "ProfileHandleHistory_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfileHandleHistory_normalizedHandle_key" ON "ProfileHandleHistory"("normalizedHandle");
CREATE INDEX "ProfileHandleHistory_playerProfileId_changedAt_idx" ON "ProfileHandleHistory"("playerProfileId", "changedAt");

CREATE TABLE "ProfileMedia" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "altText" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" DATETIME,
  CONSTRAINT "ProfileMedia_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfileMedia_storageKey_key" ON "ProfileMedia"("storageKey");
CREATE INDEX "ProfileMedia_profileId_kind_removedAt_idx" ON "ProfileMedia"("profileId", "kind", "removedAt");

CREATE TABLE "ExternalIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "providerDisplayName" TEXT,
  "avatarReference" TEXT,
  "allowedScopes" TEXT NOT NULL DEFAULT '[]',
  "useForLogin" BOOLEAN NOT NULL DEFAULT false,
  "visibility" TEXT NOT NULL DEFAULT 'ONLY_ME',
  "status" TEXT NOT NULL DEFAULT 'LINKED',
  "encryptedToken" TEXT,
  "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" DATETIME,
  "refreshedAt" DATETIME,
  "revokedAt" DATETIME,
  CONSTRAINT "ExternalIdentity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExternalIdentity_provider_providerAccountId_key" ON "ExternalIdentity"("provider", "providerAccountId");
CREATE INDEX "ExternalIdentity_accountId_status_visibility_idx" ON "ExternalIdentity"("accountId", "status", "visibility");

CREATE TABLE "ProviderLinkAttempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "pkceVerifier" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "redirectPath" TEXT NOT NULL DEFAULT '/passport/providers',
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderLinkAttempt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProviderLinkAttempt_stateHash_key" ON "ProviderLinkAttempt"("stateHash");
CREATE INDEX "ProviderLinkAttempt_accountId_provider_expiresAt_idx" ON "ProviderLinkAttempt"("accountId", "provider", "expiresAt");

CREATE TABLE "ProfilePreferenceSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerProfileId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" TEXT NOT NULL DEFAULT '{}',
  "migratedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProfilePreferenceSet_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfilePreferenceSet_playerProfileId_key" ON "ProfilePreferenceSet"("playerProfileId");

CREATE TABLE "ProfilePrivacyRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerProfileId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ProfilePrivacyRule_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProfilePrivacyRule_playerProfileId_section_key" ON "ProfilePrivacyRule"("playerProfileId", "section");
CREATE INDEX "ProfilePrivacyRule_playerProfileId_visibility_idx" ON "ProfilePrivacyRule"("playerProfileId", "visibility");
