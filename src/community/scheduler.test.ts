import { describe, expect, it } from "vitest";
import { communityScheduleEventType, communityScheduleTypes } from "./scheduler";

describe("Community scheduler", () => {
  it("maps every durable schedule to an outbox event instead of a direct action", () => {
    expect(communityScheduleTypes).toHaveLength(13);
    for (const schedule of communityScheduleTypes) expect(communityScheduleEventType(schedule)).toMatch(/^[A-Z_]+$/);
  });
});
