import { describe, expect, it } from "vitest";
import { authoritativeMoonPhase, eventToLogEntry } from "./ships-log";

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

  it("labels only events after an authoritative offline sequence boundary with server synchronization time", () => {
    const synchronizedAt = new Date("2026-07-16T12:05:00.000Z");
    const recovered = eventToLogEntry(event("PLAYER_LOG_ENTRY_ADDED"), true, {
      afterSequence: 6,
      synchronizedAt,
    });
    const alreadyKnown = eventToLogEntry(event("PLAYER_LOG_ENTRY_ADDED"), false, {
      afterSequence: 7,
      synchronizedAt,
    });

    expect(recovered?.synchronization).toEqual({
      source: "offline-recovery",
      synchronizedAt: "2026-07-16T12:05:00.000Z",
    });
    expect(alreadyKnown).not.toHaveProperty("synchronization");
    expect(recovered?.timestamp).toBe("2026-07-16T12:00:00.000Z");
  });

  it("projects a stable moon phase from the immutable server event time", () => {
    const releaseAt = new Date("2026-07-16T12:00:00.000Z");
    const first = authoritativeMoonPhase(releaseAt);
    expect(authoritativeMoonPhase(new Date(releaseAt.getTime()))).toBe(first);
    expect(eventToLogEntry({ ...event("PLAYER_LOG_ENTRY_ADDED"), releaseAt }, false)?.moonPhase).toBe(first);
  });
});
