CREATE TABLE "ProtectedMediaConsentAssertion" (
  "id" TEXT NOT NULL PRIMARY KEY, "authority" TEXT NOT NULL, "authorityRecordOpaqueId" TEXT NOT NULL, "authorityRevision" TEXT NOT NULL,
  "subjectOpaqueId" TEXT NOT NULL, "subjectParticipantOpaqueId" TEXT, "consumingAggregateKind" TEXT NOT NULL,
  "consumingAggregateOpaqueId" TEXT NOT NULL, "purpose" TEXT NOT NULL, "scopes" TEXT NOT NULL, "state" TEXT NOT NULL,
  "sourceProtectedMediaId" TEXT NOT NULL, "sourceChecksum" TEXT NOT NULL, "requestedTransformationPolicy" TEXT NOT NULL,
  "derivativeId" TEXT, "derivativeChecksum" TEXT, "validFrom" DATETIME NOT NULL, "validUntil" DATETIME, "revokedAt" DATETIME,
  "sourceWatermark" TEXT NOT NULL, "assertionDigest" TEXT NOT NULL UNIQUE, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("sourceProtectedMediaId") REFERENCES "ProtectedMedia"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProtectedMediaConsentAssertion_authority_idx" ON "ProtectedMediaConsentAssertion"("authority", "authorityRecordOpaqueId", "authorityRevision");
CREATE INDEX "ProtectedMediaConsentAssertion_source_idx" ON "ProtectedMediaConsentAssertion"("sourceProtectedMediaId", "state");
