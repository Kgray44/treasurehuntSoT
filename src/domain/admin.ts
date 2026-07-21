import { z } from "zod";

export const adminCommands = [
  "PREPARE_CHAPTER",
  "RELEASE_CHAPTER",
  "MARK_SOLVED",
  "COMPLETE_CHAPTER",
  "PREPARE_HINT",
  "RELEASE_HINT",
  "RELEASE_NEXT_HINT",
  "REVEAL_MAP",
  "REVEAL_ROUTE",
  "AWARD_ARTIFACT",
  "REVEAL_ARTIFACT_SILHOUETTE",
  "CONNECT_ARTIFACTS",
  "DISCOVER_SIDE_QUEST",
  "UPDATE_SIDE_QUEST",
  "COMPLETE_SIDE_QUEST",
  "ADVANCE_SIDE_QUEST",
  "ADD_JOURNAL_ANNOTATION",
  "ADD_LOG_ENTRY",
  "RELEASE_JOURNAL_ENTRY",
  "TEASE_FINALE",
  "UPDATE_FINALE_REQUIREMENT",
  "PAUSE",
  "RESUME",
  "UNDO_LAST",
  "REQUEST_RECONCILIATION",
] as const;
export type AdminCommand = (typeof adminCommands)[number];

export const actionRisks = {
  PREPARE_CHAPTER: "MEDIUM",
  RELEASE_CHAPTER: "HIGH",
  MARK_SOLVED: "HIGH",
  COMPLETE_CHAPTER: "HIGH",
  PREPARE_HINT: "MEDIUM",
  RELEASE_HINT: "HIGH",
  RELEASE_NEXT_HINT: "HIGH",
  REVEAL_MAP: "HIGH",
  REVEAL_ROUTE: "HIGH",
  AWARD_ARTIFACT: "HIGH",
  REVEAL_ARTIFACT_SILHOUETTE: "HIGH",
  CONNECT_ARTIFACTS: "HIGH",
  DISCOVER_SIDE_QUEST: "HIGH",
  UPDATE_SIDE_QUEST: "HIGH",
  COMPLETE_SIDE_QUEST: "HIGH",
  ADVANCE_SIDE_QUEST: "HIGH",
  ADD_JOURNAL_ANNOTATION: "HIGH",
  ADD_LOG_ENTRY: "HIGH",
  RELEASE_JOURNAL_ENTRY: "HIGH",
  TEASE_FINALE: "HIGH",
  UPDATE_FINALE_REQUIREMENT: "HIGH",
  PAUSE: "HIGH",
  RESUME: "HIGH",
  UNDO_LAST: "HIGH",
  REQUEST_RECONCILIATION: "LOW",
} as const satisfies Record<AdminCommand, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL">;

export const gmCapabilities = [
  "VIEW_COMMAND_CENTER",
  "VIEW_PLAYER_PREVIEW",
  "PREPARE_PROGRESSION",
  "RELEASE_PROGRESSION",
  "REVERSE_PROGRESSION",
  "USE_EMERGENCY_CONTROLS",
  "RESET_DEVELOPMENT_CAMPAIGN",
  "VIEW_DIAGNOSTICS",
  "VIEW_AUDIT_LOG",
] as const;

const noDataCommands = [
  "PREPARE_CHAPTER",
  "RELEASE_CHAPTER",
  "MARK_SOLVED",
  "COMPLETE_CHAPTER",
  "RELEASE_NEXT_HINT",
  "TEASE_FINALE",
  "PAUSE",
  "RESUME",
  "UNDO_LAST",
  "REQUEST_RECONCILIATION",
] as const satisfies readonly AdminCommand[];

const targetedCommands = [
  "RELEASE_HINT",
  "REVEAL_MAP",
  "REVEAL_ROUTE",
  "AWARD_ARTIFACT",
  "REVEAL_ARTIFACT_SILHOUETTE",
  "CONNECT_ARTIFACTS",
  "DISCOVER_SIDE_QUEST",
  "UPDATE_SIDE_QUEST",
  "COMPLETE_SIDE_QUEST",
  "ADVANCE_SIDE_QUEST",
  "UPDATE_FINALE_REQUIREMENT",
] as const satisfies readonly AdminCommand[];

const valueCommands = ["ADD_JOURNAL_ANNOTATION", "ADD_LOG_ENTRY"] as const satisfies readonly AdminCommand[];

const campaignSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u, "Use a valid Voyage identifier.");
const commandKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Use a bounded command key.");
const idempotencyKeySchema = z
  .string()
  .trim()
  .min(12)
  .max(191)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u, "Use a bounded idempotency key.");
const emptyPayloadSchema = z.object({}).strict().default({});
const valuePayloadSchema = z
  .object({ value: z.string().trim().min(1).max(2_048).optional() })
  .strict()
  .default({});
const preparedHintPayloadSchema = z
  .object({ body: z.string().trim().min(1).max(4_096).optional() })
  .strict()
  .default({});
const journalEntryPayloadSchema = z
  .object({ title: z.string().trim().min(1).max(160).optional(), body: z.string().trim().min(1).max(4_096) })
  .strict();
const commandTransportShape = {
  campaignSlug: campaignSlugSchema,
  expectedSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  idempotencyKey: idempotencyKeySchema,
  reason: z.string().trim().min(1).max(500).optional(),
  confirmation: z.literal(true),
} as const;

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete (copy as Partial<T>)[key];
  return copy;
}

export const commandSchema = z.discriminatedUnion("command", [
  z
    .object({
      ...commandTransportShape,
      command: z.enum(noDataCommands),
      targetKey: z.never().optional(),
      payload: emptyPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...commandTransportShape,
      command: z.enum(targetedCommands),
      targetKey: commandKeySchema.optional(),
      payload: emptyPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...commandTransportShape,
      command: z.enum(valueCommands),
      targetKey: z.never().optional(),
      payload: valuePayloadSchema,
    })
    .strict(),
  z
    .object({
      ...commandTransportShape,
      command: z.literal("PREPARE_HINT"),
      targetKey: commandKeySchema.optional(),
      payload: preparedHintPayloadSchema,
    })
    .strict(),
  z
    .object({
      ...commandTransportShape,
      command: z.literal("RELEASE_JOURNAL_ENTRY"),
      targetKey: z.never().optional(),
      payload: journalEntryPayloadSchema,
    })
    .strict(),
]);

export type AdminCommandInput = z.infer<typeof commandSchema>;

/**
 * Compatibility transport for the former `/api/gm/action` endpoint. It keeps
 * the old field name while requiring the same concurrency and idempotency
 * evidence as the canonical command endpoint.
 */
export const actionCommandSchema = z
  .object({ action: z.enum(adminCommands) })
  .passthrough()
  .transform(({ action, ...input }) => ({ ...input, command: action }))
  .pipe(commandSchema);

export const commandPublicationStates = ["PROCESS_PUBLISHED", "PROCESS_PUBLICATION_FAILED", "NOT_APPLICABLE"] as const;
export const playerDeliveryStates = ["UNCONFIRMED"] as const;

export type AdminCommandReceiptTruth = Readonly<{
  kind: "PROGRESSION_EVENT" | "STAGED_ACTION";
  persistence: "COMMITTED";
  publication: (typeof commandPublicationStates)[number];
  /** @deprecated Compatibility alias. This refers only to the in-process event bus. */
  delivery: "PUBLISHED" | "PUBLICATION_FAILED" | "NOT_ATTEMPTED";
  deliveryScope: "PROCESS_SUBSCRIBERS_ONLY" | "NO_PLAYER_EVENT";
  playerDelivery: (typeof playerDeliveryStates)[number];
  playerPresentation: "UNCONFIRMED";
  playerAcknowledgment: "UNCONFIRMED";
}>;

export type StagedActionReceiptIdentity = Readonly<{
  preparedActionId: string;
  command: string;
  targetKey: string | null;
  reservedSequence: number;
  status: string;
  preparedAt: string;
}>;

export const previewSchema = z
  .object({ preview: z.literal(true) })
  .passthrough()
  .transform((value) => ({
    ...omitKeys(value, ["preview"]),
    idempotencyKey: "preview-request",
    confirmation: true as const,
  }))
  .pipe(commandSchema)
  .transform((value) => ({
    ...omitKeys(value, ["idempotencyKey", "confirmation"]),
    preview: true as const,
  }));

export const stageSchema = z
  .object({ scheduledFor: z.iso.datetime().optional() })
  .passthrough()
  .transform(({ scheduledFor, ...input }) => ({
    ...(scheduledFor ? { scheduledFor } : {}),
    command: {
      ...input,
      idempotencyKey: "staging-request",
      confirmation: true as const,
    },
  }))
  .pipe(z.object({ scheduledFor: z.iso.datetime().optional(), command: commandSchema }))
  .transform(({ scheduledFor, command }) => ({
    ...omitKeys(command, ["idempotencyKey", "confirmation"]),
    scheduledFor,
  }));

export type PresenceEvidence = {
  lastHeartbeatAt: Date;
  disconnectedAt: Date | null;
  acknowledgedSequence: number;
  route: string | null;
};

export function describePresence(items: PresenceEvidence[], campaignSequence: number, now = Date.now()) {
  const active = items.filter((item) => !item.disconnectedAt && now - item.lastHeartbeatAt.getTime() <= 45_000);
  const recent = items.filter((item) => now - item.lastHeartbeatAt.getTime() <= 120_000);
  const acknowledgedSequence = Math.max(0, ...items.map((item) => item.acknowledgedSequence));
  const lag = Math.max(0, campaignSequence - acknowledgedSequence);
  return {
    state: active.length ? "CONNECTED" : recent.length ? "RECENTLY_LOST" : items.length ? "STALE" : "UNKNOWN",
    activeDevices: active.length,
    lastSeenAt: items.length
      ? new Date(Math.max(...items.map((item) => item.lastHeartbeatAt.getTime()))).toISOString()
      : null,
    acknowledgedSequence,
    synchronized: active.length > 0 && lag === 0,
    lag,
    route: active[0]?.route ?? recent[0]?.route ?? null,
  } as const;
}

export function commandCapability(command: AdminCommand) {
  if (command === "UNDO_LAST") return "REVERSE_PROGRESSION";
  if (command === "REQUEST_RECONCILIATION") return "VIEW_DIAGNOSTICS";
  if (actionRisks[command] === "MEDIUM") return "PREPARE_PROGRESSION";
  return "RELEASE_PROGRESSION";
}

export type SideQuestTransitionPlan =
  | {
      allowed: true;
      state: "DISCOVERED" | "ACTIVE" | "PARTIALLY_COMPLETE" | "COMPLETE";
      eventType: "SIDE_QUEST_DISCOVERED" | "SIDE_QUEST_UPDATED" | "SIDE_QUEST_COMPLETED";
      objectiveOrdinal?: number;
    }
  | { allowed: false; message: string };

export function planSideQuestTransition(
  command: "DISCOVER_SIDE_QUEST" | "ADVANCE_SIDE_QUEST",
  state: string,
  objectives: Array<{ ordinal: number; complete: boolean }>,
): SideQuestTransitionPlan {
  if (command === "DISCOVER_SIDE_QUEST") {
    if (!["HIDDEN", "RUMORED"].includes(state))
      return { allowed: false, message: "This Echo has already been discovered." };
    return { allowed: true, state: "DISCOVERED", eventType: "SIDE_QUEST_DISCOVERED" };
  }
  if (state === "DISCOVERED") return { allowed: true, state: "ACTIVE", eventType: "SIDE_QUEST_UPDATED" };
  if (!["ACTIVE", "PARTIALLY_COMPLETE"].includes(state))
    return { allowed: false, message: "Discover this Echo before advancing it." };
  const objective = objectives.find((item) => !item.complete);
  if (!objective) return { allowed: true, state: "COMPLETE", eventType: "SIDE_QUEST_COMPLETED" };
  const completesQuest = objectives.filter((item) => !item.complete).length === 1;
  return {
    allowed: true,
    state: completesQuest ? "COMPLETE" : "PARTIALLY_COMPLETE",
    eventType: completesQuest ? "SIDE_QUEST_COMPLETED" : "SIDE_QUEST_UPDATED",
    objectiveOrdinal: objective.ordinal,
  };
}
