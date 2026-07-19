import type { ClientProgressEvent, ProgressEventType } from "./story";

type StoredEvent = {
  id: string;
  type: string;
  sequence: number;
  payload: string;
  releaseAt: Date;
  reversesEventId?: string | null;
  supersededById?: string | null;
};

/**
 * The persisted progression events that are eligible for a Phase 3 Player
 * presentation and per-device presentation acknowledgement. Other persisted
 * events may still refresh business state, but they are not ceremonies.
 */
export const playerPresentationEventTypes = [
  "CHAPTER_RELEASED",
  "CHAPTER_SOLVED",
  "ARTIFACT_AWARDED",
  "ARTIFACT_SILHOUETTE_REVEALED",
  "ARTIFACT_CONNECTED",
  "MAP_LOCATION_REVEALED",
  "MAP_ROUTE_REVEALED",
  "SIDE_QUEST_DISCOVERED",
  "SIDE_QUEST_UPDATED",
  "SIDE_QUEST_COMPLETED",
  "JOURNAL_ANNOTATION_ADDED",
  "PLAYER_LOG_ENTRY_ADDED",
  "FINALE_TEASED",
  "FINALE_REQUIREMENT_UPDATED",
  "CAMPAIGN_PAUSED",
  "CAMPAIGN_RESUMED",
  "STATE_REVERTED",
] as const satisfies readonly ProgressEventType[];

export type PlayerPresentationEventType = (typeof playerPresentationEventTypes)[number];

const playerPresentationEventTypeSet = new Set<string>(playerPresentationEventTypes);

export function isPlayerPresentationEventType(type: string): type is PlayerPresentationEventType {
  return playerPresentationEventTypeSet.has(type);
}

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

export const MAX_PUBLIC_EVENT_STRING_LENGTH = 2_048;
const MAX_PUBLIC_EVENT_ID_LENGTH = 128;

function isPublicEventScalar(value: unknown): value is string | number | boolean {
  if (typeof value === "string") return value.length <= MAX_PUBLIC_EVENT_STRING_LENGTH;
  if (typeof value === "number") return Number.isFinite(value);
  return typeof value === "boolean";
}

export function sanitizeEventPayload(type: ProgressEventType, payload: Record<string, unknown>) {
  const keys = publicKeys[type] ?? [];
  return Object.fromEntries(keys.filter((key) => isPublicEventScalar(payload[key])).map((key) => [key, payload[key]]));
}

export function toClientEvent(event: StoredEvent): ClientProgressEvent {
  const type = event.type as ProgressEventType;
  let payload: Record<string, unknown> = {};
  try {
    payload = sanitizeEventPayload(type, JSON.parse(event.payload));
  } catch {
    payload = {};
  }
  if (type === "PLAYER_LOG_ENTRY_ADDED") {
    // Log-entry domain keys may be mutable or reused. The persisted event ID is
    // the immutable presentation identity and is safe only after campaign auth.
    payload.progressEventId = event.id;
  }
  if (type === "STATE_REVERTED") {
    // Never infer the event that was reversed from sequence or payload copy.
    // Persisted relation identities are included when present; unavailability
    // is explicit so the Player can render a truthful generic fallback.
    payload.revertEventId = event.id;
    const reversedId = event.reversesEventId;
    payload.revertedEventIdAvailable =
      typeof reversedId === "string" && reversedId.length > 0 && reversedId.length <= MAX_PUBLIC_EVENT_ID_LENGTH;
    if (payload.revertedEventIdAvailable) payload.revertedEventId = reversedId;
    const replacementId = event.supersededById;
    if (
      typeof replacementId === "string" &&
      replacementId.length > 0 &&
      replacementId.length <= MAX_PUBLIC_EVENT_ID_LENGTH
    ) {
      payload.replacementEventId = replacementId;
    }
  }
  return { id: event.id, type, sequence: event.sequence, payload, releaseAt: event.releaseAt.toISOString() };
}
