CREATE TABLE "ParallaxResolutionDecision" (
  "id" TEXT NOT NULL PRIMARY KEY, "scopeKey" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL, "versionId" TEXT NOT NULL,
  "versionChecksum" TEXT NOT NULL, "policy" TEXT NOT NULL, "seed" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ParallaxResolutionDecision_scopeKey_key" ON "ParallaxResolutionDecision"("scopeKey");
CREATE INDEX "ParallaxResolutionDecision_definitionId_versionId_idx" ON "ParallaxResolutionDecision"("definitionId", "versionId");
CREATE TABLE "ParallaxFieldObservation" (
  "id" TEXT NOT NULL PRIMARY KEY, "definitionId" TEXT NOT NULL, "versionId" TEXT NOT NULL,
  "versionChecksum" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "blockId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "digest" TEXT NOT NULL,
  "metadata" TEXT NOT NULL, "provenance" TEXT NOT NULL, "consentRevision" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" DATETIME NOT NULL, "withdrawnAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ParallaxFieldObservation_sessionId_actorId_idempotencyKey_key" ON "ParallaxFieldObservation"("sessionId", "actorId", "idempotencyKey");
CREATE INDEX "ParallaxFieldObservation_definitionId_expiresAt_idx" ON "ParallaxFieldObservation"("definitionId", "expiresAt");
CREATE TABLE "ParallaxCalibrationReview" (
  "id" TEXT NOT NULL PRIMARY KEY, "definitionId" TEXT NOT NULL, "versionId" TEXT NOT NULL,
  "ownerAccountId" TEXT NOT NULL, "evidenceId" TEXT NOT NULL, "recipeDigest" TEXT NOT NULL,
  "maturity" TEXT NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ParallaxCalibrationReview_definitionId_ownerAccountId_idx" ON "ParallaxCalibrationReview"("definitionId", "ownerAccountId");
CREATE TABLE "ParallaxFieldAudit" (
  "id" TEXT NOT NULL PRIMARY KEY, "recordId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ParallaxFieldAudit_recordId_createdAt_idx" ON "ParallaxFieldAudit"("recordId", "createdAt");
