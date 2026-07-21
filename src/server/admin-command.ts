import { randomUUID } from "node:crypto";
import type { AdminCommand } from "@/domain/admin";
import { getTaleSessionState } from "@/chronicle/progression";
import { db } from "@/lib/db";
import { resolveLegacyCampaign } from "@/compatibility/legacy-companion";
import { executeLegacyQuartermasterCommand, LegacyQuartermasterConflict } from "@/compatibility/legacy-quartermaster";

export type AdminCommandInput = {
  command: AdminCommand;
  campaignSlug: string;
  expectedSequence: number;
  idempotencyKey: string;
  targetKey?: string;
  payload: Record<string, unknown>;
  reason?: string;
};

type CanonicalEventReceipt = Readonly<{
  kind: "PROGRESSION_EVENT";
  event: { id: string; type: string; sequence: number; payload: Record<string, unknown>; releaseAt: string };
  correlationId: string;
  persistence: "COMMITTED";
  publication: "PROCESS_PUBLISHED" | "PROCESS_PUBLICATION_FAILED";
  delivery: "PUBLISHED" | "PUBLICATION_FAILED";
  deliveryScope: "PROCESS_SUBSCRIBERS_ONLY";
  playerDelivery: "UNCONFIRMED";
  playerPresentation: "UNCONFIRMED";
  playerAcknowledgment: "UNCONFIRMED";
  playerEvent: { id: string; type: string; sequence: number };
}>;

type StagedActionReceipt = Readonly<{
  kind: "STAGED_ACTION";
  event: null;
  stagedAction: {
    preparedActionId: string;
    command: string;
    targetKey: string | null;
    reservedSequence: number;
    status: string;
    preparedAt: string;
  };
  preparedActionId: string;
  correlationId: string;
  persistence: "COMMITTED";
  publication: "NOT_APPLICABLE";
  delivery: "NOT_ATTEMPTED";
  deliveryScope: "NO_PLAYER_EVENT";
  playerDelivery: "UNCONFIRMED";
  playerPresentation: "UNCONFIRMED";
  playerAcknowledgment: "UNCONFIRMED";
  playerEvent: null;
}>;

export type AdminCommandReceipt = CanonicalEventReceipt | StagedActionReceipt;

export class CommandConflict extends Error {
  constructor(
    message: string,
    public readonly code = "COMMAND_CONFLICT",
  ) {
    super(message);
  }
}

export class CommandFailure extends Error {
  constructor(public readonly correlationId: string) {
    super("The Chronicle command could not be completed. No progress has changed.");
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export function commandRequestFingerprint(input: AdminCommandInput) {
  return canonicalJson({
    campaignSlug: input.campaignSlug,
    command: input.command,
    expectedSequence: input.expectedSequence,
    targetKey: input.targetKey ?? null,
    payload: input.payload,
    reason: input.reason ?? null,
  });
}

/**
 * The only command entrypoint used by both historical GM URLs. It delegates
 * every mutation to the Chronicle-session command service; Campaign tables
 * are never loaded or written here.
 */
export async function executeAdminCommand(
  input: AdminCommandInput,
  userId: string,
  context: { correlationId?: string } = {},
): Promise<AdminCommandReceipt> {
  const correlationId = context.correlationId ?? randomUUID();
  try {
    return await executeLegacyQuartermasterCommand(input, userId, correlationId);
  } catch (error) {
    if (error instanceof LegacyQuartermasterConflict) throw new CommandConflict(error.message, error.code);
    throw error;
  }
}

export async function stageAdminCommand(
  input: Pick<AdminCommandInput, "command" | "campaignSlug" | "expectedSequence" | "targetKey" | "payload"> & {
    scheduledFor?: string;
  },
  userId: string,
  context: { correlationId?: string; reason?: string } = {},
) {
  const correlationId = context.correlationId ?? randomUUID();
  const resolved = await resolveLegacyCampaign(input.campaignSlug);
  if (!resolved) throw new CommandConflict("This Voyage is unavailable.", "NOT_FOUND");
  return db.$transaction(async (tx) => {
    const session = await tx.taleSession.findUniqueOrThrow({ where: { id: resolved.sessionId } });
    if (!session.publishedVersionId)
      throw new CommandConflict("This Chronicle Session has no published version.", "NOT_FOUND");
    const idempotencyKey = `chronicle-stage:${session.id}:${commandRequestFingerprint({ ...input, idempotencyKey: "stage" })}`;
    const prior = await tx.taleSessionEvent.findUnique({ where: { idempotencyKey } });
    if (prior)
      return {
        id: prior.id,
        command: input.command,
        targetKey: input.targetKey ?? null,
        reservedSequence: prior.sequence,
        status: input.scheduledFor ? "SCHEDULED" : "PREPARED",
        preparedAt: prior.createdAt,
        publication: "NOT_APPLICABLE" as const,
        delivery: "NOT_ATTEMPTED" as const,
        deliveryScope: "NO_PLAYER_EVENT" as const,
      };
    if (session.currentSequence !== input.expectedSequence)
      throw new CommandConflict(
        "This prepared Chronicle command is stale. Refresh Captain's Console before preparing it again.",
        "STALE_SEQUENCE",
      );
    const next = await tx.taleSession.update({
      where: { id: session.id },
      data: { currentSequence: { increment: 1 } },
      select: { currentSequence: true },
    });
    const staged = await tx.taleSessionEvent.create({
      data: {
        sessionId: session.id,
        publishedVersionId: session.publishedVersionId,
        blockId: session.currentBlockId,
        eventType: "chronicle.commandPrepared",
        sourceType: "captain-command-service",
        sourceId: userId,
        idempotencyKey,
        payload: JSON.stringify({
          command: input.command,
          targetKey: input.targetKey ?? null,
          scheduledFor: input.scheduledFor ?? null,
        }),
        sequence: next.currentSequence,
        correlationId,
      },
    });
    await tx.platformAuditEvent.create({
      data: {
        actorType: "CAPTAIN",
        actorId: userId,
        action: "CHRONICLE_COMMAND_PREPARED",
        resourceType: "CHRONICLE_SESSION",
        resourceId: session.id,
        correlationId,
        metadata: JSON.stringify({
          command: input.command,
          targetKey: input.targetKey ?? null,
          scheduledFor: input.scheduledFor ?? null,
        }),
      },
    });
    return {
      id: staged.id,
      command: input.command,
      targetKey: input.targetKey ?? null,
      reservedSequence: next.currentSequence,
      status: input.scheduledFor ? "SCHEDULED" : "PREPARED",
      preparedAt: staged.createdAt,
      publication: "NOT_APPLICABLE" as const,
      delivery: "NOT_ATTEMPTED" as const,
      deliveryScope: "NO_PLAYER_EVENT" as const,
    };
  });
}

export async function previewAdminCommand(input: Omit<AdminCommandInput, "idempotencyKey">) {
  const resolved = await resolveLegacyCampaign(input.campaignSlug);
  if (!resolved) throw new CommandConflict("This Voyage is unavailable.", "NOT_FOUND");
  const state = await getTaleSessionState(resolved.sessionId, undefined, true);
  const prerequisites: string[] = [];
  if (state.session.currentSequence !== input.expectedSequence)
    prerequisites.push("Captain's Console state is stale. Refresh before continuing.");
  if (state.session.status === "PAUSED" && !["RESUME", "REQUEST_RECONCILIATION"].includes(input.command))
    prerequisites.push("Resume the Chronicle Session first.");
  return {
    preview: true,
    watermark: "PREVIEW — NOT RELEASED",
    currentSequence: state.session.currentSequence,
    projectedSequence: state.session.currentSequence + 1,
    eventType: `chronicle.${input.command.toLowerCase()}`,
    affectedSystems: ["chronicle-session", "chronicle-event", "platform-audit"],
    undoAvailable: input.command === "UNDO_LAST",
    prerequisites,
    canExecute: prerequisites.length === 0,
    snapshot: state,
  };
}
