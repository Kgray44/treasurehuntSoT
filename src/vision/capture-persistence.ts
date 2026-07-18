import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";
import { VisionDomainError } from "@/vision/domain";

const identifier = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);
const jsonObject = z.record(z.string(), z.unknown());
const creatorPurpose = z.enum([
  "TARGET_REFERENCE",
  "ACCEPTED_AREA_WALK",
  "BOUNDARY",
  "ENVIRONMENTAL_VARIATION",
  "NEARBY_HARD_NEGATIVE",
  "DISTANT_HARD_NEGATIVE",
  "INVALID_POSE",
  "DIAGNOSTIC_POSITIVE",
  "DIAGNOSTIC_NEGATIVE",
]);

export const creatorCaptureManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    artifactId: identifier.refine((value) => value.startsWith("artifact_")),
    recordingId: identifier.refine((value) => value.startsWith("recording_")),
    mediaType: z.literal("video/webm"),
    storageCategory: z.literal("LOCAL_APP_DATA"),
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    fileSize: z.number().int().positive().max(2_147_483_647),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    metadata: z
      .object({
        waypointVersionId: identifier,
        purpose: creatorPurpose,
        creatorLabel: z.string().trim().min(1).max(120),
        notes: z.string().max(4_000).default(""),
        fieldOfView: z.number().min(20).max(180).nullable().optional(),
        environmentNotes: z.string().max(4_000).default(""),
        allowCloudUpload: z.boolean(),
        target: z.object({ targetId: identifier, privacyLabel: z.string().trim().min(1).max(160) }).strict(),
        captureApi: z.literal("ELECTRON_DESKTOP_CAPTURER"),
      })
      .strict(),
    capture: z
      .object({
        sessionId: identifier.refine((value) => value.startsWith("creator_")),
        captureCoreVersion: z.string().trim().min(1).max(40),
        protocolVersion: z.literal("2.0"),
        originalDimensions: z
          .object({ width: z.number().int().positive(), height: z.number().int().positive() })
          .strict(),
        normalizedDimensions: z
          .object({ width: z.number().int().positive(), height: z.number().int().positive() })
          .strict(),
        estimatedFrameRate: z.number().positive().max(240),
        durationMs: z.number().int().nonnegative().max(86_400_000),
        frameCount: z.number().int().nonnegative().max(5_000_000),
        encoding: z.string().trim().min(1).max(100),
        qualitySummary: jsonObject,
        interruptions: z
          .array(
            z
              .object({
                code: z.string().trim().min(1).max(80),
                at: z.iso.datetime(),
                dimensions: z
                  .object({ width: z.number().int().positive(), height: z.number().int().positive() })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .max(500),
      })
      .strict(),
    retention: z
      .object({ policy: z.literal("CREATOR_MANAGED"), deletable: z.literal(true), uploadAuthorized: z.boolean() })
      .strict(),
  })
  .strict();

export type CreatorCaptureManifest = z.infer<typeof creatorCaptureManifestSchema>;

function publicAsset(asset: {
  id: string;
  captureSessionId: string | null;
  contentHash: string;
  fileSize: number;
  mediaType: string;
  durationMs: number | null;
  creatorLabel: string | null;
  deletionStatus: string;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    artifactId: asset.id,
    captureSessionId: asset.captureSessionId,
    contentHash: asset.contentHash,
    fileSize: asset.fileSize,
    mediaType: asset.mediaType,
    durationMs: asset.durationMs,
    creatorLabel: asset.creatorLabel,
    deletionStatus: asset.deletionStatus,
    createdAt: asset.createdAt.toISOString(),
    deletedAt: asset.deletedAt?.toISOString() ?? null,
  };
}

async function writeCaptureAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    action: string;
    resourceId: string;
    correlationId: string;
    metadata: Record<string, unknown>;
  },
) {
  await tx.platformAuditEvent.create({
    data: {
      actorType: "CREATOR",
      actorId: input.actorId,
      action: input.action,
      resourceType: "VISION_RECORDING_ASSET",
      resourceId: input.resourceId,
      outcome: "SUCCEEDED",
      correlationId: input.correlationId,
      metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
    },
  });
}

export async function persistCreatorCapture(input: unknown, actorId: string) {
  const manifest = creatorCaptureManifestSchema.parse(input);
  if (Date.parse(manifest.completedAt) < Date.parse(manifest.startedAt))
    throw new VisionDomainError("INVALID_CAPTURE_MANIFEST", "Capture completion precedes its start time.");

  return db.$transaction(async (tx) => {
    const version = await tx.visionWaypointVersion.findFirst({
      where: { id: manifest.metadata.waypointVersionId, waypoint: { ownerId: actorId } },
      select: { id: true, lifecycleStatus: true },
    });
    if (!version)
      throw new VisionDomainError("WAYPOINT_VERSION_NOT_FOUND", "The selected waypoint draft was not found.");
    if (version.lifecycleStatus !== "DRAFT")
      throw new VisionDomainError(
        "CAPTURE_DRAFT_REQUIRED",
        "Creator recordings can only be attached to a draft version.",
      );

    const existing = await tx.visionRecordingAsset.findFirst({
      where: {
        waypointVersionId: version.id,
        OR: [{ id: manifest.artifactId }, { contentHash: manifest.contentHash }],
      },
    });
    if (existing) return { asset: publicAsset(existing), idempotent: true };

    const completedAt = new Date(manifest.completedAt);
    const captureSession = await tx.visionCaptureSession.create({
      data: {
        sessionKey: manifest.capture.sessionId,
        waypointVersionId: version.id,
        purpose: manifest.metadata.purpose,
        actorType: "CREATOR",
        actorId,
        companionVersion: manifest.capture.captureCoreVersion,
        protocolVersion: manifest.capture.protocolVersion,
        captureApi: manifest.metadata.captureApi,
        captureResolution: `${manifest.capture.originalDimensions.width}x${manifest.capture.originalDimensions.height}`,
        frameRate: manifest.capture.estimatedFrameRate,
        durationMs: manifest.capture.durationMs,
        hardwarePath: "LOCAL_COMPANION",
        targetMetadata: JSON.stringify(manifest.metadata.target),
        qualitySummary: JSON.stringify(manifest.capture.qualitySummary),
        interruptionSummary: JSON.stringify({ count: manifest.capture.interruptions.length }),
        consentFlags: JSON.stringify({ cloudUploadAuthorized: manifest.retention.uploadAuthorized }),
        retentionPolicy: manifest.retention.policy,
        manifestVersion: manifest.schemaVersion,
        status: "COMPLETED",
        startedAt: new Date(manifest.startedAt),
        completedAt,
      },
    });
    const asset = await tx.visionRecordingAsset.create({
      data: {
        id: manifest.artifactId,
        waypointVersionId: version.id,
        captureSessionId: captureSession.id,
        assetType: "CREATOR_RECORDING",
        storageReference: `companion://creator/${manifest.artifactId}`,
        contentHash: manifest.contentHash,
        fileSize: manifest.fileSize,
        mediaType: manifest.mediaType,
        manifestVersion: manifest.schemaVersion,
        artifactManifest: JSON.stringify(manifest),
        durationMs: manifest.capture.durationMs,
        creatorLabel: manifest.metadata.creatorLabel,
        qualitySummary: JSON.stringify(manifest.capture.qualitySummary),
      },
    });
    if (manifest.capture.interruptions.length > 0) {
      await tx.visionCaptureInterruption.createMany({
        data: manifest.capture.interruptions.map((interruption) => ({
          captureSessionId: captureSession.id,
          code: interruption.code,
          occurredAt: new Date(interruption.at),
          metadata: JSON.stringify(interruption.dimensions ? { dimensions: interruption.dimensions } : {}),
        })),
      });
    }
    await writeCaptureAudit(tx, {
      actorId,
      action: "VISION_CREATOR_CAPTURE_PERSISTED",
      resourceId: asset.id,
      correlationId: manifest.capture.sessionId,
      metadata: {
        waypointVersionId: version.id,
        purpose: manifest.metadata.purpose,
        contentHash: manifest.contentHash,
        fileSize: manifest.fileSize,
        durationMs: manifest.capture.durationMs,
        interruptionCount: manifest.capture.interruptions.length,
      },
    });
    return { asset: publicAsset(asset), captureSessionId: captureSession.id, idempotent: false };
  });
}

export async function listCreatorCaptures(actorId: string) {
  const assets = await db.visionRecordingAsset.findMany({
    where: { waypointVersion: { waypoint: { ownerId: actorId } }, assetType: "CREATOR_RECORDING" },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 100,
  });
  return assets.map(publicAsset);
}

export async function markCreatorCaptureDeleted(artifactId: string, actorId: string) {
  const id = identifier.parse(artifactId);
  return db.$transaction(async (tx) => {
    const asset = await tx.visionRecordingAsset.findFirst({
      where: { id, waypointVersion: { waypoint: { ownerId: actorId } } },
    });
    if (!asset) throw new VisionDomainError("CAPTURE_ARTIFACT_NOT_FOUND", "The creator capture was not found.");
    if (asset.deletedAt) return { asset: publicAsset(asset), idempotent: true };
    const deleted = await tx.visionRecordingAsset.update({
      where: { id },
      data: { deletionStatus: "DELETED_FROM_COMPANION", deletedAt: new Date() },
    });
    await writeCaptureAudit(tx, {
      actorId,
      action: "VISION_CREATOR_CAPTURE_DELETED",
      resourceId: id,
      correlationId: randomUUID(),
      metadata: { waypointVersionId: asset.waypointVersionId, contentHash: asset.contentHash },
    });
    return { asset: publicAsset(deleted), idempotent: false };
  });
}
