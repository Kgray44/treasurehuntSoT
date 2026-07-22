-- Phase 2 repair: Phase 1 declared contentJson required, which prevents the
-- encrypted-normalized retry payload from becoming authoritative. Rebuild the
-- SQLite table additively, preserving every Phase 1 row and its compatibility
-- fallback while allowing verified clearing to NULL.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_PrivateContentImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageId" TEXT NOT NULL,
  "packageRevision" INTEGER NOT NULL,
  "packageSha256" TEXT NOT NULL,
  "planSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "ownerActorId" TEXT,
  "ownerAccountId" TEXT,
  "sourceTaleId" TEXT,
  "contentJson" TEXT,
  "normalizedPayloadId" TEXT,
  "materializationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "importedTaleIds" TEXT NOT NULL DEFAULT '[]',
  "importedAssetIds" TEXT NOT NULL DEFAULT '[]',
  "warnings" TEXT NOT NULL DEFAULT '[]',
  "correlationId" TEXT NOT NULL,
  "finalizationErrorCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME
);

INSERT INTO "new_PrivateContentImport" (
  "id", "packageId", "packageRevision", "packageSha256", "planSha256", "status", "ownerActorId", "ownerAccountId", "sourceTaleId",
  "contentJson", "normalizedPayloadId", "materializationStatus", "importedTaleIds", "importedAssetIds", "warnings",
  "correlationId", "finalizationErrorCode", "createdAt", "completedAt"
)
SELECT
  "id", "packageId", "packageRevision", "packageSha256", "planSha256", "status", "ownerActorId", "ownerAccountId", "sourceTaleId",
  "contentJson", "normalizedPayloadId", "materializationStatus", "importedTaleIds", "importedAssetIds", "warnings",
  "correlationId", "finalizationErrorCode", "createdAt", "completedAt"
FROM "PrivateContentImport";

DROP TABLE "PrivateContentImport";
ALTER TABLE "new_PrivateContentImport" RENAME TO "PrivateContentImport";
CREATE UNIQUE INDEX "PrivateContentImport_packageSha256_key" ON "PrivateContentImport"("packageSha256");
CREATE UNIQUE INDEX "PrivateContentImport_packageId_packageRevision_key" ON "PrivateContentImport"("packageId", "packageRevision");
CREATE INDEX "PrivateContentImport_status_createdAt_idx" ON "PrivateContentImport"("status", "createdAt");
CREATE INDEX "PrivateContentImport_materializationStatus_createdAt_idx" ON "PrivateContentImport"("materializationStatus", "createdAt");
CREATE INDEX "PrivateContentImport_ownerAccountId_createdAt_idx" ON "PrivateContentImport"("ownerAccountId", "createdAt");

PRAGMA foreign_keys=ON;
