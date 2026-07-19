import { describe, expect, it } from "vitest";
import {
  MAX_PUBLIC_EVENT_STRING_LENGTH,
  isPlayerPresentationEventType,
  playerPresentationEventTypes,
  sanitizeEventPayload,
  toClientEvent,
} from "./visibility";

describe("player event serialization", () => {
  it("allowlists released fields and strips internal story data", () => {
    expect(
      sanitizeEventPayload("CHAPTER_RELEASED", {
        ordinal: 2,
        title: "Safe title",
        narrative: "hidden payload",
        internalNote: "secret",
      }),
    ).toEqual({ ordinal: 2, title: "Safe title" });
  });

  it("does not throw on malformed stored payloads", () => {
    expect(
      toClientEvent({
        id: "event-safe",
        type: "CAMPAIGN_PAUSED",
        sequence: 4,
        payload: "{broken",
        releaseAt: new Date("2026-07-16T12:00:00Z"),
      }),
    ).toEqual({
      id: "event-safe",
      type: "CAMPAIGN_PAUSED",
      sequence: 4,
      payload: {},
      releaseAt: "2026-07-16T12:00:00.000Z",
    });
  });

  it("keeps released dispatch metadata but never broadcasts its body", () => {
    expect(
      sanitizeEventPayload("NARRATIVE_MESSAGE_RELEASED", {
        id: "dispatch-1",
        title: "Safe title",
        body: "Player-visible body is loaded from the authorized snapshot.",
        internalNote: "never broadcast",
      }),
    ).toEqual({ id: "dispatch-1", title: "Safe title" });
  });

  it("rejects nested and oversized values rather than serializing hidden structure", () => {
    expect(
      sanitizeEventPayload("CHAPTER_RELEASED", {
        ordinal: 2,
        title: { public: "Safe title", internalNote: "never serialize" },
        narrative: "not allowlisted",
      }),
    ).toEqual({ ordinal: 2 });

    expect(
      sanitizeEventPayload("CHAPTER_RELEASED", {
        ordinal: 2,
        title: "x".repeat(MAX_PUBLIC_EVENT_STRING_LENGTH + 1),
      }),
    ).toEqual({ ordinal: 2 });
  });

  it("rejects non-finite numeric metadata", () => {
    expect(sanitizeEventPayload("CHAPTER_RELEASED", { ordinal: Number.POSITIVE_INFINITY, title: "Safe" })).toEqual({
      title: "Safe",
    });
  });

  it("freezes the exact 17 server-approved Player presentation event types", () => {
    expect(playerPresentationEventTypes).toHaveLength(17);
    for (const type of playerPresentationEventTypes) expect(isPlayerPresentationEventType(type)).toBe(true);
    expect(isPlayerPresentationEventType("HINT_RELEASED")).toBe(false);
    expect(isPlayerPresentationEventType("CHAPTER_PREPARED")).toBe(false);
  });

  it("uses the immutable progress-event identity for Player log targets", () => {
    expect(
      toClientEvent({
        id: "progress-event-log-1",
        type: "PLAYER_LOG_ENTRY_ADDED",
        sequence: 9,
        payload: JSON.stringify({ key: "mutable-log-key", title: "Safe title", internal: "secret" }),
        releaseAt: new Date("2026-07-18T12:00:00Z"),
      }).payload,
    ).toEqual({ key: "mutable-log-key", title: "Safe title", progressEventId: "progress-event-log-1" });
  });

  it("reports persisted STATE_REVERTED identities without guessing unavailable history", () => {
    const available = toClientEvent({
      id: "revert-event-2",
      type: "STATE_REVERTED",
      sequence: 12,
      payload: JSON.stringify({ reversedType: "ARTIFACT_AWARDED", internal: "secret" }),
      releaseAt: new Date("2026-07-18T12:00:00Z"),
      reversesEventId: "award-event-1",
      supersededById: "replacement-event-3",
    });
    expect(available.payload).toEqual({
      reversedType: "ARTIFACT_AWARDED",
      revertEventId: "revert-event-2",
      revertedEventIdAvailable: true,
      revertedEventId: "award-event-1",
      replacementEventId: "replacement-event-3",
    });

    const unavailable = toClientEvent({
      id: "revert-event-4",
      type: "STATE_REVERTED",
      sequence: 14,
      payload: "{}",
      releaseAt: new Date("2026-07-18T12:00:00Z"),
    });
    expect(unavailable.payload).toEqual({
      revertEventId: "revert-event-4",
      revertedEventIdAvailable: false,
    });
  });
});
