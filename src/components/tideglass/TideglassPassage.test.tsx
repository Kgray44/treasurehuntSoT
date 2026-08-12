import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TideglassPassage,
  type TideglassPassageComparisonDto,
  type TideglassPassageContextDto,
} from "./TideglassPassage";

const context: TideglassPassageContextDto = {
  chronicle: { slug: "lantern-test", title: "The Lantern Test" },
  editions: [
    {
      id: "edition-1",
      label: "Edition 1.0",
      publishedAt: "2026-08-01T00:00:00.000Z",
      creatorName: "Synthetic Creator",
      releaseNotes: null,
      compatibilitySummary: "Exact pair assessment",
      availability: "HISTORICAL_ONLY",
    },
    {
      id: "edition-2",
      label: "Edition 2.0",
      publishedAt: "2026-08-02T00:00:00.000Z",
      creatorName: "Synthetic Creator",
      releaseNotes: "A safe release note.",
      compatibilitySummary: "Exact pair assessment",
      availability: "PLAYABLE",
    },
  ],
  recommendation: { available: true, editionId: "edition-2" },
  playedAnchors: [
    {
      recordId: "record-1",
      editionId: "edition-1",
      lifecycleStatus: "COMPLETED",
      outcome: "SUCCESS",
      completedAt: "2026-08-03T00:00:00.000Z",
    },
  ],
};

const comparison: TideglassPassageComparisonDto = {
  selection: { kind: "PAIR" as const, sourceEditionId: "edition-1", targetEditionId: "edition-2" },
  projection: {
    projectionStatus: "PROJECTED",
    changes: [
      {
        changeCode: "TG-STRUCTURE-ROUTE",
        category: "STRUCTURE",
        kind: "MODIFIED",
        significance: "MAJOR",
        disclosureState: "DISCLOSABLE",
        compatibilityRelevant: false,
      },
    ],
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
    expect(screen.getByText("Historical edition")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
    expect(screen.getByText("A concise, spoiler-safe account of this Chronicle change.")).toBeInTheDocument();
    expect(screen.getAllByText("Synthetic Creator")).toHaveLength(2);
    expect(screen.getByText("A safe release note.")).toBeInTheDocument();
    expect(screen.queryByText("The route was refined.")).not.toBeInTheDocument();
    expect(screen.getByText("Captions were updated.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show safe-to-reveal details" }));
    fireEvent.change(screen.getByLabelText("Filter changes by category"), { target: { value: "STRUCTURE" } });

    expect(screen.getByText("The route was refined.")).toBeInTheDocument();
    expect(screen.queryByText("Captions were updated.")).not.toBeInTheDocument();
    expect(screen.getByText("Structure Modified")).toBeInTheDocument();
    expect(screen.getByText("Classified as major because its governed semantic category changed.")).toBeInTheDocument();
    expect(screen.getByText("Your saved record remains compatible.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Swap selected editions" }));
    expect(screen.getByLabelText("Played or starting edition")).toHaveValue("edition-2");
    expect(screen.getByLabelText("Edition to review")).toHaveValue("edition-1");
  });

  it("names no-change, partial, and up-to-date outcomes without implying a replay recommendation", () => {
    render(
      <TideglassPassage
        taleSlug="lantern-test"
        initialContext={context}
        initialComparison={{
          selection: { kind: "PAIR", sourceEditionId: "edition-1", targetEditionId: "edition-2" },
          projection: {
            projectionStatus: "NO_MEANINGFUL_CHANGE",
            summary: { headline: { templateKey: "tideglass.summary.no-meaningful-change" } },
          },
        }}
      />,
    );
    expect(screen.getByText("No meaningful changes were recorded between these editions.")).toBeInTheDocument();
    expect(screen.getByText("No replay recommendation is implied by this result.")).toBeInTheDocument();

    cleanup();
    render(
      <TideglassPassage
        taleSlug="lantern-test"
        initialContext={context}
        initialComparison={{
          selection: { kind: "PAIR", sourceEditionId: "edition-1", targetEditionId: "edition-2" },
          projection: {
            projectionStatus: "PARTIAL",
            summary: {
              headline: { templateKey: "tideglass.summary.partial" },
              partial: true,
              unavailableSections: [{ section: "synthetic", code: "UNKNOWN_SEMANTICS" }],
            },
          },
        }}
      />,
    );
    expect(screen.getByText("This comparison is partial. Some semantic sections are unavailable.")).toBeInTheDocument();
    expect(
      screen.getByText("Some location behavior could not be compared for this historical edition."),
    ).toBeInTheDocument();

    cleanup();
    render(
      <TideglassPassage
        taleSlug="lantern-test"
        initialContext={context}
        initialComparison={{
          selection: { kind: "UP_TO_DATE", sourceEditionId: "edition-2", targetEditionId: "edition-2" },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "You are up to date." })).toBeInTheDocument();
  });

  it("renders a bounded unavailable state with retry after a context request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "TIDEGLASS_INTERNAL_FAILURE",
            error: "This Chronicle comparison is unavailable.",
            correlationId: "tg3-safe-ref",
          }),
          { status: 503 },
        ),
      ),
    );
    render(<TideglassPassage taleSlug="missing-fixture" />);
    expect(screen.getByText("Opening the exact published editions for this Chronicle…")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("This Chronicle comparison is unavailable.");
    expect(screen.getByRole("alert")).toHaveTextContent("Reference: tg3-safe-ref");
  });
});
