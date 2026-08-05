-- Project Homeport Phase 7 owner correction Round 1: additive account and participation lifecycle gaps.
ALTER TABLE "AccountToken" ADD COLUMN "pendingNormalizedEmail" VARCHAR(254);
ALTER TABLE "AccountToken" ADD COLUMN "pendingDisplayEmail" VARCHAR(254);

ALTER TABLE "PlaythroughMembership" ADD COLUMN "participationAlias" VARCHAR(80);
ALTER TABLE "PlaythroughMembership" ADD COLUMN "participationAliasEditedAt" DATETIME;

CREATE TABLE "AccountDataExport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "state" VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "manifest" TEXT NOT NULL DEFAULT '{}',
  "payload" TEXT,
  "checksum" CHAR(64),
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "buildingAt" DATETIME,
  "readyAt" DATETIME,
  "failedAt" DATETIME,
  "expiresAt" DATETIME,
  "downloadedAt" DATETIME,
  "failureSummary" VARCHAR(500),
  CONSTRAINT "AccountDataExport_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountDataExport_accountId_requestedAt_idx" ON "AccountDataExport"("accountId", "requestedAt");
CREATE INDEX "AccountDataExport_state_expiresAt_idx" ON "AccountDataExport"("state", "expiresAt");

CREATE TABLE "AccountLifecycleRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "state" VARCHAR(32) NOT NULL DEFAULT 'REQUESTED',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledFor" DATETIME,
  "cancellableUntil" DATETIME,
  "canceledAt" DATETIME,
  "completedAt" DATETIME,
  "reason" VARCHAR(500),
  CONSTRAINT "AccountLifecycleRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AccountLifecycleRequest_accountId_kind_state_idx" ON "AccountLifecycleRequest"("accountId", "kind", "state");
CREATE INDEX "AccountLifecycleRequest_kind_state_scheduledFor_idx" ON "AccountLifecycleRequest"("kind", "state", "scheduledFor");
