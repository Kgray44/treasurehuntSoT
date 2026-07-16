import { describe, expect, it } from "vitest";
import { eventToLogEntry } from "./ships-log";

const event = (type: string, payload: Record<string, unknown> = {}) => ({
  id: "event-1",
  type,
  sequence: 7,
  payload: JSON.stringify(payload),
  releaseAt: new Date("2026-07-16T12:00:00Z"),
});

describe("event-to-log transformation", () => {
  it("creates an atmospheric linked entry without technical metadata", () => {
    expect(
      eventToLogEntry(event("MAP_LOCATION_REVEALED", { key: "safe-cay", internalNote: "never expose" }), true),
    ).toMatchObject({ title: "Ink appeared on the chart", section: "chart", targetKey: "safe-cay", unseen: true });
    expect(
      JSON.stringify(
        eventToLogEntry(event("MAP_LOCATION_REVEALED", { key: "safe-cay", internalNote: "never expose" }), true),
      ),
    ).not.toContain("internalNote");
  });

  it("ignores unknown and non-player-facing events safely", () => {
    expect(eventToLogEntry(event("FUTURE_INTERNAL_EVENT"), false)).toBeNull();
    expect(eventToLogEntry({ ...event("CHAPTER_RELEASED"), payload: "not-json" }, false)).toMatchObject({
      section: "journal",
    });
  });
});
