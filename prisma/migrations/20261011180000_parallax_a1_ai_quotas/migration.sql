-- CreateTable
CREATE TABLE "AIQuotaCommandPreview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorAccountId" TEXT NOT NULL,
    "accountSessionId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "expectedRevision" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIQuotaControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "lockVersion" INTEGER NOT NULL DEFAULT 0,
    "policy" TEXT NOT NULL,
    "lastSuccessAt" DATETIME,
    "lastFailureCode" TEXT,
    "lastFailureAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIQuotaUserPolicy" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "policy" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIQuotaPolicyRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetAccountId" TEXT,
    "actorAccountId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "previousRevision" INTEGER NOT NULL,
    "resultingRevision" INTEGER NOT NULL,
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AIUsageLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "operationCategory" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "pricingRevision" TEXT NOT NULL,
    "pricing" TEXT NOT NULL,
    "policyRevision" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "reservationNano" BIGINT NOT NULL,
    "exposureNano" BIGINT NOT NULL,
    "settledCostNano" BIGINT,
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "cacheWriteTokens" INTEGER,
    "outputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "providerResponseId" TEXT,
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" DATETIME,
    "settledAt" DATETIME,
    "leaseExpiresAt" DATETIME NOT NULL,
    "result" TEXT,
    "resultExpiresAt" DATETIME,
    "timings" TEXT
);

-- CreateIndex
CREATE INDEX "AIQuotaCommandPreview_expiresAt_idx" ON "AIQuotaCommandPreview"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIQuotaPolicyRevision_idempotencyKey_key" ON "AIQuotaPolicyRevision"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AIQuotaPolicyRevision_targetAccountId_createdAt_idx" ON "AIQuotaPolicyRevision"("targetAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLedger_period_accountId_status_idx" ON "AIUsageLedger"("period", "accountId", "status");

-- CreateIndex
CREATE INDEX "AIUsageLedger_createdAt_status_idx" ON "AIUsageLedger"("createdAt", "status");

-- CreateIndex
CREATE INDEX "AIUsageLedger_leaseExpiresAt_status_idx" ON "AIUsageLedger"("leaseExpiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageLedger_accountId_idempotencyKey_key" ON "AIUsageLedger"("accountId", "idempotencyKey");
