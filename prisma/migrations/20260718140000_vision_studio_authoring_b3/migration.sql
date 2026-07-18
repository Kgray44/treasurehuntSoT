-- Phase B-3 authoring revisions, resumability, recording curation, deterministic build input, and test locks.
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "authoringRevision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "authoringMode" TEXT NOT NULL DEFAULT 'GUIDED';
ALTER TABLE "VisionWaypointVersion" ADD COLUMN "currentWizardStep" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "VisionRecordingAsset" ADD COLUMN "creatorNotes" TEXT;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'UNASSIGNED';
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "isUsable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "segmentStartMs" INTEGER;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "segmentEndMs" INTEGER;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "sourceAssetId" TEXT;
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "integrityState" TEXT NOT NULL DEFAULT 'LOCAL_VERIFIED';
ALTER TABLE "VisionRecordingAsset" ADD COLUMN "cloudState" TEXT NOT NULL DEFAULT 'LOCAL_ONLY';

ALTER TABLE "VisionBuildJob" ADD COLUMN "inputSchemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "VisionBuildJob" ADD COLUMN "buildInput" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionBuildJob" ADD COLUMN "inputHash" TEXT;

ALTER TABLE "VisionWaypointTestRun" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Untitled test';
ALTER TABLE "VisionWaypointTestRun" ADD COLUMN "instructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "VisionWaypointTestRun" ADD COLUMN "environment" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "VisionWaypointTestRun" ADD COLUMN "assetRole" TEXT NOT NULL DEFAULT 'VALIDATION';
ALTER TABLE "VisionWaypointTestRun" ADD COLUMN "lockedAt" DATETIME;
