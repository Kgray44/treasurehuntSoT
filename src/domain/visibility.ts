import type { ClientProgressEvent, ProgressEventType } from "./story";

type StoredEvent = {
  id: string;
  type: string;
  sequence: number;
  payload: string;
  releaseAt: Date;
};

const publicKeys: Partial<Record<ProgressEventType, readonly string[]>> = {
  CHAPTER_PREPARED: ["ordinal"],
  CHAPTER_RELEASED: ["ordinal", "title"],
  CHAPTER_REVEAL_STARTED: ["ordinal"],
  CHAPTER_REVEAL_COMPLETED: ["ordinal"],
  CHAPTER_SOLVED: ["ordinal"],
  HINT_RELEASED: ["ordinal", "hintOrdinal"],
  MAP_LOCATION_REVEALED: ["key", "name", "regionLabel", "x", "y"],
  MAP_ROUTE_REVEALED: ["key", "fromKey", "toKey"],
  ARTIFACT_SILHOUETTE_REVEALED: ["key", "safeName", "silhouetteLabel"],
  ARTIFACT_AWARDED: ["key", "name", "description", "discoveryText"],
  ARTIFACT_CONNECTED: ["key", "connectedArtifactKey"],
  SIDE_QUEST_DISCOVERED: ["key", "title"],
  SIDE_QUEST_UPDATED: ["key", "objectiveOrdinal"],
  SIDE_QUEST_COMPLETED: ["key", "title", "rewardLabel"],
  JOURNAL_ENTRY_ADDED: ["key", "title", "chapterOrdinal"],
  JOURNAL_ANNOTATION_ADDED: ["key", "title", "chapterOrdinal"],
  NARRATIVE_MESSAGE_RELEASED: ["id", "title"],
  PLAYER_LOG_ENTRY_ADDED: ["key", "title"],
  FINALE_TEASED: ["state"],
  FINALE_REQUIREMENT_UPDATED: ["key"],
  STATE_REVERTED: ["reversedType"],
};

export function sanitizeEventPayload(type: ProgressEventType, payload: Record<string, unknown>) {
  const keys = publicKeys[type] ?? [];
  return Object.fromEntries(keys.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]));
}

export function toClientEvent(event: StoredEvent): ClientProgressEvent {
  const type = event.type as ProgressEventType;
  let payload: Record<string, unknown> = {};
  try {
    payload = sanitizeEventPayload(type, JSON.parse(event.payload));
  } catch {
    payload = {};
  }
  return { id: event.id, type, sequence: event.sequence, payload, releaseAt: event.releaseAt.toISOString() };
}
