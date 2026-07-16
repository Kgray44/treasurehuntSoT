-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN "relatedArtifactKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "relatedMapKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "relatedSideQuestKey" TEXT;
ALTER TABLE "Chapter" ADD COLUMN "safeTeaser" TEXT;

-- AlterTable
ALTER TABLE "SideQuest" ADD COLUMN "artifactKey" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "chapterOrdinal" INTEGER;
ALTER TABLE "SideQuest" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "SideQuest" ADD COLUMN "completionSummary" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "description" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "mapLocationKey" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "rewardLabel" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "rewardType" TEXT;
ALTER TABLE "SideQuest" ADD COLUMN "safeTeaser" TEXT;

-- CreateTable
CREATE TABLE "MapRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fromKey" TEXT NOT NULL,
    "toKey" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'HIDDEN',
    "annotation" TEXT,
    "revealedAt" DATETIME,
    CONSTRAINT "MapRoute_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ViewedContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAccessId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewedContent_playerAccessId_fkey" FOREIGN KEY ("playerAccessId") REFERENCES "PlayerAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "safeName" TEXT,
    "state" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "category" TEXT NOT NULL DEFAULT 'RELIC',
    "discoveryText" TEXT,
    "silhouetteLabel" TEXT,
    "displayX" REAL NOT NULL DEFAULT 50,
    "displayY" REAL NOT NULL DEFAULT 50,
    "assemblyGroup" TEXT,
    "assemblyPosition" TEXT,
    "connectedArtifactKey" TEXT,
    "chapterOrdinal" INTEGER,
    CONSTRAINT "Artifact_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Artifact" ("campaignId", "description", "id", "key", "name") SELECT "campaignId", "description", "id", "key", "name" FROM "Artifact";
DROP TABLE "Artifact";
ALTER TABLE "new_Artifact" RENAME TO "Artifact";
CREATE UNIQUE INDEX "Artifact_campaignId_key_key" ON "Artifact"("campaignId", "key");
CREATE TABLE "new_AudioPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerAccessId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "masterVolume" REAL NOT NULL DEFAULT 0.45,
    "ambientVolume" REAL NOT NULL DEFAULT 0.25,
    "effectsVolume" REAL NOT NULL DEFAULT 0.55,
    "motionMode" TEXT NOT NULL DEFAULT 'SYSTEM',
    "textScale" REAL NOT NULL DEFAULT 1,
    "ambientEffects" BOOLEAN NOT NULL DEFAULT true,
    "textureIntensity" REAL NOT NULL DEFAULT 1,
    "fullscreenPreferred" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AudioPreference_playerAccessId_fkey" FOREIGN KEY ("playerAccessId") REFERENCES "PlayerAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AudioPreference" ("ambientVolume", "effectsVolume", "id", "masterVolume", "muted", "playerAccessId", "updatedAt") SELECT "ambientVolume", "effectsVolume", "id", "masterVolume", "muted", "playerAccessId", "updatedAt" FROM "AudioPreference";
DROP TABLE "AudioPreference";
ALTER TABLE "new_AudioPreference" RENAME TO "AudioPreference";
CREATE UNIQUE INDEX "AudioPreference_playerAccessId_key" ON "AudioPreference"("playerAccessId");
CREATE TABLE "new_Campaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "accessCodeHash" TEXT NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "finaleState" TEXT NOT NULL DEFAULT 'SEALED',
    "finaleTeaser" TEXT,
    "finaleRequirements" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Campaign" ("accessCodeHash", "createdAt", "currentSequence", "id", "slug", "status", "title", "updatedAt") SELECT "accessCodeHash", "createdAt", "currentSequence", "id", "slug", "status", "title", "updatedAt" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");
CREATE TABLE "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ANNOTATION',
    "eventId" TEXT,
    "chapterOrdinal" INTEGER,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntry" ("body", "campaignId", "createdAt", "id", "releasedAt", "title") SELECT "body", "campaignId", "createdAt", "id", "releasedAt", "title" FROM "JournalEntry";
DROP TABLE "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE UNIQUE INDEX "JournalEntry_eventId_key" ON "JournalEntry"("eventId");
CREATE INDEX "JournalEntry_campaignId_releasedAt_idx" ON "JournalEntry"("campaignId", "releasedAt");
CREATE TABLE "new_MapLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "safeLabel" TEXT,
    "regionLabel" TEXT NOT NULL,
    "locationType" TEXT NOT NULL DEFAULT 'STORY',
    "state" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "description" TEXT,
    "exactness" TEXT NOT NULL DEFAULT 'APPROXIMATE',
    "chapterOrdinal" INTEGER,
    "sideQuestKey" TEXT,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "mobileX" REAL,
    "mobileY" REAL,
    "revealedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "MapLocation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MapLocation" ("campaignId", "id", "key", "name", "regionLabel", "revealedAt", "x", "y") SELECT "campaignId", "id", "key", "name", "regionLabel", "revealedAt", "x", "y" FROM "MapLocation";
DROP TABLE "MapLocation";
ALTER TABLE "new_MapLocation" RENAME TO "MapLocation";
CREATE UNIQUE INDEX "MapLocation_campaignId_key_key" ON "MapLocation"("campaignId", "key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MapRoute_campaignId_ordinal_idx" ON "MapRoute"("campaignId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "MapRoute_campaignId_key_key" ON "MapRoute"("campaignId", "key");

-- CreateIndex
CREATE INDEX "ViewedContent_playerAccessId_viewedAt_idx" ON "ViewedContent"("playerAccessId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ViewedContent_playerAccessId_contentType_contentKey_key" ON "ViewedContent"("playerAccessId", "contentType", "contentKey");
