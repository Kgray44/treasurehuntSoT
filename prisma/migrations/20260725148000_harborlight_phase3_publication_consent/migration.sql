-- Harborlight owns this purpose-specific public-publication consent. It never
-- stores Wayfarer's private consent or private history.
ALTER TABLE "CommunityVoyageLog" ADD COLUMN "lifecycleState" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "CommunityVoyageLog" ADD COLUMN "consentRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommunityVoyageLog" ADD COLUMN "projectionChecksum" TEXT;
ALTER TABLE "CommunityVoyageLog" ADD COLUMN "searchIndexedAt" DATETIME;
ALTER TABLE "CommunityVoyageLog" ADD COLUMN "openGraphInvalidatedAt" DATETIME;
UPDATE "CommunityVoyageLog" SET "lifecycleState" = 'PUBLISHED' WHERE "publishedAt" IS NOT NULL AND "visibility" = 'COMMUNITY';

ALTER TABLE "CommunityVoyageLogParticipantConsent" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "CommunityVoyageLogParticipantConsent" ADD COLUMN "requestedAt" DATETIME;
ALTER TABLE "CommunityVoyageLogParticipantConsent" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "CommunityVoyageLogParticipantConsent" ADD COLUMN "updatedAt" DATETIME;
UPDATE "CommunityVoyageLogParticipantConsent"
  SET "state" = CASE WHEN "revokedAt" IS NOT NULL THEN 'REVOKED' WHEN "grantedAt" IS NOT NULL THEN 'APPROVED' ELSE 'PENDING' END,
      "updatedAt" = CURRENT_TIMESTAMP;

CREATE TABLE "CommunityVoyageLogConsentAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voyageLogId" TEXT NOT NULL,
  "participantId" TEXT,
  "actorAccountId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CommunityVoyageLogConsentAudit_voyageLogId_occurredAt_idx" ON "CommunityVoyageLogConsentAudit"("voyageLogId", "occurredAt");
CREATE INDEX "CommunityVoyageLogConsentAudit_participantId_occurredAt_idx" ON "CommunityVoyageLogConsentAudit"("participantId", "occurredAt");
