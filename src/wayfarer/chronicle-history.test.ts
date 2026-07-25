import { describe, expect, it } from "vitest";
import type { PublishedTaleSnapshot } from "@/chronicle/types";
import {
  derivePersonalTiming,
  filterKeepsakeCrew,
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
    expect(summary.choiceSummary[0]?.reason).toMatch(/^UNAVAILABLE:/);
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
