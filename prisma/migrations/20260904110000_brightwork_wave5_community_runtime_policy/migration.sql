CREATE TABLE "CommunityOperationalPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "dispatchEnabled" BOOLEAN NOT NULL DEFAULT true,
    "batchSize" INTEGER NOT NULL DEFAULT 25,
    "pollIntervalMs" INTEGER NOT NULL DEFAULT 1000,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "CommunityOperationalPolicy_key_key" ON "CommunityOperationalPolicy"("key");

CREATE TABLE "CommunityOperationalPolicyChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyKey" TEXT NOT NULL,
    "actorAccountId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "expectedRevision" INTEGER NOT NULL,
    "resultingRevision" INTEGER NOT NULL,
    "beforeState" TEXT NOT NULL,
    "afterState" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CommunityOperationalPolicyChange_idempotencyKey_key" ON "CommunityOperationalPolicyChange"("idempotencyKey");
CREATE UNIQUE INDEX "CommunityOperationalPolicyChange_correlationId_key" ON "CommunityOperationalPolicyChange"("correlationId");
CREATE INDEX "CommunityOperationalPolicyChange_policyKey_createdAt_idx" ON "CommunityOperationalPolicyChange"("policyKey", "createdAt");
CREATE INDEX "CommunityOperationalPolicyChange_actorAccountId_createdAt_idx" ON "CommunityOperationalPolicyChange"("actorAccountId", "createdAt");

CREATE TABLE "CommunityOperationalCommandReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandType" TEXT NOT NULL,
    "actorAccountId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "CommunityOperationalCommandReceipt_idempotencyKey_key" ON "CommunityOperationalCommandReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "CommunityOperationalCommandReceipt_correlationId_key" ON "CommunityOperationalCommandReceipt"("correlationId");
CREATE INDEX "CommunityOperationalCommandReceipt_commandType_actorAccountId_createdAt_idx" ON "CommunityOperationalCommandReceipt"("commandType", "actorAccountId", "createdAt");
CREATE INDEX "CommunityOperationalCommandReceipt_targetType_targetId_createdAt_idx" ON "CommunityOperationalCommandReceipt"("targetType", "targetId", "createdAt");
