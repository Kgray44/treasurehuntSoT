import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { safeAuditMetadata } from "@/platform/audit";
import { VerificationRejectedError, submitVerification } from "@/tall-tale/progression";
import { parsePublishedSnapshot } from "@/tall-tale/publishing";
import {
  assertAttemptTransition,
  mockVisionScenarioSchema,
  scenarioOutcome,
  terminalStateForResult,
  verificationAttemptStateSchema,
  VisionDomainError,
  type VerificationAttemptState,
  type VerificationResult,
} from "@/vision/domain";
import { createVisionEnvelope, VISION_PROTOCOL_VERSION } from "@/vision/protocol";

export const createAttemptSchema = z
  .object({
    sessionId: z.string().min(8).max(128),
    blockId: z.string().min(8).max(128),
    waypointVersionId: z.string().min(8).max(128),
    scenario: mockVisionScenarioSchema.default("verified"),
    platform: z.enum(["WEB", "PWA", "DESKTOP"]),
    adapterType: z.enum(["MOCK", "WEB_COMPANION", "DESKTOP"]),
  })
  .strict();

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function appendTransition(
  tx: Prisma.TransactionClient,
  attempt: { id: string; attemptState: string },
  toState: VerificationAttemptState,
  metadata: Record<string, unknown> = {},
) {
  const fromState = verificationAttemptStateSchema.parse(attempt.attemptState);
  assertAttemptTransition(fromState, toState);
  const latest = await tx.verificationAttemptTransition.findFirst({
    where: { attemptId: attempt.id },
    orderBy: { sequence: "desc" },
  });
  await tx.verificationAttemptTransition.create({
    data: {
      attemptId: attempt.id,
      sequence: (latest?.sequence ?? -1) + 1,
      fromState,
      toState,
      metadata: JSON.stringify(safeAuditMetadata(metadata)),
    },
  });
  return tx.verificationAttempt.update({
    where: { id: attempt.id },
    data: {
      attemptState: toState,
      ...(toState === "CAPTURING" ? { startedAt: new Date() } : {}),
      ...(["VERIFIED", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED"].includes(toState)
        ? { completedAt: new Date() }
        : {}),
      ...(toState === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });
}

export async function transitionVerificationAttempt(
  attemptId: string,
  toState: VerificationAttemptState,
  metadata: Record<string, unknown> = {},
) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    return appendTransition(tx, attempt, toState, metadata);
  });
}

function publicAttempt<
  T extends {
    id: string;
    storyId: string;
    stageId: string;
    playerId: string | null;
    sessionId: string | null;
    verificationRequestId: string | null;
    waypointId: string;
    waypointVersionId: string;
    attemptState: string;
    result: string | null;
    guidanceCode: string | null;
    evidenceDigest: string | null;
    platform: string;
    adapterType: string;
    eventDeliveryStatus: string;
    captainAction: string | null;
    mockScenario: string | null;
    protocolVersion: string;
    protocolMessageId: string | null;
    idempotencyKey: string;
    staleResultRejected: boolean;
    duplicateResultRejected: boolean;
    createdAt: Date;
    updatedAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    closedAt: Date | null;
    transitions?: Array<{
      sequence: number;
      fromState: string | null;
      toState: string;
      metadata: string;
      createdAt: Date;
    }>;
    waypoint?: { name: string };
    waypointVersion?: { versionNumber: number; lifecycleStatus: string };
  },
>(attempt: T) {
  return {
    ...attempt,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
    startedAt: attempt.startedAt?.toISOString() ?? null,
    completedAt: attempt.completedAt?.toISOString() ?? null,
    closedAt: attempt.closedAt?.toISOString() ?? null,
    transitions: attempt.transitions?.map((transition) => ({
      ...transition,
      metadata: parseJson(transition.metadata),
      createdAt: transition.createdAt.toISOString(),
    })),
  };
}

export async function createVerificationAttempt(unchecked: unknown, actor: { playerId?: string; actorId?: string }) {
  const input = createAttemptSchema.parse(unchecked);
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findUnique({
      where: { id: input.sessionId },
      include: { version: true, tale: true },
    });
    if (!session || !session.publishedVersionId || !session.version)
      throw new VisionDomainError("SESSION_NOT_VERSIONED", "A published Tall Tale session is required.");
    if (session.currentBlockId !== input.blockId)
      throw new VisionDomainError("STORY_STAGE_CHANGED", "The story is no longer at this Vision Waypoint block.");
    const publishedBlock = parsePublishedSnapshot(session.version.contentSnapshot)
      .chapters.flatMap((chapter) => chapter.blocks)
      .find((block) => block.id === input.blockId);
    if (
      publishedBlock?.blockType !== "visionWaypoint" ||
      publishedBlock.configuration.runtimeMode !== "DEVELOPMENT_MOCK" ||
      publishedBlock.configuration.waypointVersionId !== input.waypointVersionId
    )
      throw new VisionDomainError(
        "PUBLISHED_BINDING_MISMATCH",
        "The attempt does not match the immutable Vision binding in this published Tall Tale version.",
      );
    const waypointVersion = await tx.visionWaypointVersion.findUnique({
      where: { id: input.waypointVersionId },
      include: { publication: true, buildArtifacts: true },
    });
    if (!waypointVersion?.publishedAt || !waypointVersion.publication)
      throw new VisionDomainError(
        "PUBLISHED_VERSION_REQUIRED",
        "The immutable story binding does not reference a published Vision version.",
      );
    const developmentArtifact = waypointVersion.buildArtifacts.find(
      (artifact) => artifact.artifactType === "DEVELOPMENT_MOCK_PACKAGE",
    );
    if (
      !developmentArtifact ||
      !/^[a-f0-9]{64}$/.test(waypointVersion.publication.packageHash) ||
      developmentArtifact.contentHash !== waypointVersion.publication.packageHash ||
      waypointVersion.packageArtifactReference !==
        `development-package://sha256/${waypointVersion.publication.packageHash}`
    )
      throw new VisionDomainError("PACKAGE_INTEGRITY_FAILED", "The published development package hash is invalid.");
    const request = await tx.taleVerificationRequest.findFirst({
      where: { sessionId: session.id, blockId: input.blockId, providerType: "visionLocation", status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    });
    if (!request)
      throw new VisionDomainError(
        "VERIFICATION_REQUEST_REQUIRED",
        "The story has no active Vision verification request.",
      );
    const id = randomUUID();
    const messageId = randomUUID();
    const idempotencyKey = `vision:${session.id}:${input.blockId}:${input.waypointVersionId}:${id}:result`;
    const envelope = createVisionEnvelope({
      messageType: "runtime.scan.start",
      messageId,
      sessionId: session.id,
      sender: {
        type: input.platform === "DESKTOP" ? "desktop" : "web",
        instanceId: input.platform === "DESKTOP" ? "desktop-b1-instance" : "web-b1-instance",
      },
      payload: {
        attemptId: id,
        storyId: session.taleId,
        stageId: input.blockId,
        waypointId: waypointVersion.waypointId,
        waypointVersionId: waypointVersion.id,
        mockScenario: input.scenario,
      },
    });
    const attempt = await tx.verificationAttempt.create({
      data: {
        id,
        storyId: session.taleId,
        stageId: input.blockId,
        playerId: actor.playerId ?? null,
        sessionId: session.id,
        verificationRequestId: request.id,
        waypointId: waypointVersion.waypointId,
        waypointVersionId: waypointVersion.id,
        platform: input.platform,
        adapterType: input.adapterType,
        mockScenario: input.scenario,
        protocolVersion: VISION_PROTOCOL_VERSION,
        protocolMessageId: envelope.messageId,
        idempotencyKey,
      },
    });
    await tx.verificationAttemptTransition.create({
      data: { attemptId: attempt.id, sequence: 0, fromState: null, toState: "IDLE", metadata: "{}" },
    });
    const armed = await appendTransition(tx, attempt, "ARMED", { protocolMessageId: envelope.messageId });
    await tx.platformAuditEvent.create({
      data: {
        actorType: actor.playerId ? "PLAYER" : "CAPTAIN",
        actorId: actor.playerId ?? actor.actorId ?? null,
        action: "VISION_VERIFICATION_ATTEMPT_CREATED",
        resourceType: "VERIFICATION_ATTEMPT",
        resourceId: attempt.id,
        correlationId: envelope.messageId,
        metadata: JSON.stringify({
          storyId: session.taleId,
          stageId: input.blockId,
          waypointVersionId: waypointVersion.id,
          platform: input.platform,
          adapterType: input.adapterType,
          mockScenario: input.scenario,
        }),
      },
    });
    return publicAttempt(armed);
  });
}

export async function getVerificationAttempt(attemptId: string) {
  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      transitions: { orderBy: { sequence: "asc" } },
      waypoint: { select: { name: true } },
      waypointVersion: { select: { versionNumber: true, lifecycleStatus: true } },
    },
  });
  return publicAttempt(attempt);
}

export async function listVerificationAttempts(input: { sessionId: string; limit?: number }) {
  const attempts = await db.verificationAttempt.findMany({
    where: { sessionId: input.sessionId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 20, 1), 100),
    include: {
      transitions: { orderBy: { sequence: "asc" } },
      waypoint: { select: { name: true } },
      waypointVersion: { select: { versionNumber: true, lifecycleStatus: true } },
    },
  });
  return attempts.map(publicAttempt);
}

export async function cancelVerificationAttempt(attemptId: string, actorId?: string) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const state = verificationAttemptStateSchema.parse(attempt.attemptState);
    if (["VERIFIED", "INSUFFICIENT", "NOT_AT_TARGET", "AMBIGUOUS", "ERROR", "CANCELLED", "CLOSED"].includes(state))
      throw new VisionDomainError("ATTEMPT_ALREADY_TERMINAL", "This attempt can no longer be cancelled.");
    await appendTransition(tx, attempt, "CANCELLED", { actorId });
    return publicAttempt(
      await tx.verificationAttempt.update({
        where: { id: attemptId },
        data: {
          result: "CANCELLED",
          guidanceCode: "ATTEMPT_CANCELLED",
          eventDeliveryStatus: "NOT_DELIVERED",
        },
      }),
    );
  });
}

async function markStale(attemptId: string, guidanceCode: string) {
  return db.$transaction(async (tx) => {
    const attempt = await tx.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    let current = attempt;
    const state = verificationAttemptStateSchema.parse(current.attemptState);
    if (!["ERROR", "CANCELLED", "CLOSED"].includes(state))
      current = await appendTransition(tx, current, "ERROR", { guidanceCode });
    return tx.verificationAttempt.update({
      where: { id: attemptId },
      data: {
        result: "SYSTEM_ERROR",
        guidanceCode,
        eventDeliveryStatus: "REJECTED_STALE",
        staleResultRejected: true,
      },
    });
  });
}

async function executeProgressPath(attemptId: string) {
  for (const state of [
    "CAPTURING",
    "CURATING_FRAMES",
    "RETRIEVING",
    "MATCHING",
    "LOCALIZING",
    "EVALUATING_SEQUENCE",
    "EVALUATING_SPECIAL_RULES",
  ] as const)
    await transitionVerificationAttempt(attemptId, state, { implementation: "deterministic-development-mock" });
}

function resultSubmissionValue(result: VerificationResult) {
  if (result === "VERIFIED") return "match" as const;
  if (result === "AMBIGUOUS" || result === "INSUFFICIENT_VISUAL_EVIDENCE") return "uncertain" as const;
  return "notMatch" as const;
}

export async function deliverMockVerificationResult(
  attemptId: string,
  uncheckedScenario?: unknown,
  actor: { sourceType: "mock" | "desktopMock" | "captainMock"; sourceId?: string } = { sourceType: "mock" },
) {
  const initial = await db.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const scenario = mockVisionScenarioSchema.parse(uncheckedScenario ?? initial.mockScenario ?? "verified");
  if (initial.attemptState === "CANCELLED")
    throw new VisionDomainError("ATTEMPT_CANCELLED", "A cancelled attempt cannot later verify.");
  if (scenario === "cancelled") return cancelVerificationAttempt(attemptId, actor.sourceId);
  await executeProgressPath(attemptId);
  if (scenario === "delayed_verified") await new Promise((resolve) => setTimeout(resolve, 750));

  const attempt = await db.verificationAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { session: { include: { version: true } }, verificationRequest: true },
  });
  if (!attempt.session || !attempt.verificationRequest || !attempt.session.version)
    throw new VisionDomainError("ATTEMPT_CONTEXT_MISSING", "The attempt has no active story context.");
  const stageChanged =
    attempt.session.currentBlockId !== attempt.stageId || attempt.verificationRequest.status !== "PENDING";
  if (scenario === "stale_stage" || stageChanged) {
    const stale = await markStale(attemptId, stageChanged ? "STORY_STAGE_CHANGED" : "ATTEMPT_STALE");
    logger.info(
      { area: "vision-mock", attemptId, scenario, stageChanged },
      "Deterministic mock result rejected as stale",
    );
    return publicAttempt(stale);
  }

  const outcome = scenarioOutcome[scenario];
  const evidenceDigest = createHash("sha256")
    .update(
      JSON.stringify({
        implementation: "b1-deterministic-mock",
        scenario,
        storyId: attempt.storyId,
        stageId: attempt.stageId,
        waypointVersionId: attempt.waypointVersionId,
        result: outcome.result,
      }),
    )
    .digest("hex");
  const messageId = randomUUID();
  createVisionEnvelope({
    messageType: "runtime.scan.result",
    messageId,
    requestId: attempt.protocolMessageId ?? undefined,
    sessionId: attempt.session.id,
    sender: { type: actor.sourceType === "desktopMock" ? "desktop" : "server", instanceId: "b1-mock-verifier" },
    payload: {
      attemptId,
      storyId: attempt.storyId,
      stageId: attempt.stageId,
      waypointVersionId: attempt.waypointVersionId,
      result: outcome.result,
      guidanceCode: outcome.guidanceCode,
      evidenceDigest,
    },
  });
  await db.verificationAttempt.update({
    where: { id: attemptId },
    data: {
      result: outcome.result,
      guidanceCode: outcome.guidanceCode,
      evidenceDigest,
      protocolMessageId: messageId,
    },
  });
  await transitionVerificationAttempt(attemptId, terminalStateForResult(outcome.result), {
    result: outcome.result,
    guidanceCode: outcome.guidanceCode,
  });

  if (["SYSTEM_ERROR", "CANCELLED"].includes(outcome.result)) {
    const terminal = await db.verificationAttempt.update({
      where: { id: attemptId },
      data: { eventDeliveryStatus: "NOT_DELIVERED" },
      include: { transitions: { orderBy: { sequence: "asc" } } },
    });
    return publicAttempt(terminal);
  }

  let delivered = false;
  let duplicateRejected = false;
  try {
    const submission = {
      schemaVersion: 1 as const,
      eventId: messageId,
      idempotencyKey: `${attempt.idempotencyKey}:story`,
      eventType: "verification.result" as const,
      providerType: "visionLocation" as const,
      providerInstanceId: actor.sourceType === "desktopMock" ? "desktop-b1-mock" : "web-b1-mock",
      sessionId: attempt.session.id,
      publishedVersionId: attempt.session.publishedVersionId!,
      blockId: attempt.stageId,
      verificationRequestId: attempt.verificationRequest.id,
      observedAt: new Date().toISOString(),
      result: resultSubmissionValue(outcome.result),
      evidence: {
        evidenceDigest,
        waypointId: attempt.waypointId,
        waypointVersionId: attempt.waypointVersionId,
        mockScenario: scenario,
        protocolVersion: VISION_PROTOCOL_VERSION,
      },
    };
    const first = await submitVerification(submission, { sourceType: actor.sourceType, sourceId: actor.sourceId });
    delivered = first.accepted;
    if (scenario === "duplicate_result_delivery") {
      const duplicate = await submitVerification(submission, {
        sourceType: actor.sourceType,
        sourceId: actor.sourceId,
      });
      duplicateRejected = duplicate.duplicate;
    }
  } catch (cause) {
    if (
      cause instanceof VerificationRejectedError &&
      ["wrongBlock", "staleRequest", "staleObservation"].includes(cause.reason)
    ) {
      const stale = await markStale(attemptId, cause.reason === "wrongBlock" ? "STORY_STAGE_CHANGED" : "ATTEMPT_STALE");
      return publicAttempt(stale);
    }
    throw cause;
  }

  if (outcome.result === "VERIFIED" && delivered)
    await transitionVerificationAttempt(attemptId, "EVENT_DELIVERED", { storyEvent: "verificationSatisfied" });
  const updated = await db.verificationAttempt.update({
    where: { id: attemptId },
    data: {
      eventDeliveryStatus: outcome.result === "VERIFIED" ? "DELIVERED" : "RESULT_RECORDED",
      duplicateResultRejected: duplicateRejected,
    },
    include: {
      transitions: { orderBy: { sequence: "asc" } },
      waypoint: { select: { name: true } },
      waypointVersion: { select: { versionNumber: true, lifecycleStatus: true } },
    },
  });
  logger.info(
    {
      area: "vision-mock",
      attemptId,
      scenario,
      result: outcome.result,
      eventDeliveryStatus: updated.eventDeliveryStatus,
      duplicateResultRejected: updated.duplicateResultRejected,
    },
    "Deterministic mock verification completed",
  );
  return publicAttempt(updated);
}

export async function recordCaptainAttemptAction(
  attemptId: string,
  actorId: string,
  action: "APPROVED" | "REJECTED",
  reason: string,
) {
  const cleanReason = z.string().trim().min(3).max(500).parse(reason);
  return db.$transaction(async (tx) => {
    const attempt = await tx.verificationAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const updated = await tx.verificationAttempt.update({ where: { id: attemptId }, data: { captainAction: action } });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId,
        action: `VISION_ATTEMPT_MANUAL_${action}`,
        resourceType: "VERIFICATION_ATTEMPT",
        resourceId: attempt.id,
        correlationId: randomUUID(),
        metadata: JSON.stringify({ action, reason: cleanReason.slice(0, 200), sessionId: attempt.sessionId }),
      },
    });
    return publicAttempt(updated);
  });
}
