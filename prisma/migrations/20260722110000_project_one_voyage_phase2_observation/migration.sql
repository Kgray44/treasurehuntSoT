-- Project One Voyage Phase 2: durable, privacy-safe compatibility observation.
-- This records adapter use only; it must never contain a credential, payload,
-- display name, email, private asset key, or legacy business state.
CREATE TABLE "CompatibilityObservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "correlationId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "routeKey" TEXT NOT NULL,
  "disposition" TEXT NOT NULL,
  "canonicalSessionId" TEXT,
  "canonicalAccountId" TEXT,
  "testTraffic" BOOLEAN NOT NULL DEFAULT false,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CompatibilityObservation_operation_occurredAt_idx" ON "CompatibilityObservation"("operation", "occurredAt");
CREATE INDEX "CompatibilityObservation_canonicalSessionId_occurredAt_idx" ON "CompatibilityObservation"("canonicalSessionId", "occurredAt");
CREATE INDEX "CompatibilityObservation_correlationId_idx" ON "CompatibilityObservation"("correlationId");
