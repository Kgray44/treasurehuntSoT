CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseNumber" TEXT NOT NULL,
    "requestingOperatorId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "supportAccessRequestId" TEXT,
    "title" TEXT NOT NULL,
    "safeSummary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_CONSENT',
    "correlationId" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportCase_requestingOperatorId_fkey" FOREIGN KEY ("requestingOperatorId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportCase_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportCase_supportAccessRequestId_fkey" FOREIGN KEY ("supportAccessRequestId") REFERENCES "SupportAccessRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportCase_caseNumber_key" ON "SupportCase"("caseNumber");
CREATE UNIQUE INDEX "SupportCase_supportAccessRequestId_key" ON "SupportCase"("supportAccessRequestId");
CREATE UNIQUE INDEX "SupportCase_correlationId_key" ON "SupportCase"("correlationId");
CREATE INDEX "SupportCase_requestingOperatorId_status_openedAt_idx" ON "SupportCase"("requestingOperatorId", "status", "openedAt");
CREATE INDEX "SupportCase_targetAccountId_status_openedAt_idx" ON "SupportCase"("targetAccountId", "status", "openedAt");

CREATE TABLE "SupportExecutionGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportCaseId" TEXT NOT NULL,
    "parentSupportGrantId" TEXT NOT NULL,
    "operatorAccountId" TEXT NOT NULL,
    "targetAccountId" TEXT NOT NULL,
    "grantedScopes" TEXT NOT NULL,
    "dataClasses" TEXT NOT NULL,
    "riskCeiling" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "correlationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportExecutionGrant_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportExecutionGrant_parentSupportGrantId_fkey" FOREIGN KEY ("parentSupportGrantId") REFERENCES "SupportAccessGrant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportExecutionGrant_operatorAccountId_fkey" FOREIGN KEY ("operatorAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportExecutionGrant_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportExecutionGrant_correlationId_key" ON "SupportExecutionGrant"("correlationId");
CREATE INDEX "SupportExecutionGrant_supportCaseId_status_expiresAt_idx" ON "SupportExecutionGrant"("supportCaseId", "status", "expiresAt");
CREATE INDEX "SupportExecutionGrant_operatorAccountId_targetAccountId_status_expiresAt_idx" ON "SupportExecutionGrant"("operatorAccountId", "targetAccountId", "status", "expiresAt");

CREATE TABLE "SupportExecutionSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportCaseId" TEXT NOT NULL,
    "supportExecutionGrantId" TEXT,
    "operatorAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "queriedDomains" TEXT NOT NULL DEFAULT '[]',
    "dataClasses" TEXT NOT NULL DEFAULT '[]',
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    "deniedAccessCount" INTEGER NOT NULL DEFAULT 0,
    "denialCode" TEXT,
    "receiptDigest" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "correlationId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportExecutionSession_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportExecutionSession_supportExecutionGrantId_fkey" FOREIGN KEY ("supportExecutionGrantId") REFERENCES "SupportExecutionGrant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportExecutionSession_operatorAccountId_fkey" FOREIGN KEY ("operatorAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportExecutionSession_correlationId_key" ON "SupportExecutionSession"("correlationId");
CREATE INDEX "SupportExecutionSession_supportCaseId_startedAt_idx" ON "SupportExecutionSession"("supportCaseId", "startedAt");
CREATE INDEX "SupportExecutionSession_supportExecutionGrantId_startedAt_idx" ON "SupportExecutionSession"("supportExecutionGrantId", "startedAt");

CREATE TABLE "SupportObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportExecutionSessionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "dataClassification" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "safeSummary" TEXT NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportObservation_supportExecutionSessionId_fkey" FOREIGN KEY ("supportExecutionSessionId") REFERENCES "SupportExecutionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportObservation_supportExecutionSessionId_domain_observedAt_idx" ON "SupportObservation"("supportExecutionSessionId", "domain", "observedAt");

CREATE TABLE "SupportEvidenceReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportExecutionSessionId" TEXT NOT NULL,
    "supportObservationId" TEXT,
    "sourceDomain" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "dataClassification" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "sanitizedExcerpt" TEXT NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportEvidenceReference_supportExecutionSessionId_fkey" FOREIGN KEY ("supportExecutionSessionId") REFERENCES "SupportExecutionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportEvidenceReference_supportObservationId_fkey" FOREIGN KEY ("supportObservationId") REFERENCES "SupportObservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "SupportEvidenceReference_supportExecutionSessionId_sourceDomain_observedAt_idx" ON "SupportEvidenceReference"("supportExecutionSessionId", "sourceDomain", "observedAt");

CREATE TABLE "SupportFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportExecutionSessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "uncertainty" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportFinding_supportExecutionSessionId_fkey" FOREIGN KEY ("supportExecutionSessionId") REFERENCES "SupportExecutionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportFinding_supportExecutionSessionId_confidence_idx" ON "SupportFinding"("supportExecutionSessionId", "confidence");

CREATE TABLE "SupportFindingEvidence" (
    "supportFindingId" TEXT NOT NULL,
    "supportEvidenceReferenceId" TEXT NOT NULL,
    PRIMARY KEY ("supportFindingId", "supportEvidenceReferenceId"),
    CONSTRAINT "SupportFindingEvidence_supportFindingId_fkey" FOREIGN KEY ("supportFindingId") REFERENCES "SupportFinding" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupportFindingEvidence_supportEvidenceReferenceId_fkey" FOREIGN KEY ("supportEvidenceReferenceId") REFERENCES "SupportEvidenceReference" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SupportDiagnosis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportExecutionSessionId" TEXT NOT NULL,
    "primaryCause" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "uncertainty" TEXT NOT NULL,
    "unresolvedQuestions" TEXT NOT NULL DEFAULT '[]',
    "evidenceDigest" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportDiagnosis_supportExecutionSessionId_fkey" FOREIGN KEY ("supportExecutionSessionId") REFERENCES "SupportExecutionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportDiagnosis_supportExecutionSessionId_key" ON "SupportDiagnosis"("supportExecutionSessionId");

CREATE TABLE "SupportRepairProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supportExecutionSessionId" TEXT NOT NULL,
    "proposalType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "requiredUserConsent" BOOLEAN NOT NULL DEFAULT false,
    "requiresAdministrator" BOOLEAN NOT NULL DEFAULT true,
    "state" TEXT NOT NULL DEFAULT 'INFORMATION_ONLY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRepairProposal_supportExecutionSessionId_fkey" FOREIGN KEY ("supportExecutionSessionId") REFERENCES "SupportExecutionSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SupportRepairProposal_supportExecutionSessionId_state_idx" ON "SupportRepairProposal"("supportExecutionSessionId", "state");
