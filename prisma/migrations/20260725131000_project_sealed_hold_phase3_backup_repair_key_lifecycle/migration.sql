-- Project Sealed Hold Phase 3: immutable repair plans and recovery evidence.
CREATE TABLE "PrivateRepairPlan" (
  "id" TEXT NOT NULL PRIMARY KEY, "digest" TEXT NOT NULL, "snapshotDigest" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT', "dryRun" BOOLEAN NOT NULL DEFAULT true, "expiresAt" DATETIME NOT NULL,
  "approvedById" TEXT, "approvedAt" DATETIME, "executionLease" TEXT, "executionUntil" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PrivateRepairPlan_digest_key" ON "PrivateRepairPlan"("digest");
CREATE INDEX "PrivateRepairPlan_state_expiresAt_idx" ON "PrivateRepairPlan"("state", "expiresAt");
CREATE TABLE "PrivateRepairAction" (
  "id" TEXT NOT NULL PRIMARY KEY, "planId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "action" TEXT NOT NULL,
  "opaqueTarget" TEXT NOT NULL, "preconditionDigest" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING', "resultCode" TEXT,
  CONSTRAINT "PrivateRepairAction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PrivateRepairPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PrivateRepairAction_planId_ordinal_key" ON "PrivateRepairAction"("planId", "ordinal");
CREATE TABLE "PrivateBackupRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "backupId" TEXT NOT NULL, "state" TEXT NOT NULL, "manifestDigest" TEXT NOT NULL,
  "snapshotIdentity" TEXT NOT NULL, "objectSetDigest" TEXT NOT NULL, "keyVersions" TEXT NOT NULL,
  "verifiedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PrivateBackupRun_backupId_key" ON "PrivateBackupRun"("backupId");
CREATE INDEX "PrivateBackupRun_state_createdAt_idx" ON "PrivateBackupRun"("state", "createdAt");
CREATE TABLE "PrivateRestoreDrill" (
  "id" TEXT NOT NULL PRIMARY KEY, "backupRunId" TEXT NOT NULL, "targetIdentity" TEXT NOT NULL, "state" TEXT NOT NULL,
  "resultCode" TEXT, "cleanupCompletedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PrivateRestoreDrill_backupRunId_createdAt_idx" ON "PrivateRestoreDrill"("backupRunId", "createdAt");
CREATE TABLE "PrivateKeyLifecycleRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "provider" TEXT NOT NULL, "sourceVersion" TEXT, "destinationVersion" TEXT NOT NULL,
  "state" TEXT NOT NULL, "plannedCount" INTEGER NOT NULL DEFAULT 0, "completedCount" INTEGER NOT NULL DEFAULT 0,
  "retirementApprovedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PrivateKeyLifecycleRecord_provider_destinationVersion_createdAt_idx" ON "PrivateKeyLifecycleRecord"("provider", "destinationVersion", "createdAt");
