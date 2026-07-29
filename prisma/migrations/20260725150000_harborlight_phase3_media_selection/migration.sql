-- Persist opaque Sealed Hold identity and checksums only; no bytes or storage key is exposed publicly.
ALTER TABLE "CommunityVoyageLogMedia" ADD COLUMN "sourceChecksum" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CommunityVoyageLogMedia" ADD COLUMN "subjectParticipantId" TEXT;
ALTER TABLE "CommunityVoyageLogMedia" ADD COLUMN "detectedMediaType" TEXT NOT NULL DEFAULT 'application/octet-stream';
CREATE UNIQUE INDEX "CommunityVoyageLogMedia_voyageLogId_privateMediaReference_key" ON "CommunityVoyageLogMedia"("voyageLogId", "privateMediaReference");
