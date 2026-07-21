-- Project One Voyage is additive except for the physical authored-root rename.
-- The historical name below is required only to preserve databases created by
-- the preceding published migration; application code uses Chronicle.
ALTER TABLE "TallTale" RENAME TO "Chronicle";

CREATE TABLE "LegacyEntityReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDomain" TEXT NOT NULL,
    "sourceModel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "canonicalModel" TEXT NOT NULL,
    "canonicalId" TEXT NOT NULL,
    "migrationVersion" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "migratedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" DATETIME
);
CREATE UNIQUE INDEX "LegacyEntityReference_sourceDomain_sourceModel_sourceId_canonicalModel_migrationVersion_key"
ON "LegacyEntityReference"("sourceDomain", "sourceModel", "sourceId", "canonicalModel", "migrationVersion");
CREATE INDEX "LegacyEntityReference_canonicalModel_canonicalId_idx"
ON "LegacyEntityReference"("canonicalModel", "canonicalId");
CREATE INDEX "LegacyEntityReference_sourceDomain_sourceModel_sourceId_idx"
ON "LegacyEntityReference"("sourceDomain", "sourceModel", "sourceId");

CREATE TABLE "LegacyMigrationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "migrationVersion" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceSelector" TEXT,
    "report" TEXT NOT NULL DEFAULT '{}',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);
CREATE INDEX "LegacyMigrationRun_migrationVersion_startedAt_idx"
ON "LegacyMigrationRun"("migrationVersion", "startedAt");
CREATE INDEX "LegacyMigrationRun_status_startedAt_idx"
ON "LegacyMigrationRun"("status", "startedAt");

ALTER TABLE "TaleLocation" ADD COLUMN "legacyKey" TEXT;
ALTER TABLE "TaleLocation" ADD COLUMN "locationType" TEXT NOT NULL DEFAULT 'STORY';
ALTER TABLE "TaleLocation" ADD COLUMN "safeLabel" TEXT;
ALTER TABLE "TaleLocation" ADD COLUMN "exactness" TEXT NOT NULL DEFAULT 'APPROXIMATE';
ALTER TABLE "TaleLocation" ADD COLUMN "mapX" REAL;
ALTER TABLE "TaleLocation" ADD COLUMN "mapY" REAL;
ALTER TABLE "TaleLocation" ADD COLUMN "mobileMapX" REAL;
ALTER TABLE "TaleLocation" ADD COLUMN "mobileMapY" REAL;
CREATE UNIQUE INDEX "TaleLocation_taleId_legacyKey_key" ON "TaleLocation"("taleId", "legacyKey");

ALTER TABLE "TaleArtifact" ADD COLUMN "legacyKey" TEXT;
ALTER TABLE "TaleArtifact" ADD COLUMN "safeName" TEXT;
ALTER TABLE "TaleArtifact" ADD COLUMN "silhouetteLabel" TEXT;
ALTER TABLE "TaleArtifact" ADD COLUMN "displayX" REAL;
ALTER TABLE "TaleArtifact" ADD COLUMN "displayY" REAL;
ALTER TABLE "TaleArtifact" ADD COLUMN "assemblyPosition" TEXT;
ALTER TABLE "TaleArtifact" ADD COLUMN "connectedArtifactKey" TEXT;
ALTER TABLE "TaleArtifact" ADD COLUMN "sourceChapterOrdinal" INTEGER;
CREATE UNIQUE INDEX "TaleArtifact_taleId_legacyKey_key" ON "TaleArtifact"("taleId", "legacyKey");

CREATE TABLE "TaleSideQuest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taleId" TEXT NOT NULL,
  "legacyKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "safeTeaser" TEXT,
  "description" TEXT,
  "rewardType" TEXT,
  "rewardLabel" TEXT,
  "completionSummary" TEXT,
  "sourceChapterOrdinal" INTEGER,
  "mapLocationKey" TEXT,
  "artifactKey" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TaleSideQuest_taleId_fkey" FOREIGN KEY ("taleId") REFERENCES "Chronicle"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleSideQuest_taleId_legacyKey_key" ON "TaleSideQuest"("taleId", "legacyKey");
CREATE INDEX "TaleSideQuest_taleId_sourceChapterOrdinal_idx" ON "TaleSideQuest"("taleId", "sourceChapterOrdinal");
CREATE TABLE "TaleSideQuestObjective" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sideQuestId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  CONSTRAINT "TaleSideQuestObjective_sideQuestId_fkey" FOREIGN KEY ("sideQuestId") REFERENCES "TaleSideQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TaleSideQuestObjective_sideQuestId_ordinal_key" ON "TaleSideQuestObjective"("sideQuestId", "ordinal");
