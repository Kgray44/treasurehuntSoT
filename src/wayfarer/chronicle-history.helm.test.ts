import { describe, expect, it } from "vitest";
import { deriveHistoryLifecycle, derivePersonalCompletionAt, eventsWithinMembership } from "./chronicle-history";

describe("Project Helm Phase 1 personal history integration", () => {
  it("preserves removal and bounds personal events to the membership interval", () => {
    expect(deriveHistoryLifecycle("REMOVED", "COMPLETED")).toBe("REMOVED");
    expect(deriveHistoryLifecycle("ACTIVE_MEMBER", "COMPLETED")).toBe("COMPLETED");
    const sessionCompletedAt = new Date("2026-07-25T10:20:00.000Z");
    expect(derivePersonalCompletionAt("REMOVED", null, "COMPLETED", sessionCompletedAt)).toBeNull();
    expect(derivePersonalCompletionAt("ACTIVE_MEMBER", null, "COMPLETED", sessionCompletedAt)).toEqual(
      sessionCompletedAt,
    );
    const joinedAt = new Date("2026-07-25T10:05:00.000Z");
    const removedAt = new Date("2026-07-25T10:15:00.000Z");
    const events = [
      { id: "before", createdAt: new Date("2026-07-25T10:04:59.000Z") },
      { id: "during", createdAt: new Date("2026-07-25T10:10:00.000Z") },
      { id: "at-removal", createdAt: removedAt },
    ];
    expect(eventsWithinMembership(events, { joinedAt, removedAt }).map((event) => event.id)).toEqual(["during"]);
  });
});
