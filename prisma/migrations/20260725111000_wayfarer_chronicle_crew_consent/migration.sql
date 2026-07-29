-- Phase 3 completion: durable crew snapshots and scoped Keepsake consent.
CREATE TABLE "PlayerChronicleParticipantSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "historyRecordId" TEXT NOT NULL,
  "sourceMembershipId" TEXT NOT NULL,
  "participantProfileId" TEXT,
  "displayNameSnapshot" TEXT NOT NULL,
  "avatarAltSnapshot" TEXT,
  "participationRole" TEXT NOT NULL,
  "crewRoleSnapshot" TEXT,
  "joinedAt" DATETIME,
  "completedAt" DATETIME,
  "removedAt" DATETIME,
  "projectionEligibility" TEXT NOT NULL DEFAULT 'ONLY_ME',
  "tombstoneState" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerChronicleParticipantSnapshot_historyRecordId_fkey" FOREIGN KEY ("historyRecordId") REFERENCES "PlayerChronicleRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerChronicleParticipantSnapshot_historyRecordId_sourceMembershipId_key" ON "PlayerChronicleParticipantSnapshot"("historyRecordId", "sourceMembershipId");
CREATE INDEX "PlayerChronicleParticipantSnapshot_historyRecordId_projectionEligibility_idx" ON "PlayerChronicleParticipantSnapshot"("historyRecordId", "projectionEligibility");

ALTER TABLE "VoyageKeepsakeConsent" RENAME TO "VoyageKeepsakeConsent_old";
CREATE TABLE "VoyageKeepsakeConsent" (
  "id" TEXT NOT NULL PRIMARY KEY, "keepsakeId" TEXT NOT NULL, "participantId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'GENERAL_MEDIA', "state" TEXT NOT NULL DEFAULT 'PENDING', "historicalLabel" TEXT,
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "decidedAt" DATETIME, "requestedByProfileId" TEXT, "correlationId" TEXT,
  "grantedAt" DATETIME, "revokedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "VoyageKeepsakeConsent_keepsakeId_fkey" FOREIGN KEY ("keepsakeId") REFERENCES "VoyageKeepsake" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VoyageKeepsakeConsent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "VoyageKeepsakeConsent" ("id","keepsakeId","participantId","scope","state","requestedAt","decidedAt","grantedAt","revokedAt","createdAt","updatedAt") SELECT "id","keepsakeId","participantId",'GENERAL_MEDIA',CASE WHEN "granted" THEN 'GRANTED' WHEN "revokedAt" IS NOT NULL THEN 'REVOKED' ELSE 'PENDING' END,"createdAt",CASE WHEN "granted" OR "revokedAt" IS NOT NULL THEN "updatedAt" ELSE NULL END,"grantedAt","revokedAt","createdAt","updatedAt" FROM "VoyageKeepsakeConsent_old";
DROP TABLE "VoyageKeepsakeConsent_old";
CREATE UNIQUE INDEX "VoyageKeepsakeConsent_keepsakeId_participantId_scope_key" ON "VoyageKeepsakeConsent"("keepsakeId", "participantId", "scope");
CREATE INDEX "VoyageKeepsakeConsent_participantId_state_idx" ON "VoyageKeepsakeConsent"("participantId", "state");
