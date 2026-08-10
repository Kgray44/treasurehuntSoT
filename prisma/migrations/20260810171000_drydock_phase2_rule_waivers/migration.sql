CREATE TABLE "DrydockRuleWaiver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "authorizedByAccountId" TEXT NOT NULL,
    "authorizedRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "reviewCondition" TEXT,
    "carryForwardPolicy" TEXT NOT NULL DEFAULT 'DO_NOT_CARRY',
    "revokedAt" DATETIME,
    "auditReference" TEXT,
    CONSTRAINT "DrydockRuleWaiver_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrydockRuleWaiver_authorizedByAccountId_fkey" FOREIGN KEY ("authorizedByAccountId") REFERENCES "UserAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DrydockRuleWaiver_draftId_createdAt_idx" ON "DrydockRuleWaiver"("draftId", "createdAt");
CREATE INDEX "DrydockRuleWaiver_issueId_sourceChecksum_idx" ON "DrydockRuleWaiver"("issueId", "sourceChecksum");
CREATE INDEX "DrydockRuleWaiver_authorizedByAccountId_createdAt_idx" ON "DrydockRuleWaiver"("authorizedByAccountId", "createdAt");
