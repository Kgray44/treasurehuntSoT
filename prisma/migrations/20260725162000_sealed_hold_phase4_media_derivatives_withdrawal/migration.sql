CREATE TABLE "ProtectedMediaDerivative" (
  "id" TEXT NOT NULL PRIMARY KEY, "sourceProtectedMediaId" TEXT NOT NULL, "sourcePrivateAssetObjectId" TEXT NOT NULL,
  "derivativeObjectId" TEXT NOT NULL, "sourceChecksum" TEXT NOT NULL, "transformationPolicy" TEXT NOT NULL,
  "transformationPolicyVersion" INTEGER NOT NULL, "purpose" TEXT NOT NULL, "mediaKind" TEXT NOT NULL, "outputMediaType" TEXT NOT NULL,
  "outputByteLength" INTEGER NOT NULL, "outputChecksum" TEXT NOT NULL, "width" INTEGER, "height" INTEGER, "durationMilliseconds" INTEGER,
  "storageNamespace" TEXT NOT NULL DEFAULT 'derivatives', "storageOpaqueReference" TEXT NOT NULL UNIQUE, "wrappedKeyReference" TEXT,
  "scanState" TEXT NOT NULL, "state" TEXT NOT NULL, "operationId" TEXT NOT NULL, "supersedesDerivativeId" TEXT,
  "verifiedAt" DATETIME, "readyAt" DATETIME, "withdrawnAt" DATETIME, "failureCode" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sourceProtectedMediaId") REFERENCES "ProtectedMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("sourcePrivateAssetObjectId") REFERENCES "PrivateAssetObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("derivativeObjectId") REFERENCES "PrivateAssetObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("operationId") REFERENCES "PrivateContentOperation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ProtectedMediaDerivative_identity_key" ON "ProtectedMediaDerivative"("sourceProtectedMediaId", "purpose", "transformationPolicy", "transformationPolicyVersion", "outputChecksum");
CREATE INDEX "ProtectedMediaDerivative_state_scanState_createdAt_idx" ON "ProtectedMediaDerivative"("state", "scanState", "createdAt");
CREATE TABLE "ProtectedMediaGrant" (
  "id" TEXT NOT NULL PRIMARY KEY, "protectedMediaId" TEXT NOT NULL, "derivativeId" TEXT, "associationId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL, "audience" TEXT NOT NULL, "consumingAuthority" TEXT NOT NULL, "consumingAggregateKind" TEXT NOT NULL,
  "consumingAggregateOpaqueId" TEXT NOT NULL, "authorizationRevision" TEXT NOT NULL, "consentAssertionId" TEXT, "state" TEXT NOT NULL,
  "activeFrom" DATETIME NOT NULL, "expiresAt" DATETIME, "revokedAt" DATETIME, "revocationReasonCode" TEXT, "createdByAccountId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("protectedMediaId") REFERENCES "ProtectedMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("derivativeId") REFERENCES "ProtectedMediaDerivative"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("associationId") REFERENCES "ProtectedMediaAssociation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("consentAssertionId") REFERENCES "ProtectedMediaConsentAssertion"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ProtectedMediaGrant_derivativeId_state_idx" ON "ProtectedMediaGrant"("derivativeId", "state");
CREATE TABLE "ProtectedMediaTransformationReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY, "derivativeId" TEXT NOT NULL UNIQUE, "sourceProtectedMediaOpaqueId" TEXT NOT NULL,
  "sourceChecksum" TEXT NOT NULL, "policyName" TEXT NOT NULL, "policyVersion" INTEGER NOT NULL, "outputChecksum" TEXT NOT NULL,
  "outputByteLength" INTEGER NOT NULL, "outputMediaType" TEXT NOT NULL, "safeMetadata" TEXT NOT NULL, "scanReceiptOpaqueId" TEXT,
  "operationCorrelation" TEXT NOT NULL, "startedAt" DATETIME NOT NULL, "completedAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("derivativeId") REFERENCES "ProtectedMediaDerivative"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "ProtectedMediaWithdrawal" (
  "id" TEXT NOT NULL PRIMARY KEY, "protectedMediaId" TEXT NOT NULL, "derivativeId" TEXT, "reasonCode" TEXT NOT NULL,
  "actorAccountId" TEXT, "consumerInvalidationState" TEXT NOT NULL DEFAULT 'PENDING', "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("protectedMediaId") REFERENCES "ProtectedMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("derivativeId") REFERENCES "ProtectedMediaDerivative"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
