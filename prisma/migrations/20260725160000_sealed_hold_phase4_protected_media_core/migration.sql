CREATE TABLE "ProtectedMedia" (
  "id" TEXT NOT NULL PRIMARY KEY, "ownerAccountId" TEXT NOT NULL, "ownerProfileId" TEXT,
  "sourcePrivateAssetObjectId" TEXT NOT NULL, "mediaKind" TEXT NOT NULL, "declaredMediaType" TEXT NOT NULL,
  "detectedMediaType" TEXT NOT NULL, "byteLength" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "scanState" TEXT NOT NULL,
  "availabilityState" TEXT NOT NULL DEFAULT 'AVAILABLE', "privacyClassification" TEXT NOT NULL DEFAULT 'PRIVATE',
  "originalFilenameSafeSnapshot" TEXT, "accessibilityDescription" TEXT, "withdrawnAt" DATETIME, "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("sourcePrivateAssetObjectId") REFERENCES "PrivateAssetObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProtectedMedia_sourcePrivateAssetObjectId_ownerAccountId_key" ON "ProtectedMedia"("sourcePrivateAssetObjectId", "ownerAccountId");
CREATE INDEX "ProtectedMedia_ownerAccountId_createdAt_idx" ON "ProtectedMedia"("ownerAccountId", "createdAt");
CREATE INDEX "ProtectedMedia_scanState_availabilityState_idx" ON "ProtectedMedia"("scanState", "availabilityState");
CREATE TABLE "ProtectedMediaAssociation" (
  "id" TEXT NOT NULL PRIMARY KEY, "protectedMediaId" TEXT NOT NULL, "authority" TEXT NOT NULL, "subjectKind" TEXT NOT NULL,
  "subjectOpaqueId" TEXT NOT NULL, "purpose" TEXT NOT NULL, "role" TEXT NOT NULL, "ordinal" INTEGER NOT NULL DEFAULT 0,
  "ownerAccountId" TEXT NOT NULL, "sourceRevision" TEXT NOT NULL, "removedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("protectedMediaId") REFERENCES "ProtectedMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProtectedMediaAssociation_subject_key" ON "ProtectedMediaAssociation"("protectedMediaId", "authority", "subjectKind", "subjectOpaqueId", "purpose", "role", "ordinal");
CREATE INDEX "ProtectedMediaAssociation_ownerAccountId_removedAt_idx" ON "ProtectedMediaAssociation"("ownerAccountId", "removedAt");
CREATE INDEX "ProtectedMediaAssociation_subject_idx" ON "ProtectedMediaAssociation"("authority", "subjectKind", "subjectOpaqueId");
