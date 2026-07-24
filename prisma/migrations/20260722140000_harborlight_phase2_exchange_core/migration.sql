-- Harborlight Phase 2: immutable exchange package identity. Additive only.
CREATE TABLE "CommunityPackage" (
  "id" TEXT NOT NULL PRIMARY KEY, "releaseId" TEXT NOT NULL, "packageSchema" INTEGER NOT NULL DEFAULT 1,
  "packageChecksum" TEXT NOT NULL, "manifest" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
  "storageStatus" TEXT NOT NULL DEFAULT 'STAGED', "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "finalizedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityPackage_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "CommunityRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityPackage_releaseId_key" ON "CommunityPackage"("releaseId");
CREATE UNIQUE INDEX "CommunityPackage_packageChecksum_key" ON "CommunityPackage"("packageChecksum");
CREATE INDEX "CommunityPackage_storageStatus_scanStatus_idx" ON "CommunityPackage"("storageStatus", "scanStatus");
