-- Additive Tall Tale Platform migration. Existing TaleSession rows remain the
-- authoritative playthrough records and retain their identifiers and history.
ALTER TABLE "TallTale" ADD COLUMN "forkedFromTaleId" TEXT;
ALTER TABLE "TallTale" ADD COLUMN "forkedFromVersionId" TEXT;
ALTER TABLE "TaleSession" ADD COLUMN "voyageName" TEXT;
ALTER TABLE "TaleSession" ADD COLUMN "captainMode" TEXT NOT NULL DEFAULT 'CAPTAIN_CONTROLLED';
ALTER TABLE "TaleSession" ADD COLUMN "configuration" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "TaleSession" ADD COLUMN "scheduleTimezone" TEXT;
ALTER TABLE "TaleSession" ADD COLUMN "plannedStartAt" DATETIME;
ALTER TABLE "TaleSession" ADD COLUMN "launchedAt" DATETIME;
ALTER TABLE "TaleSession" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "TaleSession" ADD COLUMN "abandonedAt" DATETIME;
ALTER TABLE "TaleSession" ADD COLUMN "concurrencyVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TaleSession" ADD COLUMN "historicalHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TaleSession" ADD COLUMN "archiveMetadata" TEXT NOT NULL DEFAULT '{}';

UPDATE "TaleSession"
SET "voyageName" = COALESCE("ownerLabel", 'Legacy voyage'),
    "launchedAt" = CASE WHEN "previewMode" = false THEN "startedAt" ELSE NULL END;

CREATE TABLE "PlayerProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT,
  "passwordHash" TEXT,
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "preferences" TEXT NOT NULL DEFAULT '{}',
  "claimedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "lastSeenAt" DATETIME
);
CREATE UNIQUE INDEX "PlayerProfile_username_key" ON "PlayerProfile"("username");
CREATE INDEX "PlayerProfile_status_displayName_idx" ON "PlayerProfile"("status", "displayName");

CREATE TABLE "PlayerIdentitySession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerProfileId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "csrfToken" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  CONSTRAINT "PlayerIdentitySession_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerIdentitySession_tokenHash_key" ON "PlayerIdentitySession"("tokenHash");
CREATE INDEX "PlayerIdentitySession_playerProfileId_expiresAt_idx" ON "PlayerIdentitySession"("playerProfileId", "expiresAt");

CREATE TABLE "PlatformRoleAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
  "scopeId" TEXT,
  "grantedBy" TEXT,
  "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  CONSTRAINT "PlatformRoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "GameMasterUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlatformRoleAssignment_accountId_role_scopeType_scopeId_key" ON "PlatformRoleAssignment"("accountId", "role", "scopeType", "scopeId");
CREATE INDEX "PlatformRoleAssignment_role_scopeType_scopeId_revokedAt_idx" ON "PlatformRoleAssignment"("role", "scopeType", "scopeId", "revokedAt");

CREATE TABLE "PlaythroughMembership" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playthroughId" TEXT NOT NULL,
  "playerProfileId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PLAYER',
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "crewRole" TEXT,
  "joinedAt" DATETIME,
  "removedAt" DATETIME,
  "completedAt" DATETIME,
  "pinnedAt" DATETIME,
  "hiddenAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlaythroughMembership_playthroughId_fkey" FOREIGN KEY ("playthroughId") REFERENCES "TaleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlaythroughMembership_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlaythroughMembership_playthroughId_playerProfileId_key" ON "PlaythroughMembership"("playthroughId", "playerProfileId");
CREATE INDEX "PlaythroughMembership_playerProfileId_status_updatedAt_idx" ON "PlaythroughMembership"("playerProfileId", "status", "updatedAt");

CREATE TABLE "Invitation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playthroughId" TEXT NOT NULL,
  "intendedPlayerId" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "shortCodeHash" TEXT NOT NULL,
  "shortCodePrefix" TEXT NOT NULL,
  "pinHash" TEXT,
  "recipientName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "deliveryMethods" TEXT NOT NULL DEFAULT '[]',
  "expiresAt" DATETIME NOT NULL,
  "maxRedemptions" INTEGER NOT NULL DEFAULT 1,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "viewedAt" DATETIME,
  "acceptedAt" DATETIME,
  "declinedAt" DATETIME,
  "revokedAt" DATETIME,
  "lastValidatedAt" DATETIME,
  "replacesInvitationId" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Invitation_playthroughId_fkey" FOREIGN KEY ("playthroughId") REFERENCES "TaleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Invitation_intendedPlayerId_fkey" FOREIGN KEY ("intendedPlayerId") REFERENCES "PlayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Invitation_replacesInvitationId_fkey" FOREIGN KEY ("replacesInvitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE UNIQUE INDEX "Invitation_shortCodeHash_key" ON "Invitation"("shortCodeHash");
CREATE UNIQUE INDEX "Invitation_replacesInvitationId_key" ON "Invitation"("replacesInvitationId");
CREATE INDEX "Invitation_playthroughId_status_expiresAt_idx" ON "Invitation"("playthroughId", "status", "expiresAt");
CREATE INDEX "Invitation_intendedPlayerId_status_idx" ON "Invitation"("intendedPlayerId", "status");

CREATE TABLE "InvitationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invitationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvitationEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InvitationEvent_invitationId_createdAt_idx" ON "InvitationEvent"("invitationId", "createdAt");

CREATE TABLE "RevealState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playthroughId" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "contentKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REVEALED',
  "revealedBy" TEXT,
  "revealedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RevealState_playthroughId_fkey" FOREIGN KEY ("playthroughId") REFERENCES "TaleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RevealState_playthroughId_contentType_contentKey_key" ON "RevealState"("playthroughId", "contentType", "contentKey");
CREATE INDEX "RevealState_playthroughId_revealedAt_idx" ON "RevealState"("playthroughId", "revealedAt");

CREATE TABLE "PlatformAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'SUCCEEDED',
  "correlationId" TEXT NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PlatformAuditEvent_resourceType_resourceId_createdAt_idx" ON "PlatformAuditEvent"("resourceType", "resourceId", "createdAt");
CREATE INDEX "PlatformAuditEvent_actorType_actorId_createdAt_idx" ON "PlatformAuditEvent"("actorType", "actorId", "createdAt");
CREATE INDEX "PlatformAuditEvent_correlationId_idx" ON "PlatformAuditEvent"("correlationId");
