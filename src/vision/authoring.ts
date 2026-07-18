import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";
import {
  BUILD_INPUT_SCHEMA_VERSION,
  applyStep,
  authoringMutationSchema,
  authoringStateSchema,
  defaultAuthoringState,
  type AuthoringMutation,
  type AuthoringState,
} from "@/vision/authoring-domain";
import { visionWaypointDraftConfigurationSchema, VisionDomainError } from "@/vision/domain";

type JsonRecord = Record<string, unknown>;

function parseObject(value: string | null | undefined): JsonRecord {
  try {
    const parsed: unknown = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as JsonRecord) : {};
  } catch {
    return {};
  }
}

function parseArray(value: string | null | undefined): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as JsonRecord)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function authoringFromConfiguration(configuration: JsonRecord): AuthoringState {
  const parsed = authoringStateSchema.safeParse(configuration.authoring);
  return parsed.success ? parsed.data : defaultAuthoringState();
}

async function audit(
  tx: Prisma.TransactionClient,
  input: { actorId: string; action: string; resourceId: string; correlationId?: string; metadata?: JsonRecord },
) {
  await tx.platformAuditEvent.create({
    data: {
      actorType: "CREATOR",
      actorId: input.actorId,
      action: input.action,
      resourceType: "VISION_WAYPOINT_VERSION",
      resourceId: input.resourceId,
      outcome: "SUCCEEDED",
      correlationId: input.correlationId ?? randomUUID(),
      metadata: JSON.stringify(safeAuditMetadata(input.metadata)),
    },
  });
}

const authoringInclude = {
  waypoint: true,
  captureSessions: { orderBy: { createdAt: "desc" as const } },
  recordingAssets: {
    include: { captureSession: true },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  regions: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  poseRegions: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  hardNegativeSets: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  buildJobs: { orderBy: { createdAt: "desc" as const }, take: 20 },
  testRuns: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.VisionWaypointVersionInclude;

type AuthoringRecord = Prisma.VisionWaypointVersionGetPayload<{ include: typeof authoringInclude }>;

function publicRecord(version: AuthoringRecord) {
  const configuration = visionWaypointDraftConfigurationSchema.parse(parseObject(version.draftConfiguration));
  const authoring = authoringFromConfiguration(configuration as unknown as JsonRecord);
  const result = {
    version: {
      id: version.id,
      waypointId: version.waypointId,
      versionNumber: version.versionNumber,
      lifecycleStatus: version.lifecycleStatus,
      verificationProfile: version.verificationProfile,
      authoringRevision: version.authoringRevision,
      authoringMode: version.authoringMode,
      currentWizardStep: version.currentWizardStep,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      updatedAt: version.updatedAt.toISOString(),
    },
    waypoint: {
      id: version.waypoint.id,
      name: version.waypoint.name,
      description: version.waypoint.description,
      type: version.waypoint.type,
      locationTags: parseArray(version.waypoint.locationTags),
      sharingScope: version.waypoint.sharingScope,
    },
    configuration,
    authoring,
    captures: version.captureSessions.map((capture) => ({
      id: capture.id,
      sessionKey: capture.sessionKey,
      purpose: capture.purpose,
      status: capture.status,
      durationMs: capture.durationMs,
      qualitySummary: parseObject(capture.qualitySummary),
      interruptionSummary: parseObject(capture.interruptionSummary),
      createdAt: capture.createdAt.toISOString(),
    })),
    assets: version.recordingAssets.map((asset) => ({
      id: asset.id,
      captureSessionId: asset.captureSessionId,
      purpose: asset.captureSession?.purpose ?? null,
      label: asset.creatorLabel,
      notes: asset.creatorNotes,
      role: asset.role,
      isUsable: asset.isUsable,
      durationMs: asset.durationMs,
      segmentStartMs: asset.segmentStartMs,
      segmentEndMs: asset.segmentEndMs,
      sourceAssetId: asset.sourceAssetId,
      contentHash: asset.contentHash,
      fileSize: asset.fileSize,
      mediaType: asset.mediaType,
      integrityState: asset.integrityState,
      cloudState: asset.cloudState,
      deletionStatus: asset.deletionStatus,
      deletedAt: asset.deletedAt?.toISOString() ?? null,
      qualitySummary: parseObject(asset.qualitySummary),
      createdAt: asset.createdAt.toISOString(),
    })),
    poseRegions: version.poseRegions.map((region) => ({
      id: region.id,
      coordinateSystem: region.coordinateSystem,
      shapeType: region.shapeType,
      classification: region.classification,
      parameters: parseObject(region.parameters),
      orientationRules: parseObject(region.orientationRules),
      visibilityRules: parseObject(region.targetVisibilityRules),
      authoringSource: region.authoringSource,
    })),
    visualRegions: version.regions.map((region) => ({
      id: region.id,
      recordingAssetId: region.recordingAssetId,
      regionType: region.regionType,
      coordinateSpace: region.coordinateSpace,
      geometry: parseObject(region.geometry),
      semanticLabel: region.semanticLabel,
    })),
    hardNegatives: version.hardNegativeSets.map((negative) => ({
      id: negative.id,
      name: negative.name,
      classification: negative.classification,
      metadata: parseObject(negative.metadata),
    })),
    tests: version.testRuns.map((test) => ({
      id: test.id,
      name: test.name,
      testType: test.testType,
      instructions: test.instructions,
      expectedResult: test.expectedResult,
      status: test.status,
      environment: parseObject(test.environment),
      assetRole: test.assetRole,
      lockedAt: test.lockedAt?.toISOString() ?? null,
    })),
    buildJobs: version.buildJobs.map((job) => ({
      id: job.id,
      executionTarget: job.executionTarget,
      status: job.status,
      processingStage: job.processingStage,
      progress: job.progress,
      inputSchemaVersion: job.inputSchemaVersion,
      inputHash: job.inputHash,
      engineMetadata: parseObject(job.engineMetadata),
      outputSummary: parseObject(job.outputSummary),
      reliabilityGrade: job.reliabilityGrade,
      packageId: job.packageId,
      packageHash: job.packageHash,
      automaticEligibility: false,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    })),
  };
  return { ...result, dataHealth: assessDataHealth(result) };
}

export type AuthoringAggregate = ReturnType<typeof publicRecord>;

export type DataHealthItem = {
  code: string;
  severity: "BLOCKER" | "WARNING";
  step: number;
  message: string;
  recovery: string;
};

export function assessDataHealth(input: {
  version: { verificationProfile: string };
  waypoint: { type: string };
  authoring: AuthoringState;
  assets: Array<{
    id: string;
    role: string;
    isUsable: boolean;
    deletedAt: string | null;
    integrityState: string;
    qualitySummary: Record<string, unknown>;
  }>;
  poseRegions: Array<{ classification: string }>;
  visualRegions: Array<{ regionType: string }>;
  hardNegatives: Array<{ classification: string }>;
  tests: Array<{ testType: string; lockedAt: string | null }>;
}) {
  const items: DataHealthItem[] = [];
  const usable = input.assets.filter((asset) => asset.isUsable && !asset.deletedAt);
  const add = (item: DataHealthItem) => items.push(item);
  for (let step = 1; step <= 12; step += 1) {
    if (!input.authoring.completedSteps.includes(step))
      add({
        code: `AUTHORING_STEP_${step}_REQUIRED`,
        severity: "BLOCKER",
        step,
        message: `${["Purpose", "Story Intent", "Companion", "Record Target", "Accepted Player Area", "Boundaries", "Similar Wrong Places", "Important Visual Regions", "Data Health", "Build Preparation", "Test Plan", "Review"][step - 1]} is not complete.`,
        recovery: `Review and complete step ${step}.`,
      });
  }
  if (!input.authoring.steps.purpose)
    add({
      code: "PURPOSE_REQUIRED",
      severity: "BLOCKER",
      step: 1,
      message: "Describe what this waypoint proves.",
      recovery: "Complete Purpose with a concrete success definition.",
    });
  if (!usable.some((asset) => asset.role === "TARGET_REFERENCE"))
    add({
      code: "TARGET_REFERENCE_REQUIRED",
      severity: "BLOCKER",
      step: 4,
      message: "No usable target reference is assigned.",
      recovery: "Record the target through Companion, then assign Target reference.",
    });
  if (!input.poseRegions.some((region) => region.classification === "ACCEPTED"))
    add({
      code: "ACCEPTED_AREA_REQUIRED",
      severity: "BLOCKER",
      step: 5,
      message: "The accepted player area is undefined.",
      recovery: "Add at least one provisional accepted region.",
    });
  if (!input.poseRegions.some((region) => region.classification === "BOUNDARY" || region.classification === "EXCLUDED"))
    add({
      code: "BOUNDARY_REQUIRED",
      severity: "BLOCKER",
      step: 6,
      message: "No boundary or excluded area is defined.",
      recovery: "Add a boundary and explain why crossing it should fail.",
    });
  const storyCritical = input.version.verificationProfile === "STORY_CRITICAL";
  if (storyCritical && !input.hardNegatives.some((negative) => negative.classification === "NEARBY"))
    add({
      code: "NEARBY_HARD_NEGATIVE_REQUIRED",
      severity: "BLOCKER",
      step: 7,
      message: "Story-Critical waypoints require a nearby wrong place.",
      recovery: "Record and describe the strongest nearby confuser.",
    });
  if (storyCritical && !input.hardNegatives.some((negative) => negative.classification === "DISTANT"))
    add({
      code: "DISTANT_HARD_NEGATIVE_REQUIRED",
      severity: "BLOCKER",
      step: 7,
      message: "Story-Critical waypoints require a distant wrong place.",
      recovery: "Record and describe a visually similar distant location.",
    });
  if (!storyCritical && input.hardNegatives.length === 0)
    add({
      code: "HARD_NEGATIVE_RECOMMENDED",
      severity: "WARNING",
      step: 7,
      message: "No similar wrong place is documented.",
      recovery: "Add the strongest likely confuser before field testing.",
    });
  if (
    ["EXACT_LANDMARK", "VIEWPOINT", "OBJECT_INSPECTION", "ITEM_PICKUP"].includes(input.waypoint.type) &&
    !input.visualRegions.some((region) => region.regionType === "TARGET" || region.regionType === "STABLE")
  )
    add({
      code: "VISUAL_TARGET_REGION_REQUIRED",
      severity: "BLOCKER",
      step: 8,
      message: "No important target or stable visual region is marked.",
      recovery: "Mark the durable part of a representative frame.",
    });
  if (!input.tests.some((test) => test.testType === "POSITIVE"))
    add({
      code: "POSITIVE_TEST_REQUIRED",
      severity: "BLOCKER",
      step: 11,
      message: "A positive test case is missing.",
      recovery: "Add a test that should match.",
    });
  if (!input.tests.some((test) => test.testType === "NEGATIVE"))
    add({
      code: "NEGATIVE_TEST_REQUIRED",
      severity: "BLOCKER",
      step: 11,
      message: "A negative test case is missing.",
      recovery: "Add a test that must not match.",
    });
  if (!input.tests.some((test) => test.lockedAt))
    add({
      code: "LOCKED_TEST_REQUIRED",
      severity: "BLOCKER",
      step: 11,
      message: "No test evidence is locked away from authoring.",
      recovery: "Lock at least one test case before build preparation.",
    });
  if (input.authoring.steps.companion && input.authoring.steps.companion.privacyAcknowledged !== true)
    add({
      code: "CAPTURE_PRIVACY_ACKNOWLEDGMENT_REQUIRED",
      severity: "BLOCKER",
      step: 3,
      message: "Capture privacy has not been acknowledged.",
      recovery: "Review the selected-window and retention boundary.",
    });
  if (input.authoring.steps.acceptedArea && input.authoring.steps.acceptedArea.provisionalAccuracyAcknowledged !== true)
    add({
      code: "PROVISIONAL_AREA_ACKNOWLEDGMENT_REQUIRED",
      severity: "BLOCKER",
      step: 5,
      message: "The provisional accepted-area limitation is not acknowledged.",
      recovery: "Confirm that creator-relative regions are not surveyed game coordinates.",
    });
  const review = input.authoring.steps.review;
  if (review && (!review.confirmCaptureConsent || !review.confirmNoModelYet || !review.confirmLockedTests))
    add({
      code: "AUTHORING_REVIEW_CONFIRMATION_REQUIRED",
      severity: "BLOCKER",
      step: 12,
      message: "Final truth and consent confirmations are incomplete.",
      recovery: "Complete all three Review confirmations.",
    });
  for (const asset of usable.filter(
    (candidate) => candidate.integrityState !== "LOCAL_VERIFIED" && candidate.integrityState !== "CLOUD_VERIFIED",
  ))
    add({
      code: `ASSET_INTEGRITY_${asset.id}`,
      severity: "BLOCKER",
      step: 4,
      message: "A selected asset failed integrity verification.",
      recovery: "Replace or remove the affected recording.",
    });
  for (const asset of usable) {
    if (asset.qualitySummary.frozen === true)
      add({
        code: `ASSET_FROZEN_${asset.id}`,
        severity: "BLOCKER",
        step: 4,
        message: "A recording appears frozen.",
        recovery: "Preview it, mark it unusable, and record a replacement.",
      });
    if (typeof asset.qualitySummary.usableFrameCount === "number" && asset.qualitySummary.usableFrameCount < 6)
      add({
        code: `ASSET_COVERAGE_${asset.id}`,
        severity: "WARNING",
        step: 4,
        message: "A recording has very few usable frames.",
        recovery: "Move more slowly and capture another view.",
      });
  }
  if (usable.filter((asset) => asset.role === "TARGET_REFERENCE").length === 1)
    add({
      code: "TARGET_COVERAGE_LOW",
      severity: "WARNING",
      step: 4,
      message: "Only one target recording is assigned.",
      recovery: "Add another angle or environmental condition when practical.",
    });
  const blockers = items.filter((item) => item.severity === "BLOCKER");
  const completed = new Set(input.authoring.completedSteps).size;
  return {
    readyToPrepare: blockers.length === 0,
    score: Math.max(
      0,
      Math.round(((completed / 12) * 0.45 + ((10 - Math.min(10, blockers.length)) / 10) * 0.55) * 100),
    ),
    blockerCount: blockers.length,
    warningCount: items.length - blockers.length,
    items,
  };
}

async function ownedRecord(versionId: string, actorId: string, client: Prisma.TransactionClient | typeof db = db) {
  const version = await client.visionWaypointVersion.findFirst({
    where: { id: versionId, waypoint: { ownerId: actorId } },
    include: authoringInclude,
  });
  if (!version) throw new VisionDomainError("WAYPOINT_VERSION_NOT_FOUND", "Vision Waypoint version not found.");
  return version;
}

function assertEditable(version: AuthoringRecord, expectedRevision: number) {
  if (version.publishedAt || version.lifecycleStatus !== "DRAFT")
    throw new VisionDomainError(
      "PUBLISHED_VERSION_IMMUTABLE",
      "Published or sealed waypoint versions cannot be edited.",
    );
  if (version.authoringRevision !== expectedRevision)
    throw new VisionDomainError(
      "AUTHORING_CONFLICT",
      "This draft changed in another window. Reload before saving again.",
      { currentRevision: version.authoringRevision },
    );
}

async function advanceRevision(
  tx: Prisma.TransactionClient,
  version: AuthoringRecord,
  expectedRevision: number,
  data: Prisma.VisionWaypointVersionUpdateManyMutationInput = {},
) {
  const updated = await tx.visionWaypointVersion.updateMany({
    where: { id: version.id, authoringRevision: expectedRevision, lifecycleStatus: "DRAFT", publishedAt: null },
    data: { ...data, authoringRevision: { increment: 1 } },
  });
  if (updated.count !== 1)
    throw new VisionDomainError(
      "AUTHORING_CONFLICT",
      "This draft changed while it was being saved. Reload and review the newest version.",
    );
}

export async function getAuthoringAggregate(versionId: string, actorId: string) {
  return publicRecord(await ownedRecord(versionId, actorId));
}

async function assertAssetIds(version: AuthoringRecord, assetIds: string[]) {
  const allowed = new Set(
    version.recordingAssets.filter((asset) => !asset.deletedAt && asset.isUsable).map((asset) => asset.id),
  );
  if (assetIds.some((id) => !allowed.has(id)))
    throw new VisionDomainError(
      "INVALID_AUTHORING_ASSET",
      "One or more selected recordings are unavailable or unusable.",
    );
}

export async function mutateAuthoring(versionId: string, unchecked: unknown, actorId: string) {
  const input = authoringMutationSchema.parse(unchecked) as AuthoringMutation;
  await db.$transaction(async (tx) => {
    const version = await ownedRecord(versionId, actorId, tx);
    assertEditable(version, input.expectedRevision);
    let revisionData: Prisma.VisionWaypointVersionUpdateManyMutationInput = {};

    if (input.operation === "SAVE_STEP") {
      const configuration = visionWaypointDraftConfigurationSchema.parse(parseObject(version.draftConfiguration));
      const authoring = applyStep(
        authoringFromConfiguration(configuration as unknown as JsonRecord),
        input.step,
        input.data,
        input.complete,
      );
      const nextConfiguration = { ...configuration, authoring };
      revisionData = {
        draftConfiguration: JSON.stringify(nextConfiguration),
        currentWizardStep: Math.min(12, input.step + (input.complete ? 1 : 0)),
      };
      if (input.step === 1) {
        revisionData.verificationProfile = input.data.verificationProfile;
        await tx.visionWaypoint.update({ where: { id: version.waypointId }, data: { type: input.data.waypointType } });
      }
    } else if (input.operation === "SET_NAVIGATION") {
      revisionData = { authoringMode: input.mode, currentWizardStep: input.currentStep };
    } else if (input.operation === "UPSERT_POSE_REGION") {
      const data = {
        waypointVersionId: version.id,
        coordinateSystem: "CREATOR_PROVISIONAL_2D",
        shapeType: "CIRCLE",
        parameters: JSON.stringify(input.parameters),
        classification: input.classification,
        orientationRules: JSON.stringify({ plainLanguage: input.orientationRules }),
        targetVisibilityRules: JSON.stringify({ plainLanguage: input.visibilityRules }),
        authoringSource: "STUDIO_GUIDED",
      };
      if (input.id) {
        const updated = await tx.visionPoseRegion.updateMany({
          where: { id: input.id, waypointVersionId: version.id },
          data,
        });
        if (!updated.count) throw new VisionDomainError("POSE_REGION_NOT_FOUND", "Accepted-area region not found.");
      } else await tx.visionPoseRegion.create({ data });
    } else if (input.operation === "DELETE_POSE_REGION") {
      const deleted = await tx.visionPoseRegion.deleteMany({ where: { id: input.id, waypointVersionId: version.id } });
      if (!deleted.count) throw new VisionDomainError("POSE_REGION_NOT_FOUND", "Accepted-area region not found.");
    } else if (input.operation === "UPSERT_VISUAL_REGION") {
      await assertAssetIds(version, [input.recordingAssetId]);
      const data = {
        waypointVersionId: version.id,
        recordingAssetId: input.recordingAssetId,
        regionType: input.regionType,
        coordinateSpace: "NORMALIZED_IMAGE",
        geometry: JSON.stringify(input.geometry),
        semanticLabel: input.semanticLabel,
        createdBy: actorId,
      };
      if (input.id) {
        const updated = await tx.visionRegion.updateMany({
          where: { id: input.id, waypointVersionId: version.id },
          data,
        });
        if (!updated.count) throw new VisionDomainError("VISUAL_REGION_NOT_FOUND", "Visual region not found.");
      } else await tx.visionRegion.create({ data });
    } else if (input.operation === "DELETE_VISUAL_REGION") {
      const deleted = await tx.visionRegion.deleteMany({ where: { id: input.id, waypointVersionId: version.id } });
      if (!deleted.count) throw new VisionDomainError("VISUAL_REGION_NOT_FOUND", "Visual region not found.");
    } else if (input.operation === "UPSERT_HARD_NEGATIVE") {
      await assertAssetIds(version, input.assetIds);
      const data = {
        waypointVersionId: version.id,
        name: input.name,
        classification: input.classification,
        strongestConfuserReference: input.assetIds[0],
        metadata: JSON.stringify({ reason: input.reason, assetIds: [...input.assetIds].sort() }),
      };
      if (input.id) {
        const updated = await tx.visionHardNegativeSet.updateMany({
          where: { id: input.id, waypointVersionId: version.id },
          data,
        });
        if (!updated.count) throw new VisionDomainError("HARD_NEGATIVE_NOT_FOUND", "Wrong-place example not found.");
      } else await tx.visionHardNegativeSet.create({ data });
    } else if (input.operation === "DELETE_HARD_NEGATIVE") {
      const deleted = await tx.visionHardNegativeSet.deleteMany({
        where: { id: input.id, waypointVersionId: version.id },
      });
      if (!deleted.count) throw new VisionDomainError("HARD_NEGATIVE_NOT_FOUND", "Wrong-place example not found.");
    } else if (input.operation === "UPDATE_ASSET") {
      const asset = version.recordingAssets.find(
        (candidate) => candidate.id === input.artifactId && !candidate.deletedAt,
      );
      if (!asset) throw new VisionDomainError("CAPTURE_ARTIFACT_NOT_FOUND", "The selected recording was not found.");
      const end = input.segmentEndMs ?? asset.durationMs;
      if (end !== null && input.segmentStartMs !== null && end <= input.segmentStartMs)
        throw new VisionDomainError("INVALID_RECORDING_RANGE", "The recording end must be after its start.");
      await tx.visionRecordingAsset.update({
        where: { id: asset.id },
        data: {
          creatorLabel: input.label,
          creatorNotes: input.notes,
          role: input.role,
          isUsable: input.isUsable,
          segmentStartMs: input.segmentStartMs,
          segmentEndMs: input.segmentEndMs,
        },
      });
    } else if (input.operation === "SPLIT_ASSET") {
      const asset = version.recordingAssets.find(
        (candidate) => candidate.id === input.artifactId && !candidate.deletedAt,
      );
      if (!asset || !asset.durationMs)
        throw new VisionDomainError("CAPTURE_ARTIFACT_NOT_FOUND", "A timed recording is required for a logical split.");
      const start = asset.segmentStartMs ?? 0;
      const end = asset.segmentEndMs ?? asset.durationMs;
      if (input.splitAtMs <= start || input.splitAtMs >= end)
        throw new VisionDomainError(
          "INVALID_RECORDING_RANGE",
          "Split time must be inside the selected recording range.",
        );
      await tx.visionRecordingAsset.update({
        where: { id: asset.id },
        data: { segmentStartMs: start, segmentEndMs: input.splitAtMs },
      });
      const derivedHash = `sha256:${createHash("sha256").update(`${asset.contentHash}:${input.splitAtMs}:${end}`).digest("hex")}`;
      const manifest = {
        ...parseObject(asset.artifactManifest),
        logicalSegment: {
          sourceAssetId: asset.sourceAssetId ?? asset.id,
          startMs: input.splitAtMs,
          endMs: end,
          mediaNotReencoded: true,
        },
      };
      await tx.visionRecordingAsset.create({
        data: {
          waypointVersionId: version.id,
          captureSessionId: asset.captureSessionId,
          assetType: "CREATOR_LOGICAL_SEGMENT",
          storageReference: asset.storageReference,
          contentHash: derivedHash,
          fileSize: Math.max(1, Math.round(asset.fileSize * ((end - input.splitAtMs) / asset.durationMs))),
          mediaType: asset.mediaType,
          manifestVersion: asset.manifestVersion,
          artifactManifest: JSON.stringify(manifest),
          durationMs: end - input.splitAtMs,
          datasetPartition: asset.datasetPartition,
          truthLabel: asset.truthLabel,
          creatorLabel: `${asset.creatorLabel ?? "Recording"} (segment)`,
          creatorNotes: asset.creatorNotes,
          role: asset.role,
          isUsable: asset.isUsable,
          segmentStartMs: input.splitAtMs,
          segmentEndMs: end,
          sourceAssetId: asset.sourceAssetId ?? asset.id,
          qualitySummary: asset.qualitySummary,
          integrityState: asset.integrityState,
          cloudState: asset.cloudState,
        },
      });
    } else if (input.operation === "UPSERT_TEST") {
      await assertAssetIds(version, input.assetIds);
      const data = {
        waypointVersionId: version.id,
        name: input.name,
        testType: input.testType,
        expectedResult: input.expectedResult,
        instructions: input.instructions,
        environment: JSON.stringify({ plainLanguage: input.environment, assetIds: [...input.assetIds].sort() }),
        assetRole: "VALIDATION",
        status: "AUTHORED",
      };
      if (input.id) {
        const existing = version.testRuns.find((test) => test.id === input.id);
        if (!existing) throw new VisionDomainError("WAYPOINT_TEST_NOT_FOUND", "Test case not found.");
        if (existing.lockedAt)
          throw new VisionDomainError("LOCKED_TEST_IMMUTABLE", "Locked test cases cannot be edited.");
        await tx.visionWaypointTestRun.update({ where: { id: input.id }, data });
      } else await tx.visionWaypointTestRun.create({ data });
    } else if (input.operation === "LOCK_TEST") {
      const existing = version.testRuns.find((test) => test.id === input.id);
      if (!existing) throw new VisionDomainError("WAYPOINT_TEST_NOT_FOUND", "Test case not found.");
      if (!existing.lockedAt) {
        const assetIds = parseObject(existing.environment).assetIds;
        if (Array.isArray(assetIds))
          await tx.visionRecordingAsset.updateMany({
            where: {
              waypointVersionId: version.id,
              id: { in: assetIds.filter((id): id is string => typeof id === "string") },
            },
            data: { datasetPartition: "LOCKED_TEST" },
          });
        await tx.visionWaypointTestRun.update({
          where: { id: input.id },
          data: { lockedAt: new Date(), assetRole: "LOCKED_TEST", status: "LOCKED" },
        });
      }
    } else if (input.operation === "DELETE_TEST") {
      const existing = version.testRuns.find((test) => test.id === input.id);
      if (!existing) throw new VisionDomainError("WAYPOINT_TEST_NOT_FOUND", "Test case not found.");
      if (existing.lockedAt)
        throw new VisionDomainError("LOCKED_TEST_IMMUTABLE", "Locked test cases cannot be deleted.");
      await tx.visionWaypointTestRun.delete({ where: { id: input.id } });
    }

    await advanceRevision(tx, version, input.expectedRevision, revisionData);
    await audit(tx, {
      actorId,
      action: "VISION_AUTHORING_MUTATED",
      resourceId: version.id,
      metadata: {
        operation: input.operation,
        previousRevision: input.expectedRevision,
        nextRevision: input.expectedRevision + 1,
      },
    });
  });
  return getAuthoringAggregate(versionId, actorId);
}

function buildInputFor(record: ReturnType<typeof publicRecord>) {
  return {
    schemaVersion: BUILD_INPUT_SCHEMA_VERSION,
    inputType: "VISION_WAYPOINT_BUILD_INPUT",
    waypoint: {
      id: record.waypoint.id,
      versionId: record.version.id,
      versionNumber: record.version.versionNumber,
      type: record.waypoint.type,
      verificationProfile: record.version.verificationProfile,
    },
    authoring: record.authoring,
    assets: record.assets
      .filter((asset) => asset.isUsable && !asset.deletedAt)
      .map((asset) => ({
        id: asset.id,
        role: asset.role,
        contentHash: asset.contentHash,
        durationMs: asset.durationMs,
        segmentStartMs: asset.segmentStartMs,
        segmentEndMs: asset.segmentEndMs,
        sourceAssetId: asset.sourceAssetId,
        integrityState: asset.integrityState,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    acceptedPoseRegions: [...record.poseRegions].sort((left, right) => left.id.localeCompare(right.id)),
    visualRegions: [...record.visualRegions].sort((left, right) => left.id.localeCompare(right.id)),
    hardNegatives: [...record.hardNegatives].sort((left, right) => left.id.localeCompare(right.id)),
    validationTests: record.tests
      .filter((test) => !test.lockedAt)
      .sort((left, right) => left.id.localeCompare(right.id)),
    lockedTests: record.tests.filter((test) => test.lockedAt).sort((left, right) => left.id.localeCompare(right.id)),
    boundary: {
      implementation: "LOCAL_COMPANION_BUILD_REQUIRED",
      modelProduced: false,
      confidenceProduced: false,
      certificationProduced: false,
      shadowModeOnly: true,
      automaticProgression: false,
    },
  };
}

export async function prepareBuildInput(versionId: string, unchecked: unknown, actorId: string) {
  if (!["1", "true", "enabled"].includes((process.env.FEATURE_VISION_BUILD_ENGINE ?? "").toLocaleLowerCase()))
    throw new VisionDomainError(
      "VISION_BUILD_ENGINE_DISABLED",
      "The local Vision build engine is disabled. Enable it explicitly for pilot builders.",
    );
  const expectedRevision =
    typeof unchecked === "object" && unchecked && "expectedRevision" in unchecked
      ? Number((unchecked as JsonRecord).expectedRevision)
      : NaN;
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1)
    throw new VisionDomainError("INVALID_BUILD_REQUEST", "A current authoring revision is required.");
  const initial = await ownedRecord(versionId, actorId);
  assertEditable(initial, expectedRevision);
  const record = publicRecord(initial);
  if (!record.dataHealth.readyToPrepare)
    throw new VisionDomainError(
      "DATA_HEALTH_BLOCKED",
      `Build input has ${record.dataHealth.blockerCount} unresolved blocker(s).`,
      { dataHealth: record.dataHealth },
    );
  const buildInput = buildInputFor(record);
  const serialized = stableStringify(buildInput);
  const inputHash = createHash("sha256").update(serialized).digest("hex");
  const result = await db.$transaction(async (tx) => {
    const current = await ownedRecord(versionId, actorId, tx);
    assertEditable(current, expectedRevision);
    const job = await tx.visionBuildJob.create({
      data: {
        id: `build_${randomUUID()}`,
        waypointVersionId: versionId,
        executionTarget: record.authoring.steps.buildPreparation?.executionTarget ?? "LOCAL",
        engineMetadata: JSON.stringify({
          implementation: "LOCAL_COMPANION_VERIFICATION_ENGINE",
          phase: "B4",
          modelProduced: false,
          confidenceProduced: false,
        }),
        processingStage: "QUEUED",
        status: "QUEUED",
        progress: 0,
        logSummary: JSON.stringify([
          "Validated persisted authoring aggregate",
          "Canonicalized BuildInput",
          "Queued immutable input snapshot for local Companion build",
        ]),
        outputSummary: JSON.stringify({ inputHash, modelProduced: false, nextAction: "START_LOCAL_BUILD" }),
        inputSchemaVersion: BUILD_INPUT_SCHEMA_VERSION,
        buildInput: serialized,
        inputHash,
        startedAt: null,
        completedAt: null,
      },
    });
    await advanceRevision(tx, current, expectedRevision, { lifecycleStatus: "READY_TO_BUILD" });
    await audit(tx, {
      actorId,
      action: "VISION_BUILD_INPUT_PREPARED",
      resourceId: versionId,
      metadata: { jobId: job.id, inputHash, queuedForLocalBuild: true, modelProduced: false },
    });
    return {
      jobId: job.id,
      inputHash,
      schemaVersion: BUILD_INPUT_SCHEMA_VERSION,
      modelProduced: false,
      confidenceProduced: false,
      status: "QUEUED",
      processingStage: "QUEUED",
    };
  });
  return { ...result, authoring: await getAuthoringAggregate(versionId, actorId) };
}

export async function getBuildInput(jobId: string, actorId: string) {
  const job = await db.visionBuildJob.findFirst({
    where: { id: jobId, waypointVersion: { waypoint: { ownerId: actorId } } },
    select: { id: true, inputSchemaVersion: true, inputHash: true, buildInput: true, status: true },
  });
  if (!job) throw new VisionDomainError("BUILD_JOB_NOT_FOUND", "Build-input job not found.");
  return {
    id: job.id,
    schemaVersion: job.inputSchemaVersion,
    inputHash: job.inputHash,
    status: job.status,
    buildInput: JSON.parse(job.buildInput) as unknown,
  };
}
