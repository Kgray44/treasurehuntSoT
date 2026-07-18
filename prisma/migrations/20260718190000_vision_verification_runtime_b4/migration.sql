ALTER TABLE "VisionBuildJob" ADD COLUMN "packageId" TEXT;
ALTER TABLE "VisionBuildJob" ADD COLUMN "packageHash" TEXT;
ALTER TABLE "VisionBuildJob" ADD COLUMN "report" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionBuildJob" ADD COLUMN "providerMetadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionBuildJob" ADD COLUMN "reliabilityGrade" TEXT;
ALTER TABLE "VisionBuildJob" ADD COLUMN "automaticEligibility" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VisionBuildJob" ADD COLUMN "lastHeartbeatAt" DATETIME;
ALTER TABLE "VisionBuildJob" ADD COLUMN "cancellationRequestedAt" DATETIME;

CREATE TABLE "VisionShadowAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "waypointId" TEXT NOT NULL,
    "waypointVersionId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "packageHash" TEXT,
    "stageTokenHash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "guidanceCode" TEXT,
    "failedGates" TEXT NOT NULL DEFAULT '[]',
    "evidenceDigest" TEXT,
    "engineVersion" TEXT NOT NULL,
    "modelBundleVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerFallbackUsed" BOOLEAN NOT NULL DEFAULT false,
    "capturedFrameCount" INTEGER NOT NULL DEFAULT 0,
    "usableFrameCount" INTEGER NOT NULL DEFAULT 0,
    "passingFrameCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "diagnostics" TEXT NOT NULL DEFAULT '{}',
    "humanTruthLabel" TEXT,
    "captainDisposition" TEXT,
    "rebuildDisposition" TEXT,
    "rebuildParentAttemptId" TEXT,
    "shadowMode" BOOLEAN NOT NULL DEFAULT true,
    "automaticProgression" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "VisionShadowAttempt_waypointId_fkey" FOREIGN KEY ("waypointId") REFERENCES "VisionWaypoint" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionShadowAttempt_waypointVersionId_fkey" FOREIGN KEY ("waypointVersionId") REFERENCES "VisionWaypointVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VisionShadowAttempt_attemptId_key" ON "VisionShadowAttempt"("attemptId");
CREATE INDEX "VisionShadowAttempt_waypointVersionId_result_createdAt_idx" ON "VisionShadowAttempt"("waypointVersionId", "result", "createdAt");
CREATE INDEX "VisionShadowAttempt_humanTruthLabel_createdAt_idx" ON "VisionShadowAttempt"("humanTruthLabel", "createdAt");
