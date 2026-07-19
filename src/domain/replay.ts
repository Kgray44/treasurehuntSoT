import type { PublicChapter, ReplayablePresentation } from "./story";
import { sanitizeEventPayload } from "./visibility";

const readableChapterStates = new Set(["REVEALING", "ACTIVE", "SOLVED", "COMPLETE"]);

export const replayPayloadLimits = {
  eventId: 128,
  title: 256,
  narrative: 16_000,
  objective: 4_000,
  riddle: 8_000,
} as const;

export type StoredReplayEvent = {
  id: string;
  type: string;
  sequence: number;
  version: number;
  payload: string;
  releaseAt: Date;
};

export type ReplayProjection =
  | { status: "replayable"; presentation: ReplayablePresentation }
  | {
      status: "readable-fallback";
      reason: "sparse-event-payload";
      presentation: ReplayablePresentation;
    }
  | {
      status: "unavailable";
      reason:
        | "wrong-event-type"
        | "unreleased-event"
        | "invalid-event-identity"
        | "invalid-event-payload"
        | "chapter-not-readable";
    };

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

function parseLocator(payload: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const sanitized = sanitizeEventPayload("CHAPTER_RELEASED", parsed as Record<string, unknown>);
  const ordinal = sanitized.ordinal;
  if (!Number.isInteger(ordinal) || typeof ordinal !== "number" || ordinal < 1) return null;
  const title = boundedString(sanitized.title, replayPayloadLimits.title) ? sanitized.title : undefined;
  return { ordinal, title };
}

export function projectChapterReleaseReplay(
  event: StoredReplayEvent,
  chapters: readonly PublicChapter[],
  now = new Date(),
): ReplayProjection {
  if (event.type !== "CHAPTER_RELEASED") return { status: "unavailable", reason: "wrong-event-type" };
  if (!(event.releaseAt instanceof Date) || !Number.isFinite(event.releaseAt.getTime()) || event.releaseAt > now) {
    return { status: "unavailable", reason: "unreleased-event" };
  }
  if (
    !boundedString(event.id, replayPayloadLimits.eventId) ||
    !Number.isInteger(event.sequence) ||
    event.sequence < 1 ||
    !Number.isInteger(event.version) ||
    event.version < 1
  ) {
    return { status: "unavailable", reason: "invalid-event-identity" };
  }

  const locator = parseLocator(event.payload);
  if (!locator) return { status: "unavailable", reason: "invalid-event-payload" };
  const chapter = chapters.find((candidate) => candidate.ordinal === locator.ordinal);
  if (
    !chapter ||
    !readableChapterStates.has(chapter.state) ||
    !boundedString(chapter.title, replayPayloadLimits.title) ||
    !boundedString(chapter.narrative, replayPayloadLimits.narrative) ||
    !boundedString(chapter.objective, replayPayloadLimits.objective) ||
    !boundedString(chapter.riddle ?? "", replayPayloadLimits.riddle, true)
  ) {
    return { status: "unavailable", reason: "chapter-not-readable" };
  }

  const presentation: ReplayablePresentation = {
    eventId: event.id,
    eventType: "CHAPTER_RELEASED",
    sequence: event.sequence,
    occurredAt: event.releaseAt.toISOString(),
    sceneName: "chapter-release",
    payloadVersion: event.version,
    payload: {
      ordinal: locator.ordinal,
      title: locator.title ?? chapter.title,
      narrative: chapter.narrative,
      objective: chapter.objective,
      riddle: chapter.riddle ?? "",
    },
    replayPolicy: "presentation-only",
  };

  return locator.title
    ? { status: "replayable", presentation }
    : { status: "readable-fallback", reason: "sparse-event-payload", presentation };
}
