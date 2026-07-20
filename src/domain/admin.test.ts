import { describe, expect, it } from "vitest";
import {
  actionCommandSchema,
  adminCommands,
  commandCapability,
  commandSchema,
  describePresence,
  planSideQuestTransition,
  stageSchema,
} from "./admin";

describe("truthful Crew presence", () => {
  it("distinguishes synchronized active devices from a browser merely seen before", () => {
    const now = new Date("2026-07-16T20:00:00Z").getTime();
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 5_000), disconnectedAt: null, acknowledgedSequence: 8, route: "/journal" }],
        8,
        now,
      ),
    ).toMatchObject({ state: "CONNECTED", synchronized: true, activeDevices: 1, lag: 0 });
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 90_000), disconnectedAt: null, acknowledgedSequence: 7, route: null }],
        8,
        now,
      ),
    ).toMatchObject({ state: "RECENTLY_LOST", synchronized: false, lag: 1 });
  });

  it("expires stale devices and never calls unknown state connected", () => {
    const now = new Date("2026-07-16T20:00:00Z").getTime();
    expect(
      describePresence(
        [{ lastHeartbeatAt: new Date(now - 180_000), disconnectedAt: null, acknowledgedSequence: 2, route: null }],
        9,
        now,
      ).state,
    ).toBe("STALE");
    expect(describePresence([], 0, now).state).toBe("UNKNOWN");
  });
});

describe("capability mapping", () => {
  it("keeps preparation, release, recovery, and diagnostics separate", () => {
    expect(commandCapability("PREPARE_CHAPTER")).toBe("PREPARE_PROGRESSION");
    expect(commandCapability("RELEASE_CHAPTER")).toBe("RELEASE_PROGRESSION");
    expect(commandCapability("UNDO_LAST")).toBe("REVERSE_PROGRESSION");
    expect(commandCapability("REQUEST_RECONCILIATION")).toBe("VIEW_DIAGNOSTICS");
  });

  it("covers every live Quartermaster progression action with release authority", () => {
    for (const command of [
      "REVEAL_ROUTE",
      "REVEAL_ARTIFACT_SILHOUETTE",
      "CONNECT_ARTIFACTS",
      "UPDATE_SIDE_QUEST",
      "COMPLETE_SIDE_QUEST",
      "ADD_JOURNAL_ANNOTATION",
      "ADD_LOG_ENTRY",
      "TEASE_FINALE",
      "UPDATE_FINALE_REQUIREMENT",
    ] as const) {
      expect(adminCommands).toContain(command);
      expect(commandCapability(command)).toBe("RELEASE_PROGRESSION");
    }
  });

  it("maps the compatibility action transport onto the hardened command shape", () => {
    expect(
      actionCommandSchema.parse({
        action: "REVEAL_ROUTE",
        campaignSlug: "test-voyage",
        expectedSequence: 7,
        idempotencyKey: "quartermaster-123456",
        payload: {},
        confirmation: true,
      }),
    ).toEqual({
      command: "REVEAL_ROUTE",
      campaignSlug: "test-voyage",
      expectedSequence: 7,
      idempotencyKey: "quartermaster-123456",
      payload: {},
      confirmation: true,
    });
  });
});

describe("bounded command payloads", () => {
  const base = {
    campaignSlug: "test-voyage",
    expectedSequence: 7,
    idempotencyKey: "quartermaster-123456",
    confirmation: true,
  } as const;

  it("rejects target and payload data for commands that consume neither", () => {
    expect(commandSchema.safeParse({ ...base, command: "PAUSE", targetKey: "extra", payload: {} }).success).toBe(false);
    expect(commandSchema.safeParse({ ...base, command: "PAUSE", payload: { nested: {} } }).success).toBe(false);
  });

  it("allows only bounded values for note commands", () => {
    expect(
      commandSchema.parse({ ...base, command: "ADD_LOG_ENTRY", payload: { value: "A safe captain's note" } }),
    ).toMatchObject({ payload: { value: "A safe captain's note" } });
    expect(
      commandSchema.safeParse({ ...base, command: "ADD_LOG_ENTRY", payload: { value: "x".repeat(2_049) } }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({ ...base, command: "ADD_LOG_ENTRY", payload: { value: "safe", extra: true } }).success,
    ).toBe(false);
  });

  it("requires a bounded journal body and rejects deep or surplus data", () => {
    expect(
      commandSchema.parse({
        ...base,
        command: "RELEASE_JOURNAL_ENTRY",
        payload: { title: "Dispatch", body: "A bounded release." },
      }),
    ).toMatchObject({ payload: { title: "Dispatch", body: "A bounded release." } });
    expect(
      commandSchema.safeParse({ ...base, command: "RELEASE_JOURNAL_ENTRY", payload: { title: "Dispatch" } }).success,
    ).toBe(false);
    expect(
      commandSchema.safeParse({
        ...base,
        command: "RELEASE_JOURNAL_ENTRY",
        payload: { body: "safe", metadata: { nested: { value: true } } },
      }).success,
    ).toBe(false);
  });

  it("applies the same strict payload contract to staged commands", () => {
    expect(
      stageSchema.parse({
        command: "PREPARE_CHAPTER",
        campaignSlug: "test-voyage",
        expectedSequence: 7,
        payload: {},
      }),
    ).toMatchObject({ command: "PREPARE_CHAPTER", expectedSequence: 7, payload: {} });
    expect(
      stageSchema.safeParse({
        command: "PREPARE_CHAPTER",
        campaignSlug: "test-voyage",
        expectedSequence: 7,
        payload: { unexpected: true },
      }).success,
    ).toBe(false);
  });
});

describe("side-quest state planning", () => {
  const objectives = [
    { ordinal: 1, complete: false },
    { ordinal: 2, complete: false },
  ];

  it("discovers hidden and rumored quests before allowing progression", () => {
    expect(planSideQuestTransition("DISCOVER_SIDE_QUEST", "RUMORED", objectives)).toMatchObject({
      allowed: true,
      state: "DISCOVERED",
      eventType: "SIDE_QUEST_DISCOVERED",
    });
    expect(planSideQuestTransition("ADVANCE_SIDE_QUEST", "HIDDEN", objectives)).toEqual({
      allowed: false,
      message: "Discover this Echo before advancing it.",
    });
  });

  it("advances objectives one at a time and completes only after the last one", () => {
    expect(planSideQuestTransition("ADVANCE_SIDE_QUEST", "DISCOVERED", objectives)).toMatchObject({
      state: "ACTIVE",
      eventType: "SIDE_QUEST_UPDATED",
    });
    expect(planSideQuestTransition("ADVANCE_SIDE_QUEST", "ACTIVE", objectives)).toMatchObject({
      state: "PARTIALLY_COMPLETE",
      objectiveOrdinal: 1,
      eventType: "SIDE_QUEST_UPDATED",
    });
    expect(
      planSideQuestTransition("ADVANCE_SIDE_QUEST", "PARTIALLY_COMPLETE", [
        { ordinal: 1, complete: true },
        { ordinal: 2, complete: false },
      ]),
    ).toMatchObject({ state: "COMPLETE", objectiveOrdinal: 2, eventType: "SIDE_QUEST_COMPLETED" });
  });
});
