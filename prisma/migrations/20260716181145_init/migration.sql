-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "accessCodeHash" TEXT NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayerAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" DATETIME,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerAccess_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameMasterUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GameMasterSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "csrfToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameMasterSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GameMasterUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'LOCKED',
    "contentId" TEXT NOT NULL,
    "revealedAt" DATETIME,
    "solvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chapter_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "ChapterContent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChapterContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "developmentOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Clue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "Clue_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "releasedAt" DATETIME,
    CONSTRAINT "Hint_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    CONSTRAINT "Artifact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtifactAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "eventId" TEXT,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtifactAward_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtifactAward_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SideQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'UNDISCOVERED',
    CONSTRAINT "SideQuest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SideQuestObjective" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sideQuestId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "complete" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SideQuestObjective_sideQuestId_fkey" FOREIGN KEY ("sideQuestId") REFERENCES "SideQuest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MapLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionLabel" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "revealedAt" DATETIME,
    CONSTRAINT "MapLocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "releaseAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversesEventId" TEXT,
    "supersededById" TEXT,
    CONSTRAINT "ProgressEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CampaignSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdminAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GameMasterUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAccessId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "masterVolume" REAL NOT NULL DEFAULT 0.45,
    "ambientVolume" REAL NOT NULL DEFAULT 0.25,
    "effectsVolume" REAL NOT NULL DEFAULT 0.55,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioPreference_playerAccessId_fkey" FOREIGN KEY ("playerAccessId") REFERENCES "PlayerAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SaveStateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaveStateSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewedCeremony" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAccess_tokenHash_key" ON "PlayerAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "PlayerAccess_campaignId_idx" ON "PlayerAccess"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "GameMasterUser_username_key" ON "GameMasterUser"("username");

-- CreateIndex
CREATE INDEX "GameMasterSession_userId_expiresAt_idx" ON "GameMasterSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Chapter_campaignId_state_idx" ON "Chapter"("campaignId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_campaignId_ordinal_key" ON "Chapter"("campaignId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Clue_chapterId_ordinal_key" ON "Clue"("chapterId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_chapterId_ordinal_key" ON "Hint"("chapterId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_campaignId_key_key" ON "Artifact"("campaignId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactAward_eventId_key" ON "ArtifactAward"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactAward_campaignId_artifactId_key" ON "ArtifactAward"("campaignId", "artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "SideQuest_campaignId_key_key" ON "SideQuest"("campaignId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SideQuestObjective_sideQuestId_ordinal_key" ON "SideQuestObjective"("sideQuestId", "ordinal");

-- CreateIndex
CREATE INDEX "JournalEntry_campaignId_releasedAt_idx" ON "JournalEntry"("campaignId", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MapLocation_campaignId_key_key" ON "MapLocation"("campaignId", "key");

-- CreateIndex
CREATE INDEX "ProgressEvent_campaignId_releaseAt_idx" ON "ProgressEvent"("campaignId", "releaseAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressEvent_campaignId_sequence_key" ON "ProgressEvent"("campaignId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignSnapshot_campaignId_sequence_key" ON "CampaignSnapshot"("campaignId", "sequence");

-- CreateIndex
CREATE INDEX "AdminAuditLog_campaignId_createdAt_idx" ON "AdminAuditLog"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AudioPreference_playerAccessId_key" ON "AudioPreference"("playerAccessId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_key_version_key" ON "ContentVersion"("key", "version");

-- CreateIndex
CREATE INDEX "SaveStateSnapshot_campaignId_sequence_idx" ON "SaveStateSnapshot"("campaignId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ViewedCeremony_campaignId_deviceId_eventId_key" ON "ViewedCeremony"("campaignId", "deviceId", "eventId");

-- CreateIndex
CREATE INDEX "LoginAttempt_fingerprint_createdAt_idx" ON "LoginAttempt"("fingerprint", "createdAt");
