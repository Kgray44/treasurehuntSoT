-- Wayfarer Phase 4: immutable artifact receipt projections and achievement facts.
CREATE TABLE "ArtifactGrantReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY, "sessionId" TEXT NOT NULL, "sourceEventId" TEXT NOT NULL, "grantId" TEXT NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1, "artifactDefinitionId" TEXT NOT NULL, "artifactOccurrenceId" TEXT NOT NULL,
  "publishedVersionId" TEXT NOT NULL, "sourceBlockId" TEXT, "recipientPolicy" TEXT NOT NULL,
  "resolvedRecipientMembershipIds" TEXT NOT NULL, "resolvedRecipientProfileIds" TEXT NOT NULL, "discoveringMembershipId" TEXT,
  "requiredCrewRole" TEXT, "sharedInventoryAction" TEXT NOT NULL, "personalGrantState" TEXT NOT NULL, "custodyKind" TEXT NOT NULL,
  "assemblyDefinitionId" TEXT, "componentRole" TEXT, "receiptState" TEXT NOT NULL DEFAULT 'ACTIVE', "occurredAt" DATETIME NOT NULL,
  "correctionOfGrantId" TEXT, "correctionReason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactGrantReceipt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArtifactGrantReceipt_sourceEventId_key" ON "ArtifactGrantReceipt"("sourceEventId");
CREATE UNIQUE INDEX "ArtifactGrantReceipt_grantId_key" ON "ArtifactGrantReceipt"("grantId");
CREATE INDEX "ArtifactGrantReceipt_sessionId_occurredAt_idx" ON "ArtifactGrantReceipt"("sessionId", "occurredAt");
CREATE INDEX "ArtifactGrantReceipt_publishedVersionId_artifactDefinitionId_idx" ON "ArtifactGrantReceipt"("publishedVersionId", "artifactDefinitionId");

CREATE TABLE "PlayerArtifactRecord" (
  "id" TEXT NOT NULL PRIMARY KEY, "playerProfileId" TEXT NOT NULL, "sourcePlaythroughId" TEXT NOT NULL, "sourceGrantEventId" TEXT NOT NULL,
  "sourceGrantSequence" INTEGER NOT NULL, "sourceBlockId" TEXT, "publishedVersionId" TEXT NOT NULL, "publishedVersionChecksum" TEXT NOT NULL,
  "chronicleTitleSnapshot" TEXT NOT NULL, "artifactDefinitionId" TEXT NOT NULL, "artifactNameSnapshot" TEXT NOT NULL,
  "artifactTypeSnapshot" TEXT NOT NULL DEFAULT 'ARTIFACT', "representationSnapshot" TEXT NOT NULL DEFAULT 'FALLBACK',
  "collectionKeySnapshot" TEXT, "assemblyKeySnapshot" TEXT, "componentRoleSnapshot" TEXT, "recipientPolicy" TEXT NOT NULL,
  "recipientEvidence" TEXT NOT NULL DEFAULT '{}', "ownershipState" TEXT NOT NULL, "custody" TEXT NOT NULL DEFAULT 'PERSONAL',
  "recordStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "discoveredAt" DATETIME, "grantedAt" DATETIME, "witnessedAt" DATETIME,
  "revokedAt" DATETIME, "archivedAt" DATETIME, "correctedAt" DATETIME, "correctionReason" TEXT, "sourceFingerprint" TEXT NOT NULL,
  "lastDerivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerArtifactRecord_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerArtifactRecord_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerArtifactRecord_playerProfileId_sourceGrantEventId_key" ON "PlayerArtifactRecord"("playerProfileId", "sourceGrantEventId");
CREATE INDEX "PlayerArtifactRecord_playerProfileId_recordStatus_grantedAt_idx" ON "PlayerArtifactRecord"("playerProfileId", "recordStatus", "grantedAt");
CREATE INDEX "PlayerArtifactRecord_playerProfileId_ownershipState_artifactDefinitionId_idx" ON "PlayerArtifactRecord"("playerProfileId", "ownershipState", "artifactDefinitionId");
CREATE INDEX "PlayerArtifactRecord_sourcePlaythroughId_sourceGrantSequence_idx" ON "PlayerArtifactRecord"("sourcePlaythroughId", "sourceGrantSequence");

CREATE TABLE "PlayerArtifactPersonalization" (
  "id" TEXT NOT NULL PRIMARY KEY, "artifactRecordId" TEXT NOT NULL, "favorite" BOOLEAN NOT NULL DEFAULT false, "privateNote" TEXT,
  "chronicleMemoryId" TEXT, "visibility" TEXT NOT NULL DEFAULT 'ONLY_ME', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerArtifactPersonalization_artifactRecordId_fkey" FOREIGN KEY ("artifactRecordId") REFERENCES "PlayerArtifactRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerArtifactPersonalization_artifactRecordId_key" ON "PlayerArtifactPersonalization"("artifactRecordId");

CREATE TABLE "ArtifactDisplayCase" (
  "id" TEXT NOT NULL PRIMARY KEY, "playerProfileId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "visibility" TEXT NOT NULL DEFAULT 'ONLY_ME',
  "unlistedToken" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ArtifactDisplayCase_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArtifactDisplayCase_unlistedToken_key" ON "ArtifactDisplayCase"("unlistedToken");
CREATE UNIQUE INDEX "ArtifactDisplayCase_playerProfileId_name_key" ON "ArtifactDisplayCase"("playerProfileId", "name");
CREATE INDEX "ArtifactDisplayCase_playerProfileId_visibility_idx" ON "ArtifactDisplayCase"("playerProfileId", "visibility");

CREATE TABLE "ArtifactDisplayItem" (
  "id" TEXT NOT NULL PRIMARY KEY, "displayCaseId" TEXT NOT NULL, "artifactRecordId" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArtifactDisplayItem_displayCaseId_fkey" FOREIGN KEY ("displayCaseId") REFERENCES "ArtifactDisplayCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ArtifactDisplayItem_artifactRecordId_fkey" FOREIGN KEY ("artifactRecordId") REFERENCES "PlayerArtifactRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArtifactDisplayItem_displayCaseId_artifactRecordId_key" ON "ArtifactDisplayItem"("displayCaseId", "artifactRecordId");
CREATE UNIQUE INDEX "ArtifactDisplayItem_displayCaseId_position_key" ON "ArtifactDisplayItem"("displayCaseId", "position");
CREATE INDEX "ArtifactDisplayItem_artifactRecordId_idx" ON "ArtifactDisplayItem"("artifactRecordId");

CREATE TABLE "PlayerArtifactAssembly" (
  "id" TEXT NOT NULL PRIMARY KEY, "playerProfileId" TEXT NOT NULL, "publishedVersionId" TEXT NOT NULL, "sourcePlaythroughId" TEXT NOT NULL,
  "assemblyKeySnapshot" TEXT NOT NULL, "assembledArtifactName" TEXT NOT NULL, "recipeSnapshot" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "completedAt" DATETIME, "sourceFingerprint" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerArtifactAssembly_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerArtifactAssembly_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerArtifactAssembly_playerProfileId_sourcePlaythroughId_assemblyKeySnapshot_key" ON "PlayerArtifactAssembly"("playerProfileId", "sourcePlaythroughId", "assemblyKeySnapshot");
CREATE INDEX "PlayerArtifactAssembly_playerProfileId_status_completedAt_idx" ON "PlayerArtifactAssembly"("playerProfileId", "status", "completedAt");

CREATE TABLE "PlayerArtifactContribution" (
  "id" TEXT NOT NULL PRIMARY KEY, "assemblyId" TEXT NOT NULL, "artifactRecordId" TEXT NOT NULL, "componentKey" TEXT NOT NULL, "componentRole" TEXT,
  "state" TEXT NOT NULL DEFAULT 'ACTIVE', "contributedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerArtifactContribution_assemblyId_fkey" FOREIGN KEY ("assemblyId") REFERENCES "PlayerArtifactAssembly" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerArtifactContribution_artifactRecordId_fkey" FOREIGN KEY ("artifactRecordId") REFERENCES "PlayerArtifactRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerArtifactContribution_assemblyId_artifactRecordId_key" ON "PlayerArtifactContribution"("assemblyId", "artifactRecordId");
CREATE INDEX "PlayerArtifactContribution_artifactRecordId_state_idx" ON "PlayerArtifactContribution"("artifactRecordId", "state");

CREATE TABLE "AchievementDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "definitionVersion" INTEGER NOT NULL DEFAULT 1, "scope" TEXT NOT NULL DEFAULT 'GLOBAL', "publishedVersionId" TEXT,
  "titleSnapshot" TEXT NOT NULL, "descriptionSnapshot" TEXT NOT NULL, "criteria" TEXT NOT NULL, "activeFrom" DATETIME, "inactiveAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "AchievementDefinition_key_definitionVersion_key" ON "AchievementDefinition"("key", "definitionVersion");
CREATE INDEX "AchievementDefinition_scope_publishedVersionId_inactiveAt_idx" ON "AchievementDefinition"("scope", "publishedVersionId", "inactiveAt");

CREATE TABLE "PlayerAchievement" (
  "id" TEXT NOT NULL PRIMARY KEY, "playerProfileId" TEXT NOT NULL, "achievementDefinitionId" TEXT NOT NULL, "definitionVersion" INTEGER NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'EARNED', "evidenceSnapshot" TEXT NOT NULL, "sourceFingerprint" TEXT NOT NULL, "earnedAt" DATETIME, "revokedAt" DATETIME,
  "correctedAt" DATETIME, "correctionReason" TEXT, "showcased" BOOLEAN NOT NULL DEFAULT false, "visibility" TEXT NOT NULL DEFAULT 'ONLY_ME',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PlayerAchievement_playerProfileId_fkey" FOREIGN KEY ("playerProfileId") REFERENCES "PlayerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlayerAchievement_achievementDefinitionId_fkey" FOREIGN KEY ("achievementDefinitionId") REFERENCES "AchievementDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerAchievement_playerProfileId_achievementDefinitionId_key" ON "PlayerAchievement"("playerProfileId", "achievementDefinitionId");
CREATE INDEX "PlayerAchievement_playerProfileId_state_earnedAt_idx" ON "PlayerAchievement"("playerProfileId", "state", "earnedAt");

INSERT INTO "AchievementDefinition" ("id", "key", "definitionVersion", "scope", "titleSnapshot", "descriptionSnapshot", "criteria", "createdAt", "updatedAt")
SELECT 'wayfarer-phase4-first-artifact-v1', 'FIRST_PERSONAL_ARTIFACT', 1, 'GLOBAL', 'First personal artifact', 'Receive an authoritative personal artifact grant.', '{"kind":"ARTIFACT_COUNT","minimum":1}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "AchievementDefinition" WHERE "key" = 'FIRST_PERSONAL_ARTIFACT' AND "definitionVersion" = 1);
