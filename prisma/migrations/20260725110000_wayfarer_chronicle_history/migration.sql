-- Project Wayfarer Phase 3: private, version-pinned Chronicle history.
-- Additive only. One Voyage source tables are intentionally not altered.
CREATE TABLE "PlayerChronicleRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerProfileId" TEXT NOT NULL,
  "sourcePlaythroughId" TEXT NOT NULL,
  "sourceMembershipId" TEXT,
  "publishedVersionId" TEXT NOT NULL,
  "publishedVersionChecksum" TEXT NOT NULL,
  "chronicleTitleSnapshot" TEXT NOT NULL,
  "chronicleCoverSnapshot" TEXT,
  "creatorAttributionSnapshot" TEXT,
  "playerNameSnapshot" TEXT NOT NULL,
  "playerAvatarSnapshot" TEXT,
  "participationRole" TEXT NOT NULL DEFAULT 'PLAYER',
  "crewRoleSnapshot" TEXT,
  "lifecycleStatus" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "startedAt" DATETIME,
  "joinedAt" DATETIME,
  "completedAt" DATETIME,
  "wallClockSeconds" INTEGER,
  "activeSeconds" INTEGER,
  "pausedSeconds" INTEGER,
  "connectedSeconds" INTEGER,
  "interactiveSeconds" INTEGER,
  "captainWaitSeconds" INTEGER,
  "wallClockAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "activeAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "pausedAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "connectedAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "interactiveAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "captainWaitAccuracy" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
  "metricDefinitionVersion" TEXT NOT NULL DEFAULT 'WAYFARER_TIMING_V1',
  "completedChapters" TEXT NOT NULL DEFAULT '[]',
  "optionalObjectives" TEXT NOT NULL DEFAULT '[]',
  "choiceSummary" TEXT NOT NULL DEFAULT '[]',
  "artifactSummary" TEXT NOT NULL DEFAULT '[]',
  "sourceFingerprint" TEXT NOT NULL,
  "projectionStatus" TEXT NOT NULL DEFAULT 'CURRENT',
  "projectionReason" TEXT,
  "lastDerivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerChronicleRecord_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerChronicleRecord_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerChronicleRecord_playerProfileId_sourcePlaythroughId_key" ON "PlayerChronicleRecord"("playerProfileId", "sourcePlaythroughId");
CREATE INDEX "PlayerChronicleRecord_playerProfileId_lifecycleStatus_completedAt_idx" ON "PlayerChronicleRecord"("playerProfileId", "lifecycleStatus", "completedAt");
CREATE INDEX "PlayerChronicleRecord_playerProfileId_chronicleTitleSnapshot_idx" ON "PlayerChronicleRecord"("playerProfileId", "chronicleTitleSnapshot");
CREATE INDEX "PlayerChronicleRecord_publishedVersionId_idx" ON "PlayerChronicleRecord"("publishedVersionId");

CREATE TABLE "ChronicleReflection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerChronicleRecordId" TEXT NOT NULL,
  "favoriteChapterId" TEXT,
  "favoriteClueReference" TEXT,
  "favoriteMomentReference" TEXT,
  "favoriteArtifactReference" TEXT,
  "privateNote" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ChronicleReflection_playerChronicleRecordId_fkey" FOREIGN KEY ("playerChronicleRecordId") REFERENCES "PlayerChronicleRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ChronicleReflection_playerChronicleRecordId_key" ON "ChronicleReflection"("playerChronicleRecordId");

CREATE TABLE "ChronicleMemory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerChronicleRecordId" TEXT NOT NULL,
  "playerProfileId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'ONLY_ME',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "deletedAt" DATETIME,
  CONSTRAINT "ChronicleMemory_playerChronicleRecordId_fkey" FOREIGN KEY ("playerChronicleRecordId") REFERENCES "PlayerChronicleRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChronicleMemory_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ChronicleMemory_playerChronicleRecordId_deletedAt_createdAt_idx" ON "ChronicleMemory"("playerChronicleRecordId", "deletedAt", "createdAt");
CREATE INDEX "ChronicleMemory_playerProfileId_deletedAt_idx" ON "ChronicleMemory"("playerProfileId", "deletedAt");

CREATE TABLE "VoyageKeepsake" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "playerChronicleRecordId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "presentationPayload" TEXT NOT NULL DEFAULT '{}',
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "regeneratedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VoyageKeepsake_playerChronicleRecordId_fkey" FOREIGN KEY ("playerChronicleRecordId") REFERENCES "PlayerChronicleRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VoyageKeepsake_playerChronicleRecordId_key" ON "VoyageKeepsake"("playerChronicleRecordId");

CREATE TABLE "VoyageKeepsakeConsent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keepsakeId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT false,
  "grantedAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VoyageKeepsakeConsent_keepsakeId_fkey" FOREIGN KEY ("keepsakeId") REFERENCES "VoyageKeepsake" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VoyageKeepsakeConsent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VoyageKeepsakeConsent_keepsakeId_participantId_key" ON "VoyageKeepsakeConsent"("keepsakeId", "participantId");
CREATE INDEX "VoyageKeepsakeConsent_participantId_granted_idx" ON "VoyageKeepsakeConsent"("participantId", "granted");
