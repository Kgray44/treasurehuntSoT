import { randomUUID } from "node:crypto";
import type { AdminCommand } from "@/domain/admin";
import { db } from "@/lib/db";
import { publishTaleSessionEvent } from "@/lib/events";
import { parseJsonArray, parseJsonObject, parsePublishedSnapshot, type JsonObject } from "@/chronicle/types";
import { resolveLegacyCampaign } from "@/compatibility/legacy-companion";
import { canonicalWritesEnabled } from "@/compatibility/project-one-voyage-stage";
import { compatibilityTestTraffic, recordCompatibilityObservation } from "@/compatibility/compatibility-observation";
import { canonicalAccountForLegacyActor } from "@/wayfarer/accounts";

export class LegacyQuartermasterConflict extends Error {
  constructor(
    message: string,
    public readonly code: "STALE_SEQUENCE" | "SESSION_PAUSED" | "NOT_FOUND" | "UNSUPPORTED_COMMAND",
  ) {
    super(message);
  }
}

type LegacyCommandInput = {
  command: AdminCommand;
  campaignSlug: string;
  expectedSequence: number;
  idempotencyKey: string;
  targetKey?: string;
  payload: Record<string, unknown>;
  reason?: string;
};

type LegacyVariables = JsonObject & {
  legacy?: JsonObject & {
    chapters?: Record<string, string>;
    sideQuests?: Record<string, JsonObject>;
    routes?: Record<string, string>;
  };
};

const eventTypeFor: Partial<Record<AdminCommand, string>> = {
  PREPARE_CHAPTER: "CHAPTER_PREPARED",
  RELEASE_CHAPTER: "CHAPTER_RELEASED",
  MARK_SOLVED: "CHAPTER_SOLVED",
  COMPLETE_CHAPTER: "CHAPTER_REVEAL_COMPLETED",
  RELEASE_HINT: "HINT_RELEASED",
  RELEASE_NEXT_HINT: "HINT_RELEASED",
  REVEAL_MAP: "MAP_LOCATION_REVEALED",
  REVEAL_ROUTE: "MAP_ROUTE_REVEALED",
  AWARD_ARTIFACT: "ARTIFACT_AWARDED",
  REVEAL_ARTIFACT_SILHOUETTE: "ARTIFACT_SILHOUETTE_REVEALED",
  CONNECT_ARTIFACTS: "ARTIFACT_CONNECTED",
  DISCOVER_SIDE_QUEST: "SIDE_QUEST_DISCOVERED",
  UPDATE_SIDE_QUEST: "SIDE_QUEST_UPDATED",
  COMPLETE_SIDE_QUEST: "SIDE_QUEST_COMPLETED",
  ADVANCE_SIDE_QUEST: "SIDE_QUEST_UPDATED",
  ADD_JOURNAL_ANNOTATION: "JOURNAL_ANNOTATION_ADDED",
  ADD_LOG_ENTRY: "PLAYER_LOG_ENTRY_ADDED",
  RELEASE_JOURNAL_ENTRY: "NARRATIVE_MESSAGE_RELEASED",
  TEASE_FINALE: "FINALE_TEASED",
  UPDATE_FINALE_REQUIREMENT: "FINALE_REQUIREMENT_UPDATED",
  PAUSE: "CAMPAIGN_PAUSED",
  RESUME: "CAMPAIGN_RESUMED",
  REQUEST_RECONCILIATION: "PLAYER_RECONCILIATION_REQUESTED",
};

function legacyState(raw: string): LegacyVariables {
  const parsed = parseJsonObject(raw) as LegacyVariables;
  const legacy = (parsed.legacy ?? {}) as JsonObject;
  parsed.legacy = legacy;
  if (!legacy.chapters || typeof legacy.chapters !== "object" || Array.isArray(legacy.chapters)) legacy.chapters = {};
  if (!legacy.sideQuests || typeof legacy.sideQuests !== "object" || Array.isArray(legacy.sideQuests))
    legacy.sideQuests = {};
  if (!legacy.routes || typeof legacy.routes !== "object" || Array.isArray(legacy.routes)) legacy.routes = {};
  return parsed;
}

function chapterForCommand(
  snapshot: ReturnType<typeof parsePublishedSnapshot>,
  variables: LegacyVariables,
  command: AdminCommand,
) {
  const chapters = (variables.legacy?.chapters ?? {}) as Record<string, string>;
  if (command === "PREPARE_CHAPTER")
    return snapshot.chapters.find((chapter) =>
      ["LOCKED", "TEASER"].includes(chapters[String(chapter.orderIndex)] ?? "LOCKED"),
    );
  if (command === "RELEASE_CHAPTER")
    return snapshot.chapters.find((chapter) => (chapters[String(chapter.orderIndex)] ?? "LOCKED") === "READY");
  return [...snapshot.chapters]
    .reverse()
    .find((chapter) => ["ACTIVE", "SOLVED", "COMPLETE"].includes(chapters[String(chapter.orderIndex)] ?? "LOCKED"));
}

function receipt(event: { id: string; eventType: string; sequence: number; createdAt: Date }, correlationId: string) {
  return {
    kind: "PROGRESSION_EVENT" as const,
    event: {
      id: event.id,
      type: event.eventType,
      sequence: event.sequence,
      payload: {},
      releaseAt: event.createdAt.toISOString(),
    },
    correlationId,
    persistence: "COMMITTED" as const,
    publication: "PROCESS_PUBLISHED" as const,
    delivery: "PUBLISHED" as const,
    deliveryScope: "PROCESS_SUBSCRIBERS_ONLY" as const,
    playerDelivery: "UNCONFIRMED" as const,
    playerPresentation: "UNCONFIRMED" as const,
    playerAcknowledgment: "UNCONFIRMED" as const,
    playerEvent: { id: event.id, type: event.eventType, sequence: event.sequence },
  };
}

/**
 * Adapter for Quartermaster request shapes. It resolves the historical Campaign
 * only as an ID lookup; all decisions, sequence increments, events, reveals,
 * inventory and audit writes are canonical Chronicle-session writes.
 */
export async function executeLegacyQuartermasterCommand(
  input: LegacyCommandInput,
  userId: string,
  correlationId: string = randomUUID(),
) {
  if (!canonicalWritesEnabled())
    throw new LegacyQuartermasterConflict(
      "Canonical compatibility writes are not enabled for this rollout stage.",
      "NOT_FOUND",
    );
  const resolved = await resolveLegacyCampaign(input.campaignSlug);
  if (!resolved) throw new LegacyQuartermasterConflict("This Voyage is unavailable.", "NOT_FOUND");
  const key = `legacy-quartermaster:${resolved.sessionId}:${input.idempotencyKey}`;
  const canonicalAccountId = await canonicalAccountForLegacyActor(userId);
  const event = await db.$transaction(async (tx) => {
    const prior = await tx.taleSessionEvent.findUnique({ where: { idempotencyKey: key } });
    if (prior) return prior;
    const session = await tx.taleSession.findUniqueOrThrow({
      where: { id: resolved.sessionId },
      include: { version: true },
    });
    if (session.currentSequence !== input.expectedSequence)
      throw new LegacyQuartermasterConflict(
        `Chronicle state changed from sequence ${input.expectedSequence} to ${session.currentSequence}. Refresh Captain's Console.`,
        "STALE_SEQUENCE",
      );
    if (session.status === "PAUSED" && !["RESUME", "REQUEST_RECONCILIATION"].includes(input.command))
      throw new LegacyQuartermasterConflict(
        "This Chronicle Session is paused. Resume it before releasing progression.",
        "SESSION_PAUSED",
      );
    const type = eventTypeFor[input.command];
    if (!type || input.command === "UNDO_LAST")
      throw new LegacyQuartermasterConflict(
        "This historical command requires the canonical Captain rollback control.",
        "UNSUPPORTED_COMMAND",
      );
    if (!session.version)
      throw new LegacyQuartermasterConflict("This Chronicle Session has no published version.", "NOT_FOUND");
    const snapshot = parsePublishedSnapshot(session.version.contentSnapshot);
    const variables = legacyState(session.variables);
    const inventory = parseJsonArray<string>(session.inventory);
    let currentBlockId = session.currentBlockId;
    let currentChapterId = session.currentChapterId;
    let status = session.status;
    let reveal: { contentType: string; contentKey: string } | null = null;
    const payload: JsonObject = { command: input.command, targetKey: input.targetKey ?? null };
    const chapter = chapterForCommand(snapshot, variables, input.command);

    if (["PREPARE_CHAPTER", "RELEASE_CHAPTER", "MARK_SOLVED", "COMPLETE_CHAPTER"].includes(input.command)) {
      if (!chapter) throw new LegacyQuartermasterConflict("No matching imported Chapter is available.", "NOT_FOUND");
      const state =
        input.command === "PREPARE_CHAPTER"
          ? "READY"
          : input.command === "RELEASE_CHAPTER"
            ? "ACTIVE"
            : input.command === "MARK_SOLVED"
              ? "SOLVED"
              : "COMPLETE";
      (variables.legacy!.chapters as Record<string, string>)[String(chapter.orderIndex)] = state;
      if (input.command === "RELEASE_CHAPTER") {
        currentChapterId = chapter.id;
        currentBlockId = chapter.entryBlockId;
        if (chapter.entryBlockId) reveal = { contentType: "BLOCK", contentKey: chapter.entryBlockId };
      }
      payload.chapterId = chapter.id;
      payload.chapterState = state;
    } else if (input.command === "PAUSE" || input.command === "RESUME") {
      status = input.command === "PAUSE" ? "PAUSED" : "ACTIVE";
    } else if (input.command === "REVEAL_MAP" || input.command === "REVEAL_ROUTE") {
      const contentKey = input.targetKey ?? "default";
      reveal = { contentType: input.command === "REVEAL_MAP" ? "map-location" : "map-route", contentKey };
      if (input.command === "REVEAL_ROUTE")
        (variables.legacy!.routes as Record<string, string>)[contentKey] = "REVEALED";
    } else if (["AWARD_ARTIFACT", "REVEAL_ARTIFACT_SILHOUETTE", "CONNECT_ARTIFACTS"].includes(input.command)) {
      const artifact = await tx.taleArtifact.findFirst({
        where: { taleId: session.taleId, ...(input.targetKey ? { legacyKey: input.targetKey } : {}) },
        orderBy: { sortOrder: "asc" },
      });
      if (!artifact) throw new LegacyQuartermasterConflict("No mapped Artifact is available.", "NOT_FOUND");
      reveal = { contentType: "artifact", contentKey: artifact.legacyKey ?? artifact.id };
      if (input.command === "AWARD_ARTIFACT" && !inventory.includes(artifact.id)) inventory.push(artifact.id);
      payload.artifactId = artifact.id;
    } else if (
      ["DISCOVER_SIDE_QUEST", "UPDATE_SIDE_QUEST", "COMPLETE_SIDE_QUEST", "ADVANCE_SIDE_QUEST"].includes(input.command)
    ) {
      const quest = await tx.taleSideQuest.findFirst({
        where: { taleId: session.taleId, ...(input.targetKey ? { legacyKey: input.targetKey } : {}) },
        orderBy: { legacyKey: "asc" },
      });
      if (!quest) throw new LegacyQuartermasterConflict("No mapped side quest is available.", "NOT_FOUND");
      const questState =
        input.command === "DISCOVER_SIDE_QUEST"
          ? "DISCOVERED"
          : input.command === "COMPLETE_SIDE_QUEST"
            ? "COMPLETE"
            : "ACTIVE";
      (variables.legacy!.sideQuests as Record<string, JsonObject>)[quest.legacyKey] = { state: questState };
      reveal = { contentType: "side-quest", contentKey: quest.legacyKey };
      payload.sideQuestKey = quest.legacyKey;
      payload.sideQuestState = questState;
    } else if (input.command === "TEASE_FINALE" || input.command === "UPDATE_FINALE_REQUIREMENT") {
      variables.legacy = {
        ...variables.legacy,
        finaleState: input.command === "TEASE_FINALE" ? "TEASED" : "REQUIREMENTS_PARTIAL",
      };
    } else if (
      input.command === "ADD_JOURNAL_ANNOTATION" ||
      input.command === "ADD_LOG_ENTRY" ||
      input.command === "RELEASE_JOURNAL_ENTRY"
    ) {
      payload.value = typeof input.payload.value === "string" ? input.payload.value : null;
    }

    const guarded = await tx.taleSession.updateMany({
      where: { id: session.id, currentSequence: input.expectedSequence },
      data: {
        currentSequence: { increment: 1 },
        status,
        currentBlockId,
        currentChapterId,
        variables: JSON.stringify(variables),
        inventory: JSON.stringify(inventory),
      },
    });
    if (guarded.count !== 1)
      throw new LegacyQuartermasterConflict(
        "Another Captain command was saved first. Refresh before retrying.",
        "STALE_SEQUENCE",
      );
    const updated = await tx.taleSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { currentSequence: true },
    });
    if (reveal)
      await tx.revealState.upsert({
        where: { playthroughId_contentType_contentKey: { playthroughId: session.id, ...reveal } },
        update: {},
        create: { playthroughId: session.id, ...reveal, revealedBy: userId },
      });
    const created = await tx.taleSessionEvent.create({
      data: {
        sessionId: session.id,
        publishedVersionId: session.publishedVersionId!,
        blockId: currentBlockId,
        eventType: type,
        sourceType: "legacy-quartermaster-adapter",
        sourceId: userId,
        idempotencyKey: key,
        payload: JSON.stringify(payload),
        sequence: updated.currentSequence,
        correlationId,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId: userId,
        actorAccountId: canonicalAccountId,
        action: `LEGACY_QUARTERMASTER_${input.command}`,
        resourceType: "CHRONICLE_SESSION",
        resourceId: session.id,
        correlationId,
        metadata: JSON.stringify({ adapter: "legacy-quartermaster", targetKey: input.targetKey ?? null }),
      },
    });
    return created;
  });
  publishTaleSessionEvent(resolved.sessionId, {
    id: event.id,
    eventType: event.eventType,
    sequence: event.sequence,
    createdAt: event.createdAt.toISOString(),
  });
  await recordCompatibilityObservation({
    correlationId,
    operation: "LEGACY_QUARTERMASTER_COMMAND",
    routeKey: "quartermaster-command",
    disposition: "ADAPTED",
    canonicalSessionId: resolved.sessionId,
    canonicalAccountId: canonicalAccountId ?? undefined,
    testTraffic: compatibilityTestTraffic(),
  });
  return receipt(event, correlationId);
}
