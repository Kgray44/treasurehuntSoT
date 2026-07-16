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
  "AWARD_ARTIFACT",
  "DISCOVER_SIDE_QUEST",
  "ADVANCE_SIDE_QUEST",
  "RELEASE_JOURNAL_ENTRY",
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
  AWARD_ARTIFACT: "HIGH",
  DISCOVER_SIDE_QUEST: "HIGH",
  ADVANCE_SIDE_QUEST: "HIGH",
  RELEASE_JOURNAL_ENTRY: "HIGH",
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

export const commandSchema = z.object({
  command: z.enum(adminCommands),
  campaignSlug: z.string().min(3).max(80),
  expectedSequence: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(12).max(191),
  targetKey: z.string().min(1).max(191).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  reason: z.string().trim().max(500).optional(),
  confirmation: z.literal(true),
});

export const previewSchema = commandSchema.omit({ idempotencyKey: true, confirmation: true }).extend({
  preview: z.literal(true),
});

export const stageSchema = commandSchema
  .pick({ command: true, campaignSlug: true, expectedSequence: true, targetKey: true, payload: true })
  .extend({ scheduledFor: z.iso.datetime().optional() });

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
