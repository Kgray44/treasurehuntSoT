-- Harborlight Phase 4: durable moderation, provider evidence, shared limits,
-- and restart-safe operational scheduling. No historical Harbor rows are
-- rewritten; all new enforcement is additive and fail-closed in services.
ALTER TABLE "CommunityReport" ADD COLUMN "caseId" TEXT;
ALTER TABLE "CommunityReport" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "CommunityReport_idempotencyKey_key" ON "CommunityReport"("idempotencyKey");
CREATE INDEX "CommunityReport_caseId_createdAt_idx" ON "CommunityReport"("caseId", "createdAt");

CREATE TABLE "CommunityModerationCase" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM', "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "primaryReasonCode" TEXT NOT NULL, "subjectFingerprint" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
  "assignedAccountId" TEXT, "conflictAccountId" TEXT, "correlationId" TEXT NOT NULL,
  "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityModerationCase_caseKey_key" ON "CommunityModerationCase"("caseKey");
CREATE INDEX "CommunityModerationCase_status_priority_openedAt_idx" ON "CommunityModerationCase"("status", "priority", "openedAt");
CREATE INDEX "CommunityModerationCase_subjectFingerprint_status_idx" ON "CommunityModerationCase"("subjectFingerprint", "status");
CREATE INDEX "CommunityModerationCase_assignedAccountId_status_idx" ON "CommunityModerationCase"("assignedAccountId", "status");

CREATE TABLE "CommunityModerationCaseSubject" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "subjectChecksum" TEXT, "tombstone" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityModerationCaseSubject_caseId_subjectType_subjectId_key" ON "CommunityModerationCaseSubject"("caseId", "subjectType", "subjectId");
CREATE INDEX "CommunityModerationCaseSubject_subjectType_subjectId_idx" ON "CommunityModerationCaseSubject"("subjectType", "subjectId");

CREATE TABLE "CommunityModerationCaseReport" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "reportId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "CommunityModerationCaseReport_reportId_key" ON "CommunityModerationCaseReport"("reportId");
CREATE INDEX "CommunityModerationCaseReport_caseId_createdAt_idx" ON "CommunityModerationCaseReport"("caseId", "createdAt");

CREATE TABLE "CommunityModerationCaseEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "kind" TEXT NOT NULL, "checksum" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1, "safeSnapshot" TEXT NOT NULL DEFAULT '{}', "accessClass" TEXT NOT NULL DEFAULT 'MODERATOR',
  "createdBy" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityModerationCaseEvidence_caseId_kind_checksum_key" ON "CommunityModerationCaseEvidence"("caseId", "kind", "checksum");
CREATE INDEX "CommunityModerationCaseEvidence_caseId_createdAt_idx" ON "CommunityModerationCaseEvidence"("caseId", "createdAt");

CREATE TABLE "CommunityModerationCaseAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "moderatorAccountId" TEXT NOT NULL,
  "assignedByAccountId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'ASSIGNED', "reasonCode" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" DATETIME
);
CREATE INDEX "CommunityModerationCaseAssignment_caseId_endedAt_idx" ON "CommunityModerationCaseAssignment"("caseId", "endedAt");
CREATE INDEX "CommunityModerationCaseAssignment_moderatorAccountId_endedAt_idx" ON "CommunityModerationCaseAssignment"("moderatorAccountId", "endedAt");

CREATE TABLE "CommunityModerationCaseEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "fromStatus" TEXT,
  "toStatus" TEXT, "reasonCode" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL, "correlationId" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommunityModerationCaseEvent_caseId_createdAt_idx" ON "CommunityModerationCaseEvent"("caseId", "createdAt");

CREATE TABLE "CommunityModerationAction" (
  "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'APPLIED', "reasonCode" TEXT NOT NULL,
  "expectedRevision" INTEGER NOT NULL, "idempotencyKey" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL,
  "secondReviewerId" TEXT, "reversible" BOOLEAN NOT NULL DEFAULT true, "appealEligible" BOOLEAN NOT NULL DEFAULT true,
  "restorationEligible" BOOLEAN NOT NULL DEFAULT false, "correlationId" TEXT NOT NULL,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reversedAt" DATETIME
);
CREATE UNIQUE INDEX "CommunityModerationAction_idempotencyKey_key" ON "CommunityModerationAction"("idempotencyKey");
CREATE INDEX "CommunityModerationAction_caseId_appliedAt_idx" ON "CommunityModerationAction"("caseId", "appliedAt");
CREATE INDEX "CommunityModerationAction_subjectType_subjectId_state_idx" ON "CommunityModerationAction"("subjectType", "subjectId", "state");

CREATE TABLE "CommunitySanction" (
  "id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "subjectAccountId" TEXT, "sanctionType" TEXT NOT NULL,
  "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" DATETIME, "state" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunitySanction_actionId_key" ON "CommunitySanction"("actionId");
CREATE INDEX "CommunitySanction_subjectAccountId_state_idx" ON "CommunitySanction"("subjectAccountId", "state");

CREATE TABLE "CommunityModerationAppeal" (
  "id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "appellantAccountId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "reason" TEXT NOT NULL, "filingDeadlineAt" DATETIME NOT NULL,
  "assignedAccountId" TEXT, "decisionReasonCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" DATETIME
);
CREATE UNIQUE INDEX "CommunityModerationAppeal_actionId_appellantAccountId_key" ON "CommunityModerationAppeal"("actionId", "appellantAccountId");
CREATE INDEX "CommunityModerationAppeal_caseId_status_createdAt_idx" ON "CommunityModerationAppeal"("caseId", "status", "createdAt");

CREATE TABLE "CommunityModerationAppealEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "appealId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "fromStatus" TEXT,
  "toStatus" TEXT, "reasonCode" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommunityModerationAppealEvent_appealId_createdAt_idx" ON "CommunityModerationAppealEvent"("appealId", "createdAt");

CREATE TABLE "CommunityRestorationReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL, "objectChecksum" TEXT, "scanReceiptId" TEXT, "packageChecksum" TEXT,
  "eligibility" TEXT NOT NULL, "restoredBy" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityRestorationReceipt_actionId_key" ON "CommunityRestorationReceipt"("actionId");
CREATE INDEX "CommunityRestorationReceipt_caseId_createdAt_idx" ON "CommunityRestorationReceipt"("caseId", "createdAt");

CREATE TABLE "CommunityScanReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL, "definitionsVersion" TEXT, "result" TEXT NOT NULL, "objectChecksum" TEXT NOT NULL,
  "byteLength" INTEGER NOT NULL, "detectedMediaType" TEXT NOT NULL, "evidenceKind" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL, "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommunityScanReceipt_subjectType_subjectId_scannedAt_idx" ON "CommunityScanReceipt"("subjectType", "subjectId", "scannedAt");
CREATE INDEX "CommunityScanReceipt_objectChecksum_result_expiresAt_idx" ON "CommunityScanReceipt"("objectChecksum", "result", "expiresAt");

CREATE TABLE "CommunityRateLimitBucket" (
  "id" TEXT NOT NULL PRIMARY KEY, "keyHash" TEXT NOT NULL, "scope" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0,
  "windowEndsAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityRateLimitBucket_keyHash_key" ON "CommunityRateLimitBucket"("keyHash");
CREATE INDEX "CommunityRateLimitBucket_scope_windowEndsAt_idx" ON "CommunityRateLimitBucket"("scope", "windowEndsAt");

CREATE TABLE "CommunityOperationalSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY, "scheduleType" TEXT NOT NULL, "nextRunAt" DATETIME NOT NULL,
  "lastRunAt" DATETIME, "lastOutcome" TEXT, "revision" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CommunityOperationalSchedule_scheduleType_key" ON "CommunityOperationalSchedule"("scheduleType");
CREATE INDEX "CommunityOperationalSchedule_nextRunAt_idx" ON "CommunityOperationalSchedule"("nextRunAt");
