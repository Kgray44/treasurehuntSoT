import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCampaign: vi.fn(),
  findLatestEvent: vi.fn(),
  findViewed: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    campaign: { findUniqueOrThrow: mocks.findCampaign },
    progressEvent: { findFirst: mocks.findLatestEvent },
    viewedContent: { findMany: mocks.findViewed },
  },
}));

import { buildPublicSnapshot } from "./snapshot";

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
  });

  it("omits replay data when no eligible released chapter event exists", async () => {
    mocks.findLatestEvent.mockResolvedValue(null);

    const snapshot = await buildPublicSnapshot("campaign-1", "player-access-1");

    expect(snapshot).not.toHaveProperty("latestChapterReleasePresentation");
  });
});
