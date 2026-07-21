-- Project Wayfarer Phase 1: additive canonical account foundation.
-- Existing PlayerProfile and GameMasterUser identifiers remain intact.
CREATE TABLE "UserAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "legacyGameMasterId" TEXT,
  "claimedAt" DATETIME,
  "lastSeenAt" DATETIME,
  "lockedAt" DATETIME,
  "suspendedAt" DATETIME,
  "mergedIntoAccountId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserAccount_legacyGameMasterId_fkey" FOREIGN KEY ("legacyGameMasterId") REFERENCES "GameMasterUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserAccount_legacyGameMasterId_key" ON "UserAccount"("legacyGameMasterId");
CREATE INDEX "UserAccount_status_lastSeenAt_idx" ON "UserAccount"("status", "lastSeenAt");

CREATE TABLE "AccountEmail" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "normalizedEmail" TEXT NOT NULL,
  "displayEmail" TEXT NOT NULL, "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "verificationState" TEXT NOT NULL DEFAULT 'PENDING', "verifiedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AccountEmail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountEmail_normalizedEmail_key" ON "AccountEmail"("normalizedEmail");
CREATE UNIQUE INDEX "AccountEmail_accountId_isPrimary_key" ON "AccountEmail"("accountId", "isPrimary");
CREATE INDEX "AccountEmail_accountId_verificationState_idx" ON "AccountEmail"("accountId", "verificationState");

CREATE TABLE "AccountCredential" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'bcrypt', "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountCredential_accountId_key" ON "AccountCredential"("accountId");

CREATE TABLE "AccountToken" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "purpose" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL, "consumedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX "AccountToken_accountId_purpose_expiresAt_idx" ON "AccountToken"("accountId", "purpose", "expiresAt");

CREATE TABLE "AccountSession" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "csrfToken" TEXT NOT NULL,
  "deviceLabel" TEXT, "expiresAt" DATETIME NOT NULL, "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountSession_tokenHash_key" ON "AccountSession"("tokenHash");
CREATE INDEX "AccountSession_accountId_expiresAt_idx" ON "AccountSession"("accountId", "expiresAt");

CREATE TABLE "AccountRoleAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "role" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL', "scopeId" TEXT, "grantedBy" TEXT,
  "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" DATETIME,
  CONSTRAINT "AccountRoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountRoleAssignment_accountId_role_scopeType_scopeId_key" ON "AccountRoleAssignment"("accountId", "role", "scopeType", "scopeId");
CREATE INDEX "AccountRoleAssignment_role_scopeType_scopeId_revokedAt_idx" ON "AccountRoleAssignment"("role", "scopeType", "scopeId", "revokedAt");

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "correlationId" TEXT, "metadata" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SecurityEvent_accountId_createdAt_idx" ON "SecurityEvent"("accountId", "createdAt");

CREATE TABLE "WayfarerMigrationRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "accountId" TEXT,
  "status" TEXT NOT NULL, "detail" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WayfarerMigrationRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WayfarerMigrationRecord_sourceId_key" ON "WayfarerMigrationRecord"("sourceId");
CREATE INDEX "WayfarerMigrationRecord_status_sourceType_idx" ON "WayfarerMigrationRecord"("status", "sourceType");

ALTER TABLE "PlayerProfile" ADD COLUMN "accountId" TEXT;
CREATE UNIQUE INDEX "PlayerProfile_accountId_key" ON "PlayerProfile"("accountId");
ALTER TABLE "Chronicle" ADD COLUMN "creatorAccountId" TEXT;
ALTER TABLE "TaleDraft" ADD COLUMN "createdByAccountId" TEXT;
ALTER TABLE "PublishedTaleVersion" ADD COLUMN "publishedByAccountId" TEXT;
ALTER TABLE "TaleAsset" ADD COLUMN "createdByAccountId" TEXT;
ALTER TABLE "TaleSession" ADD COLUMN "captainAccountId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "creatorAccountId" TEXT;
ALTER TABLE "InvitationEvent" ADD COLUMN "actorAccountId" TEXT;
ALTER TABLE "RevealState" ADD COLUMN "revealedByAccountId" TEXT;
ALTER TABLE "PlatformAuditEvent" ADD COLUMN "actorAccountId" TEXT;
CREATE INDEX "Chronicle_creatorAccountId_updatedAt_idx" ON "Chronicle"("creatorAccountId", "updatedAt");
CREATE INDEX "TaleDraft_createdByAccountId_idx" ON "TaleDraft"("createdByAccountId");
CREATE INDEX "PublishedTaleVersion_publishedByAccountId_idx" ON "PublishedTaleVersion"("publishedByAccountId");
CREATE INDEX "TaleAsset_createdByAccountId_idx" ON "TaleAsset"("createdByAccountId");
CREATE INDEX "TaleSession_captainAccountId_status_idx" ON "TaleSession"("captainAccountId", "status");
CREATE INDEX "Invitation_creatorAccountId_status_idx" ON "Invitation"("creatorAccountId", "status");
CREATE INDEX "InvitationEvent_actorAccountId_createdAt_idx" ON "InvitationEvent"("actorAccountId", "createdAt");
CREATE INDEX "RevealState_revealedByAccountId_revealedAt_idx" ON "RevealState"("revealedByAccountId", "revealedAt");
CREATE INDEX "PlatformAuditEvent_actorAccountId_createdAt_idx" ON "PlatformAuditEvent"("actorAccountId", "createdAt");

-- Stable deterministic account IDs make migration restart-safe without re-keying profiles.
INSERT INTO "UserAccount" ("id", "status", "claimedAt", "lastSeenAt", "createdAt", "updatedAt")
SELECT 'wayfarer-player-' || "id",
       CASE WHEN "passwordHash" IS NOT NULL OR "claimedAt" IS NOT NULL OR "username" IS NOT NULL THEN 'ACTIVE' ELSE 'GUEST_UNCLAIMED' END,
       "claimedAt", "lastSeenAt", "createdAt", "updatedAt"
FROM "PlayerProfile";
UPDATE "PlayerProfile" SET "accountId" = 'wayfarer-player-' || "id" WHERE "accountId" IS NULL;
INSERT INTO "AccountCredential" ("id", "accountId", "passwordHash", "algorithm", "changedAt", "createdAt")
SELECT 'wayfarer-credential-' || "id", 'wayfarer-player-' || "id", "passwordHash", 'bcrypt', "updatedAt", "createdAt"
FROM "PlayerProfile" WHERE "passwordHash" IS NOT NULL;
INSERT INTO "AccountRoleAssignment" ("id", "accountId", "role", "scopeType", "grantedAt")
SELECT 'wayfarer-player-role-' || "id", 'wayfarer-player-' || "id", 'PLAYER', 'GLOBAL', "createdAt" FROM "PlayerProfile";
INSERT INTO "AccountSession" ("id", "accountId", "tokenHash", "csrfToken", "expiresAt", "lastSeenAt", "revokedAt", "createdAt")
SELECT 'wayfarer-player-session-' || "id", 'wayfarer-player-' || "playerProfileId", "tokenHash", "csrfToken", "expiresAt", "lastSeenAt", "revokedAt", "createdAt"
FROM "PlayerIdentitySession";

INSERT INTO "UserAccount" ("id", "status", "legacyGameMasterId", "claimedAt", "createdAt", "updatedAt")
SELECT 'wayfarer-gm-' || "id", 'ACTIVE', "id", "createdAt", "createdAt", "createdAt" FROM "GameMasterUser";
INSERT INTO "PlayerProfile" ("id", "accountId", "displayName", "status", "claimedAt", "createdAt", "updatedAt")
SELECT 'wayfarer-gm-profile-' || "id", 'wayfarer-gm-' || "id", "username", 'ACTIVE', "createdAt", "createdAt", "createdAt"
FROM "GameMasterUser";
INSERT INTO "AccountCredential" ("id", "accountId", "passwordHash", "algorithm", "changedAt", "createdAt")
SELECT 'wayfarer-gm-credential-' || "id", 'wayfarer-gm-' || "id", "passwordHash", 'bcrypt', "createdAt", "createdAt" FROM "GameMasterUser";
INSERT INTO "AccountRoleAssignment" ("id", "accountId", "role", "scopeType", "scopeId", "grantedBy", "grantedAt", "revokedAt")
SELECT 'wayfarer-gm-role-' || "id", 'wayfarer-gm-' || "accountId", "role", "scopeType", "scopeId", "grantedBy", "grantedAt", "revokedAt" FROM "PlatformRoleAssignment";
INSERT INTO "AccountRoleAssignment" ("id", "accountId", "role", "scopeType", "grantedAt")
SELECT 'wayfarer-gm-player-role-' || "id", 'wayfarer-gm-' || "id", 'PLAYER', 'GLOBAL', "createdAt" FROM "GameMasterUser";
INSERT INTO "AccountRoleAssignment" ("id", "accountId", "role", "scopeType", "grantedAt")
SELECT 'wayfarer-gm-captain-role-' || "id", 'wayfarer-gm-' || "id", 'CAPTAIN', 'GLOBAL', "createdAt" FROM "GameMasterUser";
INSERT INTO "AccountRoleAssignment" ("id", "accountId", "role", "scopeType", "grantedAt")
SELECT 'wayfarer-gm-creator-role-' || "id", 'wayfarer-gm-' || "id", 'CREATOR', 'GLOBAL', "createdAt" FROM "GameMasterUser" WHERE "role" IN ('CREATOR', 'PUBLISHER', 'CAPTAIN_CREATOR');
INSERT INTO "AccountSession" ("id", "accountId", "tokenHash", "csrfToken", "expiresAt", "createdAt")
SELECT 'wayfarer-gm-session-' || "id", 'wayfarer-gm-' || "userId", "id", "csrfToken", "expiresAt", "createdAt" FROM "GameMasterSession";

-- Backfill only known Game Master identifiers. Unknown historical strings stay intact and are reported by the reconciliation command.
UPDATE "Chronicle" SET "creatorAccountId" = 'wayfarer-gm-' || "creatorId" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "Chronicle"."creatorId");
UPDATE "TaleDraft" SET "createdByAccountId" = 'wayfarer-gm-' || "createdBy" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "TaleDraft"."createdBy");
UPDATE "PublishedTaleVersion" SET "publishedByAccountId" = 'wayfarer-gm-' || "publishedBy" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "PublishedTaleVersion"."publishedBy");
UPDATE "TaleAsset" SET "createdByAccountId" = 'wayfarer-gm-' || "createdBy" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "TaleAsset"."createdBy");
UPDATE "TaleSession" SET "captainAccountId" = 'wayfarer-gm-' || "captainId" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "TaleSession"."captainId");
UPDATE "Invitation" SET "creatorAccountId" = 'wayfarer-gm-' || "createdBy" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "Invitation"."createdBy");
UPDATE "InvitationEvent" SET "actorAccountId" = 'wayfarer-gm-' || "actorId" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "InvitationEvent"."actorId");
UPDATE "RevealState" SET "revealedByAccountId" = 'wayfarer-gm-' || "revealedBy" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "RevealState"."revealedBy");
UPDATE "PlatformAuditEvent" SET "actorAccountId" = 'wayfarer-gm-' || "actorId" WHERE EXISTS (SELECT 1 FROM "GameMasterUser" WHERE "GameMasterUser"."id" = "PlatformAuditEvent"."actorId");
