import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WakebookInsights } from "@/components/wakebook/WakebookInsights";
import type { WakebookInsights as Insights } from "@/wakebook/insights";

const response: Insights = {
  freshness: "CURRENT",
  notice: null,
  metrics: {
    definitionVersions: ["WAYFARER_TIMING_V1"],
    voyageCount: 2,
    completedCount: 1,
    exactDurationSeconds: null,
    durationCoverage: "MIXED",
    firstJourneyAt: "2025-12-14T12:00:00.000Z",
    latestJourneyAt: "2026-04-03T12:00:00.000Z",
  },
  timeline: [
    {
      id: "record-one",
      title: "The Lantern Below",
      date: "2026-04-03T12:00:00.000Z",
      dateQuality: "EXACT",
      lifecycle: "Completed",
      duration: "1 hr 2 min",
    },
  ],
  people: [
    {
      label: "Synthetic Crew",
      role: "Lookout",
      voyageCount: 1,
      availability: "HISTORICAL",
    },
  ],
};

describe("WakebookInsights", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the timeline private, navigable, and linked back to the canonical Voyage record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    render(<WakebookInsights view="timeline" />);
    expect(await screen.findByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Voyage" })).toHaveAttribute("href", "/passport/history/record-one");
    expect(screen.getByRole("navigation", { name: "Archive views" })).toBeInTheDocument();
  });

  it("labels limited history honestly in people and statistics instead of inventing a score", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    const { rerender } = render(<WakebookInsights view="people" />);
    expect(await screen.findByText("Synthetic Crew")).toBeInTheDocument();
    expect(screen.getByText("Historical snapshot")).toBeInTheDocument();
    rerender(<WakebookInsights view="statistics" />);
    expect(await screen.findByText("Mixed quality")).toBeInTheDocument();
    expect(screen.getByText(/do not rank you/i)).toBeInTheDocument();
  });

  it("organizes Voyage history by season and keeps the absent Landfall map truthful", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response)));
    render(<WakebookInsights view="atlas" />);
    expect(await screen.findByRole("heading", { name: "Voyage Atlas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Voyages by season")).toHaveTextContent("2026 Spring");
    expect(screen.getByLabelText("Map availability")).toHaveTextContent(/does not draw or infer a route/i);
    expect(screen.getByRole("link", { name: "Open People" })).toHaveAttribute("href", "/passport/people");
  });
});
