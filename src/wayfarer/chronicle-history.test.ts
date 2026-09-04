import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    playthroughMembership: { findMany: vi.fn() },
    playerChronicleRecord: { findUnique: vi.fn(), upsert: vi.fn() },
    playerChronicleParticipantSnapshot: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db }));

import type { PublishedTaleSnapshot } from "@/chronicle/types";
import {
  derivePersonalTiming,
  filterKeepsakeCrew,
  materializeChronicleHistory,
  summarizeHistoricalEvents,
  isTerminalHistoryStatus,
} from "./chronicle-history";

const snapshot = {
  schemaVersion: 1,
  tale: {
    id: "tale-1",
    slug: "harbor",
    title: "Harborlight",
    subtitle: null,
    shortDescription: null,
    longDescription: null,
    coverAssetId: null,
    theme: "DEFAULT",
    visibility: "PRIVATE",
    playerCountMin: 1,
    playerCountMax: 4,
    estimatedDuration: null,
    contentWarnings: null,
  },
  chapters: [
    {
      id: "chapter-1",
      title: "The First Tide",
      subtitle: null,
      description: null,
      coverAssetId: null,
      estimatedDuration: null,
      isOptional: false,
      metadata: {},
      orderIndex: 0,
      entryBlockId: "block-1",
      completionBlockId: "block-1",
      blocks: [
        {
          id: "block-1",
          blockType: "ARTIFACT",
          title: "Find the Lantern",
          configuration: { artifactId: "artifact-1" },
          presentation: {},
          completion: {},
          chapterId: "chapter-1",
          orderIndex: 0,
          nextBlockId: null,
        },
      ],
    },
  ],
  assets: [],
  locations: [],
  artifacts: [{ id: "artifact-1", displayName: "Harbor Lantern" }],
  publishedAt: "2026-07-25T00:00:00.000Z",
} as unknown as PublishedTaleSnapshot;

describe("Project Wayfarer Phase 3 chronicle derivation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("starts personal timing at the later of session start and membership join", () => {
    const timing = derivePersonalTiming(
      new Date("2026-07-25T10:00:00.000Z"),
      new Date("2026-07-25T10:05:00.000Z"),
      new Date("2026-07-25T10:15:00.000Z"),
    );

    expect(timing.wallClockSeconds).toBe(600);
    expect(timing.wallClockAccuracy).toBe("EXACT");
    expect(timing.activeAccuracy).toBe("UNAVAILABLE");
  });

  it("does not invent a duration when the personal completion precedes the join", () => {
    expect(
      derivePersonalTiming(
        new Date("2026-07-25T10:00:00.000Z"),
        new Date("2026-07-25T10:05:00.000Z"),
        new Date("2026-07-25T10:04:00.000Z"),
      ).wallClockSeconds,
    ).toBeNull();
  });

  it("summarizes only canonical safe events with pinned snapshot labels", () => {
    const summary = summarizeHistoricalEvents(snapshot, [
      {
        id: "ignored",
        eventType: "chapter.completed",
        blockId: "block-1",
        sequence: 1,
        createdAt: new Date("2026-07-25T10:00:00.000Z"),
      },
      {
        id: "chapter",
        eventType: "chapterCompleted",
        blockId: "block-1",
        sequence: 2,
        createdAt: new Date("2026-07-25T10:01:00.000Z"),
      },
      {
        id: "artifact",
        eventType: "artifactGranted",
        blockId: "block-1",
        sequence: 3,
        createdAt: new Date("2026-07-25T10:02:00.000Z"),
      },
    ]);

    expect(summary.completedChapters).toEqual([
      expect.objectContaining({ chapterId: "chapter-1", title: "The First Tide", sourceSequence: 2 }),
    ]);
    expect(summary.artifactSummary).toEqual([
      expect.objectContaining({ artifactId: "artifact-1", name: "Harbor Lantern", sourceSequence: 3 }),
    ]);
    expect(summary.choiceSummary).toEqual([
      {
        schemaVersion: 1,
        state: "UNAVAILABLE",
        reason: "UNAVAILABLE: canonical completion events do not retain selected choice identity.",
      },
    ]);
  });

  it("reconciles malformed choice history without fabricating a selected choice and is idempotent", async () => {
    let stored = {
      sourceFingerprint: "legacy-fingerprint",
      choiceSummary: JSON.stringify([
        {
          schemaVersion: 1,
          reason: "UNAVAILABLE: canonical completion events do not retain selected choice identity.",
        },
      ]),
    };
    db.playthroughMembership.findMany.mockResolvedValue([materializationMembership()]);
    db.playerChronicleRecord.findUnique.mockImplementation(async () => ({ id: "record-1", ...stored }));
    db.playerChronicleRecord.upsert.mockImplementation(async ({ update }) => {
      stored = { sourceFingerprint: update.sourceFingerprint, choiceSummary: update.choiceSummary };
      return { id: "record-1" };
    });
    db.playerChronicleParticipantSnapshot.upsert.mockResolvedValue({});

    await expect(materializeChronicleHistory("profile-owner")).resolves.toEqual({
      membershipsExamined: 1,
      recordsCreated: 0,
      recordsUpdated: 1,
      projectionFailures: 0,
    });
    expect(JSON.parse(stored.choiceSummary)).toEqual([
      {
        schemaVersion: 1,
        state: "UNAVAILABLE",
        reason: "UNAVAILABLE: canonical completion events do not retain selected choice identity.",
      },
    ]);

    await expect(materializeChronicleHistory("profile-owner")).resolves.toEqual({
      membershipsExamined: 1,
      recordsCreated: 0,
      recordsUpdated: 0,
      projectionFailures: 0,
    });
    expect(db.playerChronicleRecord.upsert).toHaveBeenCalledTimes(1);
  });

  it("preserves a previously validated available choice when materializing other history changes", async () => {
    const availableChoice = [
      {
        schemaVersion: 1,
        state: "AVAILABLE",
        label: "Take the lighthouse path",
        chapterTitle: "The First Tide",
        kind: "CHOICE",
      },
    ];
    db.playthroughMembership.findMany.mockResolvedValue([materializationMembership()]);
    db.playerChronicleRecord.findUnique.mockResolvedValue({
      id: "record-1",
      sourceFingerprint: "outdated-fingerprint",
      choiceSummary: JSON.stringify(availableChoice),
    });
    db.playerChronicleRecord.upsert.mockResolvedValue({ id: "record-1" });
    db.playerChronicleParticipantSnapshot.upsert.mockResolvedValue({});

    await materializeChronicleHistory("profile-owner");

    expect(JSON.parse(db.playerChronicleRecord.upsert.mock.calls[0]?.[0].update.choiceSummary)).toEqual(
      availableChoice,
    );
  });

  it("omits all crew data for a one-person Keepsake", () => {
    expect(filterKeepsakeCrew([{ participantId: "owner", name: "Owner", role: "PLAYER", crewRole: null }], [])).toEqual(
      [],
    );
  });

  it("includes multi-person crew labels only when the matching scope is granted", () => {
    const crew = filterKeepsakeCrew(
      [
        { participantId: "owner", name: "Owner", role: "CAPTAIN", crewRole: "CAPTAIN" },
        { participantId: "granted", name: "Visible Crew", role: "PLAYER", crewRole: null },
        { participantId: "denied", name: "Hidden Crew", role: "PLAYER", crewRole: null },
      ],
      [
        { participantId: "granted", scope: "DISPLAY_NAME", state: "GRANTED" },
        { participantId: "denied", scope: "GENERAL_MEDIA", state: "DENIED" },
      ],
    );

    expect(crew).toEqual([{ name: "Visible Crew", role: "PLAYER", crewRole: null }]);
  });

  it("recognizes terminal history states without treating active membership as terminal", () => {
    expect(isTerminalHistoryStatus("COMPLETED")).toBe(true);
    expect(isTerminalHistoryStatus("ACTIVE")).toBe(false);
  });
});

function materializationMembership() {
  const createdAt = new Date("2026-07-25T10:00:00.000Z");
  return {
    id: "membership-owner",
    playthroughId: "playthrough-owner",
    status: "COMPLETED",
    joinedAt: createdAt,
    completedAt: createdAt,
    removedAt: null,
    role: "PLAYER",
    crewRole: null,
    player: { displayName: "Owner", avatarMedia: null },
    playthrough: {
      id: "playthrough-owner",
      status: "COMPLETED",
      startedAt: createdAt,
      completedAt: createdAt,
      tale: { coverAssetId: null, creatorId: "creator-owner" },
      version: { id: "version-owner", checksum: "checksum-owner", contentSnapshot: JSON.stringify(snapshot) },
      events: [
        {
          id: "completed-event",
          eventType: "chapterCompleted",
          blockId: "block-1",
          sequence: 1,
          createdAt,
        },
      ],
      memberships: [
        {
          id: "membership-owner",
          playerProfileId: "profile-owner",
          status: "COMPLETED",
          role: "PLAYER",
          crewRole: null,
          joinedAt: createdAt,
          completedAt: createdAt,
          removedAt: null,
          player: { displayName: "Owner", avatarMedia: null },
        },
      ],
    },
  };
}
