CREATE INDEX "ProtectedMediaGrant_consumer_idx" ON "ProtectedMediaGrant"("consumingAuthority", "consumingAggregateKind", "consumingAggregateOpaqueId");
CREATE INDEX "ProtectedMediaDerivative_operationId_idx" ON "ProtectedMediaDerivative"("operationId");
CREATE INDEX "ProtectedMediaWithdrawal_derivativeId_occurredAt_idx" ON "ProtectedMediaWithdrawal"("derivativeId", "occurredAt");
CREATE INDEX "ProtectedMediaWithdrawal_protectedMediaId_occurredAt_idx" ON "ProtectedMediaWithdrawal"("protectedMediaId", "occurredAt");
CREATE TABLE "ProtectedMediaReconciliationRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "mode" TEXT NOT NULL, "snapshotDigest" TEXT NOT NULL, "findings" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME
);
CREATE INDEX "ProtectedMediaReconciliationRecord_mode_createdAt_idx" ON "ProtectedMediaReconciliationRecord"("mode", "createdAt");
