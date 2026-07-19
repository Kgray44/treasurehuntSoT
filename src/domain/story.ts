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
  "MAP_ROUTE_REVEALED",
  "ARTIFACT_SILHOUETTE_REVEALED",
  "ARTIFACT_CONNECTED",
  "SIDE_QUEST_COMPLETED",
  "JOURNAL_ANNOTATION_ADDED",
  "PLAYER_LOG_ENTRY_ADDED",
  "FINALE_TEASED",
  "FINALE_REQUIREMENT_UPDATED",
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
    "REVEAL_ROUTE",
    "REVEAL_ARTIFACT_SILHOUETTE",
    "CONNECT_ARTIFACTS",
    "DISCOVER_SIDE_QUEST",
    "UPDATE_SIDE_QUEST",
    "COMPLETE_SIDE_QUEST",
    "ADD_JOURNAL_ANNOTATION",
    "ADD_LOG_ENTRY",
    "TEASE_FINALE",
    "UPDATE_FINALE_REQUIREMENT",
    "UNDO_LAST",
    "PAUSE",
    "RESUME",
  ]),
  campaignSlug: z.string().min(3).max(80),
  confirmation: z.literal(true),
  targetKey: z.string().min(1).max(120).optional(),
  value: z.string().max(1000).optional(),
});

export type PublicChapter = {
  ordinal: number;
  state: ChapterState;
  title?: string;
  narrative?: string;
  objective?: string;
  riddle?: string;
  teaser?: string;
  hints?: Array<{ ordinal: number; body: string; releasedAt: string; unseen: boolean }>;
  annotations?: Array<{ key: string; title: string; body: string; createdAt: string; unseen: boolean }>;
  related?: { mapKey?: string; artifactKey?: string; sideQuestKey?: string };
  unseen?: boolean;
};

export type PublicMapLocation = {
  key: string;
  state: string;
  label: string;
  name: string;
  regionLabel?: string;
  locationType?: string;
  description?: string;
  exactness?: string;
  x?: number;
  y?: number;
  mobileX?: number;
  mobileY?: number;
  chapterOrdinal?: number;
  sideQuestKey?: string;
  unseen: boolean;
};

export type PublicArtifact = {
  key: string;
  state: string;
  name?: string;
  safeName?: string;
  category?: string;
  description?: string;
  discoveryText?: string;
  silhouetteLabel?: string;
  displayX: number;
  displayY: number;
  assemblyGroup?: string;
  assemblyPosition?: string;
  connectedArtifactKey?: string;
  chapterOrdinal?: number;
  awardedAt?: string;
  unseen: boolean;
};

export type PublicSideQuest = {
  key: string;
  state: string;
  title?: string;
  teaser?: string;
  description?: string;
  objectives?: Array<{ ordinal: number; body: string; complete: boolean }>;
  reward?: { type: string; label?: string };
  completionSummary?: string;
  chapterOrdinal?: number;
  mapLocationKey?: string;
  artifactKey?: string;
  unseen: boolean;
};

export type PublicLogEntry = {
  key: string;
  sequence: number;
  title: string;
  summary: string;
  timestamp: string;
  symbol: string;
  importance: "quiet" | "notable" | "major";
  section: "journal" | "chart" | "treasures" | "quests" | "log" | "finale";
  targetKey?: string;
  synchronization?: Readonly<{
    source: "offline-recovery";
    synchronizedAt: string;
  }>;
  unseen: boolean;
};

export type ReplayablePresentation = Readonly<{
  eventId: string;
  eventType: "CHAPTER_RELEASED";
  sequence: number;
  occurredAt: string;
  sceneName: "chapter-release";
  payloadVersion: number;
  payload: Readonly<{
    ordinal: number;
    title: string;
    narrative: string;
    objective: string;
    riddle: string;
  }>;
  replayPolicy: "presentation-only";
}>;

export type PublicSnapshot = {
  campaign: { slug: string; title: string; status: string };
  sequence: number;
  chapter: PublicChapter;
  chapters: PublicChapter[];
  artifacts: PublicArtifact[];
  mapLocations: PublicMapLocation[];
  mapRoutes: Array<{
    key: string;
    fromKey: string;
    toKey: string;
    ordinal: number;
    state: string;
    annotation?: string;
    unseen: boolean;
  }>;
  sideQuests: PublicSideQuest[];
  sideQuest: { title: string; state: string } | null;
  log: PublicLogEntry[];
  finale: {
    state: string;
    teaser?: string;
    requirements: Array<{ key: string; label: string; current: number; target: number; optional?: boolean }>;
    unseen: boolean;
  };
  unseen: Record<"journal" | "chart" | "treasures" | "quests" | "log" | "finale", number>;
  latestChapterReleasePresentation?: ReplayablePresentation;
  /** Bounded, oldest-first, Player-safe presentation delivery history. */
  presentationHistory?: ClientProgressEvent[];
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
