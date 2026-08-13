import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, loadTideglassHistoryComparisonEntry } = vi.hoisted(() => ({
  db: {
    playerChronicleRecord: { findFirst: vi.fn() },
    playerArtifactRecord: { findMany: vi.fn() },
  },
  loadTideglassHistoryComparisonEntry: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/tideglass/passage-service", () => ({ loadTideglassHistoryComparisonEntry }));

import { queryVoyageDetail } from "@/wakebook/archive-query";

const exactRecord = {
  id: "record-owned",
  sourcePlaythroughId: "playthrough-owned",
  sourceMembershipId: "membership-owned",
  publishedVersionId: "edition-played",
  publishedVersionChecksum: "checksum-played",
  chronicleTitleSnapshot: "Synthetic Chronicle",
  chronicleCoverSnapshot: null,
  participationRole: "PLAYER",
  crewRoleSnapshot: "Navigator",
  lifecycleStatus: "COMPLETED",
  outcome: "COMPLETED",
  startedAt: new Date("2026-01-01T00:00:00.000Z"),
  joinedAt: new Date("2026-01-01T00:00:00.000Z"),
  completedAt: new Date("2026-01-02T00:00:00.000Z"),
  wallClockSeconds: 600,
  wallClockAccuracy: "EXACT",
  activeSeconds: 500,
  activeAccuracy: "EXACT",
  pausedSeconds: 100,
  pausedAccuracy: "EXACT",
  connectedSeconds: 600,
  connectedAccuracy: "EXACT",
  interactiveSeconds: 450,
  interactiveAccuracy: "EXACT",
  captainWaitSeconds: null,
  captainWaitAccuracy: "NOT_APPLICABLE",
  completedChapters: "[]",
  optionalObjectives: "[]",
  choiceSummary: "[]",
  artifactSummary: "[]",
  projectionStatus: "CURRENT",
  projectionReason: null,
  playerNameSnapshot: "Synthetic Player",
  metricDefinitionVersion: "wayfarer-timing.v1",
  reflection: null,
  memories: [],
  keepsake: null,
  participantSnapshots: [],
  publishedVersion: {
    versionLabel: "1.0",
    tale: { slug: "synthetic-chronicle" },
    communityReleases: [],
  },
};

describe("Wakebook Tideglass history handoff", () => {
  beforeEach(() => {
    db.playerChronicleRecord.findFirst.mockReset();
    db.playerArtifactRecord.findMany.mockReset();
    loadTideglassHistoryComparisonEntry.mockReset();
  });

  it("passes only exact owner-bound history evidence to the Tideglass adapter", async () => {
    db.playerChronicleRecord.findFirst.mockResolvedValue(exactRecord);
    db.playerArtifactRecord.findMany.mockResolvedValue([]);
    loadTideglassHistoryComparisonEntry.mockResolvedValue({
      href: "/chronicles/synthetic-chronicle/compare?historyRecord=record-owned",
      state: "COMPARE",
    });

    const detail = await queryVoyageDetail("profile-owner", "record-owned");

    expect(db.playerChronicleRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "record-owned", playerProfileId: "profile-owner" } }),
    );
    expect(loadTideglassHistoryComparisonEntry).toHaveBeenCalledWith({
      taleSlug: "synthetic-chronicle",
      playerProfileId: "profile-owner",
      historyRecordId: "record-owned",
      returnTo: "/passport/history/record-owned",
    });
    expect(detail?.comparison).toEqual({
      href: "/chronicles/synthetic-chronicle/compare?historyRecord=record-owned",
      state: "COMPARE",
    });
    expect(JSON.stringify(detail?.comparison)).not.toContain("checksum-played");
  });

  it("fails closed for a foreign or missing record before invoking the Tideglass adapter", async () => {
    db.playerChronicleRecord.findFirst.mockResolvedValue(null);

    await expect(queryVoyageDetail("profile-owner", "record-foreign")).resolves.toBeNull();

    expect(loadTideglassHistoryComparisonEntry).not.toHaveBeenCalled();
    expect(db.playerArtifactRecord.findMany).not.toHaveBeenCalled();
  });
});
