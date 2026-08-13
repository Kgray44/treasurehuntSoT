CREATE TABLE "WayfarerAdminCommandReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorAccountId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT '{}',
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WayfarerAdminCommandReceipt_idempotencyKey_key"
    ON "WayfarerAdminCommandReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "WayfarerAdminCommandReceipt_correlationId_key"
    ON "WayfarerAdminCommandReceipt"("correlationId");
CREATE INDEX "WayfarerAdminCommandReceipt_commandType_actorAccountId_completedAt_idx"
    ON "WayfarerAdminCommandReceipt"("commandType", "actorAccountId", "completedAt");
CREATE INDEX "WayfarerAdminCommandReceipt_targetType_targetId_completedAt_idx"
    ON "WayfarerAdminCommandReceipt"("targetType", "targetId", "completedAt");
