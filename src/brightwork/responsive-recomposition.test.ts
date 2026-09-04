import { describe, expect, it } from "vitest";
import { responsiveRecompositionStrategies } from "./responsive-recomposition";

describe("Brightwork responsive recomposition", () => {
  it("governs recomposition options without converting every desktop card into a one-column stack", () => {
    expect(Object.values(responsiveRecompositionStrategies)).toEqual([
      "SUMMARY_TO_DETAIL",
      "TABLE_TO_RECORD",
      "TABS_TO_RAIL_OR_SELECTOR",
      "ACTIONS_TO_OVERFLOW",
      "STATUS_TO_COMPACT_BADGE",
      "SIDEBAR_TO_DRAWER_OR_SELECTOR",
      "STICKY_TASK_CONTROLS",
    ]);
  });
});
