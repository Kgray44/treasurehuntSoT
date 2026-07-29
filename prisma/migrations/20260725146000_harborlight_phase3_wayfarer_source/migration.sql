-- Harborlight Phase 3: a publication-preparation record references Wayfarer's
-- canonical private Keepsake through an opaque source identity.  This does not
-- import or duplicate any Wayfarer private-history model.
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CommunityVoyageKeepsake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerAccountId" TEXT NOT NULL,
    "taleSessionId" TEXT,
    "wayfarerKeepsakeId" TEXT,
    "sourceWatermark" TEXT,
    "sourceProjectionChecksum" TEXT,
    "preparationState" TEXT NOT NULL DEFAULT 'PENDING_SOURCE',
    "publishedVersionId" TEXT,
    "safeSnapshot" TEXT NOT NULL,
    "favoriteMoment" TEXT,
    "representationChecksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CommunityVoyageKeepsake" ("id", "ownerAccountId", "taleSessionId", "publishedVersionId", "safeSnapshot", "favoriteMoment", "representationChecksum", "status", "createdAt", "updatedAt")
SELECT "id", "ownerAccountId", "taleSessionId", "publishedVersionId", "safeSnapshot", "favoriteMoment", "representationChecksum", "status", "createdAt", "updatedAt"
FROM "CommunityVoyageKeepsake";
DROP TABLE "CommunityVoyageKeepsake";
ALTER TABLE "new_CommunityVoyageKeepsake" RENAME TO "CommunityVoyageKeepsake";
CREATE UNIQUE INDEX "CommunityVoyageKeepsake_ownerAccountId_taleSessionId_key" ON "CommunityVoyageKeepsake"("ownerAccountId", "taleSessionId");
CREATE UNIQUE INDEX "CommunityVoyageKeepsake_ownerAccountId_wayfarerKeepsakeId_key" ON "CommunityVoyageKeepsake"("ownerAccountId", "wayfarerKeepsakeId");
CREATE INDEX "CommunityVoyageKeepsake_taleSessionId_idx" ON "CommunityVoyageKeepsake"("taleSessionId");
CREATE INDEX "CommunityVoyageKeepsake_wayfarerKeepsakeId_idx" ON "CommunityVoyageKeepsake"("wayfarerKeepsakeId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
