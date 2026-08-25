ALTER TABLE "DrydockScenarioSuite" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "DrydockScenarioSuiteEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draftId" TEXT NOT NULL,
  "suiteRecordId" TEXT NOT NULL,
  "suiteRevision" INTEGER NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "schemaRegistryVersion" INTEGER NOT NULL,
  "ruleCatalogVersion" INTEGER NOT NULL,
  "runtimeAdapterVersion" TEXT NOT NULL,
  "requiredSuitePolicyVersion" TEXT NOT NULL,
  "compatibilityPolicyVersion" TEXT NOT NULL,
  "runIds" TEXT NOT NULL,
  "coverageDigest" TEXT NOT NULL,
  "proofStatus" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrydockScenarioSuiteEvidence_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DrydockScenarioSuiteEvidence_suiteRecordId_fkey" FOREIGN KEY ("suiteRecordId") REFERENCES "DrydockScenarioSuite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DrydockScenarioSuiteEvidence_draftId_sourceChecksum_createdAt_idx" ON "DrydockScenarioSuiteEvidence"("draftId", "sourceChecksum", "createdAt");
CREATE INDEX "DrydockScenarioSuiteEvidence_suiteRecordId_suiteRevision_createdAt_idx" ON "DrydockScenarioSuiteEvidence"("suiteRecordId", "suiteRevision", "createdAt");
CREATE INDEX "DrydockScenarioSuiteEvidence_sourceChecksum_proofStatus_idx" ON "DrydockScenarioSuiteEvidence"("sourceChecksum", "proofStatus");
