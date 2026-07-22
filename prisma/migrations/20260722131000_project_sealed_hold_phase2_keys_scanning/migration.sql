-- Phase 2 reserves this additive checkpoint for encrypted retry data, key wrapping, and scanner records.
CREATE TABLE "PrivateContentScan" (
  "id" TEXT NOT NULL PRIMARY KEY, "objectId" TEXT NOT NULL, "provider" TEXT NOT NULL, "state" TEXT NOT NULL,
  "safeCode" TEXT, "scannedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("objectId") REFERENCES "PrivateAssetObject"("id") ON DELETE CASCADE
);
CREATE INDEX "PrivateContentScan_objectId_createdAt_idx" ON "PrivateContentScan"("objectId", "createdAt");
CREATE INDEX "PrivateContentScan_state_createdAt_idx" ON "PrivateContentScan"("state", "createdAt");
