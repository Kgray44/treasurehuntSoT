CREATE TABLE "DrydockValidationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "sourceRevision" INTEGER NOT NULL,
    "reportSchemaVersion" INTEGER NOT NULL,
    "ruleCatalogVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "proofCompleteness" TEXT NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "issueDigest" TEXT NOT NULL,
    "reportDigest" TEXT NOT NULL,
    "report" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrydockValidationRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DrydockValidationRun_runId_key" ON "DrydockValidationRun"("runId");
CREATE INDEX "DrydockValidationRun_draftId_createdAt_idx" ON "DrydockValidationRun"("draftId", "createdAt");
CREATE INDEX "DrydockValidationRun_sourceChecksum_idx" ON "DrydockValidationRun"("sourceChecksum");
