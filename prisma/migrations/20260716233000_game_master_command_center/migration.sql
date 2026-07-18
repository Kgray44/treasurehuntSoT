ALTER TABLE "AdminAuditLog" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "AdminAuditLog" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'SUCCEEDED';
ALTER TABLE "AdminAuditLog" ADD COLUMN "reason" TEXT;

CREATE TABLE "PlayerPresence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "playerAccessId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "route" TEXT,
  "visibility" TEXT,
  "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disconnectedAt" DATETIME,
  "acknowledgedSequence" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PlayerPresence_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerPresence_playerAccessId_fkey" FOREIGN KEY ("playerAccessId") REFERENCES "PlayerAccess" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerPresence_campaignId_deviceId_key" ON "PlayerPresence"("campaignId", "deviceId");
CREATE INDEX "PlayerPresence_campaignId_lastHeartbeatAt_idx" ON "PlayerPresence"("campaignId", "lastHeartbeatAt");

CREATE TABLE "PreparedAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "targetKey" TEXT,
  "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREPARED',
  "expectedSequence" INTEGER NOT NULL,
  "scheduledFor" DATETIME,
  "preparedBy" TEXT NOT NULL,
  "preparedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt" DATETIME,
  "cancelledAt" DATETIME,
  CONSTRAINT "PreparedAction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PreparedAction_campaignId_status_scheduledFor_idx" ON "PreparedAction"("campaignId", "status", "scheduledFor");

CREATE TABLE "CommandExecution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "campaignId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "command" TEXT NOT NULL,
  "expectedSequence" INTEGER NOT NULL,
  "correlationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "result" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  CONSTRAINT "CommandExecution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CommandExecution_campaignId_idempotencyKey_key" ON "CommandExecution"("campaignId", "idempotencyKey");
CREATE INDEX "CommandExecution_campaignId_createdAt_idx" ON "CommandExecution"("campaignId", "createdAt");
