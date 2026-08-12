import { describe, expect, it } from "vitest";
import {
  buildTideglassCompareHref,
  editionStatusBadges,
  resolveTideglassPassageSelection,
  selectPlayedAnchor,
  safeTideglassReturnPath,
  type TideglassEditionOption,
  type TideglassPlayedAnchor,
} from "../../src/tideglass/passage";

const editions: TideglassEditionOption[] = [
  {
    id: "edition-a",
    label: "Edition A",
    publishedAt: "2026-08-01T00:00:00.000Z",
    creatorName: "Synthetic Creator",
    releaseNotes: null,
    compatibilitySummary: "Exact pair assessment",
    availability: "HISTORICAL_ONLY",
  },
  {
    id: "edition-b",
    label: "Edition B",
    publishedAt: "2026-08-02T00:00:00.000Z",
    creatorName: "Synthetic Creator",
    releaseNotes: "A safe release note.",
    compatibilitySummary: "Exact pair assessment",
    availability: "PLAYABLE",
  },
  {
    id: "edition-c",
    label: "Edition C",
    publishedAt: "2026-08-03T00:00:00.000Z",
    creatorName: "Synthetic Creator",
    releaseNotes: null,
    compatibilitySummary: "Exact pair assessment",
    availability: "PLAYABLE",
  },
];

describe("Tideglass Phase 3 passage view model", () => {
  it("uses publishing recommendation truth and never infers that the newest edition is recommended", () => {
    expect(editionStatusBadges(editions[2], { recommendedEditionId: "edition-b" })).toEqual(["PLAYABLE"]);
    expect(editionStatusBadges(editions[1], { recommendedEditionId: "edition-b" })).toEqual([
      "CURRENT_RECOMMENDED",
      "PLAYABLE",
    ]);
  });

  it("labels exact played and original evidence independently from availability", () => {
    expect(
      editionStatusBadges(editions[0], {
        earliestEditionId: "edition-a",
        playedEditionIds: new Set(["edition-a"]),
      }),
    ).toEqual(["PLAYED_BY_YOU", "ORIGINAL", "HISTORICAL_ONLY"]);
  });

  it("keeps redaction and incompatibility status distinct from recommendation and play history", () => {
    expect(editionStatusBadges({ ...editions[0], availability: "REDACTED" })).toEqual(["REDACTED"]);
    expect(editionStatusBadges({ ...editions[1], availability: "INCOMPATIBLE" })).toEqual(["INCOMPATIBLE"]);
  });

  it("retains each historical record as a separate exact played-anchor choice", () => {
    const anchors: TideglassPlayedAnchor[] = [
      {
        recordId: "record-first",
        editionId: "edition-a",
        editionChecksum: "checksum-a",
        lifecycleStatus: "COMPLETED",
        outcome: "SUCCESS",
        completedAt: "2026-08-01",
      },
      {
        recordId: "record-second",
        editionId: "edition-b",
        editionChecksum: "checksum-b",
        lifecycleStatus: "COMPLETED",
        outcome: "SUCCESS",
        completedAt: "2026-08-02",
      },
    ];
    expect(selectPlayedAnchor(anchors, "record-second")).toMatchObject({
      recordId: "record-second",
      editionId: "edition-b",
    });
    expect(selectPlayedAnchor(anchors)).toBeNull();
  });

  it("preserves only local comparison return targets and falls back safely", () => {
    expect(safeTideglassReturnPath("/passport/history/record-1", "/tales")).toBe("/passport/history/record-1");
    expect(safeTideglassReturnPath("https://attacker.example", "/tales")).toBe("/tales");
    expect(safeTideglassReturnPath("//attacker.example", "/tales")).toBe("/tales");
  });

  it("creates a pair-specific route without treating history selection as a raw edition authority", () => {
    expect(
      buildTideglassCompareHref({
        taleSlug: "synthetic-chronicle",
        sourceEditionId: "edition-a",
        targetEditionId: "edition-b",
        historyRecordId: "record-first",
        returnTo: "/passport/history/record-first",
      }),
    ).toBe(
      "/chronicles/synthetic-chronicle/compare?from=edition-a&to=edition-b&historyRecord=record-first&returnTo=%2Fpassport%2Fhistory%2Frecord-first",
    );
  });

  it("uses the exact selected history anchor and the publishing-provided target", () => {
    const selection = resolveTideglassPassageSelection({
      editions,
      recommendedEditionId: "edition-c",
      playedAnchors: [
        {
          recordId: "record-first",
          editionId: "edition-a",
          editionChecksum: "checksum-a",
          lifecycleStatus: "COMPLETED",
          outcome: "SUCCESS",
          completedAt: "2026-08-01",
        },
        {
          recordId: "record-second",
          editionId: "edition-b",
          editionChecksum: "checksum-b",
          lifecycleStatus: "COMPLETED",
          outcome: "SUCCESS",
          completedAt: "2026-08-02",
        },
      ],
      requestedHistoryRecordId: "record-first",
    });
    expect(selection).toEqual({
      kind: "PAIR",
      sourceEditionId: "edition-a",
      targetEditionId: "edition-c",
      playedAnchor: expect.objectContaining({ recordId: "record-first" }),
    });
  });

  it("uses an intentional up-to-date state when the chosen played edition is the recommendation", () => {
    expect(
      resolveTideglassPassageSelection({
        editions,
        recommendedEditionId: "edition-c",
        playedAnchors: [
          {
            recordId: "record-current",
            editionId: "edition-c",
            editionChecksum: "checksum-c",
            lifecycleStatus: "COMPLETED",
            outcome: "SUCCESS",
            completedAt: null,
          },
        ],
      }),
    ).toMatchObject({ kind: "UP_TO_DATE", sourceEditionId: "edition-c", targetEditionId: "edition-c" });
  });

  it("rejects a non-owned history choice and never substitutes another record", () => {
    expect(
      resolveTideglassPassageSelection({
        editions,
        recommendedEditionId: "edition-c",
        playedAnchors: [
          {
            recordId: "record-first",
            editionId: "edition-a",
            editionChecksum: "checksum-a",
            lifecycleStatus: "COMPLETED",
            outcome: "SUCCESS",
            completedAt: null,
          },
        ],
        requestedHistoryRecordId: "foreign-record",
      }),
    ).toEqual({ kind: "INVALID_HISTORY_RECORD" });
  });
});
