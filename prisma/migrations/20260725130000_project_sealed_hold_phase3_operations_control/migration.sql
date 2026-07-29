-- Project Sealed Hold Phase 3: provider evidence and leased scheduled operations.
CREATE TABLE "PrivateProviderHealthSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "state" TEXT NOT NULL, "safeCode" TEXT NOT NULL, "evidence" TEXT NOT NULL DEFAULT '{}',
  "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PrivateProviderHealthSnapshot_kind_checkedAt_idx" ON "PrivateProviderHealthSnapshot"("kind", "checkedAt");
CREATE TABLE "PrivateScheduledOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL, "scheduleKey" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING', "runAfter" DATETIME NOT NULL, "leaseOwner" TEXT,
  "leaseUntil" DATETIME, "lastError" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "PrivateScheduledOperation_scheduleKey_key" ON "PrivateScheduledOperation"("scheduleKey");
CREATE INDEX "PrivateScheduledOperation_state_runAfter_leaseUntil_idx" ON "PrivateScheduledOperation"("state", "runAfter", "leaseUntil");
