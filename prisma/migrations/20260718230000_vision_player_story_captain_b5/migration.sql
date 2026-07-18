ALTER TABLE "StoryWaypointBinding" ADD COLUMN "assignmentPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "StoryWaypointBinding" ADD COLUMN "accessibilityPolicy" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "StoryWaypointBinding" ADD COLUMN "guidanceConfiguration" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "StoryWaypointBinding" ADD COLUMN "scanConfiguration" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "VerificationAttempt" ADD COLUMN "publishedVersionId" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "storyBindingId" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "publishedBindingId" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "packageId" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "packageHash" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "runtimeMode" TEXT NOT NULL DEFAULT 'DEVELOPMENT_MOCK';
ALTER TABLE "VerificationAttempt" ADD COLUMN "effectiveRuntimeMode" TEXT NOT NULL DEFAULT 'DEVELOPMENT_MOCK';
ALTER TABLE "VerificationAttempt" ADD COLUMN "stageTokenHash" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "stageTokenExpiresAt" DATETIME;
ALTER TABLE "VerificationAttempt" ADD COLUMN "storyStateVersion" INTEGER;
ALTER TABLE "VerificationAttempt" ADD COLUMN "companionInstanceId" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "failedGates" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "VerificationAttempt" ADD COLUMN "diagnostics" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VerificationAttempt" ADD COLUMN "engineVersion" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "modelBundleVersion" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "provider" TEXT;
ALTER TABLE "VerificationAttempt" ADD COLUMN "providerFallbackUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VerificationAttempt" ADD COLUMN "capturedFrameCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationAttempt" ADD COLUMN "usableFrameCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationAttempt" ADD COLUMN "passingFrameCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VerificationAttempt" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "VerificationAttempt" ADD COLUMN "rawFramesRetained" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VerificationAttempt" ADD COLUMN "captainDecisionStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "VerificationAttempt" ADD COLUMN "presentationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "VerificationAttempt" ADD COLUMN "offlineEventStatus" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "VerificationAttempt" ADD COLUMN "resultReceivedAt" DATETIME;
ALTER TABLE "VerificationAttempt" ADD COLUMN "progressionAppliedAt" DATETIME;

CREATE TABLE "VisionPublishedBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bindingKey" TEXT NOT NULL,
    "publishedVersionId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "waypointVersionId" TEXT NOT NULL,
    "runtimeMode" TEXT NOT NULL,
    "scanInteraction" TEXT NOT NULL DEFAULT '{}',
    "scanConfiguration" TEXT NOT NULL DEFAULT '{}',
    "successEvent" TEXT NOT NULL,
    "guidanceConfiguration" TEXT NOT NULL DEFAULT '{}',
    "captainFallbackPolicy" TEXT NOT NULL DEFAULT '{}',
    "offlineBehavior" TEXT NOT NULL,
    "assignmentPolicy" TEXT NOT NULL DEFAULT '{}',
    "accessibilityPolicy" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionPublishedBinding_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "PublishedTaleVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionPublishedBinding_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "TallTale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionPublishedBinding_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "VisionWaypoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionPublishedBinding_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionCaptainDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "truthLabel" TEXT,
    "evidenceSummary" TEXT NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionCaptainDecision_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VerificationAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VisionRuntimeControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "storyBindingId" TEXT,
    "stageId" TEXT NOT NULL,
    "configuredMode" TEXT NOT NULL,
    "effectiveMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "automaticPaused" BOOLEAN NOT NULL DEFAULT false,
    "certificationRunId" TEXT,
    "fieldEvidenceStatus" TEXT NOT NULL DEFAULT 'MISSING',
    "demotionReason" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionRuntimeControl_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionRuntimeControl_storyBindingId_fkey" FOREIGN KEY ("storyBindingId") REFERENCES "StoryWaypointBinding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "VisionPresentationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "storyEventKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "recoveryAction" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VisionPresentationRun_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VerificationAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "VisionPendingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "attemptId" TEXT,
    "eventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "storyStateVersion" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "conflictReason" TEXT,
    "observedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" DATETIME,
    CONSTRAINT "VisionPendingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TaleSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VisionPendingEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "VerificationAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VisionCaptainDecision_idempotencyKey_key" ON "VisionCaptainDecision"("idempotencyKey");
CREATE UNIQUE INDEX "VisionPublishedBinding_bindingKey_key" ON "VisionPublishedBinding"("bindingKey");
CREATE UNIQUE INDEX "VisionPublishedBinding_publishedVersionId_stageId_key" ON "VisionPublishedBinding"("publishedVersionId", "stageId");
CREATE INDEX "VisionPublishedBinding_storyId_stageId_idx" ON "VisionPublishedBinding"("storyId", "stageId");
CREATE INDEX "VisionPublishedBinding_waypointVersionId_runtimeMode_idx" ON "VisionPublishedBinding"("waypointVersionId", "runtimeMode");
CREATE INDEX "VisionCaptainDecision_attemptId_createdAt_idx" ON "VisionCaptainDecision"("attemptId", "createdAt");
CREATE INDEX "VisionCaptainDecision_truthLabel_createdAt_idx" ON "VisionCaptainDecision"("truthLabel", "createdAt");
CREATE UNIQUE INDEX "VisionRuntimeControl_sessionId_stageId_key" ON "VisionRuntimeControl"("sessionId", "stageId");
CREATE INDEX "VisionRuntimeControl_storyBindingId_effectiveMode_idx" ON "VisionRuntimeControl"("storyBindingId", "effectiveMode");
CREATE INDEX "VisionRuntimeControl_automaticPaused_updatedAt_idx" ON "VisionRuntimeControl"("automaticPaused", "updatedAt");
CREATE UNIQUE INDEX "VisionPresentationRun_attemptId_storyEventKey_key" ON "VisionPresentationRun"("attemptId", "storyEventKey");
CREATE INDEX "VisionPresentationRun_status_updatedAt_idx" ON "VisionPresentationRun"("status", "updatedAt");
CREATE UNIQUE INDEX "VisionPendingEvent_eventId_key" ON "VisionPendingEvent"("eventId");
CREATE UNIQUE INDEX "VisionPendingEvent_idempotencyKey_key" ON "VisionPendingEvent"("idempotencyKey");
CREATE INDEX "VisionPendingEvent_sessionId_status_createdAt_idx" ON "VisionPendingEvent"("sessionId", "status", "createdAt");
CREATE INDEX "VisionPendingEvent_attemptId_createdAt_idx" ON "VisionPendingEvent"("attemptId", "createdAt");
CREATE INDEX "VerificationAttempt_storyBindingId_runtimeMode_createdAt_idx" ON "VerificationAttempt"("storyBindingId", "runtimeMode", "createdAt");
CREATE INDEX "VerificationAttempt_publishedVersionId_stageId_createdAt_idx" ON "VerificationAttempt"("publishedVersionId", "stageId", "createdAt");
CREATE INDEX "VerificationAttempt_publishedBindingId_createdAt_idx" ON "VerificationAttempt"("publishedBindingId", "createdAt");
