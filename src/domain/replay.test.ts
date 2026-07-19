import { describe, expect, it } from "vitest";
import type { PublicChapter } from "./story";
import { projectChapterReleaseReplay, replayPayloadLimits, type StoredReplayEvent } from "./replay";

const now = new Date("2026-07-18T18:00:00.000Z");

function event(overrides: Partial<StoredReplayEvent> = {}): StoredReplayEvent {
  return {
    id: "event-chapter-release",
    type: "CHAPTER_RELEASED",
    sequence: 17,
    version: 1,
    payload: JSON.stringify({ ordinal: 2, title: "The Lantern Test" }),
    releaseAt: new Date("2026-07-18T17:00:00.000Z"),
    ...overrides,
  };
}

function chapter(overrides: Partial<PublicChapter> = {}): PublicChapter {
  return {
    ordinal: 2,
    state: "ACTIVE",
    title: "The Lantern Test",
    narrative: "The released story is readable.",
    objective: "Follow the safe light.",
    riddle: "What wakes when the lantern turns?",
    ...overrides,
  };
}

describe("chapter-release replay projection", () => {
  it("preserves immutable event identity while composing only authorized readable chapter data", () => {
    expect(projectChapterReleaseReplay(event(), [chapter()], now)).toEqual({
      status: "replayable",
      presentation: {
        eventId: "event-chapter-release",
        eventType: "CHAPTER_RELEASED",
        sequence: 17,
        occurredAt: "2026-07-18T17:00:00.000Z",
        sceneName: "chapter-release",
        payloadVersion: 1,
        payload: {
          ordinal: 2,
          title: "The Lantern Test",
          narrative: "The released story is readable.",
          objective: "Follow the safe light.",
          riddle: "What wakes when the lantern turns?",
        },
        replayPolicy: "presentation-only",
      },
    });
  });

  it("uses a typed readable fallback for a sparse historical event", () => {
    const result = projectChapterReleaseReplay(event({ payload: JSON.stringify({ ordinal: 2 }) }), [chapter()], now);

    expect(result.status).toBe("readable-fallback");
    if (result.status === "readable-fallback") {
      expect(result.reason).toBe("sparse-event-payload");
      expect(result.presentation.payload.title).toBe("The Lantern Test");
    }
  });

  it.each([
    ["wrong event type", event({ type: "CHAPTER_SOLVED" }), "wrong-event-type", undefined],
    ["future release", event({ releaseAt: new Date("2026-07-18T19:00:00.000Z") }), "unreleased-event", undefined],
    ["malformed payload", event({ payload: "{broken" }), "invalid-event-payload", undefined],
    [
      "oversized event identity",
      event({ id: "x".repeat(replayPayloadLimits.eventId + 1) }),
      "invalid-event-identity",
      undefined,
    ],
    [
      "nested ordinal",
      event({ payload: JSON.stringify({ ordinal: { value: 2 } }) }),
      "invalid-event-payload",
      undefined,
    ],
    [
      "oversized chapter content",
      event(),
      "chapter-not-readable",
      chapter({ narrative: "x".repeat(replayPayloadLimits.narrative + 1) }),
    ],
  ])("fails closed for %s", (_label, stored, reason, chapterOverride) => {
    const result = projectChapterReleaseReplay(
      stored as StoredReplayEvent,
      [chapterOverride ? (chapterOverride as PublicChapter) : chapter()],
      now,
    );

    expect(result).toEqual({ status: "unavailable", reason });
  });

  it("does not reconstruct a release from a chapter that is not currently readable", () => {
    expect(projectChapterReleaseReplay(event(), [chapter({ state: "READY" })], now)).toEqual({
      status: "unavailable",
      reason: "chapter-not-readable",
    });
  });
});
