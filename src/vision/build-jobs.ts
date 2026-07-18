import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";
import { VisionDomainError } from "@/vision/domain";

const progressStages = z.enum([
  "QUEUED",
  "INGESTING",
  "VALIDATING_INPUT",
  "CURATING_FRAMES",
  "EXTRACTING_GLOBAL_FEATURES",
  "EXTRACTING_LOCAL_FEATURES",
  "MATCHING_REFERENCE_GRAPH",
  "RECONSTRUCTING",
  "BUILDING_TARGET_INDEX",
  "BUILDING_NEGATIVE_INDEX",
  "ESTIMATING_ACCEPTED_POSE_VOLUME",
  "CALIBRATING",
  "RUNNING_VALIDATION",
  "RUNNING_LOCKED_TESTS",
  "PACKAGING",
  "VALIDATING_PACKAGE",
]);
const identifier = z
  .string()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/);
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const jsonRecord = z.record(z.string(), z.unknown());

const updateSchema = z.discriminatedUnion("event", [
  z
    .object({
      event: z.literal("PROGRESS"),
      stage: progressStages,
      progress: z.number().min(0).max(1).nullable(),
      messageCode: z.string().min(1).max(120),
      detail: jsonRecord.optional(),
    })
    .strict(),
  z
    .object({
      event: z.literal("COMPLETED"),
      report: jsonRecord,
      packageArtifact: z
        .object({
          packageId: identifier,
          storageReference: z.string().regex(/^companion:\/\/vision-packages\/pkg_[A-Za-z0-9-]+$/),
          contentHash: hash,
          fileSize: z.number().int().positive().max(2_147_483_647),
        })
        .strict(),
    })
    .strict(),
  z.object({ event: z.literal("FAILED"), failureCode: z.string().min(1).max(120), report: jsonRecord }).strict(),
  z.object({ event: z.literal("CANCELLED"), report: jsonRecord.optional() }).strict(),
]);

function safeEngineJson(value: unknown, label: string) {
  const serialized = JSON.stringify(value);
  if (serialized.length > 1_500_000)
    throw new VisionDomainError("ENGINE_REPORT_TOO_LARGE", `${label} exceeds the persisted report limit.`);
  if (/"(?:pixels|luminanceBase64|rawFrames|rawMedia)"\s*:/i.test(serialized))
    throw new VisionDomainError("ENGINE_REPORT_CONTAINS_RAW_MEDIA", `${label} contains forbidden raw-frame fields.`);
  return serialized;
}

function reportCertification(report: Record<string, unknown>) {
  const certification = (
    report.certification && typeof report.certification === "object" ? report.certification : {}
  ) as Record<string, unknown>;
  const grade = ["EXCELLENT", "GOOD", "NEEDS_IMPROVEMENT", "UNSAFE"].includes(String(certification.reliabilityGrade))
    ? String(certification.reliabilityGrade)
    : "UNSAFE";
  const metrics = (
    certification.metrics && typeof certification.metrics === "object" ? certification.metrics : {}
  ) as Record<string, unknown>;
  return { grade, metrics, approvedRuntimeModes: ["SHADOW"] };
}

async function audit(actorId: string, action: string, jobId: string, metadata: Record<string, unknown>) {
  await db.platformAuditEvent.create({
    data: {
      actorType: "CREATOR",
      actorId,
      action,
      resourceType: "VISION_BUILD_JOB",
      resourceId: jobId,
      outcome: "SUCCEEDED",
      correlationId: jobId,
      metadata: JSON.stringify(safeAuditMetadata(metadata)),
    },
  });
}

export async function getVisionBuildJob(jobId: string, actorId: string) {
  const job = await db.visionBuildJob.findFirst({
    where: { id: jobId, waypointVersion: { waypoint: { ownerId: actorId } } },
    include: { artifacts: true, waypointVersion: { select: { lifecycleStatus: true } } },
  });
  if (!job) throw new VisionDomainError("BUILD_JOB_NOT_FOUND", "Vision build job not found.");
  return {
    id: job.id,
    waypointVersionId: job.waypointVersionId,
    inputSchemaVersion: job.inputSchemaVersion,
    inputHash: job.inputHash,
    status: job.status,
    processingStage: job.processingStage,
    progress: job.progress,
    buildInput: JSON.parse(job.buildInput) as unknown,
    outputSummary: JSON.parse(job.outputSummary) as unknown,
    report: JSON.parse(job.report) as unknown,
    packageId: job.packageId,
    packageHash: job.packageHash,
    reliabilityGrade: job.reliabilityGrade,
    automaticEligibility: false,
    lifecycleStatus: job.waypointVersion.lifecycleStatus,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

export async function updateVisionBuildJob(jobId: string, unchecked: unknown, actorId: string) {
  const input = updateSchema.parse(unchecked);
  const owned = await db.visionBuildJob.findFirst({
    where: { id: jobId, waypointVersion: { waypoint: { ownerId: actorId } } },
  });
  if (!owned) throw new VisionDomainError("BUILD_JOB_NOT_FOUND", "Vision build job not found.");
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(owned.status)) return getVisionBuildJob(jobId, actorId);
  const now = new Date();
  if (input.event === "PROGRESS") {
    await db.$transaction([
      db.visionBuildJob.update({
        where: { id: jobId },
        data: {
          status: "RUNNING",
          processingStage: input.stage,
          progress: input.progress ?? owned.progress,
          startedAt: owned.startedAt ?? now,
          lastHeartbeatAt: now,
          logSummary: JSON.stringify([
            ...(JSON.parse(owned.logSummary) as unknown[]).slice(-199),
            { at: now.toISOString(), code: input.messageCode, stage: input.stage, detail: input.detail ?? {} },
          ]),
        },
      }),
      db.visionWaypointVersion.update({
        where: { id: owned.waypointVersionId },
        data: { lifecycleStatus: "BUILDING" },
      }),
    ]);
    return getVisionBuildJob(jobId, actorId);
  }
  if (input.event === "COMPLETED") {
    const report = input.report;
    if (input.packageArtifact.storageReference !== `companion://vision-packages/${input.packageArtifact.packageId}`)
      throw new VisionDomainError(
        "PACKAGE_IDENTITY_MISMATCH",
        "Package storage reference does not match its immutable package ID.",
      );
    const certification = reportCertification(report);
    const inputHash = String(report.inputHash ?? "").replace(/^sha256:/, "");
    if (inputHash !== owned.inputHash)
      throw new VisionDomainError(
        "BUILD_INPUT_HASH_MISMATCH",
        "Companion report does not match the queued BuildInput.",
      );
    const packageManifest = (
      report.package &&
      typeof report.package === "object" &&
      "manifest" in report.package &&
      report.package.manifest &&
      typeof report.package.manifest === "object"
        ? report.package.manifest
        : {}
    ) as Record<string, unknown>;
    const approvedModes = (
      report.certification &&
      typeof report.certification === "object" &&
      "approvedRuntimeModes" in report.certification &&
      Array.isArray(report.certification.approvedRuntimeModes)
        ? report.certification.approvedRuntimeModes
        : []
    ).map(String);
    if (
      report.buildId !== jobId ||
      report.status !== "COMPLETED" ||
      report.shadowModeOnly !== true ||
      packageManifest.packageId !== input.packageArtifact.packageId ||
      packageManifest.packageHash !== input.packageArtifact.contentHash ||
      packageManifest.waypointVersionId !== owned.waypointVersionId ||
      packageManifest.shadowModeOnly !== true ||
      packageManifest.automaticEligibility !== false ||
      approvedModes.length !== 1 ||
      approvedModes[0] !== "SHADOW"
    )
      throw new VisionDomainError(
        "BUILD_REPORT_CONTRACT_MISMATCH",
        "Companion report does not match the governed shadow package contract.",
      );
    const lifecycleStatus =
      certification.grade === "UNSAFE"
        ? "UNSAFE"
        : certification.grade === "NEEDS_IMPROVEMENT"
          ? "NEEDS_ADDITIONAL_DATA"
          : "SHADOW_READY";
    const metrics = certification.metrics;
    const validationHash = createHash("sha256").update(JSON.stringify(metrics)).digest("hex");
    await db.$transaction(async (tx) => {
      const artifact = await tx.visionBuildArtifact.create({
        data: {
          waypointVersionId: owned.waypointVersionId,
          buildJobId: jobId,
          artifactType: "RUNTIME_PACKAGE",
          storageReference: input.packageArtifact.storageReference,
          contentHash: input.packageArtifact.contentHash,
          fileSize: input.packageArtifact.fileSize,
          schemaVersion: 1,
        },
      });
      await tx.visionCertificationRun.create({
        data: {
          waypointVersionId: owned.waypointVersionId,
          buildArtifactId: artifact.id,
          validationPartitionHash: validationHash,
          lockedTestPartitionHash: validationHash,
          thresholds: safeEngineJson(report.calibration ?? {}, "Calibration"),
          profile: String((report.calibration as Record<string, unknown> | undefined)?.profile ?? "BALANCED"),
          metrics: safeEngineJson(metrics, "Certification metrics"),
          observedFalseResults: safeEngineJson(
            { falseAccepts: metrics.falseAccepts ?? null, falseRejects: metrics.falseRejects ?? null },
            "False-result summary",
          ),
          reliabilityGrade: certification.grade,
          approvedRuntimeModes: JSON.stringify(certification.approvedRuntimeModes),
          reportReference: `database://vision-build-jobs/${jobId}/report`,
          completedAt: now,
        },
      });
      await tx.visionBuildJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          processingStage: "COMPLETE",
          progress: 1,
          completedAt: now,
          lastHeartbeatAt: now,
          packageId: input.packageArtifact.packageId,
          packageHash: input.packageArtifact.contentHash,
          report: safeEngineJson(report, "Build report"),
          providerMetadata: safeEngineJson(report.provider ?? {}, "Provider metadata"),
          reliabilityGrade: certification.grade,
          automaticEligibility: false,
          outputSummary: JSON.stringify({
            packageId: input.packageArtifact.packageId,
            packageHash: input.packageArtifact.contentHash,
            reliabilityGrade: certification.grade,
            shadowModeOnly: true,
            automaticEligibility: false,
          }),
        },
      });
      await tx.visionWaypointVersion.update({
        where: { id: owned.waypointVersionId },
        data: {
          lifecycleStatus,
          packageArtifactReference: input.packageArtifact.storageReference,
          certificationReference: `database://vision-build-jobs/${jobId}/certification`,
          compatibilityMetadata: JSON.stringify({
            packageSchemaVersion: 1,
            shadowModeOnly: true,
            automaticProgression: false,
          }),
        },
      });
    });
    await audit(actorId, "VISION_BUILD_COMPLETED", jobId, {
      packageId: input.packageArtifact.packageId,
      packageHash: input.packageArtifact.contentHash,
      reliabilityGrade: certification.grade,
      automaticEligibility: false,
    });
    return getVisionBuildJob(jobId, actorId);
  }
  const cancelled = input.event === "CANCELLED";
  await db.$transaction([
    db.visionBuildJob.update({
      where: { id: jobId },
      data: {
        status: cancelled ? "CANCELLED" : "FAILED",
        processingStage: cancelled ? "CANCELLED" : "FAILED",
        failureCode: cancelled ? "BUILD_CANCELLED" : input.failureCode,
        report: safeEngineJson(input.report ?? {}, "Failure report"),
        completedAt: now,
        lastHeartbeatAt: now,
      },
    }),
    db.visionWaypointVersion.update({
      where: { id: owned.waypointVersionId },
      data: { lifecycleStatus: cancelled ? "READY_TO_BUILD" : "BUILD_FAILED" },
    }),
  ]);
  await audit(actorId, cancelled ? "VISION_BUILD_CANCELLED" : "VISION_BUILD_FAILED", jobId, {
    failureCode: cancelled ? "BUILD_CANCELLED" : input.failureCode,
  });
  return getVisionBuildJob(jobId, actorId);
}

const shadowAttemptSchema = z
  .object({
    attemptId: identifier,
    waypointId: identifier,
    waypointVersionId: identifier,
    packageId: identifier,
    packageHash: hash,
    stageToken: identifier,
    result: z.enum([
      "VERIFIED",
      "INSUFFICIENT_VISUAL_EVIDENCE",
      "NOT_AT_TARGET",
      "AMBIGUOUS",
      "SYSTEM_ERROR",
      "CANCELLED",
    ]),
    guidanceCode: z.string().max(120).nullable().optional(),
    failedGates: z.array(z.string().max(120)).max(30),
    evidenceDigest: hash.nullable().optional(),
    engineVersion: z.string().min(1).max(120),
    modelBundleVersion: z.string().min(1).max(120),
    provider: z.string().min(1).max(120),
    providerFallbackUsed: z.boolean(),
    capturedFrameCount: z.number().int().nonnegative(),
    usableFrameCount: z.number().int().nonnegative(),
    passingFrameCount: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative().max(120_000),
    shadowMode: z.literal(true),
    automaticProgression: z.literal(false),
    diagnostics: jsonRecord,
  })
  .strict();

export async function persistShadowAttempt(unchecked: unknown, actorId: string) {
  const input = shadowAttemptSchema.parse(unchecked);
  const version = await db.visionWaypointVersion.findFirst({
    where: { id: input.waypointVersionId, waypointId: input.waypointId, waypoint: { ownerId: actorId } },
  });
  if (!version) throw new VisionDomainError("WAYPOINT_VERSION_NOT_FOUND", "Shadow result waypoint version not found.");
  const packageBuild = await db.visionBuildJob.findFirst({
    where: {
      waypointVersionId: input.waypointVersionId,
      packageId: input.packageId,
      packageHash: input.packageHash,
      status: "COMPLETED",
      automaticEligibility: false,
    },
    select: { id: true },
  });
  if (!packageBuild)
    throw new VisionDomainError(
      "SHADOW_PACKAGE_MISMATCH",
      "Shadow result does not match a completed package owned by this waypoint version.",
    );
  const existing = await db.visionShadowAttempt.findUnique({ where: { attemptId: input.attemptId } });
  if (existing)
    return { attemptId: existing.attemptId, persisted: true, idempotent: true, automaticProgression: false };
  await db.visionShadowAttempt.create({
    data: {
      attemptId: input.attemptId,
      waypointId: input.waypointId,
      waypointVersionId: input.waypointVersionId,
      packageId: input.packageId,
      packageHash: input.packageHash,
      stageTokenHash: `sha256:${createHash("sha256").update(input.stageToken).digest("hex")}`,
      result: input.result,
      guidanceCode: input.guidanceCode ?? null,
      failedGates: JSON.stringify(input.failedGates),
      evidenceDigest: input.evidenceDigest ?? null,
      engineVersion: input.engineVersion,
      modelBundleVersion: input.modelBundleVersion,
      provider: input.provider,
      providerFallbackUsed: input.providerFallbackUsed,
      capturedFrameCount: input.capturedFrameCount,
      usableFrameCount: input.usableFrameCount,
      passingFrameCount: input.passingFrameCount,
      durationMs: input.durationMs,
      diagnostics: safeEngineJson(input.diagnostics, "Runtime diagnostics"),
      shadowMode: true,
      automaticProgression: false,
    },
  });
  await audit(actorId, "VISION_SHADOW_ATTEMPT_PERSISTED", input.attemptId, {
    waypointVersionId: input.waypointVersionId,
    result: input.result,
    evidenceDigest: input.evidenceDigest ?? null,
    automaticProgression: false,
  });
  return { attemptId: input.attemptId, persisted: true, idempotent: false, automaticProgression: false };
}
