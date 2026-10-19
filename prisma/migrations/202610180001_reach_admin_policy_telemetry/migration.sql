-- Reach-owned policy and automatic numeric aggregate reports. No camera or user identity data.
CREATE TABLE "ReachRuntimePolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL,
  "policy" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReachPolicyPreview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorAccountId" TEXT NOT NULL,
  "accountSessionId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "expectedRevision" INTEGER NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL
);
CREATE INDEX "ReachPolicyPreview_expiresAt_idx" ON "ReachPolicyPreview"("expiresAt");

CREATE TABLE "ReachPolicyChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorAccountId" TEXT NOT NULL,
  "accountSessionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "expectedRevision" INTEGER NOT NULL,
  "resultingRevision" INTEGER NOT NULL,
  "beforeState" TEXT NOT NULL,
  "afterState" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ReachPolicyChange_idempotencyKey_key" ON "ReachPolicyChange"("idempotencyKey");
CREATE INDEX "ReachPolicyChange_createdAt_idx" ON "ReachPolicyChange"("createdAt");

CREATE TABLE "ReachTelemetryReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "reportVersion" INTEGER NOT NULL,
  "report" TEXT NOT NULL,
  "receivedAt" DATETIME NOT NULL,
  "expiresAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ReachTelemetryReport_idempotencyKey_key" ON "ReachTelemetryReport"("idempotencyKey");
CREATE INDEX "ReachTelemetryReport_receivedAt_idx" ON "ReachTelemetryReport"("receivedAt");
CREATE INDEX "ReachTelemetryReport_expiresAt_idx" ON "ReachTelemetryReport"("expiresAt");
