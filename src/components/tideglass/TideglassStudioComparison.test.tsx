import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TideglassStudioComparison, type TideglassStudioComparisonDto } from "./TideglassStudioComparison";

afterEach(cleanup);

const comparison: TideglassStudioComparisonDto = {
  selection: { kind: "PAIR", sourceEditionId: "edition-1", targetEditionId: "edition-2" },
  projection: {
    projectionStatus: "COMPLETE",
    visibleChangeCount: 2,
    changes: [
      {
        changeCode: "TG-STRUCTURE-ROUTE",
        category: "STRUCTURE",
        kind: "MODIFIED",
        significance: "MAJOR",
        disclosureState: "VISIBLE",
        compatibilityRelevant: false,
        entityType: "CHAPTER",
        entityId: "synthetic-chapter",
      },
    ],
    summary: {
      headline: { templateKey: "tideglass.summary.overall", parameters: { visibleChangeCount: 2 } },
      categoryGroups: [
        {
          id: "structure",
          category: "STRUCTURE",
          lines: [{ id: "line-1", changeIds: ["change-1", "change-2"] }],
        },
      ],
      compatibility: [{ id: "compat-1", dimension: "PLATFORM", impact: "POTENTIALLY_BREAKING" }],
      partial: false,
      unavailableSections: [],
    },
    annotations: [],
  },
};

describe("TideglassStudioComparison", () => {
  it("renders semantic categories and compatibility without restoring the legacy raw diff", () => {
    render(
      <TideglassStudioComparison
        comparison={comparison}
        versionLabels={{ "edition-1": "1.0", "edition-2": "2.0" }}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Version 1.0 to Version 2.0" })).toBeInTheDocument();
    expect(screen.getByText("2 meaningful changes are available to review.")).toBeInTheDocument();
    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getByText("2 semantic changes")).toBeInTheDocument();
    expect(screen.getByText("platform: potentially breaking")).toBeInTheDocument();
    expect(screen.getByText("Technical semantic detail")).toBeInTheDocument();
    expect(screen.getByText("TG-STRUCTURE-ROUTE")).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE_RAW_PATH|before|after/i)).not.toBeInTheDocument();
  });
});
