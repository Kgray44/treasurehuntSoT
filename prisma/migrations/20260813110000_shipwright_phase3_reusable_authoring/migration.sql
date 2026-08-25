CREATE TABLE "ReusableAuthoringItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerAccountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReusableAuthoringItem_ownerAccountId_fkey" FOREIGN KEY ("ownerAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "ReusableAuthoringItemVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "envelope" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReusableAuthoringItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReusableAuthoringItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "ReusableAuthoringUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "insertedBlockIds" TEXT NOT NULL DEFAULT '[]',
    "insertedChapterIds" TEXT NOT NULL DEFAULT '[]',
    "provenance" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReusableAuthoringUsage_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReusableAuthoringUsage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ReusableAuthoringItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReusableAuthoringUsage_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ReusableAuthoringItemVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ReusableAuthoringItem_ownerAccountId_status_updatedAt_idx" ON "ReusableAuthoringItem"("ownerAccountId", "status", "updatedAt");
CREATE INDEX "ReusableAuthoringItem_ownerAccountId_kind_updatedAt_idx" ON "ReusableAuthoringItem"("ownerAccountId", "kind", "updatedAt");
CREATE UNIQUE INDEX "ReusableAuthoringItemVersion_itemId_versionNumber_key" ON "ReusableAuthoringItemVersion"("itemId", "versionNumber");
CREATE INDEX "ReusableAuthoringItemVersion_checksum_idx" ON "ReusableAuthoringItemVersion"("checksum");
CREATE INDEX "ReusableAuthoringUsage_draftId_createdAt_idx" ON "ReusableAuthoringUsage"("draftId", "createdAt");
CREATE INDEX "ReusableAuthoringUsage_itemId_createdAt_idx" ON "ReusableAuthoringUsage"("itemId", "createdAt");
CREATE INDEX "ReusableAuthoringUsage_versionId_idx" ON "ReusableAuthoringUsage"("versionId");
