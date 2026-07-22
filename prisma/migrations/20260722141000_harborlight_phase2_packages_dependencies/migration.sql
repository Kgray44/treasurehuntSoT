CREATE TABLE "CommunityPackageItem" (
  "id" TEXT NOT NULL PRIMARY KEY, "packageId" TEXT NOT NULL, "logicalId" TEXT NOT NULL, "itemType" TEXT NOT NULL,
  "relativePath" TEXT NOT NULL, "checksum" TEXT NOT NULL, "mediaType" TEXT NOT NULL, "byteLength" INTEGER NOT NULL,
  "metadata" TEXT NOT NULL DEFAULT '{}', "accessibility" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunityPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityPackageItem_packageId_logicalId_key" ON "CommunityPackageItem"("packageId", "logicalId");
CREATE UNIQUE INDEX "CommunityPackageItem_packageId_relativePath_key" ON "CommunityPackageItem"("packageId", "relativePath");
CREATE INDEX "CommunityPackageItem_packageId_itemType_idx" ON "CommunityPackageItem"("packageId", "itemType");
CREATE TABLE "CommunityPackageDependency" (
  "id" TEXT NOT NULL PRIMARY KEY, "packageId" TEXT NOT NULL, "dependentLogicalId" TEXT NOT NULL,
  "requiredPackageId" TEXT, "requiredLogicalId" TEXT NOT NULL, "versionRange" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPackageDependency_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunityPackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityPackageDependency_packageId_dependentLogicalId_requiredLogicalId_key" ON "CommunityPackageDependency"("packageId", "dependentLogicalId", "requiredLogicalId");
CREATE INDEX "CommunityPackageDependency_packageId_idx" ON "CommunityPackageDependency"("packageId");
