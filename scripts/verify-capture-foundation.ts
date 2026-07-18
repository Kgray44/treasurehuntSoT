import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { markCreatorCaptureDeleted, persistCreatorCapture } from "@/vision/capture-persistence";

async function main() {
  const waypoint = await db.visionWaypoint.findFirst({
    where: { name: "B-1 Painted Lantern Waypoint" },
    include: { versions: { where: { lifecycleStatus: "DRAFT" }, orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  assert.ok(waypoint, "The B-1 waypoint fixture must exist before B-2 persistence verification.");

  let version = waypoint.versions[0];
  if (!version) {
    const latest = await db.visionWaypointVersion.findFirst({
      where: { waypointId: waypoint.id },
      orderBy: { versionNumber: "desc" },
    });
    assert.ok(latest);
    version = await db.visionWaypointVersion.create({
      data: {
        waypointId: waypoint.id,
        versionNumber: latest.versionNumber + 1,
        parentVersionId: latest.id,
        lifecycleStatus: "DRAFT",
        verificationProfile: latest.verificationProfile,
        packageSchemaVersion: latest.packageSchemaVersion,
        draftConfiguration: latest.draftConfiguration,
        compatibilityMetadata: latest.compatibilityMetadata,
        createdBy: waypoint.ownerId,
      },
    });
  }

  const now = Date.now();
  const contentHash = `sha256:${createHash("sha256").update("b2-capture-persistence-validation").digest("hex")}`;
  const manifest = {
    schemaVersion: 1 as const,
    artifactId: "artifact_b2_persistence_validation",
    recordingId: "recording_b2_persistence_validation",
    mediaType: "video/webm" as const,
    storageCategory: "LOCAL_APP_DATA" as const,
    contentHash,
    fileSize: 4096,
    startedAt: new Date(now - 5_000).toISOString(),
    completedAt: new Date(now).toISOString(),
    metadata: {
      waypointVersionId: version.id,
      purpose: "TARGET_REFERENCE",
      creatorLabel: "B-2 persistence validation",
      notes: "Metadata-only database verification; no media file is created by this script.",
      fieldOfView: 90,
      environmentNotes: "validation",
      allowCloudUpload: false,
      target: { targetId: "window:999999:0", privacyLabel: "Validation application window" },
      captureApi: "ELECTRON_DESKTOP_CAPTURER" as const,
    },
    capture: {
      sessionId: "creator_b2_persistence_validation",
      captureCoreVersion: "0.4.0-b2",
      protocolVersion: "2.0" as const,
      originalDimensions: { width: 1920, height: 1080 },
      normalizedDimensions: { width: 320, height: 180 },
      estimatedFrameRate: 10,
      durationMs: 5_000,
      frameCount: 50,
      encoding: "video/webm;codecs=vp9",
      qualitySummary: { capturedFrameCount: 50, usableFrameCount: 44, frozen: false },
      interruptions: [
        {
          code: "CAPTURE_FORMAT_CHANGED",
          at: new Date(now - 2_000).toISOString(),
          dimensions: { width: 1600, height: 900 },
        },
      ],
    },
    retention: { policy: "CREATOR_MANAGED" as const, deletable: true as const, uploadAuthorized: false },
  };

  const first = await persistCreatorCapture(manifest, waypoint.ownerId);
  assert.equal(first.idempotent, false);
  const repeated = await persistCreatorCapture(manifest, waypoint.ownerId);
  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.asset.artifactId, manifest.artifactId);

  const stored = await db.visionRecordingAsset.findUnique({
    where: { id: manifest.artifactId },
    include: { captureSession: { include: { interruptions: true } } },
  });
  assert.ok(stored?.captureSession);
  assert.equal(stored.storageReference, `companion://creator/${manifest.artifactId}`);
  assert.equal(stored.captureSession.protocolVersion, "2.0");
  assert.equal(stored.captureSession.captureApi, "ELECTRON_DESKTOP_CAPTURER");
  assert.equal(stored.captureSession.interruptions.length, 1);
  assert.equal(JSON.parse(stored.captureSession.qualitySummary).frozen, false);
  assert.equal(stored.artifactManifest.includes("VERIFIED"), false);
  assert.equal(stored.artifactManifest.includes("C:\\"), false);

  const deleted = await markCreatorCaptureDeleted(manifest.artifactId, waypoint.ownerId);
  assert.equal(deleted.asset.deletionStatus, "DELETED_FROM_COMPANION");
  assert.equal((await markCreatorCaptureDeleted(manifest.artifactId, waypoint.ownerId)).idempotent, true);
  assert.equal(
    await db.platformAuditEvent.count({
      where: {
        resourceId: manifest.artifactId,
        action: { in: ["VISION_CREATOR_CAPTURE_PERSISTED", "VISION_CREATOR_CAPTURE_DELETED"] },
      },
    }),
    2,
  );

  console.log(
    JSON.stringify({
      area: "b2-capture-persistence",
      verified: true,
      artifactId: manifest.artifactId,
      captureSessionId: stored.captureSession.id,
      interruptionCount: stored.captureSession.interruptions.length,
      auditEvents: 2,
      idempotentReplay: true,
      deleted: true,
      verificationDecisionStored: false,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
