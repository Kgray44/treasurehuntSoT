CREATE TABLE "PrivateContentImport" (
  "id" TEXT NOT NULL PRIMARY KEY, "packageId" TEXT NOT NULL, "packageRevision" INTEGER NOT NULL,
  "packageSha256" TEXT NOT NULL, "planSha256" TEXT NOT NULL, "status" TEXT NOT NULL,
  "ownerActorId" TEXT, "sourceTaleId" TEXT, "contentJson" TEXT NOT NULL,
  "importedTaleIds" TEXT NOT NULL DEFAULT '[]', "importedAssetIds" TEXT NOT NULL DEFAULT '[]',
  "warnings" TEXT NOT NULL DEFAULT '[]', "correlationId" TEXT NOT NULL, "finalizationErrorCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME
);
CREATE UNIQUE INDEX "PrivateContentImport_packageSha256_key" ON "PrivateContentImport"("packageSha256");
CREATE UNIQUE INDEX "PrivateContentImport_packageId_packageRevision_key" ON "PrivateContentImport"("packageId", "packageRevision");
CREATE INDEX "PrivateContentImport_status_createdAt_idx" ON "PrivateContentImport"("status", "createdAt");
CREATE TABLE "PrivateContentImportMapping" (
  "id" TEXT NOT NULL PRIMARY KEY, "importId" TEXT NOT NULL, "sourceLogicalId" TEXT NOT NULL, "targetId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  CONSTRAINT "PrivateContentImportMapping_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PrivateContentImport"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrivateContentImportMapping_importId_sourceLogicalId_key" ON "PrivateContentImportMapping"("importId", "sourceLogicalId");
CREATE TABLE "PrivateAssetObject" (
  "id" TEXT NOT NULL PRIMARY KEY, "sha256" TEXT NOT NULL, "byteLength" INTEGER NOT NULL, "mediaType" TEXT NOT NULL, "representation" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "finalizedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PrivateAssetObject_sha256_key" ON "PrivateAssetObject"("sha256");
CREATE UNIQUE INDEX "PrivateAssetObject_storageKey_key" ON "PrivateAssetObject"("storageKey");
CREATE TABLE "PrivateAssetReference" (
  "id" TEXT NOT NULL PRIMARY KEY, "importId" TEXT NOT NULL, "objectId" TEXT NOT NULL, "logicalId" TEXT NOT NULL, "ownerActorId" TEXT, "taleId" TEXT, "playthroughId" TEXT, "visibility" TEXT NOT NULL DEFAULT 'PRIVATE', "revealState" TEXT NOT NULL DEFAULT 'LOCKED', "available" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateAssetReference_importId_fkey" FOREIGN KEY ("importId") REFERENCES "PrivateContentImport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PrivateAssetReference_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "PrivateAssetObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrivateAssetReference_importId_logicalId_key" ON "PrivateAssetReference"("importId", "logicalId");
CREATE INDEX "PrivateAssetReference_playthroughId_revealState_available_idx" ON "PrivateAssetReference"("playthroughId", "revealState", "available");
