ALTER TABLE "VisionWaypointVersion" ADD COLUMN "certificationStatus" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "compatibilityStatus" TEXT NOT NULL DEFAULT 'NEEDS_RETEST';
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "certifiedPackageHash" TEXT;
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "certifiedDatasetRevision" TEXT;

CREATE TABLE "VisionRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXPERIMENTAL',
    "sourceCommit" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "readinessStatus" TEXT NOT NULL DEFAULT 'NO_GO',
    "releaseManifest" TEXT NOT NULL DEFAULT '{}',
    "evidenceSummary" TEXT NOT NULL DEFAULT '{}',
    "knownLimitations" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedAt" DATETIME
);

CREATE TABLE "VisionReleaseIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reproductionSteps" TEXT NOT NULL DEFAULT '[]',
    "affectedVersions" TEXT NOT NULL DEFAULT '[]',
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "fixCommit" TEXT,
    "regressionTest" TEXT,
    "releaseBlocking" BOOLEAN NOT NULL DEFAULT true,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    CONSTRAINT "VisionReleaseIssue_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "VisionRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionDatasetManifest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revision" TEXT NOT NULL,
    "evidenceClass" TEXT NOT NULL,
    "waypointVersionId" TEXT,
    "manifestHash" TEXT NOT NULL,
    "manifest" TEXT NOT NULL,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "VisionReliabilityRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "datasetManifestId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "modelBundleVersion" TEXT NOT NULL,
    "packageHashes" TEXT NOT NULL DEFAULT '[]',
    "deterministicSeed" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "resultSummary" TEXT NOT NULL DEFAULT '{}',
    "reportHash" TEXT NOT NULL,
    "reportReference" TEXT NOT NULL,
    "falseAccepts" INTEGER NOT NULL DEFAULT 0,
    "firstAttemptSuccess" REAL,
    "twoAttemptSuccess" REAL,
    "p95DurationMs" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "VisionReliabilityRun_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "VisionRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VisionReliabilityRun_datasetManifestId_fkey" FOREIGN KEY ("datasetManifestId") REFERENCES "VisionDatasetManifest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionCompatibilityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "minimumVersion" TEXT,
    "maximumVersion" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionCompatibilityRule_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "VisionRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionReleaseArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "signatureStatus" TEXT NOT NULL,
    "signatureIdentity" TEXT,
    "provenance" TEXT NOT NULL DEFAULT '{}',
    "rollbackTarget" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionReleaseArtifact_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "VisionRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionReleaseTestRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "releaseId" TEXT NOT NULL,
    "suite" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '{}',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionReleaseTestRun_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "VisionRelease" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "VisionUpdateState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "targetVersion" TEXT,
    "phase" TEXT NOT NULL DEFAULT 'IDLE',
    "manifestHash" TEXT,
    "stagedArtifactHash" TEXT,
    "rollbackVersion" TEXT,
    "lastHealthStatus" TEXT,
    "errorCode" TEXT,
    "state" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "VisionImprovementCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceAttemptId" TEXT NOT NULL,
    "waypointVersionId" TEXT NOT NULL,
    "humanTruthLabel" TEXT NOT NULL,
    "candidateReason" TEXT NOT NULL,
    "evidenceDigest" TEXT,
    "derivedDiagnostics" TEXT NOT NULL DEFAULT '{}',
    "proposedPartition" TEXT NOT NULL,
    "rawFramesRetained" BOOLEAN NOT NULL DEFAULT false,
    "consentReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "dispositionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME
);

CREATE UNIQUE INDEX "VisionRelease_version_channel_key" ON "VisionRelease"("version", "channel");
CREATE INDEX "VisionRelease_channel_status_updatedAt_idx" ON "VisionRelease"("channel", "status", "updatedAt");
CREATE INDEX "VisionReleaseIssue_releaseId_status_releaseBlocking_idx" ON "VisionReleaseIssue"("releaseId", "status", "releaseBlocking");
CREATE INDEX "VisionReleaseIssue_severity_status_idx" ON "VisionReleaseIssue"("severity", "status");
CREATE UNIQUE INDEX "VisionDatasetManifest_revision_key" ON "VisionDatasetManifest"("revision");
CREATE INDEX "VisionDatasetManifest_waypointVersionId_evidenceClass_idx" ON "VisionDatasetManifest"("waypointVersionId", "evidenceClass");
CREATE INDEX "VisionReliabilityRun_releaseId_status_createdAt_idx" ON "VisionReliabilityRun"("releaseId", "status", "createdAt");
CREATE INDEX "VisionReliabilityRun_datasetManifestId_createdAt_idx" ON "VisionReliabilityRun"("datasetManifestId", "createdAt");
CREATE UNIQUE INDEX "VisionCompatibilityRule_releaseId_component_key" ON "VisionCompatibilityRule"("releaseId", "component");
CREATE INDEX "VisionCompatibilityRule_component_status_idx" ON "VisionCompatibilityRule"("component", "status");
CREATE UNIQUE INDEX "VisionReleaseArtifact_releaseId_artifactType_platform_architecture_key" ON "VisionReleaseArtifact"("releaseId", "artifactType", "platform", "architecture");
CREATE INDEX "VisionReleaseArtifact_contentHash_idx" ON "VisionReleaseArtifact"("contentHash");
CREATE INDEX "VisionReleaseArtifact_signatureStatus_createdAt_idx" ON "VisionReleaseArtifact"("signatureStatus", "createdAt");
CREATE INDEX "VisionReleaseTestRun_releaseId_category_status_idx" ON "VisionReleaseTestRun"("releaseId", "category", "status");
CREATE INDEX "VisionReleaseTestRun_suite_createdAt_idx" ON "VisionReleaseTestRun"("suite", "createdAt");
CREATE UNIQUE INDEX "VisionUpdateState_installationId_key" ON "VisionUpdateState"("installationId");
CREATE INDEX "VisionUpdateState_channel_phase_updatedAt_idx" ON "VisionUpdateState"("channel", "phase", "updatedAt");
CREATE UNIQUE INDEX "VisionImprovementCandidate_sourceAttemptId_key" ON "VisionImprovementCandidate"("sourceAttemptId");
CREATE INDEX "VisionImprovementCandidate_waypointVersionId_status_createdAt_idx" ON "VisionImprovementCandidate"("waypointVersionId", "status", "createdAt");
CREATE INDEX "VisionImprovementCandidate_humanTruthLabel_status_idx" ON "VisionImprovementCandidate"("humanTruthLabel", "status");
