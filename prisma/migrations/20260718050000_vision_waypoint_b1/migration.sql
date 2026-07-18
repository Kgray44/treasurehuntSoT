-- CreateTable
CREATE TABLE "VisionWaypoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "locationTags" TEXT NOT NULL DEFAULT '[]',
    "sharingScope" TEXT NOT NULL DEFAULT 'PRIVATE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionWaypoint_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "GameMasterUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionWaypointVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "parentVersionId" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "verificationProfile" TEXT NOT NULL DEFAULT 'BALANCED',
    "packageSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "draftConfiguration" TEXT NOT NULL DEFAULT '{}',
    "packageArtifactReference" TEXT,
    "compatibilityMetadata" TEXT NOT NULL DEFAULT '{}',
    "certificationReference" TEXT,
    "createdBy" TEXT NOT NULL,
    "publishedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME,
    "deprecatedAt" DATETIME,
    CONSTRAINT "VisionWaypointVersion_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "VisionWaypoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionWaypointVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VisionWaypointVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "GameMasterUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionWaypointVersion_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "GameMasterUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionWaypointPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "packageHash" TEXT NOT NULL,
    "packageSchemaVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,
    "compatibilityRange" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "VisionWaypointPublication_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionWaypointPublication_publishedBy_fkey" FOREIGN KEY ("publishedBy") REFERENCES "GameMasterUser" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionCaptureSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "companionVersion" TEXT,
    "captureResolution" TEXT,
    "frameRate" REAL,
    "durationMs" INTEGER,
    "hardwarePath" TEXT,
    "consentFlags" TEXT NOT NULL DEFAULT '{}',
    "retentionPolicy" TEXT NOT NULL DEFAULT 'DERIVED_ONLY',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "VisionCaptureSession_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionRecordingAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "captureSessionId" TEXT,
    "assetType" TEXT NOT NULL,
    "storageReference" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "datasetPartition" TEXT NOT NULL DEFAULT 'UNASSIGNED',
    "truthLabel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "creatorLabel" TEXT,
    "qualitySummary" TEXT NOT NULL DEFAULT '{}',
    "deletionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "VisionRecordingAsset_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionRecordingAsset_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "VisionCaptureSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "recordingAssetId" TEXT,
    "regionType" TEXT NOT NULL,
    "coordinateSpace" TEXT NOT NULL DEFAULT 'NORMALIZED_IMAGE',
    "geometry" TEXT NOT NULL,
    "semanticLabel" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionRegion_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionRegion_recordingAssetId_fkey" FOREIGN KEY ("recordingAssetId") REFERENCES "VisionRecordingAsset" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionPoseRegion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "coordinateSystem" TEXT NOT NULL,
    "shapeType" TEXT NOT NULL,
    "parameters" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "orientationRules" TEXT NOT NULL DEFAULT '{}',
    "targetVisibilityRules" TEXT NOT NULL DEFAULT '{}',
    "authoringSource" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionPoseRegion_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionHardNegativeSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "strongestConfuserReference" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionHardNegativeSet_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionBuildJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "executionTarget" TEXT NOT NULL DEFAULT 'LOCAL',
    "engineMetadata" TEXT NOT NULL DEFAULT '{}',
    "processingStage" TEXT NOT NULL DEFAULT 'QUEUED',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" REAL NOT NULL DEFAULT 0,
    "logSummary" TEXT NOT NULL DEFAULT '[]',
    "outputSummary" TEXT NOT NULL DEFAULT '{}',
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "VisionBuildJob_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionBuildArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "buildJobId" TEXT,
    "artifactType" TEXT NOT NULL,
    "storageReference" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionBuildArtifact_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionBuildArtifact_buildJobId_fkey" FOREIGN KEY ("buildJobId") REFERENCES "VisionBuildJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionCertificationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "buildArtifactId" TEXT,
    "validationPartitionHash" TEXT NOT NULL,
    "lockedTestPartitionHash" TEXT NOT NULL,
    "thresholds" TEXT NOT NULL DEFAULT '{}',
    "profile" TEXT NOT NULL,
    "metrics" TEXT NOT NULL DEFAULT '{}',
    "observedFalseResults" TEXT NOT NULL DEFAULT '{}',
    "reliabilityGrade" TEXT NOT NULL,
    "approvedRuntimeModes" TEXT NOT NULL DEFAULT '[]',
    "reviewerId" TEXT,
    "reportReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "VisionCertificationRun_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionCertificationRun_buildArtifactId_fkey" FOREIGN KEY ("buildArtifactId") REFERENCES "VisionBuildArtifact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionWaypointTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waypointVersionId" TEXT NOT NULL,
    "certificationRunId" TEXT,
    "testType" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "actualResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evidenceReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "VisionWaypointTestRun_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionWaypointTestRun_certificationRunId_fkey" FOREIGN KEY ("certificationRunId") REFERENCES "VisionCertificationRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionWaypointVerificationProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "requirements" TEXT NOT NULL DEFAULT '{}',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionWaypointVerificationProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "GameMasterUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryWaypointBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "waypointVersionId" TEXT NOT NULL,
    "runtimeMode" TEXT NOT NULL DEFAULT 'DEVELOPMENT_MOCK',
    "scanInteraction" TEXT NOT NULL DEFAULT '{}',
    "successEvent" TEXT NOT NULL DEFAULT 'vision.verification_succeeded',
    "retryMessageConfiguration" TEXT NOT NULL DEFAULT '{}',
    "failureMessageConfiguration" TEXT NOT NULL DEFAULT '{}',
    "captainFallbackPolicy" TEXT NOT NULL DEFAULT '{}',
    "offlineBehavior" TEXT NOT NULL DEFAULT 'CAPTAIN_FALLBACK',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StoryWaypointBinding_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "TallTale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryWaypointBinding_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "StoryBlock" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StoryWaypointBinding_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "VisionWaypoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoryWaypointBinding_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "playerId" TEXT,
    "sessionId" TEXT,
    "verificationRequestId" TEXT,
    "waypointId" TEXT NOT NULL,
    "waypointVersionId" TEXT NOT NULL,
    "attemptState" TEXT NOT NULL DEFAULT 'IDLE',
    "result" TEXT,
    "guidanceCode" TEXT,
    "evidenceDigest" TEXT,
    "platform" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "eventDeliveryStatus" TEXT NOT NULL DEFAULT 'NOT_DELIVERED',
    "captainAction" TEXT,
    "mockScenario" TEXT,
    "protocolVersion" TEXT NOT NULL DEFAULT '1.0',
    "protocolMessageId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "staleResultRejected" BOOLEAN NOT NULL DEFAULT false,
    "duplicateResultRejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "VerificationAttempt_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "TallTale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VerificationAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VerificationAttempt_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "PlayerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VerificationAttempt_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "TaleVerificationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "VerificationAttempt_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "VisionWaypoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VerificationAttempt_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationAttemptTransition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationAttemptTransition_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VerificationAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionEvidenceBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "retentionPolicy" TEXT NOT NULL DEFAULT 'DERIVED_ONLY',
    "storageReference" TEXT,
    "contentHash" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "VisionEvidenceBundle_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VerificationAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanionDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "capabilities" TEXT NOT NULL DEFAULT '{}',
    "lastSeenAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionDevice_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "GameMasterUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PairingSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "companionDeviceId" TEXT NOT NULL,
    "pairingCodeHash" TEXT NOT NULL,
    "sessionSecretHash" TEXT NOT NULL,
    "allowedOrigin" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "pairedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PairingSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "GameMasterUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PairingSession_companionDeviceId_fkey" FOREIGN KEY ("companionDeviceId") REFERENCES "CompanionDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VisionWaypoint_ownerId_archivedAt_updatedAt_idx" ON "VisionWaypoint"("ownerId", "archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "VisionWaypoint_type_sharingScope_idx" ON "VisionWaypoint"("type", "sharingScope");

-- CreateIndex
CREATE INDEX "VisionWaypointVersion_waypointId_lifecycleStatus_updatedAt_idx" ON "VisionWaypointVersion"("waypointId", "lifecycleStatus", "updatedAt");

-- CreateIndex
CREATE INDEX "VisionWaypointVersion_parentVersionId_idx" ON "VisionWaypointVersion"("parentVersionId");

-- CreateIndex
CREATE INDEX "VisionWaypointVersion_publishedAt_deprecatedAt_idx" ON "VisionWaypointVersion"("publishedAt", "deprecatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisionWaypointVersion_waypointId_versionNumber_key" ON "VisionWaypointVersion"("waypointId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VisionWaypointPublication_waypointVersionId_key" ON "VisionWaypointPublication"("waypointVersionId");

-- CreateIndex
CREATE INDEX "VisionWaypointPublication_packageHash_idx" ON "VisionWaypointPublication"("packageHash");

-- CreateIndex
CREATE INDEX "VisionWaypointPublication_status_publishedAt_idx" ON "VisionWaypointPublication"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "VisionCaptureSession_waypointVersionId_purpose_createdAt_idx" ON "VisionCaptureSession"("waypointVersionId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "VisionCaptureSession_actorType_actorId_createdAt_idx" ON "VisionCaptureSession"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionRecordingAsset_captureSessionId_idx" ON "VisionRecordingAsset"("captureSessionId");

-- CreateIndex
CREATE INDEX "VisionRecordingAsset_waypointVersionId_datasetPartition_truthLabel_idx" ON "VisionRecordingAsset"("waypointVersionId", "datasetPartition", "truthLabel");

-- CreateIndex
CREATE UNIQUE INDEX "VisionRecordingAsset_waypointVersionId_contentHash_key" ON "VisionRecordingAsset"("waypointVersionId", "contentHash");

-- CreateIndex
CREATE INDEX "VisionRegion_waypointVersionId_regionType_idx" ON "VisionRegion"("waypointVersionId", "regionType");

-- CreateIndex
CREATE INDEX "VisionRegion_recordingAssetId_idx" ON "VisionRegion"("recordingAssetId");

-- CreateIndex
CREATE INDEX "VisionPoseRegion_waypointVersionId_classification_idx" ON "VisionPoseRegion"("waypointVersionId", "classification");

-- CreateIndex
CREATE INDEX "VisionHardNegativeSet_waypointVersionId_classification_idx" ON "VisionHardNegativeSet"("waypointVersionId", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "VisionHardNegativeSet_waypointVersionId_name_key" ON "VisionHardNegativeSet"("waypointVersionId", "name");

-- CreateIndex
CREATE INDEX "VisionBuildJob_waypointVersionId_status_createdAt_idx" ON "VisionBuildJob"("waypointVersionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VisionBuildArtifact_buildJobId_idx" ON "VisionBuildArtifact"("buildJobId");

-- CreateIndex
CREATE UNIQUE INDEX "VisionBuildArtifact_waypointVersionId_contentHash_artifactType_key" ON "VisionBuildArtifact"("waypointVersionId", "contentHash", "artifactType");

-- CreateIndex
CREATE INDEX "VisionCertificationRun_waypointVersionId_createdAt_idx" ON "VisionCertificationRun"("waypointVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionCertificationRun_buildArtifactId_idx" ON "VisionCertificationRun"("buildArtifactId");

-- CreateIndex
CREATE INDEX "VisionWaypointTestRun_waypointVersionId_testType_status_idx" ON "VisionWaypointTestRun"("waypointVersionId", "testType", "status");

-- CreateIndex
CREATE INDEX "VisionWaypointTestRun_certificationRunId_idx" ON "VisionWaypointTestRun"("certificationRunId");

-- CreateIndex
CREATE INDEX "VisionWaypointVerificationProfile_ownerId_archivedAt_idx" ON "VisionWaypointVerificationProfile"("ownerId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisionWaypointVerificationProfile_ownerId_name_key" ON "VisionWaypointVerificationProfile"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StoryWaypointBinding_blockId_key" ON "StoryWaypointBinding"("blockId");

-- CreateIndex
CREATE INDEX "StoryWaypointBinding_storyId_waypointVersionId_idx" ON "StoryWaypointBinding"("storyId", "waypointVersionId");

-- CreateIndex
CREATE INDEX "StoryWaypointBinding_waypointId_updatedAt_idx" ON "StoryWaypointBinding"("waypointId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationAttempt_idempotencyKey_key" ON "VerificationAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VerificationAttempt_sessionId_stageId_createdAt_idx" ON "VerificationAttempt"("sessionId", "stageId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAttempt_waypointVersionId_result_createdAt_idx" ON "VerificationAttempt"("waypointVersionId", "result", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAttempt_playerId_attemptState_createdAt_idx" ON "VerificationAttempt"("playerId", "attemptState", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationAttempt_verificationRequestId_idx" ON "VerificationAttempt"("verificationRequestId");

-- CreateIndex
CREATE INDEX "VerificationAttemptTransition_attemptId_createdAt_idx" ON "VerificationAttemptTransition"("attemptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationAttemptTransition_attemptId_sequence_key" ON "VerificationAttemptTransition"("attemptId", "sequence");

-- CreateIndex
CREATE INDEX "VisionEvidenceBundle_attemptId_createdAt_idx" ON "VisionEvidenceBundle"("attemptId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionEvidenceBundle_expiresAt_deletedAt_idx" ON "VisionEvidenceBundle"("expiresAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanionDevice_instanceId_key" ON "CompanionDevice"("instanceId");

-- CreateIndex
CREATE INDEX "CompanionDevice_ownerId_revokedAt_lastSeenAt_idx" ON "CompanionDevice"("ownerId", "revokedAt", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_pairingCodeHash_key" ON "PairingSession"("pairingCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "PairingSession_sessionSecretHash_key" ON "PairingSession"("sessionSecretHash");

-- CreateIndex
CREATE INDEX "PairingSession_ownerId_expiresAt_revokedAt_idx" ON "PairingSession"("ownerId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "PairingSession_companionDeviceId_expiresAt_idx" ON "PairingSession"("companionDeviceId", "expiresAt");
