import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { safeAuditMetadata } from "@/platform/audit";
import { parsePublishedSnapshot } from "@/tall-tale/publishing";
import { recordVisionStoryObservation, submitVerification, VerificationRejectedError } from "@/tall-tale/progression";
import {
  assertAttemptTransition,
  terminalStateForResult,
  verificationAttemptStateSchema,
  VisionDomainError,
  type VerificationAttemptState,
} from "@/vision/domain";
import { resolveVisionFeatureFlags } from "@/vision/feature-flags";
import { publishedVisionBindingConfiguration, publishedVisionBindingKey } from "@/vision/binding-contract";
import {
  captainVisionActionSchema,
  createRuntimeAttemptSchema,
  effectiveRuntimeMode,
  issueStageToken,
  offlineReconciliationSchema,
  runtimeResultPayloadHash,
  runtimeResultSchema,
  sanitizeRuntimeDiagnostics,
  verifyStageToken,
  type CaptainVisionAction,
  type RuntimeResult,
  type StageTokenContext,
} from "@/vision/runtime-contract";

const activeAttemptStates = [
  "IDLE",
  "ARMED",
  "CAPTURING",
  "CURATING_FRAMES",
  "RETRIEVING",
  "MATCHING",
  "LOCALIZING",
  "EVALUATING_SEQUENCE",
  "EVALUATING_SPECIAL_RULES",
  "VERIFIED",
  "AWAITING_CAPTAIN",
] as const;

function parseObject(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function parseArray(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function digest(value: string) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function normalizeHash(value: string) {
  return value.startsWith("sha256:") ? value : `sha256:${value}`;
}

function stableBindingKey(value: Record<string, unknown>) {
  return runtimeResultPayloadHash(value);
}

async function appendTransition(
  attemptId: string,
  toState: VerificationAttemptState,
  metadata: Record<string, unknown> = {},
) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const fromState = verificationAttemptStateSchema.parse(attempt.attemptState);
    if (fromState === toState) return attempt;
    assertAttemptTransition(fromState, toState);
    const latest = await tx.verificationAttemptTransition.findFirst({
      where: { attemptId },
      orderBy: { sequence: "desc" },
    });
    await tx.verificationAttemptTransition.create({
      data: {
        attemptId,
        sequence: (latest?.sequence ?? -1) + 1,
        fromState,
        toState,
        metadata: JSON.stringify(safeAuditMetadata(metadata)),
      },
    });
    return tx.verificationAttempt.update({
      where: { id: attemptId },
      data: {
        attemptState: toState,
        ...(toState === "CAPTURING" ? { startedAt: new Date() } : {}),
        ...((
          [
            "VERIFIED",
            "INSUFFICIENT",
            "NOT_AT_TARGET",
            "AMBIGUOUS",
            "ERROR",
            "CANCELLED",
            "STALE",
          ] as readonly VerificationAttemptState[]
        ).includes(toState)
          ? { completedAt: new Date() }
          : {}),
      },
    });
  });
}

async function publishedBindingFor(
  session: { publishedVersionId: string; taleId: string },
  block: ReturnType<typeof parsePublishedSnapshot>["chapters"][number]["blocks"][number],
  waypointId: string,
  waypointVersionId: string,
) {
  const configuration = publishedVisionBindingConfiguration(block);
  const bindingKey = stableBindingKey(
    publishedVisionBindingKey({
      publishedVersionId: session.publishedVersionId,
      storyId: session.taleId,
      stageId: block.id,
      waypointId,
      waypointVersionId,
      configuration,
    }),
  );
  const existing = await db.visionPublishedBinding.findUnique({
    where: { publishedVersionId_stageId: { publishedVersionId: session.publishedVersionId, stageId: block.id } },
  });
  if (existing) {
    if (existing.bindingKey !== bindingKey)
      throw new VisionDomainError(
        "PUBLISHED_BINDING_IMMUTABILITY_VIOLATION",
        "The stored published Vision binding differs from the signed story snapshot.",
      );
    return { binding: existing, configuration };
  }
  const binding = await db.visionPublishedBinding.create({
    data: {
      bindingKey,
      publishedVersionId: session.publishedVersionId,
      storyId: session.taleId,
      stageId: block.id,
      waypointId,
      waypointVersionId,
      runtimeMode: configuration.runtimeMode,
      scanInteraction: JSON.stringify(configuration.scanInteraction),
      scanConfiguration: JSON.stringify(configuration.scanConfiguration),
      successEvent: configuration.successEvent,
      guidanceConfiguration: JSON.stringify(configuration.guidanceConfiguration),
      captainFallbackPolicy: JSON.stringify(configuration.captainFallbackPolicy),
      offlineBehavior: configuration.offlineBehavior,
      assignmentPolicy: JSON.stringify(configuration.assignmentPolicy),
      accessibilityPolicy: JSON.stringify(configuration.accessibilityPolicy),
    },
  });
  return { binding, configuration };
}

function stageContext(attempt: {
  id: string;
  playerId: string | null;
  sessionId: string | null;
  storyId: string;
  publishedVersionId: string | null;
  stageId: string;
  publishedBindingId: string | null;
  waypointVersionId: string;
  packageHash: string | null;
  storyStateVersion: number | null;
  effectiveRuntimeMode: string;
  companionInstanceId: string | null;
}): StageTokenContext {
  if (
    !attempt.sessionId ||
    !attempt.publishedVersionId ||
    !attempt.publishedBindingId ||
    !attempt.packageHash ||
    attempt.storyStateVersion === null ||
    !attempt.companionInstanceId
  )
    throw new VisionDomainError("ATTEMPT_CONTEXT_MISSING", "The governed attempt context is incomplete.");
  return {
    attemptId: attempt.id,
    playerId: attempt.playerId,
    sessionId: attempt.sessionId,
    storyId: attempt.storyId,
    publishedVersionId: attempt.publishedVersionId,
    stageId: attempt.stageId,
    storyBindingId: attempt.publishedBindingId,
    waypointVersionId: attempt.waypointVersionId,
    packageHash: normalizeHash(attempt.packageHash),
    storyStateVersion: attempt.storyStateVersion,
    runtimeMode: attempt.effectiveRuntimeMode,
    companionInstanceId: attempt.companionInstanceId,
  };
}

export async function createRuntimeVerificationAttempt(
  unchecked: unknown,
  actor: { playerId?: string; actorId?: string },
) {
  const input = createRuntimeAttemptSchema.parse(unchecked);
  const session = await db.taleSession.findUnique({
    where: { id: input.sessionId },
    include: { version: true },
  });
  if (!session?.publishedVersionId || !session.version)
    throw new VisionDomainError("SESSION_NOT_VERSIONED", "A published Tall Tale session is required.");
  if (session.status !== "ACTIVE")
    throw new VisionDomainError("SESSION_NOT_ACTIVE", "The Tall Tale must be active before scanning.");
  if (session.currentBlockId !== input.blockId)
    throw new VisionDomainError("STORY_STAGE_CHANGED", "The story is no longer at this Vision Waypoint.");
  const block = parsePublishedSnapshot(session.version.contentSnapshot)
    .chapters.flatMap((chapter) => chapter.blocks)
    .find((candidate) => candidate.id === input.blockId);
  if (
    !block ||
    block.blockType !== "visionWaypoint" ||
    String(block.configuration.waypointVersionId ?? "") !== input.waypointVersionId
  )
    throw new VisionDomainError(
      "PUBLISHED_BINDING_MISMATCH",
      "The attempt does not match this published Tall Tale's immutable Vision binding.",
    );
  const waypointVersion = await db.visionWaypointVersion.findUnique({
    where: { id: input.waypointVersionId },
    include: {
      waypoint: true,
      buildJobs: { where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 5 },
      certificationRuns: { orderBy: { completedAt: "desc" }, take: 1 },
    },
  });
  if (!waypointVersion?.publishedAt)
    throw new VisionDomainError("PUBLISHED_VERSION_REQUIRED", "The waypoint version is not published.");
  const { binding, configuration } = await publishedBindingFor(
    { publishedVersionId: session.publishedVersionId, taleId: session.taleId },
    block,
    waypointVersion.waypointId,
    waypointVersion.id,
  );
  if (["DEVELOPMENT", "DEVELOPMENT_MOCK"].includes(configuration.runtimeMode))
    throw new VisionDomainError(
      "DEVELOPMENT_ADAPTER_REQUIRED",
      "Development bindings must use the deterministic development verifier.",
    );
  const build = waypointVersion.buildJobs.find((candidate) => candidate.packageId && candidate.packageHash);
  if (!build?.packageId || !build.packageHash || !/^(sha256:)?[a-f0-9]{64}$/.test(build.packageHash))
    throw new VisionDomainError(
      "PRODUCTION_PACKAGE_REQUIRED",
      "This waypoint has no completed B-4 runtime package with a valid content hash.",
    );
  const packageId = build.packageId;
  const packageHash = normalizeHash(build.packageHash);
  const certification = waypointVersion.certificationRuns[0] ?? null;
  const approvedModes = parseArray(certification?.approvedRuntimeModes).map(String);
  const metrics = parseObject(certification?.metrics);
  const fieldEvidenceStatus = typeof metrics.fieldEvidenceStatus === "string" ? metrics.fieldEvidenceStatus : "MISSING";
  const flags = resolveVisionFeatureFlags();
  const priorControl = await db.visionRuntimeControl.findUnique({
    where: { sessionId_stageId: { sessionId: session.id, stageId: block.id } },
  });
  const decision = effectiveRuntimeMode({
    configuredMode: configuration.runtimeMode,
    shadowEnabled: flags.shadow_verification,
    automaticEnabled: flags.automatic_progression && flags.automatic_vision_progression && flags.live_external_ar,
    automaticEligibility: build.automaticEligibility,
    certificationApprovedModes: approvedModes,
    fieldEvidenceStatus,
    automaticPaused: priorControl?.automaticPaused,
  });
  if (decision.mode === "DISABLED")
    throw new VisionDomainError(decision.reason ?? "VISION_DISABLED", "Vision scanning is unavailable for this stage.");
  if (!flags.vision_runtime_engine || !flags.live_external_ar)
    throw new VisionDomainError(
      "PRODUCTION_RUNTIME_DISABLED",
      "The B-4 production runtime and live external AR feature flags must both be enabled.",
    );
  const active = await db.verificationAttempt.findFirst({
    where: {
      sessionId: session.id,
      stageId: block.id,
      playerId: actor.playerId ?? null,
      attemptState: { in: [...activeAttemptStates] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (active)
    throw new VisionDomainError(
      "ATTEMPT_ALREADY_ACTIVE",
      "Finish or cancel the active inspection before starting another.",
    );
  const request = await db.taleVerificationRequest.findFirst({
    where: { sessionId: session.id, blockId: block.id, providerType: "visionLocation", status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });
  if (!request) throw new VisionDomainError("VERIFICATION_REQUEST_REQUIRED", "The story has no active Vision request.");
  const draftBinding = await db.storyWaypointBinding.findFirst({
    where: { storyId: session.taleId, blockId: block.id, waypointVersionId: waypointVersion.id },
  });
  const attemptId = `att_${randomUUID()}`;
  const tokenContext: StageTokenContext = {
    attemptId,
    playerId: actor.playerId ?? null,
    sessionId: session.id,
    storyId: session.taleId,
    publishedVersionId: session.publishedVersionId,
    stageId: block.id,
    storyBindingId: binding.id,
    waypointVersionId: waypointVersion.id,
    packageHash,
    storyStateVersion: session.currentSequence,
    runtimeMode: decision.mode,
    companionInstanceId: input.companionInstanceId,
  };
  const stageToken = issueStageToken(tokenContext);
  await db.$transaction(async (tx) => {
    await tx.visionRuntimeControl.upsert({
      where: { sessionId_stageId: { sessionId: session.id, stageId: block.id } },
      update: {
        configuredMode: configuration.runtimeMode,
        effectiveMode: decision.mode,
        certificationRunId: certification?.id ?? null,
        fieldEvidenceStatus,
        demotionReason: decision.reason,
      },
      create: {
        sessionId: session.id,
        storyBindingId: draftBinding?.id ?? null,
        stageId: block.id,
        configuredMode: configuration.runtimeMode,
        effectiveMode: decision.mode,
        certificationRunId: certification?.id ?? null,
        fieldEvidenceStatus,
        demotionReason: decision.reason,
      },
    });
    await tx.verificationAttempt.create({
      data: {
        id: attemptId,
        storyId: session.taleId,
        stageId: block.id,
        publishedVersionId: session.publishedVersionId,
        storyBindingId: draftBinding?.id ?? null,
        publishedBindingId: binding.id,
        playerId: actor.playerId ?? null,
        sessionId: session.id,
        verificationRequestId: request.id,
        waypointId: waypointVersion.waypointId,
        waypointVersionId: waypointVersion.id,
        packageId,
        packageHash,
        runtimeMode: configuration.runtimeMode,
        effectiveRuntimeMode: decision.mode,
        stageTokenHash: stageToken.tokenHash,
        stageTokenExpiresAt: stageToken.expiresAt,
        storyStateVersion: session.currentSequence,
        companionInstanceId: input.companionInstanceId,
        platform: input.platform,
        adapterType: input.adapterType,
        captainDecisionStatus:
          decision.mode === "SHADOW"
            ? "SHADOW_REVIEW"
            : decision.mode === "CAPTAIN_CONFIRMED"
              ? "PENDING"
              : "NOT_REQUIRED",
        protocolVersion: "2.0",
        protocolMessageId: `msg_${randomUUID()}`,
        idempotencyKey: `vision-b5:${attemptId}`,
      },
    });
    await tx.verificationAttemptTransition.createMany({
      data: [
        { attemptId, sequence: 0, fromState: null, toState: "IDLE", metadata: "{}" },
        {
          attemptId,
          sequence: 1,
          fromState: "IDLE",
          toState: "ARMED",
          metadata: JSON.stringify({ runtimeMode: decision.mode, packageHash }),
        },
      ],
    });
    await tx.verificationAttempt.update({ where: { id: attemptId }, data: { attemptState: "ARMED" } });
    await tx.platformAuditEvent.create({
      data: {
        actorType: actor.playerId ? "PLAYER" : "CAPTAIN",
        actorId: actor.playerId ?? actor.actorId ?? null,
        action: "VISION_B5_ATTEMPT_ARMED",
        resourceType: "VERIFICATION_ATTEMPT",
        resourceId: attemptId,
        correlationId: `msg_${attemptId}`,
        metadata: JSON.stringify({
          publishedVersionId: session.publishedVersionId,
          publishedBindingId: binding.id,
          waypointVersionId: waypointVersion.id,
          packageHash,
          configuredMode: configuration.runtimeMode,
          effectiveMode: decision.mode,
          demotionReason: decision.reason,
          companionInstanceId: input.companionInstanceId,
          rawFramesRetained: false,
        }),
      },
    });
  });
  return {
    attemptId,
    stageToken: stageToken.token,
    stageTokenExpiresAt: stageToken.expiresAt.toISOString(),
    packageId,
    packageHash,
    waypointId: waypointVersion.waypointId,
    waypointVersionId: waypointVersion.id,
    publishedVersionId: session.publishedVersionId,
    publishedBindingId: binding.id,
    storyStateVersion: session.currentSequence,
    configuredMode: configuration.runtimeMode,
    effectiveMode: decision.mode,
    demotionReason: decision.reason,
    scanInteraction: configuration.scanInteraction,
    scanConfiguration: configuration.scanConfiguration,
    guidanceConfiguration: configuration.guidanceConfiguration,
    rawFramesRetained: false,
  };
}

async function markStale(attemptId: string, reason: string) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const state = verificationAttemptStateSchema.parse(attempt.attemptState);
  if (!["STALE", "EVENT_DELIVERED", "CLOSED"].includes(state)) await appendTransition(attemptId, "STALE", { reason });
  await db.verificationAttempt.update({
    where: { id: attemptId },
    data: {
      result: "STALE",
      guidanceCode: "STORY_STAGE_CHANGED",
      staleResultRejected: true,
      eventDeliveryStatus: "REJECTED_STALE",
      resultReceivedAt: new Date(),
    },
  });
  return getRuntimeVerificationAttempt(attemptId);
}

async function persistRuntimeResult(attemptId: string, result: RuntimeResult) {
  for (const state of [
    "CAPTURING",
    "CURATING_FRAMES",
    "RETRIEVING",
    "MATCHING",
    "LOCALIZING",
    "EVALUATING_SEQUENCE",
    "EVALUATING_SPECIAL_RULES",
  ] as const) {
    const current = await db.verificationAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { attemptState: true },
    });
    if (current.attemptState === state) continue;
    if (verificationAttemptStateSchema.parse(current.attemptState) === "ARMED" || state !== "CAPTURING")
      await appendTransition(attemptId, state, { source: "b4-runtime-result" });
  }
  await db.verificationAttempt.update({
    where: { id: attemptId },
    data: {
      result: result.result,
      guidanceCode: result.guidanceCode,
      evidenceDigest: result.evidenceDigest,
      failedGates: JSON.stringify(result.failedGates),
      diagnostics: JSON.stringify(sanitizeRuntimeDiagnostics(result.diagnostics)),
      engineVersion: result.engineVersion,
      modelBundleVersion: result.modelBundleVersion,
      provider: result.provider,
      providerFallbackUsed: result.providerFallbackUsed,
      capturedFrameCount: result.capturedFrameCount,
      usableFrameCount: result.usableFrameCount,
      passingFrameCount: result.passingFrameCount,
      durationMs: result.durationMs,
      rawFramesRetained: false,
      resultReceivedAt: new Date(result.observedAt),
      eventDeliveryStatus: "RESULT_RECORDED",
    },
  });
  await appendTransition(attemptId, terminalStateForResult(result.result), {
    result: result.result,
    failedGates: result.failedGates,
  });
  await db.visionEvidenceBundle.create({
    data: {
      attemptId,
      metadata: JSON.stringify({
        result: result.result,
        guidanceCode: result.guidanceCode,
        failedGates: result.failedGates,
        engineVersion: result.engineVersion,
        modelBundleVersion: result.modelBundleVersion,
        provider: result.provider,
        providerFallbackUsed: result.providerFallbackUsed,
        capturedFrameCount: result.capturedFrameCount,
        usableFrameCount: result.usableFrameCount,
        passingFrameCount: result.passingFrameCount,
        durationMs: result.durationMs,
        rawFramesRetained: false,
      }),
      retentionPolicy: "DERIVED_ONLY",
      contentHash: result.evidenceDigest,
    },
  });
}

async function deliverStoryProgress(
  attemptId: string,
  actor: { sourceType: string; sourceId?: string },
  manualOverride = false,
) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { verificationRequest: true, publishedBinding: true },
  });
  if (!attempt.sessionId || !attempt.publishedVersionId || !attempt.verificationRequest || !attempt.publishedBinding)
    throw new VisionDomainError("ATTEMPT_CONTEXT_MISSING", "The attempt has no active story delivery context.");
  if (!manualOverride && attempt.result !== "VERIFIED")
    throw new VisionDomainError("VERIFIED_RESULT_REQUIRED", "Only a verified result can progress the story.");
  const eventId = `evt_${attempt.id.replaceAll("-", "_")}`;
  try {
    const delivery = await submitVerification(
      {
        schemaVersion: 1,
        eventId,
        idempotencyKey: `${attempt.idempotencyKey}:story`,
        eventType: "verification.result",
        providerType: "visionLocation",
        providerInstanceId: attempt.companionInstanceId ?? "vision-b5-runtime",
        sessionId: attempt.sessionId,
        publishedVersionId: attempt.publishedVersionId,
        blockId: attempt.stageId,
        verificationRequestId: attempt.verificationRequest.id,
        observedAt: attempt.resultReceivedAt?.toISOString() ?? new Date().toISOString(),
        result: "match",
        confidence: manualOverride ? 1 : undefined,
        evidence: {
          attemptId: attempt.id,
          publishedBindingId: attempt.publishedBindingId,
          waypointId: attempt.waypointId,
          waypointVersionId: attempt.waypointVersionId,
          packageId: attempt.packageId,
          packageHash: attempt.packageHash,
          evidenceDigest: attempt.evidenceDigest,
          engineVersion: attempt.engineVersion,
          modelBundleVersion: attempt.modelBundleVersion,
          runtimeMode: attempt.effectiveRuntimeMode,
          successEvent: attempt.publishedBinding.successEvent,
          manualOverride,
          rawFramesRetained: false,
        },
      },
      actor,
    );
    const current = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    if (current.attemptState !== "EVENT_DELIVERED")
      await appendTransition(attemptId, "EVENT_DELIVERED", {
        storyEvent: attempt.publishedBinding.successEvent,
        duplicate: delivery.duplicate,
      });
    await db.$transaction([
      db.verificationAttempt.update({
        where: { id: attemptId },
        data: {
          eventDeliveryStatus: "DELIVERED",
          progressionAppliedAt: new Date(),
          presentationStatus: "REQUESTED",
        },
      }),
      db.visionPresentationRun.upsert({
        where: {
          attemptId_storyEventKey: { attemptId, storyEventKey: attempt.publishedBinding.successEvent },
        },
        update: { status: "REQUESTED", errorCode: null, recoveryAction: null },
        create: {
          attemptId,
          storyEventKey: attempt.publishedBinding.successEvent,
          status: "REQUESTED",
        },
      }),
    ]);
    return getRuntimeVerificationAttempt(attemptId);
  } catch (cause) {
    if (
      cause instanceof VerificationRejectedError &&
      ["wrongBlock", "wrongVersion", "staleRequest", "staleObservation"].includes(cause.reason)
    )
      return markStale(attemptId, cause.reason);
    throw cause;
  }
}

export async function applyRuntimeVerificationResult(unchecked: unknown) {
  const input = runtimeResultSchema.parse(unchecked);
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: input.attemptId },
    include: {
      session: true,
      verificationRequest: true,
      publishedBinding: true,
    },
  });
  if (
    attempt.waypointId !== input.waypointId ||
    attempt.waypointVersionId !== input.waypointVersionId ||
    attempt.packageId !== input.packageId ||
    normalizeHash(attempt.packageHash ?? "") !== normalizeHash(input.packageHash) ||
    attempt.companionInstanceId !== input.companionInstanceId
  )
    throw new VisionDomainError("RESULT_IDENTITY_MISMATCH", "The result does not match the armed attempt and package.");
  if (attempt.stageTokenHash !== digest(input.stageToken))
    throw new VisionDomainError("STAGE_TOKEN_INVALID", "The stage token does not match the armed attempt.");
  if (attempt.resultReceivedAt) {
    const duplicate = attempt.evidenceDigest === input.evidenceDigest && attempt.result === input.result;
    if (!duplicate)
      throw new VisionDomainError("RESULT_CONFLICT", "A different result already exists for this attempt.");
    return { ...(await getRuntimeVerificationAttempt(attempt.id)), duplicate: true };
  }
  const observedAt = new Date(input.observedAt);
  if (
    observedAt.getTime() < attempt.createdAt.getTime() - 1_000 ||
    observedAt.getTime() > Date.now() + 30_000 ||
    Date.now() - observedAt.getTime() > 24 * 60 * 60 * 1000
  )
    throw new VisionDomainError("RESULT_TIME_INVALID", "The result timestamp is outside the accepted window.");
  const token = verifyStageToken(input.stageToken, stageContext(attempt), {
    now: input.offlineEvent ? observedAt.getTime() : Date.now(),
  });
  if (!token.valid)
    throw new VisionDomainError("STAGE_TOKEN_INVALID", `The stage token is ${token.reason.toLocaleLowerCase()}.`);
  if (
    input.passingFrameCount > input.usableFrameCount ||
    input.usableFrameCount > input.capturedFrameCount ||
    input.rawFramesRetained
  )
    throw new VisionDomainError(
      "RESULT_EVIDENCE_INVALID",
      "The result evidence counts or retention claim are invalid.",
    );
  if (input.evidenceDigest && runtimeResultPayloadHash(input.diagnostics) !== normalizeHash(input.evidenceDigest))
    throw new VisionDomainError("EVIDENCE_DIGEST_MISMATCH", "The result diagnostics do not match the evidence digest.");
  const stale =
    !attempt.session ||
    !attempt.verificationRequest ||
    !attempt.publishedBinding ||
    attempt.session.publishedVersionId !== attempt.publishedVersionId ||
    attempt.session.currentBlockId !== attempt.stageId ||
    attempt.session.currentSequence !== attempt.storyStateVersion ||
    attempt.verificationRequest.status !== "PENDING";
  if (stale) return markStale(attempt.id, "STORY_STAGE_CHANGED");
  await persistRuntimeResult(attempt.id, input);
  if (input.result !== "VERIFIED") {
    await recordVisionStoryObservation({
      sessionId: attempt.sessionId!,
      blockId: attempt.stageId,
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
      outcome: input.result,
      guidanceCode: input.guidanceCode,
      evidenceDigest: input.evidenceDigest,
    });
    return getRuntimeVerificationAttempt(attempt.id);
  }
  if (attempt.effectiveRuntimeMode === "SHADOW") {
    await recordVisionStoryObservation({
      sessionId: attempt.sessionId!,
      blockId: attempt.stageId,
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
      outcome: "VERIFIED_SHADOW",
      guidanceCode: input.guidanceCode,
      evidenceDigest: input.evidenceDigest,
    });
    await appendTransition(attempt.id, "AWAITING_CAPTAIN", { shadowMode: true, progressionAllowed: false });
    return getRuntimeVerificationAttempt(attempt.id);
  }
  if (attempt.effectiveRuntimeMode === "CAPTAIN_CONFIRMED") {
    await recordVisionStoryObservation({
      sessionId: attempt.sessionId!,
      blockId: attempt.stageId,
      attemptId: attempt.id,
      idempotencyKey: attempt.idempotencyKey,
      outcome: "VERIFIED_AWAITING_CAPTAIN",
      guidanceCode: input.guidanceCode,
      evidenceDigest: input.evidenceDigest,
    });
    await appendTransition(attempt.id, "AWAITING_CAPTAIN", { captainApprovalRequired: true });
    return getRuntimeVerificationAttempt(attempt.id);
  }
  if (attempt.effectiveRuntimeMode !== "AUTOMATIC")
    throw new VisionDomainError("RUNTIME_MODE_INVALID", "This runtime mode cannot apply a production result.");
  const control = await db.visionRuntimeControl.findUnique({
    where: { sessionId_stageId: { sessionId: attempt.sessionId!, stageId: attempt.stageId } },
  });
  if (!control || control.effectiveMode !== "AUTOMATIC" || control.automaticPaused)
    throw new VisionDomainError("AUTOMATIC_DEMOTED", "Automatic progression is paused or no longer eligible.");
  return deliverStoryProgress(attempt.id, {
    sourceType: "visionRuntime",
    sourceId: attempt.companionInstanceId ?? undefined,
  });
}

export async function getRuntimeVerificationAttempt(attemptId: string) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      transitions: { orderBy: { sequence: "asc" } },
      captainDecisions: { orderBy: { createdAt: "asc" } },
      presentationRuns: { orderBy: { createdAt: "asc" } },
      waypoint: { select: { name: true } },
      waypointVersion: { select: { versionNumber: true, lifecycleStatus: true } },
      publishedBinding: true,
    },
  });
  return {
    ...attempt,
    failedGates: parseArray(attempt.failedGates),
    diagnostics: parseObject(attempt.diagnostics),
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    startedAt: attempt.startedAt?.toISOString() ?? null,
    completedAt: attempt.completedAt?.toISOString() ?? null,
    resultReceivedAt: attempt.resultReceivedAt?.toISOString() ?? null,
    progressionAppliedAt: attempt.progressionAppliedAt?.toISOString() ?? null,
    stageTokenExpiresAt: attempt.stageTokenExpiresAt?.toISOString() ?? null,
    closedAt: attempt.closedAt?.toISOString() ?? null,
    transitions: attempt.transitions.map((transition) => ({
      ...transition,
      metadata: parseObject(transition.metadata),
      createdAt: transition.createdAt.toISOString(),
    })),
    captainDecisions: attempt.captainDecisions.map((decision) => ({
      ...decision,
      evidenceSummary: parseObject(decision.evidenceSummary),
      createdAt: decision.createdAt.toISOString(),
    })),
    presentationRuns: attempt.presentationRuns.map((run) => ({
      ...run,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
    })),
    publishedBinding: attempt.publishedBinding
      ? {
          id: attempt.publishedBinding.id,
          bindingKey: attempt.publishedBinding.bindingKey,
          successEvent: attempt.publishedBinding.successEvent,
          runtimeMode: attempt.publishedBinding.runtimeMode,
        }
      : null,
  };
}

export async function listRuntimeVerificationAttempts(sessionId: string, limit = 30) {
  const attempts = await db.verificationAttempt.findMany({
    where: { sessionId, protocolVersion: "2.0" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
  });
  return Promise.all(attempts.map((attempt) => getRuntimeVerificationAttempt(attempt.id)));
}

export async function getRuntimePackageForAttempt(attemptId: string) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  if (!attempt.packageId || !attempt.packageHash)
    throw new VisionDomainError("PRODUCTION_PACKAGE_REQUIRED", "The attempt has no immutable runtime package.");
  const build = await db.visionBuildJob.findFirst({
    where: {
      waypointVersionId: attempt.waypointVersionId,
      packageId: attempt.packageId,
      packageHash: { in: [attempt.packageHash, attempt.packageHash.replace(/^sha256:/, "")] },
      status: "COMPLETED",
    },
  });
  if (!build) throw new VisionDomainError("PACKAGE_INTEGRITY_FAILED", "The governed build record is unavailable.");
  const report = parseObject(build.report);
  const runtimePackage = report.package;
  if (!runtimePackage || typeof runtimePackage !== "object" || Array.isArray(runtimePackage))
    throw new VisionDomainError(
      "PACKAGE_CACHE_UNAVAILABLE",
      "The data-only runtime package is not present in the governed build report.",
    );
  const manifest = parseObject(JSON.stringify((runtimePackage as Record<string, unknown>).manifest));
  if (
    manifest.packageId !== attempt.packageId ||
    manifest.waypointVersionId !== attempt.waypointVersionId ||
    normalizeHash(String(manifest.packageHash ?? "")) !== normalizeHash(attempt.packageHash)
  )
    throw new VisionDomainError("PACKAGE_INTEGRITY_FAILED", "The cached package manifest does not match the attempt.");
  return {
    packageId: attempt.packageId,
    packageHash: normalizeHash(attempt.packageHash),
    package: runtimePackage as Record<string, unknown>,
  };
}

export async function recordCaptainRuntimeAction(attemptId: string, actorId: string, unchecked: unknown) {
  const input = captainVisionActionSchema.parse(unchecked);
  const prior = await db.visionCaptainDecision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) return { ...(await getRuntimeVerificationAttempt(prior.attemptId)), duplicate: true };
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { publishedBinding: true, session: true },
  });
  const policy = parseObject(attempt.publishedBinding?.captainFallbackPolicy);
  if (input.action === "MANUAL_OVERRIDE" && (policy.enabled === false || policy.allowManualApprove === false))
    throw new VisionDomainError(
      "MANUAL_OVERRIDE_DISABLED",
      "This published story binding does not allow manual approval.",
    );
  if (input.action === "APPROVE" && attempt.result !== "VERIFIED")
    throw new VisionDomainError("VERIFIED_RESULT_REQUIRED", "Captain approval requires a verified engine result.");
  if (["PROMOTE_TO_CAPTAIN_CONFIRMED", "PROMOTE_TO_AUTOMATIC"].includes(input.action) && !attempt.sessionId)
    throw new VisionDomainError("SESSION_REQUIRED", "Promotion requires a live session.");
  if (input.action === "PROMOTE_TO_CAPTAIN_CONFIRMED" || input.action === "PROMOTE_TO_AUTOMATIC")
    await assertPromotionEligible(attempt, input.action);
  await db.$transaction(async (tx) => {
    await tx.visionCaptainDecision.create({
      data: {
        attemptId,
        actorId,
        action: input.action,
        reason: input.reason,
        truthLabel: input.truthLabel ?? null,
        evidenceSummary: JSON.stringify({
          result: attempt.result,
          evidenceDigest: attempt.evidenceDigest,
          failedGates: parseArray(attempt.failedGates),
          engineVersion: attempt.engineVersion,
          modelBundleVersion: attempt.modelBundleVersion,
          rawFramesRetained: false,
        }),
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (input.action === "LABEL_TRUTH" && input.truthLabel && input.truthLabel !== "UNREVIEWABLE") {
      const proposedPartition =
        input.truthLabel === "FALSE_POSITIVE" || input.truthLabel === "TRUE_NEGATIVE"
          ? "HARD_NEGATIVE_CANDIDATE"
          : input.truthLabel === "FALSE_NEGATIVE" || input.truthLabel === "TRUE_POSITIVE"
            ? "POSITIVE_CANDIDATE"
            : "REGRESSION_CANDIDATE";
      await tx.visionImprovementCandidate.upsert({
        where: { sourceAttemptId: attempt.id },
        update: {
          humanTruthLabel: input.truthLabel,
          candidateReason: input.reason,
          evidenceDigest: attempt.evidenceDigest,
          derivedDiagnostics: JSON.stringify({
            result: attempt.result,
            guidanceCode: attempt.guidanceCode,
            failedGates: parseArray(attempt.failedGates),
            engineVersion: attempt.engineVersion,
            modelBundleVersion: attempt.modelBundleVersion,
            packageHash: attempt.packageHash,
          }),
          proposedPartition,
          rawFramesRetained: false,
          status: "QUEUED",
          dispositionReason: null,
          reviewedAt: null,
        },
        create: {
          sourceAttemptId: attempt.id,
          waypointVersionId: attempt.waypointVersionId,
          humanTruthLabel: input.truthLabel,
          candidateReason: input.reason,
          evidenceDigest: attempt.evidenceDigest,
          derivedDiagnostics: JSON.stringify({
            result: attempt.result,
            guidanceCode: attempt.guidanceCode,
            failedGates: parseArray(attempt.failedGates),
            engineVersion: attempt.engineVersion,
            modelBundleVersion: attempt.modelBundleVersion,
            packageHash: attempt.packageHash,
          }),
          proposedPartition,
          rawFramesRetained: false,
        },
      });
    }
    await tx.verificationAttempt.update({
      where: { id: attemptId },
      data: {
        captainAction: input.action,
        captainDecisionStatus:
          input.action === "APPROVE" || input.action === "MANUAL_OVERRIDE"
            ? "APPROVED"
            : input.action === "REQUEST_RESCAN"
              ? "RESCAN_REQUESTED"
              : input.action === "REJECT"
                ? "REJECTED"
                : attempt.captainDecisionStatus,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId,
        action: `VISION_B5_${input.action}`,
        resourceType: "VERIFICATION_ATTEMPT",
        resourceId: attemptId,
        correlationId: input.idempotencyKey,
        metadata: JSON.stringify(
          safeAuditMetadata({
            reason: input.reason,
            truthLabel: input.truthLabel,
            result: attempt.result,
            effectiveRuntimeMode: attempt.effectiveRuntimeMode,
            sessionId: attempt.sessionId,
          }),
        ),
      },
    });
  });
  if (input.action === "PAUSE_AUTOMATIC" || input.action === "DEMOTE_TO_CAPTAIN_CONFIRMED") {
    if (!attempt.sessionId) throw new VisionDomainError("SESSION_REQUIRED", "Runtime control requires a live session.");
    await db.visionRuntimeControl.update({
      where: { sessionId_stageId: { sessionId: attempt.sessionId, stageId: attempt.stageId } },
      data: {
        automaticPaused: true,
        effectiveMode: "CAPTAIN_CONFIRMED",
        demotionReason: input.reason,
        updatedBy: actorId,
      },
    });
  }
  if (input.action === "PROMOTE_TO_CAPTAIN_CONFIRMED" || input.action === "PROMOTE_TO_AUTOMATIC")
    await applyPromotion(attemptId, actorId, input);
  if (input.action === "APPROVE" && attempt.effectiveRuntimeMode === "SHADOW")
    return getRuntimeVerificationAttempt(attemptId);
  if (input.action === "APPROVE")
    return deliverStoryProgress(attemptId, { sourceType: "captainConfirmed", sourceId: actorId });
  if (input.action === "MANUAL_OVERRIDE")
    return deliverStoryProgress(attemptId, { sourceType: "captainOverride", sourceId: actorId }, true);
  return getRuntimeVerificationAttempt(attemptId);
}

async function applyPromotion(attemptId: string, actorId: string, input: CaptainVisionAction) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const { control, target } = await assertPromotionEligible(attempt, input.action);
  await db.visionRuntimeControl.update({
    where: { id: control.id },
    data: {
      effectiveMode: target,
      automaticPaused: false,
      demotionReason: null,
      updatedBy: actorId,
    },
  });
}

async function assertPromotionEligible(
  attempt: {
    sessionId: string | null;
    stageId: string;
    waypointVersionId: string;
    packageId: string | null;
  },
  action: CaptainVisionAction["action"],
) {
  if (!attempt.sessionId) throw new VisionDomainError("SESSION_REQUIRED", "Promotion requires a live session.");
  const control = await db.visionRuntimeControl.findUniqueOrThrow({
    where: { sessionId_stageId: { sessionId: attempt.sessionId, stageId: attempt.stageId } },
  });
  const target = action === "PROMOTE_TO_AUTOMATIC" ? "AUTOMATIC" : "CAPTAIN_CONFIRMED";
  if (control.fieldEvidenceStatus !== "PASSED")
    throw new VisionDomainError(
      "FIELD_EVIDENCE_REQUIRED",
      "Promotion is rejected until the real B-4 field-evidence gate is recorded as passed.",
    );
  if (target === "AUTOMATIC") {
    const build = await db.visionBuildJob.findFirst({
      where: {
        waypointVersionId: attempt.waypointVersionId,
        packageId: attempt.packageId,
        automaticEligibility: true,
        status: "COMPLETED",
      },
    });
    const certification = await db.visionCertificationRun.findFirst({
      where: { waypointVersionId: attempt.waypointVersionId },
      orderBy: { completedAt: "desc" },
    });
    if (!build || !parseArray(certification?.approvedRuntimeModes).includes("AUTOMATIC"))
      throw new VisionDomainError(
        "AUTOMATIC_CERTIFICATION_REQUIRED",
        "Automatic promotion requires an eligible package and certification that explicitly approves AUTOMATIC.",
      );
  }
  return { control, target };
}

export async function reconcileOfflineRuntimeEvents(unchecked: unknown) {
  const input = offlineReconciliationSchema.parse(unchecked);
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: input.sessionId } });
  const results: Array<Record<string, unknown>> = [];
  for (const event of input.events) {
    const existing = await db.visionPendingEvent.findUnique({ where: { eventId: event.eventId } });
    if (existing) {
      results.push({ eventId: event.eventId, status: existing.status, duplicate: true });
      continue;
    }
    const expectedHash = runtimeResultPayloadHash(event.payload);
    if (normalizeHash(event.payloadHash) !== expectedHash) {
      results.push({ eventId: event.eventId, status: "REJECTED", reason: "PAYLOAD_HASH_MISMATCH" });
      continue;
    }
    const conflict = event.storyStateVersion !== session.currentSequence;
    await db.visionPendingEvent.create({
      data: {
        sessionId: input.sessionId,
        attemptId: event.attemptId ?? null,
        eventId: event.eventId,
        idempotencyKey: event.idempotencyKey,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
        storyStateVersion: event.storyStateVersion,
        payloadHash: expectedHash,
        status: conflict ? "CONFLICT" : "PENDING",
        conflictReason: conflict ? "STORY_STATE_VERSION_CHANGED" : null,
        observedAt: new Date(event.observedAt),
      },
    });
    if (conflict) {
      results.push({ eventId: event.eventId, status: "CONFLICT", reason: "STORY_STATE_VERSION_CHANGED" });
      continue;
    }
    try {
      const result = runtimeResultSchema.parse({
        ...event.payload,
        attemptId: event.attemptId,
        offlineEvent: {
          eventId: event.eventId,
          idempotencyKey: event.idempotencyKey,
          storyStateVersion: event.storyStateVersion,
          payloadHash: expectedHash,
        },
      });
      await applyRuntimeVerificationResult(result);
      await db.visionPendingEvent.update({
        where: { eventId: event.eventId },
        data: { status: "SYNCED", syncedAt: new Date() },
      });
      results.push({ eventId: event.eventId, status: "SYNCED" });
    } catch (cause) {
      const reason = cause instanceof VisionDomainError ? cause.code : "RESULT_REJECTED";
      await db.visionPendingEvent.update({
        where: { eventId: event.eventId },
        data: { status: "REJECTED", conflictReason: reason, syncedAt: new Date() },
      });
      results.push({ eventId: event.eventId, status: "REJECTED", reason });
    }
  }
  return { sessionId: input.sessionId, storyStateVersion: session.currentSequence, results };
}

export async function acknowledgeVisionPresentation(
  attemptId: string,
  status: "STARTED" | "COMPLETED" | "FAILED" | "RECOVERED",
  errorCode?: string,
) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { publishedBinding: true },
  });
  if (!attempt.publishedBinding)
    throw new VisionDomainError("PRESENTATION_CONTEXT_MISSING", "The attempt has no presentation event.");
  const now = new Date();
  await db.visionPresentationRun.upsert({
    where: {
      attemptId_storyEventKey: { attemptId, storyEventKey: attempt.publishedBinding.successEvent },
    },
    update: {
      status,
      errorCode: errorCode ?? null,
      ...(status === "STARTED" ? { startedAt: now } : {}),
      ...(status === "COMPLETED" || status === "RECOVERED" ? { completedAt: now } : {}),
      ...(status === "FAILED" ? { recoveryAction: "CAPTAIN_RETRIGGER_OR_CONTINUE" } : {}),
    },
    create: {
      attemptId,
      storyEventKey: attempt.publishedBinding.successEvent,
      status,
      errorCode: errorCode ?? null,
      startedAt: status === "STARTED" ? now : null,
      completedAt: status === "COMPLETED" || status === "RECOVERED" ? now : null,
      recoveryAction: status === "FAILED" ? "CAPTAIN_RETRIGGER_OR_CONTINUE" : null,
    },
  });
  await db.verificationAttempt.update({ where: { id: attemptId }, data: { presentationStatus: status } });
  return getRuntimeVerificationAttempt(attemptId);
}
