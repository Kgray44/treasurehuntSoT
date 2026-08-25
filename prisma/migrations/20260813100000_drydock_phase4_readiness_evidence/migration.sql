CREATE TABLE "DrydockCompatibilityRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draftId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrydockCompatibilityRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DrydockCompatibilityRun_runId_key" ON "DrydockCompatibilityRun"("runId");
CREATE INDEX "DrydockCompatibilityRun_draftId_createdAt_idx" ON "DrydockCompatibilityRun"("draftId", "createdAt");
CREATE INDEX "DrydockCompatibilityRun_sourceChecksum_status_idx" ON "DrydockCompatibilityRun"("sourceChecksum", "status");

CREATE TABLE "DrydockExternalEvidenceReference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "draftId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "providerVersion" TEXT NOT NULL,
  "evidenceKind" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "sourceReference" TEXT,
  "checkedAt" DATETIME NOT NULL,
  "expiresAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrydockExternalEvidenceReference_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TaleDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DrydockExternalEvidenceReference_draftId_providerId_providerVersion_evidenceKind_sourceChecksum_key" ON "DrydockExternalEvidenceReference"("draftId", "providerId", "providerVersion", "evidenceKind", "sourceChecksum");
CREATE INDEX "DrydockExternalEvidenceReference_draftId_sourceChecksum_idx" ON "DrydockExternalEvidenceReference"("draftId", "sourceChecksum");
CREATE INDEX "DrydockExternalEvidenceReference_status_expiresAt_idx" ON "DrydockExternalEvidenceReference"("status", "expiresAt");

CREATE TABLE "DrydockPublishingEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publishedVersionId" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL,
  "schemaRegistryVersion" INTEGER NOT NULL,
  "ruleCatalogVersion" INTEGER NOT NULL,
  "validationRunId" TEXT NOT NULL,
  "requiredSuitePolicyVersion" TEXT NOT NULL,
  "compatibilityPolicyVersion" TEXT NOT NULL,
  "compatibilityDigest" TEXT NOT NULL,
  "externalEvidenceDigest" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrydockPublishingEvidence_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DrydockPublishingEvidence_publishedVersionId_key" ON "DrydockPublishingEvidence"("publishedVersionId");
CREATE UNIQUE INDEX "DrydockPublishingEvidence_digest_key" ON "DrydockPublishingEvidence"("digest");
CREATE INDEX "DrydockPublishingEvidence_sourceChecksum_idx" ON "DrydockPublishingEvidence"("sourceChecksum");
CREATE INDEX "DrydockPublishingEvidence_createdAt_idx" ON "DrydockPublishingEvidence"("createdAt");
