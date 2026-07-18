import { describe, expect, it } from "vitest";
import { sanitizeEventPayload, toClientEvent } from "./visibility";

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
});
