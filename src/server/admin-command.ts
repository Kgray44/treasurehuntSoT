import { randomUUID } from "node:crypto";
import type { AdminCommand } from "@/domain/admin";
import type { ClientProgressEvent, ProgressEventType, PublicSnapshot } from "@/domain/story";
import { db } from "@/lib/db";
import { publishCampaignEvent } from "@/lib/events";
import { buildPublicSnapshot } from "@/lib/snapshot";
import { executeProgressionAction } from "@/server/progression";

type Input = {
  command: AdminCommand;
  campaignSlug: string;
  expectedSequence: number;
  idempotencyKey: string;
  targetKey?: string;
  payload: Record<string, unknown>;
  reason?: string;
};

const legacyCommands = new Set<AdminCommand>([
  "PREPARE_CHAPTER",
  "RELEASE_CHAPTER",
  "MARK_SOLVED",
  "REVEAL_MAP",
  "AWARD_ARTIFACT",
  "PAUSE",
  "RESUME",
  "UNDO_LAST",
]);

export class CommandConflict extends Error {
  constructor(
    message: string,
    public code = "COMMAND_CONFLICT",
  ) {
    super(message);
  }
}

function eventFor(command: AdminCommand): ProgressEventType {
  const events: Partial<Record<AdminCommand, ProgressEventType>> = {
    COMPLETE_CHAPTER: "CHAPTER_REVEAL_COMPLETED",
    RELEASE_HINT: "HINT_RELEASED",
    RELEASE_NEXT_HINT: "HINT_RELEASED",
    DISCOVER_SIDE_QUEST: "SIDE_QUEST_DISCOVERED",
    ADVANCE_SIDE_QUEST: "SIDE_QUEST_UPDATED",
    RELEASE_JOURNAL_ENTRY: "NARRATIVE_MESSAGE_RELEASED",
    REQUEST_RECONCILIATION: "PLAYER_RECONCILIATION_REQUESTED",
  };
  const value = events[command];
  if (!value) throw new CommandConflict("That command does not publish directly.", "UNSUPPORTED_COMMAND");
  return value;
}

async function appendCustomEvent(input: Input, userId: string, correlationId: string) {
  const result = await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { slug: input.campaignSlug },
      include: {
        chapters: { orderBy: { ordinal: "asc" }, include: { hints: { orderBy: { ordinal: "asc" } } } },
        sideQuests: { include: { objectives: { orderBy: { ordinal: "asc" } } } },
        journalEntries: true,
      },
    });
    if (campaign.currentSequence !== input.expectedSequence)
      throw new CommandConflict(
        `State changed from sequence ${input.expectedSequence} to ${campaign.currentSequence}. Refresh and review the action again.`,
        "STALE_SEQUENCE",
      );
    if (campaign.status === "PAUSED" && input.command !== "REQUEST_RECONCILIATION")
      throw new CommandConflict("The campaign is paused. Resume it before releasing progression.", "CAMPAIGN_PAUSED");

    let payload: Record<string, unknown> = {};
    if (input.command === "COMPLETE_CHAPTER") {
      const chapter = campaign.chapters.find((item) => item.state === "SOLVED");
      if (!chapter) throw new CommandConflict("Only a solved chapter can be completed.", "INVALID_TRANSITION");
      await tx.chapter.update({ where: { id: chapter.id }, data: { state: "COMPLETE" } });
      payload = { ordinal: chapter.ordinal };
    } else if (input.command === "RELEASE_HINT" || input.command === "RELEASE_NEXT_HINT") {
      const chapter = campaign.chapters.find((item) => ["ACTIVE", "SOLVED"].includes(item.state));
      if (!chapter) throw new CommandConflict("Release the chapter before releasing a hint.", "PREREQUISITE_FAILED");
      const hint = input.targetKey
        ? chapter.hints.find((item) => item.id === input.targetKey || String(item.ordinal) === input.targetKey)
        : chapter.hints.find((item) => !item.releasedAt);
      if (!hint) throw new CommandConflict("No unreleased hint is available.", "ALREADY_RELEASED");
      const priorUnreleased = chapter.hints.some((item) => item.ordinal < hint.ordinal && !item.releasedAt);
      if (priorUnreleased) throw new CommandConflict("Release earlier hints first.", "HINT_ORDER");
      await tx.hint.update({ where: { id: hint.id }, data: { releasedAt: new Date() } });
      payload = { chapterOrdinal: chapter.ordinal, hintOrdinal: hint.ordinal, body: hint.body };
    } else if (input.command === "DISCOVER_SIDE_QUEST" || input.command === "ADVANCE_SIDE_QUEST") {
      const quest = campaign.sideQuests.find((item) => !input.targetKey || item.key === input.targetKey);
      if (!quest) throw new CommandConflict("The side quest is not configured.", "NOT_FOUND");
      const next =
        input.command === "DISCOVER_SIDE_QUEST" ? "DISCOVERED" : quest.state === "DISCOVERED" ? "ACTIVE" : "COMPLETE";
      if (input.command === "DISCOVER_SIDE_QUEST" && quest.state !== "UNDISCOVERED")
        throw new CommandConflict("The side quest is already discovered.", "ALREADY_RELEASED");
      await tx.sideQuest.update({ where: { id: quest.id }, data: { state: next } });
      payload = { key: quest.key, title: quest.title, state: next };
    } else if (input.command === "RELEASE_JOURNAL_ENTRY") {
      const title = String(input.payload.title ?? "Captain's dispatch").trim();
      const body = String(input.payload.body ?? "").trim();
      if (!body) throw new CommandConflict("Write the dispatch before releasing it.", "VALIDATION_FAILED");
      const entry = await tx.journalEntry.create({
        data: { campaignId: campaign.id, title, body, releasedAt: new Date() },
      });
      payload = { id: entry.id, title, body };
    } else {
      payload = { requestedAtSequence: campaign.currentSequence };
    }

    const updated = await tx.campaign.update({
      where: { id: campaign.id },
      data: { currentSequence: { increment: 1 } },
    });
    const type = eventFor(input.command);
    const event = await tx.progressEvent.create({
      data: {
        campaignId: campaign.id,
        type,
        payload: JSON.stringify(payload),
        actor: userId,
        sequence: updated.currentSequence,
      },
    });
    await tx.campaignSnapshot.create({
      data: { campaignId: campaign.id, sequence: event.sequence, state: JSON.stringify({ eventType: type, payload }) },
    });
    await tx.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action: input.command,
        correlationId,
        reason: input.reason,
        metadata: JSON.stringify({ eventId: event.id, sequence: event.sequence, targetKey: input.targetKey }),
      },
    });
    return { campaignId: campaign.id, event };
  });
  const event: ClientProgressEvent = {
    id: result.event.id,
    type: result.event.type as ProgressEventType,
    sequence: result.event.sequence,
    payload: JSON.parse(result.event.payload) as Record<string, unknown>,
    releaseAt: result.event.releaseAt.toISOString(),
  };
  publishCampaignEvent(result.campaignId, event);
  return { event, snapshot: await buildPublicSnapshot(result.campaignId) };
}

export async function executeAdminCommand(input: Input, userId: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
  const existing = await db.commandExecution.findUnique({
    where: { campaignId_idempotencyKey: { campaignId: campaign.id, idempotencyKey: input.idempotencyKey } },
  });
  if (existing?.status === "SUCCEEDED" && existing.result)
    return { ...(JSON.parse(existing.result) as object), idempotentReplay: true };
  if (existing) throw new CommandConflict("This command is already being processed.", "DUPLICATE_COMMAND");
  if (campaign.currentSequence !== input.expectedSequence)
    throw new CommandConflict(
      `State changed from sequence ${input.expectedSequence} to ${campaign.currentSequence}. Refresh before confirming.`,
      "STALE_SEQUENCE",
    );

  const correlationId = randomUUID();
  const execution = await db.commandExecution.create({
    data: {
      campaignId: campaign.id,
      idempotencyKey: input.idempotencyKey,
      command: input.command,
      expectedSequence: input.expectedSequence,
      correlationId,
      status: "RUNNING",
    },
  });
  try {
    let result: { event: ClientProgressEvent; snapshot: PublicSnapshot };
    if (legacyCommands.has(input.command)) {
      const current = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      if (current.currentSequence !== input.expectedSequence)
        throw new CommandConflict("Another command won the race. Refresh before retrying.", "STALE_SEQUENCE");
      result = await executeProgressionAction(
        input.campaignSlug,
        input.command as Parameters<typeof executeProgressionAction>[1],
        userId,
      );
    } else if (input.command === "PREPARE_HINT") {
      const staged = await stageAdminCommand(input, userId);
      const snapshot = await buildPublicSnapshot(campaign.id);
      result = {
        event: {
          id: staged.id,
          type: "HINT_PREPARED",
          sequence: campaign.currentSequence,
          payload: { staged: true, targetKey: input.targetKey },
          releaseAt: staged.preparedAt.toISOString(),
        },
        snapshot,
      };
    } else result = await appendCustomEvent(input, userId, correlationId);
    const stored = { ...result, correlationId, persistence: "COMMITTED", delivery: "PUBLISHED" };
    await db.commandExecution.update({
      where: { id: execution.id },
      data: { status: "SUCCEEDED", result: JSON.stringify(stored), completedAt: new Date() },
    });
    return stored;
  } catch (error) {
    await db.commandExecution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        result: JSON.stringify({ error: error instanceof Error ? error.message : "Unknown failure" }),
        completedAt: new Date(),
      },
    });
    await db.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action: input.command,
        correlationId,
        outcome: "FAILED",
        reason: input.reason,
        metadata: JSON.stringify({ code: error instanceof CommandConflict ? error.code : "COMMAND_FAILED" }),
      },
    });
    throw error;
  }
}

export async function stageAdminCommand(
  input: Pick<Input, "command" | "campaignSlug" | "expectedSequence" | "targetKey" | "payload"> & {
    scheduledFor?: string;
  },
  userId: string,
) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
  if (campaign.currentSequence !== input.expectedSequence)
    throw new CommandConflict("The proposed action is stale. Refresh it before staging.", "STALE_SEQUENCE");
  return db.preparedAction.create({
    data: {
      campaignId: campaign.id,
      command: input.command,
      targetKey: input.targetKey,
      payload: JSON.stringify(input.payload),
      expectedSequence: input.expectedSequence,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
      preparedBy: userId,
      status: input.scheduledFor ? "SCHEDULED" : "PREPARED",
    },
  });
}

export async function previewAdminCommand(input: Omit<Input, "idempotencyKey">) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
  const snapshot = await buildPublicSnapshot(campaign.id);
  const projected = structuredClone(snapshot);
  const prerequisites: string[] = [];
  if (campaign.currentSequence !== input.expectedSequence) prerequisites.push("The dashboard state is stale.");
  if (campaign.status === "PAUSED" && !["RESUME", "REQUEST_RECONCILIATION"].includes(input.command))
    prerequisites.push("Resume the campaign first.");
  if (input.command === "RELEASE_CHAPTER" && snapshot.chapter.state !== "READY")
    prerequisites.push("Prepare this chapter first.");
  if (input.command === "RELEASE_CHAPTER" && !prerequisites.length) projected.chapter.state = "ACTIVE";
  if (input.command === "MARK_SOLVED" && snapshot.chapter.state !== "ACTIVE")
    prerequisites.push("Only the active chapter can be solved.");
  if (input.command === "PAUSE") projected.campaign.status = "PAUSED";
  if (input.command === "RESUME") projected.campaign.status = "ACTIVE";
  return {
    preview: true,
    watermark: "PREVIEW — NOT RELEASED",
    currentSequence: campaign.currentSequence,
    projectedSequence: campaign.currentSequence + (input.command === "PREPARE_HINT" ? 0 : 1),
    eventType: input.command === "PREPARE_HINT" ? "HINT_PREPARED" : eventForPreview(input.command),
    affectedSystems: affectedSystems(input.command),
    undoAvailable: !["REQUEST_RECONCILIATION", "PREPARE_HINT"].includes(input.command),
    prerequisites,
    canExecute: prerequisites.length === 0,
    snapshot: projected,
  };
}

function eventForPreview(command: AdminCommand) {
  const known: Partial<Record<AdminCommand, string>> = {
    PREPARE_CHAPTER: "CHAPTER_PREPARED",
    RELEASE_CHAPTER: "CHAPTER_RELEASED",
    MARK_SOLVED: "CHAPTER_SOLVED",
    REVEAL_MAP: "MAP_LOCATION_REVEALED",
    AWARD_ARTIFACT: "ARTIFACT_AWARDED",
    PAUSE: "CAMPAIGN_PAUSED",
    RESUME: "CAMPAIGN_RESUMED",
    UNDO_LAST: "STATE_REVERTED",
  };
  return known[command] ?? eventFor(command);
}

function affectedSystems(command: AdminCommand) {
  const systems: Partial<Record<AdminCommand, string[]>> = {
    RELEASE_CHAPTER: ["Chapter", "Objective", "Voyage chart", "Ship's Log", "Player ceremony"],
    RELEASE_HINT: ["Hint ledger", "Player snapshot", "Ship's Log"],
    RELEASE_NEXT_HINT: ["Hint ledger", "Player snapshot", "Ship's Log"],
    AWARD_ARTIFACT: ["Relic frame", "Ship's Log", "Player ceremony"],
    REVEAL_MAP: ["Voyage chart", "Ship's Log", "Player ceremony"],
    UNDO_LAST: ["Campaign snapshot", "Player reconciliation", "Audit history"],
  };
  return systems[command] ?? ["Campaign state", "Ship's Log"];
}
