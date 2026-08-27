ALTER TABLE "SupportAccessRequest" ADD COLUMN "requestedRepairIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SupportAccessGrant" ADD COLUMN "grantedRepairIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SupportAccessGrant" ADD COLUMN "maximumRiskClass" TEXT NOT NULL DEFAULT 'R0';
ALTER TABLE "SupportCase" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SupportExecutionGrant" ADD COLUMN "permittedRepairIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "maximumRiskClass" TEXT NOT NULL DEFAULT 'R0';
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "maximumCommands" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "remainingCommands" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "maximumAffectedRecords" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "remainingAffectedRecords" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "maximumDomains" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SupportExecutionGrant" ADD COLUMN "usedDomains" TEXT NOT NULL DEFAULT '[]';

ALTER TABLE "SupportRepairProposal" ADD COLUMN "repairId" TEXT;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "targetType" TEXT;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "targetId" TEXT;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "targetRevision" TEXT;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "proposalRevision" INTEGER;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "preview" TEXT;
ALTER TABLE "SupportRepairProposal" ADD COLUMN "requiresHumanApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SupportRepairExecution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportCaseId" TEXT NOT NULL,
    "supportExecutionGrantId" TEXT NOT NULL,
    "supportRepairProposalId" TEXT NOT NULL,
    "repairId" TEXT NOT NULL,
    "registrySchemaVersion" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetRevision" TEXT NOT NULL,
    "proposalRevision" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationState" TEXT NOT NULL DEFAULT 'PENDING',
    "rollbackState" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "affectedRecords" INTEGER NOT NULL,
    "ownerReceipt" TEXT,
    "resultSummary" TEXT NOT NULL DEFAULT '{}',
    "failureCode" TEXT,
    "correlationId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" DATETIME,
    "verifiedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRepairExecution_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportRepairExecution_supportExecutionGrantId_fkey" FOREIGN KEY ("supportExecutionGrantId") REFERENCES "SupportExecutionGrant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportRepairExecution_supportRepairProposalId_fkey" FOREIGN KEY ("supportRepairProposalId") REFERENCES "SupportRepairProposal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportRepairExecution_idempotencyKey_key" ON "SupportRepairExecution"("idempotencyKey");
CREATE UNIQUE INDEX "SupportRepairExecution_correlationId_key" ON "SupportRepairExecution"("correlationId");
CREATE INDEX "SupportRepairExecution_supportCaseId_state_startedAt_idx" ON "SupportRepairExecution"("supportCaseId", "state", "startedAt");
CREATE INDEX "SupportRepairExecution_supportExecutionGrantId_state_startedAt_idx" ON "SupportRepairExecution"("supportExecutionGrantId", "state", "startedAt");
CREATE INDEX "SupportRepairExecution_targetType_targetId_state_idx" ON "SupportRepairExecution"("targetType", "targetId", "state");

CREATE TABLE "SupportRepairLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "supportCaseId" TEXT NOT NULL,
    "supportRepairExecutionId" TEXT,
    "leaseToken" TEXT NOT NULL,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "releasedAt" DATETIME,
    CONSTRAINT "SupportRepairLease_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportRepairLease_targetType_targetId_key" ON "SupportRepairLease"("targetType", "targetId");
CREATE UNIQUE INDEX "SupportRepairLease_supportRepairExecutionId_key" ON "SupportRepairLease"("supportRepairExecutionId");
CREATE UNIQUE INDEX "SupportRepairLease_leaseToken_key" ON "SupportRepairLease"("leaseToken");
CREATE INDEX "SupportRepairLease_supportCaseId_expiresAt_idx" ON "SupportRepairLease"("supportCaseId", "expiresAt");
