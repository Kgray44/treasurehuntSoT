import { z } from "zod";

export const chapterStates = ["LOCKED", "TEASER", "READY", "REVEALING", "ACTIVE", "SOLVED", "COMPLETE"] as const;
export type ChapterState = (typeof chapterStates)[number];

export const eventTypes = [
  "CAMPAIGN_STARTED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RESUMED",
  "CHAPTER_PREPARED",
  "CHAPTER_RELEASED",
  "CHAPTER_REVEAL_STARTED",
  "CHAPTER_REVEAL_COMPLETED",
  "CHAPTER_SOLVED",
  "HINT_RELEASED",
  "HINT_PREPARED",
  "MAP_REVEAL_PREPARED",
  "ARTIFACT_AWARD_PREPARED",
  "SIDE_QUEST_UPDATE_PREPARED",
  "ARTIFACT_AWARDED",
  "SIDE_QUEST_DISCOVERED",
  "SIDE_QUEST_UPDATED",
  "JOURNAL_ENTRY_ADDED",
  "MAP_LOCATION_REVEALED",
  "GM_MESSAGE_RELEASED",
  "FINALE_UNLOCKED",
  "STATE_REVERTED",
  "PLAYER_RECONCILIATION_REQUESTED",
  "NARRATIVE_MESSAGE_RELEASED",
] as const;
export type ProgressEventType = (typeof eventTypes)[number];

export const validTransitions: Record<ChapterState, readonly ChapterState[]> = {
  LOCKED: ["TEASER", "READY"],
  TEASER: ["READY", "LOCKED"],
  READY: ["REVEALING", "LOCKED"],
  REVEALING: ["ACTIVE", "READY"],
  ACTIVE: ["SOLVED", "READY"],
  SOLVED: ["COMPLETE", "ACTIVE"],
  COMPLETE: ["SOLVED"],
};

export function canTransition(from: ChapterState, to: ChapterState) {
  return validTransitions[from].includes(to);
}

export const gmActionSchema = z.object({
  action: z.enum([
    "PREPARE_CHAPTER",
    "RELEASE_CHAPTER",
    "MARK_SOLVED",
    "AWARD_ARTIFACT",
    "REVEAL_MAP",
    "UNDO_LAST",
    "PAUSE",
    "RESUME",
  ]),
  campaignSlug: z.string().min(3).max(80),
  confirmation: z.literal(true),
});

export type PublicChapter = {
  ordinal: number;
  state: ChapterState;
  title?: string;
  narrative?: string;
  objective?: string;
  riddle?: string;
};

export type PublicSnapshot = {
  campaign: { slug: string; title: string; status: string };
  sequence: number;
  chapter: PublicChapter;
  artifacts: Array<{ key: string; name: string; description: string }>;
  mapLocations: Array<{ key: string; name: string; regionLabel: string; x: number; y: number }>;
  sideQuest: { title: string; state: string } | null;
};

export type ClientProgressEvent = {
  id: string;
  type: ProgressEventType;
  sequence: number;
  payload: Record<string, unknown>;
  releaseAt: string;
};

export function mergeEvents<T extends { id: string; sequence: number }>(existing: T[], incoming: T[]) {
  const byId = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
}
