-- Sealed Hold Phase 2: additive durable operation/upload/job and scan foundation.
PRAGMA foreign_keys=ON;

ALTER TABLE "PrivateContentImport" ADD COLUMN "normalizedPayloadId" TEXT;
ALTER TABLE "PrivateContentImport" ADD COLUMN "materializationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "PrivateAssetObject" ADD COLUMN "storageProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "PrivateAssetObject" ADD COLUMN "scanStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "PrivateAssetObject" ADD COLUMN "quarantinedAt" DATETIME;

CREATE TABLE "PrivateContentOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "importId" TEXT, "ownerAccountId" TEXT, "kind" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'CREATED', "idempotencyKey" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
  "progress" TEXT NOT NULL DEFAULT '{}', "cancelRequestedAt" DATETIME, "claimedAt" DATETIME,
  "claimOwner" TEXT, "claimExpiresAt" DATETIME, "failureCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("importId") REFERENCES "PrivateContentImport"("id") ON DELETE SET NULL,
  FOREIGN KEY ("ownerAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "PrivateContentOperation_idempotencyKey_key" ON "PrivateContentOperation"("idempotencyKey");
CREATE INDEX "PrivateContentOperation_state_claimExpiresAt_idx" ON "PrivateContentOperation"("state", "claimExpiresAt");
CREATE INDEX "PrivateContentImport_materializationStatus_createdAt_idx" ON "PrivateContentImport"("materializationStatus", "createdAt");

CREATE TABLE "PrivateContentUpload" (
  "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "storageProvider" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "expectedSha256" TEXT, "receivedBytes" INTEGER NOT NULL DEFAULT 0, "expectedBytes" INTEGER, "expiresAt" DATETIME NOT NULL,
  "completedAt" DATETIME, "cancelledAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("operationId") REFERENCES "PrivateContentOperation"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "PrivateContentUpload_operationId_key" ON "PrivateContentUpload"("operationId");
CREATE UNIQUE INDEX "PrivateContentUpload_storageKey_key" ON "PrivateContentUpload"("storageKey");
CREATE INDEX "PrivateContentUpload_expiresAt_completedAt_idx" ON "PrivateContentUpload"("expiresAt", "completedAt");

CREATE TABLE "PrivateContentUploadPart" (
  "id" TEXT NOT NULL PRIMARY KEY, "uploadId" TEXT NOT NULL, "partNumber" INTEGER NOT NULL, "sha256" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL, "providerTag" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("uploadId") REFERENCES "PrivateContentUpload"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "PrivateContentUploadPart_uploadId_partNumber_key" ON "PrivateContentUploadPart"("uploadId", "partNumber");

CREATE TABLE "PrivateContentJob" (
  "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "type" TEXT NOT NULL, "payloadVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING', "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" DATETIME, "claimOwner" TEXT, "claimExpiresAt" DATETIME, "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "completedAt" DATETIME, "cancelledAt" DATETIME, "failureCode" TEXT, "progress" TEXT NOT NULL DEFAULT '{}', "correlationId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY ("operationId") REFERENCES "PrivateContentOperation"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "PrivateContentJob_idempotencyKey_key" ON "PrivateContentJob"("idempotencyKey");
CREATE INDEX "PrivateContentJob_state_availableAt_claimExpiresAt_idx" ON "PrivateContentJob"("state", "availableAt", "claimExpiresAt");
