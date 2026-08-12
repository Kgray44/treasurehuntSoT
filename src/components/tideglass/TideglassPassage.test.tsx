import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  TideglassPassage,
  type TideglassPassageComparisonDto,
  type TideglassPassageContextDto,
} from "./TideglassPassage";

const context: TideglassPassageContextDto = {
  chronicle: { slug: "lantern-test", title: "The Lantern Test" },
  editions: [
    { id: "edition-1", label: "Edition 1.0", publishedAt: "2026-08-01T00:00:00.000Z", availability: "HISTORICAL_ONLY" },
    { id: "edition-2", label: "Edition 2.0", publishedAt: "2026-08-02T00:00:00.000Z", availability: "PLAYABLE" },
  ],
  recommendation: { available: true, editionId: "edition-2" },
  playedAnchors: [{ recordId: "record-1", editionId: "edition-1", completedAt: "2026-08-03T00:00:00.000Z" }],
};

const comparison: TideglassPassageComparisonDto = {
  selection: { kind: "PAIR" as const, sourceEditionId: "edition-1", targetEditionId: "edition-2" },
  projection: {
    projectionStatus: "PROJECTED",
    summary: {
      headline: "A concise, spoiler-safe account of this Chronicle change.",
      categoryGroups: [
        {
          category: "STRUCTURE",
          label: "Structure",
          summary: "The route was refined.",
          disclosureState: "DISCLOSABLE",
        },
        {
          category: "MEDIA",
          label: "Media",
          summary: "Captions were updated.",
          disclosureState: "VISIBLE",
        },
      ],
      compatibility: { state: "COMPATIBLE", summary: "Your saved record remains compatible." },
      partial: { state: "COMPLETE", summary: "The comparison is complete." },
    },
    annotations: [],
  },
};

afterEach(cleanup);

describe("TideglassPassage", () => {
  it("labels editions and keeps disclosure-gated detail hidden until the visitor asks to reveal it", () => {
    render(
      <TideglassPassage
        taleSlug="lantern-test"
        initialContext={context}
        initialComparison={comparison}
        initialHistoryRecordId="record-1"
      />,
    );

    expect(screen.getByRole("heading", { name: "What changed?" })).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /Edition 1.0.*PLAYED BY YOU.*ORIGINAL/i })).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: /Edition 2.0.*CURRENT RECOMMENDED.*PLAYABLE/i })).toHaveLength(2);
    expect(screen.getByText("A concise, spoiler-safe account of this Chronicle change.")).toBeInTheDocument();
    expect(screen.queryByText("The route was refined.")).not.toBeInTheDocument();
    expect(screen.getByText("Captions were updated.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show safe-to-reveal details" }));
    fireEvent.change(screen.getByLabelText("Filter changes by category"), { target: { value: "STRUCTURE" } });

    expect(screen.getByText("The route was refined.")).toBeInTheDocument();
    expect(screen.queryByText("Captions were updated.")).not.toBeInTheDocument();
    expect(screen.getByText("Your saved record remains compatible.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Swap selected editions" }));
    expect(screen.getByLabelText("Played or starting edition")).toHaveValue("edition-2");
    expect(screen.getByLabelText("Edition to review")).toHaveValue("edition-1");
  });
});
