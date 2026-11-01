ALTER TABLE "AIUsageLedger" ADD COLUMN "capabilityId" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "AIUsageLedger" ADD COLUMN "capabilityVersion" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "userPolicyRevision" INTEGER;
ALTER TABLE "AIUsageLedger" ADD COLUMN "policySnapshot" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "logicalParentId" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "AIUsageLedger" ADD COLUMN "outcomeAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "generatedAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "previewedAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "undoneAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "outcomeEvidence" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "acceptedResourceId" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "acceptedVersion" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "AIUsageLedger" ADD COLUMN "applicationVersion" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "utcDay" TEXT;
ALTER TABLE "AIUsageLedger" ADD COLUMN "costBasis" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "AIUsageLedger" ADD COLUMN "confirmedCostNano" BIGINT;
UPDATE "AIUsageLedger" SET "capabilityId" = CASE WHEN "operationCategory" = 'ROOM_RECONSTRUCTION' THEN 'ROOM_RECONSTRUCTION' WHEN "operationCategory" = 'AUTHORING' AND "mode" = 'ADVANCED' THEN 'ADVANCED_ASSISTANT' WHEN "operationCategory" = 'AUTHORING' THEN 'GROUNDED_ASSISTANT_EDIT' ELSE 'OTHER_AI_OPERATIONS' END,
"costBasis" = CASE WHEN "status" = 'SETTLED' AND "settledCostNano" IS NOT NULL THEN 'CALCULATED' WHEN "status" = 'RELEASED' AND "settledCostNano" = 0 THEN 'NO_CHARGE' ELSE 'UNKNOWN' END,
"outcome" = CASE WHEN "appliedAt" IS NOT NULL THEN 'APPLIED' ELSE 'UNKNOWN' END, "outcomeAt" = "appliedAt";
UPDATE "AIUsageLedger" SET "utcDay" = CASE WHEN typeof("createdAt") IN ('integer', 'real') THEN strftime('%Y-%m-%d', "createdAt" / 1000, 'unixepoch') ELSE strftime('%Y-%m-%d', "createdAt") END;

CREATE TABLE "AIProviderAttempt" (
"id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
"provider" TEXT NOT NULL, "model" TEXT NOT NULL, "pricingRevision" TEXT NOT NULL, "pricing" TEXT NOT NULL,
"status" TEXT NOT NULL, "costBasis" TEXT NOT NULL DEFAULT 'UNKNOWN', "costNano" BIGINT, "exposureNano" BIGINT NOT NULL,
"usage" TEXT, "providerResponseId" TEXT, "failureCode" TEXT, "startedAt" DATETIME NOT NULL, "completedAt" DATETIME, "reconciledAt" DATETIME,
CONSTRAINT "AIProviderAttempt_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "AIUsageLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AIUsageLedger_capabilityId_createdAt_idx" ON "AIUsageLedger"("capabilityId", "createdAt");
CREATE INDEX "AIUsageLedger_accountId_capabilityId_period_status_idx" ON "AIUsageLedger"("accountId", "capabilityId", "period", "status");
CREATE INDEX "AIUsageLedger_utcDay_capabilityId_outcome_idx" ON "AIUsageLedger"("utcDay", "capabilityId", "outcome");
CREATE INDEX "AIUsageLedger_accountId_definitionId_outcome_idx" ON "AIUsageLedger"("accountId", "definitionId", "outcome");
CREATE INDEX "AIUsageLedger_accountId_acceptedResourceId_outcome_idx" ON "AIUsageLedger"("accountId", "acceptedResourceId", "outcome");
CREATE INDEX "AIUsageLedger_settledCostNano_id_idx" ON "AIUsageLedger"("settledCostNano", "id");
CREATE UNIQUE INDEX "AIProviderAttempt_operationId_sequence_key" ON "AIProviderAttempt"("operationId", "sequence");
CREATE INDEX "AIProviderAttempt_startedAt_provider_model_idx" ON "AIProviderAttempt"("startedAt", "provider", "model");
CREATE INDEX "AIProviderAttempt_status_startedAt_idx" ON "AIProviderAttempt"("status", "startedAt");
