-- AlterTable
ALTER TABLE "VisionCaptureSession" ADD COLUMN "sessionKey" TEXT;
ALTER TABLE "VisionCaptureSession" ADD COLUMN "protocolVersion" TEXT;
ALTER TABLE "VisionCaptureSession" ADD COLUMN "captureApi" TEXT;
ALTER TABLE "VisionCaptureSession" ADD COLUMN "targetMetadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionCaptureSession" ADD COLUMN "qualitySummary" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionCaptureSession" ADD COLUMN "interruptionSummary" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionCaptureSession" ADD COLUMN "manifestVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VisionCaptureSession" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'video/webm';
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "manifestVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "artifactManifest" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "durationMs" INTEGER;

-- CreateTable
CREATE TABLE "VisionCaptureInterruption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "captureSessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "recoverable" BOOLEAN NOT NULL DEFAULT true,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisionCaptureInterruption_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "VisionCaptureSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionDiagnosticBundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "captureSessionId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "bundleReference" TEXT NOT NULL,
    "contentHash" TEXT,
    "fileSize" INTEGER NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "containsRawFrames" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "VisionDiagnosticBundle_captureSessionId_fkey" FOREIGN KEY ("captureSessionId") REFERENCES "VisionCaptureSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisionCapturePreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "deviceInstanceId" TEXT NOT NULL,
    "rememberTarget" BOOLEAN NOT NULL DEFAULT false,
    "selectedTargetHash" TEXT,
    "hotkeyBinding" TEXT NOT NULL DEFAULT 'Control+Alt+F9',
    "hotkeyInteraction" TEXT NOT NULL DEFAULT 'HOLD',
    "hotkeyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "previewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "diagnosticRetention" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "VisionCaptureSession_sessionKey_key" ON "VisionCaptureSession"("sessionKey");

-- CreateIndex
CREATE INDEX "VisionCaptureInterruption_captureSessionId_occurredAt_idx" ON "VisionCaptureInterruption"("captureSessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "VisionCaptureInterruption_code_occurredAt_idx" ON "VisionCaptureInterruption"("code", "occurredAt");

-- CreateIndex
CREATE INDEX "VisionDiagnosticBundle_captureSessionId_createdAt_idx" ON "VisionDiagnosticBundle"("captureSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionDiagnosticBundle_actorType_actorId_createdAt_idx" ON "VisionDiagnosticBundle"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "VisionDiagnosticBundle_expiresAt_deletedAt_idx" ON "VisionDiagnosticBundle"("expiresAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisionCapturePreference_ownerType_ownerId_deviceInstanceId_key" ON "VisionCapturePreference"("ownerType", "ownerId", "deviceInstanceId");

-- CreateIndex
CREATE INDEX "VisionCapturePreference_ownerType_ownerId_updatedAt_idx" ON "VisionCapturePreference"("ownerType", "ownerId", "updatedAt");
