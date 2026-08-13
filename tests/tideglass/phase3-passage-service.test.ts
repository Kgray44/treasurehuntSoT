import { describe, expect, it } from "vitest";
import { compareExactEditions } from "../../src/tideglass/service";
import {
  constrainTideglassPassageRepository,
  resolveTideglassHistoryComparisonEntry,
  type TideglassPassageContext,
} from "../../src/tideglass/passage-service";
import { baseSnapshot, clone, edition, FixtureRepository } from "./fixtures";

describe("Tideglass Phase 3 server-passage authorization", () => {
  it("allows a comparison only when both exact editions were included in the trusted server context", async () => {
    const source = edition("edition-a", baseSnapshot());
    const targetSnapshot = clone(baseSnapshot());
    targetSnapshot.chapters[0].title = "Synthetic changed chapter";
    const target = edition("edition-b", targetSnapshot);
    const repository = constrainTideglassPassageRepository(new FixtureRepository([source, target]), [
      source.id,
      target.id,
    ]);

    const result = await compareExactEditions(
      repository,
      { kind: "PASSAGE", subjectId: "public:synthetic-chronicle" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );

    expect(result.ok).toBe(true);
  });

  it("fails closed rather than allowing a page query to select an edition outside the trusted context", async () => {
    const source = edition("edition-a", baseSnapshot());
    const target = edition("edition-b", clone(baseSnapshot()));
    const repository = constrainTideglassPassageRepository(new FixtureRepository([source, target]), [source.id]);

    const result = await compareExactEditions(
      repository,
      { kind: "PASSAGE", subjectId: "player:synthetic-owner" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );

    expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_AUTHORIZED" });
  });

  it("fails closed for a redacted exact edition without exposing its retained contents", async () => {
    const source = edition("edition-redacted", baseSnapshot(), { retainedState: "REDACTED" });
    const target = edition("edition-playable", clone(baseSnapshot()));
    const result = await compareExactEditions(
      constrainTideglassPassageRepository(new FixtureRepository([source, target]), [source.id, target.id]),
      { kind: "PASSAGE", subjectId: "public:synthetic-chronicle" },
      { chronicleId: source.chronicleId, sourceEditionId: source.id, targetEditionId: target.id },
      { cache: null },
    );
    expect(result).toMatchObject({ ok: false, code: "EDITION_NOT_AUTHORIZED" });
    expect(JSON.stringify(result)).not.toContain("contentSnapshot");
  });

  it("creates a Wakebook handoff only for the exact owner-bound history anchor and publishing target", () => {
    const context: TideglassPassageContext = {
      chronicle: { id: "chronicle-synthetic", slug: "synthetic-chronicle", title: "Synthetic Chronicle" },
      editions: [
        {
          id: "edition-played",
          label: "Edition 1.0",
          publishedAt: "2026-01-01T00:00:00.000Z",
          creatorName: "Synthetic Creator",
          releaseNotes: null,
          compatibilitySummary: "Exact pair assessment",
          availability: "HISTORICAL_ONLY",
        },
        {
          id: "edition-recommended",
          label: "Edition 2.0",
          publishedAt: "2026-02-01T00:00:00.000Z",
          creatorName: "Synthetic Creator",
          releaseNotes: null,
          compatibilitySummary: "Exact pair assessment",
          availability: "PLAYABLE",
        },
      ],
      recommendedEditionId: "edition-recommended",
      playedAnchors: [
        {
          recordId: "record-owned",
          editionId: "edition-played",
          editionChecksum: "checksum-played",
          lifecycleStatus: "COMPLETED",
          outcome: "COMPLETED",
          completedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      allowedEditionIds: ["edition-played", "edition-recommended"],
      audience: "PLAYER_SAFE",
    };

    expect(
      resolveTideglassHistoryComparisonEntry(context, {
        historyRecordId: "record-owned",
        returnTo: "/passport/history/record-owned",
      }),
    ).toEqual({
      href: "/chronicles/synthetic-chronicle/compare?from=edition-played&to=edition-recommended&historyRecord=record-owned&returnTo=%2Fpassport%2Fhistory%2Frecord-owned",
      state: "COMPARE",
    });
    expect(
      resolveTideglassHistoryComparisonEntry(context, {
        historyRecordId: "record-foreign",
        returnTo: "/passport/history/record-foreign",
      }),
    ).toBeNull();
  });
});
