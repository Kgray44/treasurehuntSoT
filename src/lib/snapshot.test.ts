import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCampaign: vi.fn(),
  findLatestEvent: vi.fn(),
  findPresentationHistory: vi.fn(),
  findViewed: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: { findUniqueOrThrow: mocks.findCampaign },
    progressEvent: { findFirst: mocks.findLatestEvent, findMany: mocks.findPresentationHistory },
    viewedContent: { findMany: mocks.findViewed },
  },
}));

import { MAX_PLAYER_PRESENTATION_HISTORY, buildPlayerPresentationHistory, buildPublicSnapshot } from "./snapshot";
import { playerPresentationEventTypes } from "@/domain/visibility";

function campaignFixture() {
  return {
    id: "campaign-1",
    slug: "lantern-test",
    title: "Lantern Test",
    status: "ACTIVE",
    currentSequence: 401,
    finaleState: "HIDDEN",
    finaleTeaser: null,
    finaleRequirements: "[]",
    chapters: [
      {
        id: "chapter-2",
        ordinal: 2,
        state: "ACTIVE",
        safeTeaser: "A safe teaser",
        relatedMapKey: null,
        relatedArtifactKey: null,
        relatedSideQuestKey: null,
        content: {
          title: "The Lantern Test",
          narrative: "The released story is readable.",
          objective: "Follow the safe light.",
        },
        clues: [{ body: "What wakes when the lantern turns?" }],
        hints: [],
      },
    ],
    artifacts: [],
    mapLocations: [],
    mapRoutes: [],
    sideQuests: [],
    journalEntries: [],
    events: [],
  };
}

describe("public snapshot replay source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findCampaign.mockResolvedValue(campaignFixture());
    mocks.findViewed.mockResolvedValue([]);
    mocks.findPresentationHistory.mockResolvedValue([]);
    mocks.findLatestEvent.mockResolvedValue({
      id: "release-event-2",
      type: "CHAPTER_RELEASED",
      sequence: 392,
      version: 1,
      releaseAt: new Date("2020-07-18T17:00:00.000Z"),
      payload: JSON.stringify({
        ordinal: 2,
        title: "The Lantern Test",
        narrative: "raw payload is not the public source",
        internalNote: "never expose",
      }),
    });
  });

  it("queries the latest released campaign event directly instead of relying on the 250-entry log window", async () => {
    const snapshot = await buildPublicSnapshot("campaign-1", "player-access-1");

    expect(mocks.findLatestEvent).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        type: "CHAPTER_RELEASED",
        releaseAt: { lte: expect.any(Date) },
      },
      orderBy: { sequence: "desc" },
      select: {
        id: true,
        type: true,
        sequence: true,
        version: true,
        payload: true,
        releaseAt: true,
      },
    });
    expect(snapshot.latestChapterReleasePresentation).toEqual({
      eventId: "release-event-2",
      eventType: "CHAPTER_RELEASED",
      sequence: 392,
      occurredAt: "2020-07-18T17:00:00.000Z",
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
    });
    expect(JSON.stringify(snapshot)).not.toContain("internalNote");
    expect(JSON.stringify(snapshot)).not.toContain("raw payload is not the public source");
    expect(mocks.findPresentationHistory).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        type: { in: [...playerPresentationEventTypes] },
        releaseAt: { lte: expect.any(Date) },
      },
      orderBy: [{ sequence: "desc" }, { id: "desc" }],
      take: MAX_PLAYER_PRESENTATION_HISTORY,
      select: {
        id: true,
        type: true,
        sequence: true,
        version: true,
        payload: true,
        releaseAt: true,
        reversesEventId: true,
        supersededById: true,
      },
    });
  });

  it("omits replay data when no eligible released chapter event exists", async () => {
    mocks.findLatestEvent.mockResolvedValue(null);

    const snapshot = await buildPublicSnapshot("campaign-1", "player-access-1");

    expect(snapshot).not.toHaveProperty("latestChapterReleasePresentation");
  });

  it("projects offline recovery labels from a server sequence boundary without changing event order or time", async () => {
    mocks.findCampaign.mockResolvedValue({
      ...campaignFixture(),
      currentSequence: 403,
      events: [
        {
          id: "offline-event-403",
          type: "PLAYER_LOG_ENTRY_ADDED",
          sequence: 403,
          payload: JSON.stringify({ key: "captain-note" }),
          releaseAt: new Date("2026-07-18T14:00:00.000Z"),
        },
        {
          id: "known-event-401",
          type: "CAMPAIGN_STARTED",
          sequence: 401,
          payload: "{}",
          releaseAt: new Date("2026-07-18T13:00:00.000Z"),
        },
      ],
    });

    const snapshot = await buildPublicSnapshot("campaign-1", "player-access-1", {
      offlineAfterSequence: 401,
      synchronizedAt: new Date("2026-07-18T14:05:00.000Z"),
    });

    expect(snapshot.log.map((entry) => entry.sequence)).toEqual([403, 401]);
    expect(snapshot.log[0]?.synchronization).toEqual({
      source: "offline-recovery",
      synchronizedAt: "2026-07-18T14:05:00.000Z",
    });
    expect(snapshot.log[0]?.timestamp).toBe("2026-07-18T14:00:00.000Z");
    expect(snapshot.log[1]).not.toHaveProperty("synchronization");
  });

  it("returns bounded, deduplicated, oldest-first Player-safe history for only the approved 17 event types", () => {
    const events = Array.from({ length: MAX_PLAYER_PRESENTATION_HISTORY + 5 }, (_, index) => ({
      id: `event-${index}`,
      type: index === 0 ? "HINT_RELEASED" : "SIDE_QUEST_UPDATED",
      sequence: index + 1,
      version: 1,
      payload: JSON.stringify({ key: `quest-${index}`, objectiveOrdinal: index, internalNote: "never expose" }),
      releaseAt: new Date(`2026-07-18T12:${String(index % 60).padStart(2, "0")}:00Z`),
    }));
    events.push({ ...events[50], sequence: events[50].sequence });

    const history = buildPlayerPresentationHistory([...events].reverse(), []);

    expect(history).toHaveLength(MAX_PLAYER_PRESENTATION_HISTORY);
    expect(history[0]?.sequence).toBe(6);
    expect(history.at(-1)?.sequence).toBe(MAX_PLAYER_PRESENTATION_HISTORY + 5);
    expect(new Set(history.map((event) => event.id)).size).toBe(history.length);
    expect(history.some((event) => event.type === "HINT_RELEASED")).toBe(false);
    expect(JSON.stringify(history)).not.toContain("internalNote");
  });

  it("reconstructs chapter replay prose from authorized readable chapter state, never stored private payload", () => {
    const chapters = [
      {
        ordinal: 2,
        state: "ACTIVE" as const,
        title: "Authorized title",
        narrative: "Authorized narrative",
        objective: "Authorized objective",
        riddle: "Authorized riddle",
      },
    ];
    const history = buildPlayerPresentationHistory(
      [
        {
          id: "chapter-release-2",
          type: "CHAPTER_RELEASED",
          sequence: 22,
          version: 1,
          payload: JSON.stringify({
            ordinal: 2,
            title: "Stored safe title",
            narrative: "stored private narrative must not leak",
            internalNote: "never expose",
          }),
          releaseAt: new Date("2026-07-18T12:00:00Z"),
        },
      ],
      chapters,
    );

    expect(history[0]?.payload).toEqual({
      ordinal: 2,
      title: "Authorized title",
      narrative: "Authorized narrative",
      objective: "Authorized objective",
      riddle: "Authorized riddle",
    });
    expect(JSON.stringify(history)).not.toContain("stored private narrative");
    expect(JSON.stringify(history)).not.toContain("internalNote");
  });

  it.each(["READY", "LOCKED"] as const)(
    "omits %s chapter releases instead of leaking formerly visible chapter copy",
    (state) => {
      const history = buildPlayerPresentationHistory(
        [
          {
            id: `chapter-release-${state.toLowerCase()}`,
            type: "CHAPTER_RELEASED",
            sequence: 20,
            version: 1,
            payload: JSON.stringify({
              ordinal: 2,
              title: "Revoked stored title",
              narrative: "Revoked stored narrative",
              objective: "Revoked stored objective",
              riddle: "Revoked stored riddle",
            }),
            releaseAt: new Date("2026-07-18T12:00:00Z"),
          },
        ],
        [
          {
            ordinal: 2,
            state,
            title: "Revoked authorized title",
            narrative: "Revoked authorized narrative",
            objective: "Revoked authorized objective",
            riddle: "Revoked authorized riddle",
          },
        ],
      );

      expect(history).toEqual([]);
      const serialized = JSON.stringify(history);
      for (const forbidden of ["title", "narrative", "objective", "riddle", "Revoked"]) {
        expect(serialized).not.toContain(forbidden);
      }
    },
  );

  it.each([
    { name: "missing chapter", payload: { ordinal: 9, title: "Former title" } },
    { name: "missing ordinal", payload: { title: "Former title" } },
    { name: "invalid ordinal", payload: { ordinal: 0, title: "Former title" } },
  ])("omits chapter history with $name and preserves surrounding safe order", ({ payload }) => {
    const history = buildPlayerPresentationHistory(
      [
        {
          id: "quest-before",
          type: "SIDE_QUEST_UPDATED",
          sequence: 10,
          version: 1,
          payload: JSON.stringify({ key: "quest-before", objectiveOrdinal: 1 }),
          releaseAt: new Date("2026-07-18T11:59:00Z"),
        },
        {
          id: "revoked-chapter",
          type: "CHAPTER_RELEASED",
          sequence: 11,
          version: 1,
          payload: JSON.stringify({
            ...payload,
            narrative: "Former narrative",
            objective: "Former objective",
            riddle: "Former riddle",
          }),
          releaseAt: new Date("2026-07-18T12:00:00Z"),
        },
        {
          id: "quest-after",
          type: "SIDE_QUEST_UPDATED",
          sequence: 12,
          version: 1,
          payload: JSON.stringify({ key: "quest-after", objectiveOrdinal: 2 }),
          releaseAt: new Date("2026-07-18T12:01:00Z"),
        },
      ],
      [],
    );

    expect(history.map((event) => event.id)).toEqual(["quest-before", "quest-after"]);
    expect(history.map((event) => event.sequence)).toEqual([10, 12]);
    const serialized = JSON.stringify(history);
    for (const forbidden of ["Former title", "Former narrative", "Former objective", "Former riddle"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each(["REVEALING", "ACTIVE", "SOLVED", "COMPLETE"] as const)(
    "keeps %s chapter history only through the current authorized chapter projection",
    (state) => {
      const history = buildPlayerPresentationHistory(
        [
          {
            id: `readable-${state.toLowerCase()}`,
            type: "CHAPTER_RELEASED",
            sequence: 30,
            version: 1,
            payload: JSON.stringify({ ordinal: 3, title: "Stale stored title", narrative: "Stored private prose" }),
            releaseAt: new Date("2026-07-18T12:00:00Z"),
          },
        ],
        [
          {
            ordinal: 3,
            state,
            title: "Current authorized title",
            narrative: "Current authorized narrative",
            objective: "Current authorized objective",
            riddle: "Current authorized riddle",
          },
        ],
      );

      expect(history).toHaveLength(1);
      expect(history[0]?.payload).toEqual({
        ordinal: 3,
        title: "Current authorized title",
        narrative: "Current authorized narrative",
        objective: "Current authorized objective",
        riddle: "Current authorized riddle",
      });
      expect(JSON.stringify(history)).not.toContain("Stale stored title");
      expect(JSON.stringify(history)).not.toContain("Stored private prose");
    },
  );
});
