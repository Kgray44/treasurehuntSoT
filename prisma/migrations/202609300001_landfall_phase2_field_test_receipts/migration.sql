CREATE TABLE "LandfallFieldTestReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "definitionHash" TEXT NOT NULL,
    "worldspaceId" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "waypointId" TEXT,
    "routeId" TEXT,
    "providerClass" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "accuracyBand" TEXT,
    "confidence" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "dwellSeconds" INTEGER NOT NULL,
    "networkState" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "testedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandfallFieldTestReceipt_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LandfallFieldTestReceipt_draftId_testedAt_idx" ON "LandfallFieldTestReceipt"("draftId", "testedAt");
