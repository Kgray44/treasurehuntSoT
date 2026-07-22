CREATE TABLE "CommunityInstallOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "packageId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL, "accountId" TEXT NOT NULL, "mode" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "destinationRevision" TEXT NOT NULL, "plan" TEXT NOT NULL, "finalizationErrorCode" TEXT, "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityInstallOperation_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommunityPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunityInstallOperation_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "CommunityRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunityInstallOperation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityInstallOperation_idempotencyKey_key" ON "CommunityInstallOperation"("idempotencyKey");
CREATE UNIQUE INDEX "CommunityInstallOperation_accountId_requestId_key" ON "CommunityInstallOperation"("accountId", "requestId");
CREATE INDEX "CommunityInstallOperation_packageId_status_idx" ON "CommunityInstallOperation"("packageId", "status");
CREATE TABLE "CommunityInstallMapping" (
  "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "targetId" TEXT NOT NULL, "kind" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityInstallMapping_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CommunityInstallOperation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommunityInstallMapping_operationId_sourceId_key" ON "CommunityInstallMapping"("operationId", "sourceId");
