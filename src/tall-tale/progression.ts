import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { publishTaleSessionEvent } from "@/lib/events";
import { providerForBlock } from "@/tall-tale/block-registry";
import { snapshotFromStudio, parsePublishedSnapshot } from "@/tall-tale/publishing";
import { getStudioTale } from "@/tall-tale/studio-service";
import type {
  JsonObject,
  PublishedBlock,
  PublishedTaleSnapshot,
  VerificationProviderType,
  VerificationSubmission,
} from "@/tall-tale/types";
import { parseJsonArray, parseJsonObject } from "@/tall-tale/types";
import { logger } from "@/lib/logger";
import { playerSafeAssetIds, playerSafeObject } from "@/platform/libraries";
import { projectPlayerBlock } from "@/tall-tale/journal-contract";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const futureProviders = new Set(["visionLocation", "visionObject", "externalWebhook"]);

export const verificationSubmissionSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: z.string().min(8).max(128),
  idempotencyKey: z.string().min(8).max(200),
  eventType: z.enum(["verification.observation", "verification.result"]),
  providerType: z.enum([
    "captainManual",
    "playerConfirmation",
    "textAnswer",
    "timer",
    "visionLocation",
    "visionObject",
    "externalWebhook",
  ]),
  providerInstanceId: z.string().max(160).optional(),
  sessionId: z.string().min(8).max(128),
  publishedVersionId: z.string().min(1).max(128),
  blockId: z.string().min(8).max(128),
  verificationRequestId: z.string().min(8).max(128),
  observedAt: z.string().datetime(),
  result: z.enum(["match", "notMatch", "uncertain"]),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export class VerificationRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(`Verification event rejected: ${reason}`);
  }
}

const identity = (session: { publishedVersionId: string | null; draftRevisionId: string | null }) =>
  session.publishedVersionId ?? `draft:${session.draftRevisionId ?? "unknown"}`;
const blocksOf = (snapshot: PublishedTaleSnapshot) =>
  snapshot.chapters.flatMap((chapter) => chapter.blocks.filter((block) => block.isEnabled));
const blockById = (snapshot: PublishedTaleSnapshot, id: string | null) =>
  id ? (blocksOf(snapshot).find((block) => block.id === id) ?? null) : null;
const chapterByBlock = (snapshot: PublishedTaleSnapshot, id: string | null) =>
  snapshot.chapters.find((chapter) => chapter.blocks.some((block) => block.id === id)) ?? null;
const snapshotOf = (session: { previewSnapshot: string | null; version: { contentSnapshot: string } | null }) => {
  const value = session.previewSnapshot ?? session.version?.contentSnapshot;
  if (!value) throw new Error("This session has no playable story snapshot.");
  return parsePublishedSnapshot(value);
};

async function appendEvent(
  tx: Prisma.TransactionClient,
  session: { id: string; publishedVersionId: string | null; draftRevisionId: string | null },
  input: {
    eventType: string;
    sourceType: string;
    sourceId?: string | null;
    blockId?: string | null;
    idempotencyKey: string;
    payload?: JsonObject;
    correlationId?: string;
    verificationRequestId?: string;
  },
) {
  const prior = await tx.taleSessionEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (prior) return prior;
  const sequence = await tx.taleSession.update({
    where: { id: session.id },
    data: { currentSequence: { increment: 1 } },
    select: { currentSequence: true },
  });
  return tx.taleSessionEvent.create({
    data: {
      sessionId: session.id,
      publishedVersionId: identity(session),
      blockId: input.blockId ?? null,
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      idempotencyKey: input.idempotencyKey,
      payload: JSON.stringify(input.payload ?? {}),
      sequence: sequence.currentSequence,
      correlationId: input.correlationId,
      verificationRequestId: input.verificationRequestId,
    },
  });
}

async function createRequest(tx: Prisma.TransactionClient, sessionId: string, block: PublishedBlock) {
  const providerType = providerForBlock(block.blockType, block.configuration);
  if (!providerType) return null;
  if (futureProviders.has(providerType))
    throw new Error(`${providerType} is reserved for a future paired helper and cannot be active in Phase 1.`);
  const existing = await tx.taleVerificationRequest.findFirst({
    where: { sessionId, blockId: block.id, status: "PENDING" },
  });
  if (existing) return existing;
  const duration = Number(block.configuration.durationSeconds ?? 0);
  return tx.taleVerificationRequest.create({
    data: {
      sessionId,
      blockId: block.id,
      providerType,
      expiresAt: providerType === "timer" && duration > 0 ? new Date(Date.now() + duration * 1000) : null,
      configurationSnapshot: JSON.stringify(block.configuration),
    },
  });
}

async function enterBlock(
  tx: Prisma.TransactionClient,
  session: { id: string; publishedVersionId: string | null; draftRevisionId: string | null },
  snapshot: PublishedTaleSnapshot,
  block: PublishedBlock,
  sourceType: string,
  sourceId: string | null,
  correlationId: string,
) {
  const chapter = chapterByBlock(snapshot, block.id);
  await tx.taleSession.update({
    where: { id: session.id },
    data: { currentBlockId: block.id, currentChapterId: chapter?.id ?? null, lastHeartbeatAt: new Date() },
  });
  if (session.publishedVersionId)
    await tx.revealState.upsert({
      where: {
        playthroughId_contentType_contentKey: {
          playthroughId: session.id,
          contentType: "BLOCK",
          contentKey: block.id,
        },
      },
      update: {},
      create: {
        playthroughId: session.id,
        contentType: "BLOCK",
        contentKey: block.id,
        revealedBy: sourceId ?? sourceType,
      },
    });
  const event = await appendEvent(tx, session, {
    eventType: "blockEntered",
    sourceType,
    sourceId,
    blockId: block.id,
    idempotencyKey: `${correlationId}:enter:${block.id}`,
    payload: { chapterId: chapter?.id, blockType: block.blockType },
    correlationId,
  });
  const request = await createRequest(tx, session.id, block);
  if (request)
    await appendEvent(tx, session, {
      eventType: "verificationRequested",
      sourceType: "progression",
      blockId: block.id,
      idempotencyKey: `${correlationId}:request:${block.id}`,
      payload: { providerType: request.providerType },
      correlationId,
      verificationRequestId: request.id,
    });
  return event;
}

export function conditionPasses(block: PublishedBlock, variables: JsonObject, inventory: string[]) {
  const config = block.configuration;
  const key = String(config.variable ?? "");
  const actual = key.startsWith("artifact:") ? inventory.includes(key.slice(9)) : variables[key];
  const expected = config.value;
  if (config.operator === "notEquals") return actual !== expected;
  if (config.operator === "greaterThan") return Number(actual) > Number(expected);
  if (config.operator === "lessThan") return Number(actual) < Number(expected);
  if (config.operator === "contains")
    return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "").includes(String(expected ?? ""));
  return actual === expected;
}

function chooseNext(
  snapshot: PublishedTaleSnapshot,
  block: PublishedBlock,
  variables: JsonObject,
  inventory: string[],
  selected?: string,
) {
  const blocks = blocksOf(snapshot);
  if (selected) return blocks.find((candidate) => candidate.id === selected) ?? null;
  if (block.blockType === "condition") {
    const target = String(
      block.configuration[
        conditionPasses(block, variables, inventory) ? "successTargetBlockId" : "failureTargetBlockId"
      ] ?? "",
    );
    return blocks.find((candidate) => candidate.id === target) ?? null;
  }
  const target =
    block.connections.find((connection) => connection.connectionType === "DEFAULT")?.targetBlockId ?? block.nextBlockId;
  return blocks.find((candidate) => candidate.id === target) ?? null;
}

export function mutateVariables(block: PublishedBlock, variables: JsonObject) {
  if (block.blockType !== "setVariable") return variables;
  const next = { ...variables };
  const key = String(block.configuration.variable ?? "");
  const operation = String(block.configuration.operation ?? "set");
  if (!key) return next;
  if (operation === "increment") next[key] = Number(next[key] ?? 0) + Number(block.configuration.value ?? 1);
  else if (operation === "decrement") next[key] = Number(next[key] ?? 0) - Number(block.configuration.value ?? 1);
  else if (operation === "toggle") next[key] = !Boolean(next[key]);
  else next[key] = block.configuration.value;
  return next;
}

async function completeBlock(
  tx: Prisma.TransactionClient,
  session: {
    id: string;
    publishedVersionId: string | null;
    draftRevisionId: string | null;
    variables: string;
    inventory: string;
  },
  snapshot: PublishedTaleSnapshot,
  block: PublishedBlock,
  sourceType: string,
  sourceId: string | null,
  key: string,
  selectedTarget?: string,
) {
  const completedBefore = await tx.taleSessionEvent.findFirst({
    where: { sessionId: session.id, blockId: block.id, eventType: "blockCompleted" },
  });
  if (completedBefore) return completedBefore;
  let variables = mutateVariables(block, parseJsonObject(session.variables));
  let inventory = parseJsonArray<string>(session.inventory);
  if (["artifactReveal", "collectionUpdate"].includes(block.blockType)) {
    const artifactId = String(block.configuration.artifactId ?? "");
    if (artifactId && !inventory.includes(artifactId)) {
      inventory = [...inventory, artifactId];
      await tx.revealState.upsert({
        where: {
          playthroughId_contentType_contentKey: {
            playthroughId: session.id,
            contentType: "ARTIFACT",
            contentKey: artifactId,
          },
        },
        update: {},
        create: {
          playthroughId: session.id,
          contentType: "ARTIFACT",
          contentKey: artifactId,
          revealedBy: sourceId ?? sourceType,
        },
      });
      await appendEvent(tx, session, {
        eventType: "artifactGranted",
        sourceType,
        sourceId,
        blockId: block.id,
        idempotencyKey: `grant:${session.id}:${block.id}:${artifactId}`,
        payload: { artifactId },
        correlationId: key,
      });
    }
  }
  if (block.blockType === "choice" && selectedTarget) variables[`choice:${block.id}`] = selectedTarget;
  await tx.taleSession.update({
    where: { id: session.id },
    data: { variables: JSON.stringify(variables), inventory: JSON.stringify(inventory) },
  });
  const completed = await appendEvent(tx, session, {
    eventType: "blockCompleted",
    sourceType,
    sourceId,
    blockId: block.id,
    idempotencyKey: `${key}:complete`,
    payload: { blockType: block.blockType },
    correlationId: key,
  });
  if (session.publishedVersionId)
    await tx.revealState.updateMany({
      where: { playthroughId: session.id, contentType: "BLOCK", contentKey: block.id },
      data: { status: "COMPLETED" },
    });
  if (block.blockType === "chapterComplete")
    await appendEvent(tx, session, {
      eventType: "chapterCompleted",
      sourceType,
      sourceId,
      blockId: block.id,
      idempotencyKey: `${key}:chapter`,
      payload: { chapterId: chapterByBlock(snapshot, block.id)?.id },
      correlationId: key,
    });
  if (block.blockType === "taleComplete") {
    await tx.taleSession.update({ where: { id: session.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.playthroughMembership.updateMany({
      where: { playthroughId: session.id, status: { in: ["READY", "ACTIVE_MEMBER"] } },
      data: { status: "COMPLETED_MEMBER", completedAt: new Date() },
    });
    await appendEvent(tx, session, {
      eventType: "sessionCompleted",
      sourceType,
      sourceId,
      blockId: block.id,
      idempotencyKey: `${key}:session`,
      payload: { taleId: snapshot.tale.id },
      correlationId: key,
    });
    return completed;
  }
  let next = chooseNext(snapshot, block, variables, inventory, selectedTarget);
  const seen = new Set<string>();
  while (next && ["condition", "setVariable"].includes(next.blockType) && !seen.has(next.id)) {
    seen.add(next.id);
    await enterBlock(tx, session, snapshot, next, "progression", null, `${key}:logic`);
    variables = mutateVariables(next, variables);
    await tx.taleSession.update({ where: { id: session.id }, data: { variables: JSON.stringify(variables) } });
    await appendEvent(tx, session, {
      eventType: "blockCompleted",
      sourceType: "progression",
      blockId: next.id,
      idempotencyKey: `${key}:logic:${next.id}`,
      payload: { automatic: true },
      correlationId: key,
    });
    next = chooseNext(snapshot, next, variables, inventory);
  }
  if (!next) {
    await tx.taleSession.update({ where: { id: session.id }, data: { status: "PAUSED" } });
    await appendEvent(tx, session, {
      eventType: "progressionStopped",
      sourceType: "progression",
      blockId: block.id,
      idempotencyKey: `${key}:stopped`,
      payload: { reason: "No valid next connection" },
      correlationId: key,
    });
  } else await enterBlock(tx, session, snapshot, next, sourceType, sourceId, key);
  return completed;
}

const emit = (sessionId: string, event: { id: string; eventType: string; sequence: number; createdAt: Date }) =>
  publishTaleSessionEvent(sessionId, {
    id: event.id,
    eventType: event.eventType,
    sequence: event.sequence,
    createdAt: event.createdAt.toISOString(),
  });

export async function startTaleSession(slug: string, ownerLabel?: string) {
  const tale = await db.tallTale.findFirst({
    where: {
      slug,
      archivedAt: null,
      latestPublishedVersionId: { not: null },
      visibility: { in: ["PUBLIC", "UNLISTED"] },
    },
    include: { versions: { where: { isCurrent: true }, take: 1 } },
  });
  const version = tale?.versions[0];
  if (!tale || !version) throw new Error("This Chronicle is not currently available.");
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  const first = blocksOf(snapshot)[0];
  if (!first) throw new Error("This published Chronicle has no playable first Passage.");
  const token = randomBytes(32).toString("base64url");
  const key = randomUUID();
  const created = await db.$transaction(async (tx) => {
    const player = await tx.playerProfile.create({
      data: {
        displayName: ownerLabel?.trim() || "Guest Player",
        preferences: JSON.stringify({ compatibilitySessionCookie: true }),
      },
    });
    const session = await tx.taleSession.create({
      data: {
        taleId: tale.id,
        publishedVersionId: version.id,
        ownerLabel: ownerLabel?.trim() || "Guest crew",
        voyageName: ownerLabel?.trim() ? `${ownerLabel.trim()}'s voyage` : "Guest voyage",
        accessTokenHash: digest(token),
        launchedAt: new Date(),
        currentChapterId: chapterByBlock(snapshot, first.id)?.id,
        currentBlockId: first.id,
      },
    });
    await tx.playthroughMembership.create({
      data: {
        playthroughId: session.id,
        playerProfileId: player.id,
        status: "ACTIVE_MEMBER",
        joinedAt: session.startedAt,
      },
    });
    await appendEvent(tx, session, {
      eventType: "sessionStarted",
      sourceType: "player",
      blockId: first.id,
      idempotencyKey: `${key}:session`,
      payload: { taleId: tale.id, versionId: version.id },
      correlationId: key,
    });
    const event = await enterBlock(tx, session, snapshot, first, "player", null, key);
    await tx.platformAuditEvent.create({
      data: {
        actorType: "ANONYMOUS",
        action: "COMPATIBILITY_PLAYTHROUGH_STARTED",
        resourceType: "PLAYTHROUGH",
        resourceId: session.id,
        correlationId: key,
        metadata: JSON.stringify({ taleId: tale.id, versionId: version.id }),
      },
    });
    return { session, event };
  });
  emit(created.session.id, created.event);
  logger.info(
    { area: "tall-tale-session", sessionId: created.session.id, taleId: tale.id, versionId: version.id },
    "Published Chronicle Voyage started",
  );
  return { sessionId: created.session.id, token, taleSlug: slug, versionId: version.id };
}

export async function launchTalePlaythrough(sessionId: string, actorId: string, expectedVersion?: number) {
  const session = await db.taleSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { version: true, memberships: true, invitations: true },
  });
  if (session.previewMode || !session.version) throw new Error("Only a published real voyage can be launched.");
  if (session.captainId && session.captainId !== actorId)
    throw new Error("This voyage is assigned to another Captain.");
  if (!["READY", "SCHEDULED"].includes(session.status))
    throw new Error(`This voyage is ${session.status.toLocaleLowerCase()} and is not ready to launch.`);
  if (!session.memberships.some((membership) => membership.status === "READY"))
    throw new Error("At least one accepted Player must be ready before launch.");
  const snapshot = snapshotOf(session);
  const configured = parseJsonObject(session.configuration).startingBlockId;
  const first = blockById(snapshot, typeof configured === "string" ? configured : null) ?? blocksOf(snapshot)[0];
  if (!first) throw new Error("This published version has no playable entry block.");
  const correlationId = randomUUID();
  const event = await db.$transaction(async (tx) => {
    const claimed = await tx.taleSession.updateMany({
      where: {
        id: sessionId,
        status: { in: ["READY", "SCHEDULED"] },
        concurrencyVersion: expectedVersion ?? session.concurrencyVersion,
      },
      data: {
        status: "ACTIVE",
        launchedAt: new Date(),
        captainId: actorId,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (!claimed.count) throw new Error("Voyage state changed before launch. Refresh and review the current state.");
    await tx.playthroughMembership.updateMany({
      where: { playthroughId: sessionId, status: "READY" },
      data: { status: "ACTIVE_MEMBER" },
    });
    await tx.invitation.updateMany({
      where: { playthroughId: sessionId, status: { in: ["ACCEPTED", "READY", "JOINED"] } },
      data: { status: "CONSUMED" },
    });
    await appendEvent(tx, session, {
      eventType: "sessionLaunched",
      sourceType: "captain",
      sourceId: actorId,
      blockId: first.id,
      idempotencyKey: `${correlationId}:launch`,
      payload: { versionId: session.version!.id },
      correlationId,
    });
    const entered = await enterBlock(tx, session, snapshot, first, "captain", actorId, correlationId);
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId,
        action: "PLAYTHROUGH_LAUNCHED",
        resourceType: "PLAYTHROUGH",
        resourceId: sessionId,
        correlationId,
        metadata: JSON.stringify({ versionId: session.version!.id }),
      },
    });
    return entered;
  });
  emit(sessionId, event);
  return { accepted: true, state: await getTaleSessionState(sessionId, undefined, true) };
}

export async function getCatalogSessionStatus(sessionId: string, token: string) {
  const session = await db.taleSession.findUnique({
    where: { id: sessionId },
    select: { id: true, taleId: true, status: true, previewMode: true, accessTokenHash: true, completedAt: true },
  });
  if (!session || session.previewMode || digest(token) !== session.accessTokenHash) return null;
  return {
    sessionId: session.id,
    taleId: session.taleId,
    status: session.completedAt || session.status === "COMPLETED" ? "COMPLETED" : session.status,
  };
}

export async function startPreviewSession(taleId: string, creatorId: string, startBlockId?: string) {
  const studio = await getStudioTale(taleId);
  const snapshot = snapshotFromStudio(studio);
  const first = blockById(snapshot, startBlockId ?? null) ?? blocksOf(snapshot)[0];
  if (!first) throw new Error("Add a Passage before opening Preview Voyage.");
  const token = randomBytes(32).toString("base64url");
  const key = randomUUID();
  const created = await db.$transaction(async (tx) => {
    const session = await tx.taleSession.create({
      data: {
        taleId,
        ownerLabel: "Studio preview",
        captainId: creatorId,
        accessTokenHash: digest(token),
        currentChapterId: chapterByBlock(snapshot, first.id)?.id,
        currentBlockId: first.id,
        previewMode: true,
        draftRevisionId: studio.draft.id,
        previewSnapshot: JSON.stringify(snapshot),
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    await appendEvent(tx, session, {
      eventType: "previewStarted",
      sourceType: "studio",
      sourceId: creatorId,
      blockId: first.id,
      idempotencyKey: `${key}:session`,
      payload: { draftRevisionId: studio.draft.id },
      correlationId: key,
    });
    const event = await enterBlock(tx, session, snapshot, first, "studio", creatorId, key);
    return { session, event };
  });
  emit(created.session.id, created.event);
  return { sessionId: created.session.id, token, taleSlug: studio.tale.slug, versionId: `draft:${studio.draft.id}` };
}

export async function startPublishedPreviewSession(taleId: string, versionId: string, creatorId: string) {
  const version = await db.publishedTaleVersion.findFirstOrThrow({
    where: { id: versionId, taleId },
    include: { tale: true },
  });
  const snapshot = parsePublishedSnapshot(version.contentSnapshot);
  const first = blocksOf(snapshot)[0];
  if (!first) throw new Error("This published version has no playable entry block.");
  const token = randomBytes(32).toString("base64url");
  const key = randomUUID();
  const created = await db.$transaction(async (tx) => {
    const session = await tx.taleSession.create({
      data: {
        taleId,
        publishedVersionId: version.id,
        ownerLabel: `Studio preview v${version.versionLabel}`,
        captainId: creatorId,
        accessTokenHash: digest(token),
        currentChapterId: chapterByBlock(snapshot, first.id)?.id,
        currentBlockId: first.id,
        previewMode: true,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
      },
    });
    await appendEvent(tx, session, {
      eventType: "publishedPreviewStarted",
      sourceType: "studio",
      sourceId: creatorId,
      blockId: first.id,
      idempotencyKey: `${key}:session`,
      payload: { versionId: version.id, versionLabel: version.versionLabel },
      correlationId: key,
    });
    const event = await enterBlock(tx, session, snapshot, first, "studio", creatorId, key);
    return { session, event };
  });
  emit(created.session.id, created.event);
  return { sessionId: created.session.id, token, taleSlug: version.tale.slug, versionId: version.id };
}

export async function getTaleSessionState(
  sessionId: string,
  token?: string,
  captain = false,
  authorizedPlayer = false,
) {
  const [session, journalEvents] = await Promise.all([
    db.taleSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: {
        version: true,
        verificationRequests: { where: { status: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 },
        events: { orderBy: { sequence: "desc" }, take: 40 },
        revealStates: { where: { contentType: "BLOCK" }, orderBy: { revealedAt: "asc" } },
      },
    }),
    db.taleSessionEvent.findMany({
      where: { sessionId, eventType: { in: ["blockEntered", "blockCompleted", "hintReleased"] } },
      orderBy: { sequence: "asc" },
      select: { blockId: true, eventType: true, createdAt: true },
    }),
  ]);
  if (!captain && !authorizedPlayer && (!token || digest(token) !== session.accessTokenHash))
    throw new Error("This Voyage is not available in this browser.");
  if (session.expiresAt && session.expiresAt < new Date()) throw new Error("This preview session has expired.");
  const snapshot = snapshotOf(session);
  const block = blockById(snapshot, session.currentBlockId);
  const chapter = chapterByBlock(snapshot, session.currentBlockId);
  const request = session.verificationRequests[0] ?? null;
  const revealedAt = new Map<string, Date>();
  const completedAt = new Map<string, Date>();
  const releasedHintCounts = new Map<string, number>();
  for (const state of session.revealStates) revealedAt.set(state.contentKey, state.revealedAt);
  for (const event of journalEvents) {
    if (!event.blockId) continue;
    if (event.eventType === "blockEntered" && !revealedAt.has(event.blockId))
      revealedAt.set(event.blockId, event.createdAt);
    if (event.eventType === "blockCompleted") completedAt.set(event.blockId, event.createdAt);
    if (event.eventType === "hintReleased")
      releasedHintCounts.set(event.blockId, (releasedHintCounts.get(event.blockId) ?? 0) + 1);
  }
  if (session.currentBlockId && !revealedAt.has(session.currentBlockId))
    revealedAt.set(session.currentBlockId, session.updatedAt);
  const playerChoices = Object.fromEntries(
    Object.entries(parseJsonObject(session.variables))
      .filter(([key, value]) => key.startsWith("choice:") && typeof value === "string")
      .map(([key, value]) => [key.slice("choice:".length), String(value)]),
  );
  const playerBlock = block ? projectPlayerBlock(block, { releasedHintCount: releasedHintCounts.get(block.id) }) : null;
  const journal = {
    mode: session.previewMode
      ? ("preview" as const)
      : session.status === "COMPLETED"
        ? ("historical" as const)
        : ("active" as const),
    currentChapterId: session.currentChapterId,
    currentBlockId: session.currentBlockId,
    chapters: snapshot.chapters
      .map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle ?? null,
        orderIndex: item.orderIndex,
        blocks: item.blocks
          .filter((candidate) => revealedAt.has(candidate.id))
          .map((candidate) => {
            const projected = projectPlayerBlock(candidate, {
              releasedHintCount: releasedHintCounts.get(candidate.id),
            });
            if (!projected) return null;
            const complete = completedAt.get(candidate.id) ?? null;
            return {
              ...projected,
              progress: complete
                ? ("completed" as const)
                : candidate.id === session.currentBlockId
                  ? ("active" as const)
                  : ("released" as const),
              releasedAt: revealedAt.get(candidate.id)?.toISOString() ?? null,
              completedAt: complete?.toISOString() ?? null,
              selectedTargetId: playerChoices[candidate.id] ?? null,
            };
          })
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)),
      }))
      .filter((item) => item.blocks.length > 0),
  };
  const allowedAssetIds = captain
    ? new Set(snapshot.assets.map((asset) => asset.id))
    : playerSafeAssetIds(
        session.version?.contentSnapshot ?? session.previewSnapshot ?? JSON.stringify(snapshot),
        session.events.map((event) => event.blockId),
        session.inventory,
      );
  return {
    session: {
      id: session.id,
      status: session.status,
      previewMode: session.previewMode,
      versionId: identity(session),
      ownerLabel: session.ownerLabel,
      currentSequence: session.currentSequence,
      startedAt: session.startedAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      versionLabel: session.version?.versionLabel ?? (session.previewMode ? "Draft preview" : "Unpublished"),
      versionPublishedAt: session.version?.publishedAt.toISOString() ?? null,
      versionChecksum: session.version?.checksum ?? null,
    },
    tale: snapshot.tale,
    chapter: chapter
      ? { id: chapter.id, title: chapter.title, subtitle: chapter.subtitle, orderIndex: chapter.orderIndex }
      : null,
    block: captain ? (block ? { ...block, creatorNotes: block.creatorNotes } : null) : playerBlock,
    pendingVerification: request
      ? {
          id: request.id,
          providerType: request.providerType,
          requestedAt: request.requestedAt.toISOString(),
          expiresAt: request.expiresAt?.toISOString() ?? null,
          status: request.status,
        }
      : null,
    inventory: parseJsonArray<string>(session.inventory),
    variables: captain ? parseJsonObject(session.variables) : undefined,
    journal: captain ? undefined : journal,
    events: session.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      sourceType: event.sourceType,
      blockId: event.blockId,
      sequence: event.sequence,
      payload: captain ? parseJsonObject(event.payload) : playerSafeObject(parseJsonObject(event.payload)),
      createdAt: event.createdAt.toISOString(),
    })),
    assets: snapshot.assets
      .filter((asset) => allowedAssetIds.has(asset.id))
      .map((asset) => ({
        id: asset.id,
        mediaType: asset.mediaType,
        displayName: asset.displayName,
        description: asset.description,
        mimeType: asset.mimeType,
        width: asset.width,
        height: asset.height,
        url: `/api/media/${asset.id}?version=${encodeURIComponent(identity(session))}&session=${encodeURIComponent(
          session.id,
        )}`,
      })),
    chapters: captain
      ? snapshot.chapters.map((item) => ({
          id: item.id,
          title: item.title,
          blocks: item.blocks.map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            blockType: candidate.blockType,
          })),
        }))
      : undefined,
  };
}

export function normalized(value: string, config: JsonObject) {
  let result = config.normalizeWhitespace === false ? value : value.trim().replace(/\s+/g, " ");
  if (!config.caseSensitive) result = result.toLocaleLowerCase();
  return result;
}

export async function interactWithTaleSession(
  sessionId: string,
  token: string | undefined,
  input: {
    action: "continue" | "confirm" | "answer" | "choice" | "timer";
    idempotencyKey: string;
    answer?: string;
    targetBlockId?: string;
  },
  authorizedPlayer = false,
) {
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: sessionId }, include: { version: true } });
  if (!authorizedPlayer && (!token || digest(token) !== session.accessTokenHash))
    throw new Error("This voyage session is not available to this browser.");
  if (session.status !== "ACTIVE") throw new Error(`This session is ${session.status.toLowerCase()}.`);
  const snapshot = snapshotOf(session);
  const block = blockById(snapshot, session.currentBlockId);
  if (!block) throw new Error("The current Passage is unavailable.");
  const request = await db.taleVerificationRequest.findFirst({
    where: { sessionId, blockId: block.id, status: "PENDING" },
    orderBy: { requestedAt: "desc" },
  });
  if (input.action === "answer") {
    if (!request || request.providerType !== "textAnswer") throw new Error("This block is not awaiting a text answer.");
    const config = parseJsonObject(request.configurationSnapshot);
    const answer = normalized(input.answer ?? "", config);
    const accepted =
      Array.isArray(config.acceptedAnswers) &&
      config.acceptedAnswers.some(
        (candidate) => typeof candidate === "string" && normalized(candidate, config) === answer,
      );
    if (!accepted) {
      const event = await db.$transaction((tx) =>
        appendEvent(tx, session, {
          eventType: "verificationRejected",
          sourceType: "player",
          blockId: block.id,
          idempotencyKey: `${input.idempotencyKey}:rejected`,
          payload: { providerType: "textAnswer" },
          verificationRequestId: request.id,
        }),
      );
      emit(sessionId, event);
      return { accepted: false, state: await getTaleSessionState(sessionId, token, false, authorizedPlayer) };
    }
  } else if (input.action === "timer") {
    if (!request || request.providerType !== "timer" || !request.expiresAt || request.expiresAt > new Date())
      throw new Error("The configured wait is not complete.");
  } else if (input.action === "choice") {
    if (
      !block.connections.some(
        (connection) => connection.connectionType === "CHOICE" && connection.targetBlockId === input.targetBlockId,
      )
    )
      throw new Error("That choice is not connected to this block.");
  } else if (request?.providerType === "captainManual") throw new Error("The Captain must resolve this verification.");
  const event = await db.$transaction(async (tx) => {
    const current = await tx.taleSession.findUniqueOrThrow({ where: { id: sessionId }, include: { version: true } });
    if (current.currentBlockId !== block.id) throw new Error("The story has already advanced.");
    if (request)
      await tx.taleVerificationRequest.update({
        where: { id: request.id },
        data: { status: "SATISFIED", resolvedAt: new Date() },
      });
    if (request)
      await appendEvent(tx, current, {
        eventType: "verificationSatisfied",
        sourceType: "player",
        blockId: block.id,
        idempotencyKey: `${input.idempotencyKey}:verified`,
        payload: { providerType: request.providerType },
        verificationRequestId: request.id,
        correlationId: input.idempotencyKey,
      });
    return completeBlock(tx, current, snapshot, block, "player", null, input.idempotencyKey, input.targetBlockId);
  });
  emit(sessionId, event);
  return { accepted: true, state: await getTaleSessionState(sessionId, token, false, authorizedPlayer) };
}

export async function submitVerification(
  unchecked: VerificationSubmission,
  actor: { sourceType: string; sourceId?: string },
) {
  const submission = verificationSubmissionSchema.parse(unchecked);
  const duplicate = await db.taleVerificationEvent.findUnique({ where: { idempotencyKey: submission.idempotencyKey } });
  if (duplicate) return { duplicate: true, accepted: duplicate.accepted, rejectionReason: duplicate.rejectionReason };
  const request = await db.taleVerificationRequest.findUnique({
    where: { id: submission.verificationRequestId },
    include: { session: { include: { version: true } } },
  });
  if (!request) throw new VerificationRejectedError("unknownRequest");
  let reason: string | null = null;
  if (request.sessionId !== submission.sessionId) reason = "wrongSession";
  else if (identity(request.session) !== submission.publishedVersionId) reason = "wrongVersion";
  else if (request.blockId !== submission.blockId || request.session.currentBlockId !== submission.blockId)
    reason = "wrongBlock";
  else if (request.status !== "PENDING") reason = "staleRequest";
  else if (new Date(submission.observedAt).getTime() < request.requestedAt.getTime() - 1000)
    reason = "staleObservation";
  else if (request.expiresAt && request.expiresAt < new Date()) reason = "expiredRequest";
  else if (
    request.providerType !== submission.providerType &&
    !["captainOverride", "simulator"].includes(actor.sourceType)
  )
    reason = "wrongProvider";
  if (reason) {
    logger.warn(
      {
        area: "tall-tale-verification",
        sessionId: submission.sessionId,
        requestId: submission.verificationRequestId,
        reason,
      },
      "Verification event rejected",
    );
    await db.taleVerificationEvent.create({
      data: {
        requestId: request.id,
        eventId: submission.eventId,
        idempotencyKey: submission.idempotencyKey,
        providerType: submission.providerType,
        providerInstanceId: submission.providerInstanceId,
        result: submission.result,
        confidence: submission.confidence,
        evidence: JSON.stringify(submission.evidence ?? {}),
        observedAt: new Date(submission.observedAt),
        accepted: false,
        rejectionReason: reason,
      },
    });
    throw new VerificationRejectedError(reason);
  }
  const snapshot = snapshotOf(request.session);
  const block = blockById(snapshot, request.blockId);
  if (!block) throw new VerificationRejectedError("unknownBlock");
  const event = await db.$transaction(async (tx) => {
    await tx.taleVerificationEvent.create({
      data: {
        requestId: request.id,
        eventId: submission.eventId,
        idempotencyKey: submission.idempotencyKey,
        providerType: submission.providerType,
        providerInstanceId: submission.providerInstanceId,
        result: submission.result,
        confidence: submission.confidence,
        evidence: JSON.stringify(submission.evidence ?? {}),
        observedAt: new Date(submission.observedAt),
        accepted: true,
      },
    });
    const current = await tx.taleSession.findUniqueOrThrow({
      where: { id: request.sessionId },
      include: { version: true },
    });
    if (submission.result !== "match")
      return appendEvent(tx, current, {
        eventType: submission.result === "uncertain" ? "verificationUncertain" : "verificationRejected",
        sourceType: actor.sourceType,
        sourceId: actor.sourceId,
        blockId: block.id,
        idempotencyKey: `${submission.idempotencyKey}:outcome`,
        payload: { providerType: submission.providerType, confidence: submission.confidence },
        verificationRequestId: request.id,
        correlationId: submission.eventId,
      });
    await tx.taleVerificationRequest.update({
      where: { id: request.id },
      data: { status: "SATISFIED", resolvedAt: new Date(), satisfiedByEventId: submission.eventId },
    });
    await appendEvent(tx, current, {
      eventType: actor.sourceType === "captainOverride" ? "captainManualUnlock" : "verificationSatisfied",
      sourceType: actor.sourceType,
      sourceId: actor.sourceId,
      blockId: block.id,
      idempotencyKey: `${submission.idempotencyKey}:satisfied`,
      payload: { providerType: submission.providerType, confidence: submission.confidence },
      verificationRequestId: request.id,
      correlationId: submission.eventId,
    });
    return completeBlock(
      tx,
      current,
      snapshot,
      block,
      actor.sourceType,
      actor.sourceId ?? null,
      submission.idempotencyKey,
    );
  });
  emit(request.sessionId, event);
  logger.info(
    {
      area: "tall-tale-verification",
      sessionId: request.sessionId,
      requestId: request.id,
      sourceType: actor.sourceType,
    },
    "Verification event accepted",
  );
  return { duplicate: false, accepted: true, rejectionReason: null };
}

export async function captainSessionAction(
  sessionId: string,
  actorId: string,
  input: {
    action:
      | "approve"
      | "reject"
      | "override"
      | "pause"
      | "resume"
      | "jump"
      | "rollback"
      | "presentation"
      | "releaseHint";
    reason?: string;
    targetBlockId?: string;
    idempotencyKey: string;
  },
) {
  const session = await db.taleSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      version: true,
      verificationRequests: { where: { status: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 },
      events: { where: { eventType: "blockEntered" }, orderBy: { sequence: "desc" }, take: 2 },
    },
  });
  if (session.captainId && session.captainId !== actorId)
    throw new Error("This voyage is assigned to another Captain.");
  const snapshot = snapshotOf(session);
  const request = session.verificationRequests[0];
  if (["approve", "reject", "override"].includes(input.action)) {
    if (!request) throw new Error("This session has no pending verification request.");
    return submitVerification(
      {
        schemaVersion: 1,
        eventId: randomUUID(),
        idempotencyKey: input.idempotencyKey,
        eventType: "verification.result",
        providerType: request.providerType as VerificationProviderType,
        providerInstanceId: `captain:${actorId}`,
        sessionId,
        publishedVersionId: identity(session),
        blockId: request.blockId,
        verificationRequestId: request.id,
        observedAt: new Date().toISOString(),
        result: input.action === "reject" ? "notMatch" : "match",
        confidence: 1,
        evidence: { reason: input.reason ?? "Captain action", override: input.action === "override" },
      },
      { sourceType: input.action === "override" ? "captainOverride" : "captainManual", sourceId: actorId },
    );
  }
  const event = await db.$transaction(async (tx) => {
    const current = await tx.taleSession.findUniqueOrThrow({ where: { id: sessionId }, include: { version: true } });
    if (input.action === "pause" || input.action === "resume") {
      await tx.taleSession.update({
        where: { id: sessionId },
        data: { status: input.action === "pause" ? "PAUSED" : "ACTIVE" },
      });
      return appendEvent(tx, current, {
        eventType: input.action === "pause" ? "sessionPaused" : "sessionResumed",
        sourceType: "captain",
        sourceId: actorId,
        blockId: current.currentBlockId,
        idempotencyKey: input.idempotencyKey,
        payload: { reason: input.reason ?? null },
      });
    }
    if (input.action === "presentation" || input.action === "releaseHint")
      return appendEvent(tx, current, {
        eventType: input.action === "presentation" ? "presentationTriggered" : "hintReleased",
        sourceType: "captain",
        sourceId: actorId,
        blockId: current.currentBlockId,
        idempotencyKey: input.idempotencyKey,
        payload: { reason: input.reason ?? null },
      });
    const targetId = input.action === "rollback" ? session.events[1]?.blockId : input.targetBlockId;
    const target = blockById(snapshot, targetId ?? null);
    if (!target) throw new Error("Choose a valid target block.");
    await tx.taleVerificationRequest.updateMany({
      where: { sessionId, status: "PENDING" },
      data: { status: "CANCELLED", resolvedAt: new Date() },
    });
    await tx.taleSession.update({ where: { id: sessionId }, data: { status: "ACTIVE" } });
    const audit = await appendEvent(tx, current, {
      eventType: input.action === "rollback" ? "captainRollback" : "captainJump",
      sourceType: "captain",
      sourceId: actorId,
      blockId: current.currentBlockId,
      idempotencyKey: input.idempotencyKey,
      payload: {
        fromBlockId: current.currentBlockId,
        targetBlockId: target.id,
        reason: input.reason ?? "No reason supplied",
      },
    });
    await enterBlock(tx, current, snapshot, target, "captain", actorId, input.idempotencyKey);
    return audit;
  });
  emit(sessionId, event);
  return { accepted: true };
}

export async function listCaptainSessions() {
  const sessions = await db.taleSession.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { tale: true, version: true, verificationRequests: { where: { status: "PENDING" }, take: 1 } },
  });
  return sessions.map((session) => ({
    id: session.id,
    taleId: session.taleId,
    taleTitle: session.tale.title,
    versionLabel: session.version?.versionLabel ?? "Draft preview",
    ownerLabel: session.ownerLabel,
    status: session.status,
    previewMode: session.previewMode,
    currentBlockId: session.currentBlockId,
    pendingVerification: session.verificationRequests[0]
      ? {
          id: session.verificationRequests[0].id,
          providerType: session.verificationRequests[0].providerType,
          requestedAt: session.verificationRequests[0].requestedAt.toISOString(),
        }
      : null,
    lastEventAt: session.updatedAt.toISOString(),
    connected: Boolean(session.lastHeartbeatAt && Date.now() - session.lastHeartbeatAt.getTime() < 45000),
  }));
}

export async function createHelperPairing(sessionId: string, deviceId: string) {
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!session.publishedVersionId || session.previewMode || !["ACTIVE", "PAUSED"].includes(session.status))
    throw new Error("Helper devices can only pair with an active published tale session.");
  const token = randomBytes(32).toString("base64url");
  const pairing = await db.taleHelperPairing.create({
    data: { sessionId, deviceId, tokenHash: digest(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  return { pairingId: pairing.id, token, expiresAt: pairing.expiresAt.toISOString() };
}

export async function getHelperScope(token: string) {
  const pairing = await db.taleHelperPairing.findFirst({
    where: { tokenHash: digest(token), status: "ACTIVE", revokedAt: null, expiresAt: { gt: new Date() } },
    include: {
      session: {
        include: {
          verificationRequests: { where: { status: "PENDING" }, orderBy: { requestedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!pairing || !pairing.session.publishedVersionId || pairing.session.previewMode)
    throw new VerificationRejectedError("invalidPairing");
  const now = new Date();
  await db.$transaction([
    db.taleHelperPairing.update({ where: { id: pairing.id }, data: { lastSeenAt: now } }),
    db.taleSession.update({ where: { id: pairing.sessionId }, data: { lastHeartbeatAt: now } }),
  ]);
  const request = pairing.session.verificationRequests[0] ?? null;
  return {
    pairing: {
      id: pairing.id,
      deviceId: pairing.deviceId,
      status: pairing.status,
      expiresAt: pairing.expiresAt.toISOString(),
      heartbeatAt: now.toISOString(),
    },
    scope: {
      sessionId: pairing.sessionId,
      sessionStatus: pairing.session.status,
      publishedVersionId: pairing.session.publishedVersionId,
      currentBlockId: pairing.session.currentBlockId,
      verificationRequest: request
        ? {
            id: request.id,
            blockId: request.blockId,
            providerType: request.providerType,
            status: request.status,
            requestedAt: request.requestedAt.toISOString(),
            expiresAt: request.expiresAt?.toISOString() ?? null,
          }
        : null,
    },
  };
}

export async function revokeHelperPairing(pairingId: string, actorId: string) {
  const pairing = await db.taleHelperPairing.findUniqueOrThrow({ where: { id: pairingId } });
  const revokedAt = new Date();
  const updated = await db.taleHelperPairing.update({
    where: { id: pairingId },
    data: { status: "REVOKED", revokedAt },
  });
  const session = await db.taleSession.findUniqueOrThrow({ where: { id: pairing.sessionId } });
  const event = await db.$transaction((tx) =>
    appendEvent(tx, session, {
      eventType: "helperPairingRevoked",
      sourceType: "captain",
      sourceId: actorId,
      blockId: session.currentBlockId,
      idempotencyKey: `helper-revoke:${pairingId}`,
      payload: { pairingId, deviceId: pairing.deviceId },
    }),
  );
  emit(session.id, event);
  return { id: updated.id, status: updated.status, revokedAt: revokedAt.toISOString() };
}

export async function submitHelperVerification(token: string, submission: VerificationSubmission) {
  const pairing = await db.taleHelperPairing.findFirst({
    where: { tokenHash: digest(token), status: "ACTIVE", revokedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!pairing || pairing.sessionId !== submission.sessionId) throw new VerificationRejectedError("invalidPairing");
  await db.taleHelperPairing.update({ where: { id: pairing.id }, data: { lastSeenAt: new Date() } });
  return submitVerification(submission, { sourceType: "helper", sourceId: pairing.deviceId });
}
