-- Public-media approval is bound to this exact opaque Sealed Hold identity,
-- original checksum, and separate sanitized derivative. No storage key is copied.
ALTER TABLE "CommunityVoyageLogMediaConsent" ADD COLUMN "approvedOpaqueMediaId" TEXT;
ALTER TABLE "CommunityVoyageLogMediaConsent" ADD COLUMN "approvedSourceChecksum" TEXT;
ALTER TABLE "CommunityVoyageLogMediaConsent" ADD COLUMN "approvedDerivativeChecksum" TEXT;
ALTER TABLE "CommunityVoyageLogMediaConsent" ADD COLUMN "subjectParticipantId" TEXT;
CREATE INDEX "CommunityVoyageLogMediaConsent_subjectParticipantId_idx" ON "CommunityVoyageLogMediaConsent"("subjectParticipantId");
