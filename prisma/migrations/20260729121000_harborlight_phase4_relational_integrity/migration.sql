-- Harborlight Phase 4 relational-integrity correction.  The first Phase 4
-- migration is intentionally preserved. SQLite requires table redefinition to
-- add foreign keys; all records and indexes are copied unchanged.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_CommunityModerationCase" ("id" TEXT NOT NULL PRIMARY KEY, "caseKey" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN', "severity" TEXT NOT NULL DEFAULT 'MEDIUM', "priority" TEXT NOT NULL DEFAULT 'MEDIUM', "primaryReasonCode" TEXT NOT NULL, "subjectFingerprint" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1, "assignedAccountId" TEXT, "conflictAccountId" TEXT, "correlationId" TEXT NOT NULL, "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" DATETIME, "updatedAt" DATETIME NOT NULL);
INSERT INTO "new_CommunityModerationCase" SELECT * FROM "CommunityModerationCase";
DROP TABLE "CommunityModerationCase";
ALTER TABLE "new_CommunityModerationCase" RENAME TO "CommunityModerationCase";
CREATE UNIQUE INDEX "CommunityModerationCase_caseKey_key" ON "CommunityModerationCase"("caseKey");
CREATE INDEX "CommunityModerationCase_status_priority_openedAt_idx" ON "CommunityModerationCase"("status", "priority", "openedAt");
CREATE INDEX "CommunityModerationCase_subjectFingerprint_status_idx" ON "CommunityModerationCase"("subjectFingerprint", "status");
CREATE INDEX "CommunityModerationCase_assignedAccountId_status_idx" ON "CommunityModerationCase"("assignedAccountId", "status");

CREATE TABLE "new_CommunityReport" ("id" TEXT NOT NULL PRIMARY KEY, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "reporterAccountId" TEXT NOT NULL, "reason" TEXT NOT NULL, "detail" TEXT, "status" TEXT NOT NULL DEFAULT 'OPEN', "caseId" TEXT, "idempotencyKey" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
INSERT INTO "new_CommunityReport" SELECT * FROM "CommunityReport";
DROP TABLE "CommunityReport";
ALTER TABLE "new_CommunityReport" RENAME TO "CommunityReport";
CREATE UNIQUE INDEX "CommunityReport_idempotencyKey_key" ON "CommunityReport"("idempotencyKey");
CREATE INDEX "CommunityReport_subjectType_subjectId_status_idx" ON "CommunityReport"("subjectType", "subjectId", "status");
CREATE INDEX "CommunityReport_caseId_createdAt_idx" ON "CommunityReport"("caseId", "createdAt");

CREATE TABLE "new_CommunityScanReceipt" ("id" TEXT NOT NULL PRIMARY KEY, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "provider" TEXT NOT NULL, "providerVersion" TEXT NOT NULL, "definitionsVersion" TEXT, "result" TEXT NOT NULL, "objectChecksum" TEXT NOT NULL, "byteLength" INTEGER NOT NULL, "detectedMediaType" TEXT NOT NULL, "evidenceKind" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL, "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO "new_CommunityScanReceipt" SELECT * FROM "CommunityScanReceipt";
DROP TABLE "CommunityScanReceipt";
ALTER TABLE "new_CommunityScanReceipt" RENAME TO "CommunityScanReceipt";
CREATE INDEX "CommunityScanReceipt_subjectType_subjectId_scannedAt_idx" ON "CommunityScanReceipt"("subjectType", "subjectId", "scannedAt");
CREATE INDEX "CommunityScanReceipt_objectChecksum_result_expiresAt_idx" ON "CommunityScanReceipt"("objectChecksum", "result", "expiresAt");

CREATE TABLE "new_CommunityModerationCaseSubject" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "subjectChecksum" TEXT, "tombstone" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityModerationCaseSubject_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationCaseSubject" SELECT * FROM "CommunityModerationCaseSubject";
DROP TABLE "CommunityModerationCaseSubject";
ALTER TABLE "new_CommunityModerationCaseSubject" RENAME TO "CommunityModerationCaseSubject";
CREATE UNIQUE INDEX "CommunityModerationCaseSubject_caseId_subjectType_subjectId_key" ON "CommunityModerationCaseSubject"("caseId", "subjectType", "subjectId");
CREATE INDEX "CommunityModerationCaseSubject_subjectType_subjectId_idx" ON "CommunityModerationCaseSubject"("subjectType", "subjectId");

CREATE TABLE "new_CommunityModerationCaseReport" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "reportId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityModerationCaseReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "CommunityModerationCaseReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CommunityReport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationCaseReport" SELECT * FROM "CommunityModerationCaseReport";
DROP TABLE "CommunityModerationCaseReport";
ALTER TABLE "new_CommunityModerationCaseReport" RENAME TO "CommunityModerationCaseReport";
CREATE UNIQUE INDEX "CommunityModerationCaseReport_reportId_key" ON "CommunityModerationCaseReport"("reportId");
CREATE INDEX "CommunityModerationCaseReport_caseId_createdAt_idx" ON "CommunityModerationCaseReport"("caseId", "createdAt");

CREATE TABLE "new_CommunityModerationCaseEvidence" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "kind" TEXT NOT NULL, "checksum" TEXT NOT NULL, "schemaVersion" INTEGER NOT NULL DEFAULT 1, "safeSnapshot" TEXT NOT NULL DEFAULT '{}', "accessClass" TEXT NOT NULL DEFAULT 'MODERATOR', "createdBy" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityModerationCaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationCaseEvidence" SELECT * FROM "CommunityModerationCaseEvidence";
DROP TABLE "CommunityModerationCaseEvidence";
ALTER TABLE "new_CommunityModerationCaseEvidence" RENAME TO "CommunityModerationCaseEvidence";
CREATE UNIQUE INDEX "CommunityModerationCaseEvidence_caseId_kind_checksum_key" ON "CommunityModerationCaseEvidence"("caseId", "kind", "checksum");
CREATE INDEX "CommunityModerationCaseEvidence_caseId_createdAt_idx" ON "CommunityModerationCaseEvidence"("caseId", "createdAt");

CREATE TABLE "new_CommunityModerationCaseAssignment" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "moderatorAccountId" TEXT NOT NULL, "assignedByAccountId" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'ASSIGNED', "reasonCode" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endedAt" DATETIME, CONSTRAINT "CommunityModerationCaseAssignment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationCaseAssignment" SELECT * FROM "CommunityModerationCaseAssignment";
DROP TABLE "CommunityModerationCaseAssignment";
ALTER TABLE "new_CommunityModerationCaseAssignment" RENAME TO "CommunityModerationCaseAssignment";
CREATE INDEX "CommunityModerationCaseAssignment_caseId_endedAt_idx" ON "CommunityModerationCaseAssignment"("caseId", "endedAt");
CREATE INDEX "CommunityModerationCaseAssignment_moderatorAccountId_endedAt_idx" ON "CommunityModerationCaseAssignment"("moderatorAccountId", "endedAt");

CREATE TABLE "new_CommunityModerationCaseEvent" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "fromStatus" TEXT, "toStatus" TEXT, "reasonCode" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "detail" TEXT NOT NULL DEFAULT '{}', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityModerationCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationCaseEvent" SELECT * FROM "CommunityModerationCaseEvent";
DROP TABLE "CommunityModerationCaseEvent";
ALTER TABLE "new_CommunityModerationCaseEvent" RENAME TO "CommunityModerationCaseEvent";
CREATE INDEX "CommunityModerationCaseEvent_caseId_createdAt_idx" ON "CommunityModerationCaseEvent"("caseId", "createdAt");

CREATE TABLE "new_CommunityModerationAction" ("id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "actionType" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'APPLIED', "reasonCode" TEXT NOT NULL, "expectedRevision" INTEGER NOT NULL, "idempotencyKey" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL, "secondReviewerId" TEXT, "reversible" BOOLEAN NOT NULL DEFAULT true, "appealEligible" BOOLEAN NOT NULL DEFAULT true, "restorationEligible" BOOLEAN NOT NULL DEFAULT false, "correlationId" TEXT NOT NULL, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "reversedAt" DATETIME, CONSTRAINT "CommunityModerationAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationAction" SELECT * FROM "CommunityModerationAction";
DROP TABLE "CommunityModerationAction";
ALTER TABLE "new_CommunityModerationAction" RENAME TO "CommunityModerationAction";
CREATE UNIQUE INDEX "CommunityModerationAction_idempotencyKey_key" ON "CommunityModerationAction"("idempotencyKey");
CREATE INDEX "CommunityModerationAction_caseId_appliedAt_idx" ON "CommunityModerationAction"("caseId", "appliedAt");
CREATE INDEX "CommunityModerationAction_subjectType_subjectId_state_idx" ON "CommunityModerationAction"("subjectType", "subjectId", "state");

CREATE TABLE "new_CommunitySanction" ("id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "subjectAccountId" TEXT, "sanctionType" TEXT NOT NULL, "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "endsAt" DATETIME, "state" TEXT NOT NULL DEFAULT 'ACTIVE', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunitySanction_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "CommunityModerationAction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunitySanction" SELECT * FROM "CommunitySanction";
DROP TABLE "CommunitySanction";
ALTER TABLE "new_CommunitySanction" RENAME TO "CommunitySanction";
CREATE UNIQUE INDEX "CommunitySanction_actionId_key" ON "CommunitySanction"("actionId");
CREATE INDEX "CommunitySanction_subjectAccountId_state_idx" ON "CommunitySanction"("subjectAccountId", "state");

CREATE TABLE "new_CommunityModerationAppeal" ("id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "appellantAccountId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "reason" TEXT NOT NULL, "filingDeadlineAt" DATETIME NOT NULL, "assignedAccountId" TEXT, "decisionReasonCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, "closedAt" DATETIME, CONSTRAINT "CommunityModerationAppeal_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "CommunityModerationAction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "CommunityModerationAppeal_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationAppeal" SELECT * FROM "CommunityModerationAppeal";
DROP TABLE "CommunityModerationAppeal";
ALTER TABLE "new_CommunityModerationAppeal" RENAME TO "CommunityModerationAppeal";
CREATE UNIQUE INDEX "CommunityModerationAppeal_actionId_appellantAccountId_key" ON "CommunityModerationAppeal"("actionId", "appellantAccountId");
CREATE INDEX "CommunityModerationAppeal_caseId_status_createdAt_idx" ON "CommunityModerationAppeal"("caseId", "status", "createdAt");

CREATE TABLE "new_CommunityModerationAppealEvent" ("id" TEXT NOT NULL PRIMARY KEY, "appealId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "fromStatus" TEXT, "toStatus" TEXT, "reasonCode" TEXT NOT NULL, "actorAccountId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityModerationAppealEvent_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "CommunityModerationAppeal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
INSERT INTO "new_CommunityModerationAppealEvent" SELECT * FROM "CommunityModerationAppealEvent";
DROP TABLE "CommunityModerationAppealEvent";
ALTER TABLE "new_CommunityModerationAppealEvent" RENAME TO "CommunityModerationAppealEvent";
CREATE INDEX "CommunityModerationAppealEvent_appealId_createdAt_idx" ON "CommunityModerationAppealEvent"("appealId", "createdAt");

CREATE TABLE "new_CommunityRestorationReceipt" ("id" TEXT NOT NULL PRIMARY KEY, "actionId" TEXT NOT NULL, "caseId" TEXT NOT NULL, "subjectType" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "objectChecksum" TEXT, "scanReceiptId" TEXT, "packageChecksum" TEXT, "eligibility" TEXT NOT NULL, "restoredBy" TEXT NOT NULL, "correlationId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "CommunityRestorationReceipt_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "CommunityModerationAction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "CommunityRestorationReceipt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CommunityModerationCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "CommunityRestorationReceipt_scanReceiptId_fkey" FOREIGN KEY ("scanReceiptId") REFERENCES "CommunityScanReceipt" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
INSERT INTO "new_CommunityRestorationReceipt" SELECT * FROM "CommunityRestorationReceipt";
DROP TABLE "CommunityRestorationReceipt";
ALTER TABLE "new_CommunityRestorationReceipt" RENAME TO "CommunityRestorationReceipt";
CREATE UNIQUE INDEX "CommunityRestorationReceipt_actionId_key" ON "CommunityRestorationReceipt"("actionId");
CREATE INDEX "CommunityRestorationReceipt_caseId_createdAt_idx" ON "CommunityRestorationReceipt"("caseId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
