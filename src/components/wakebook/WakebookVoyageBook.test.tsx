import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WakebookVoyageBook, WakebookVoyageBookEntry } from "@/components/wakebook/WakebookVoyageBook";
import type { VoyageDetail } from "@/wakebook/contracts";

const voyage = {
  id: "record-owned",
  chronology: { archiveDate: "2026-08-01T12:00:00.000Z" },
  chronicle: { historicalTitle: "The Lantern Below", historicalCover: null, publishedVersionLabel: "Edition 3" },
  lifecycle: { humanLabel: "Completed" },
  participation: { humanRole: "Player", crewRole: "Lookout" },
  outcome: { label: "Journey complete" },
  attribution: { captain: { historicalLabel: "Captain Rowan" } },
  warnings: [],
  reflection: { privateNote: "The quiet room after the final bell.", favoriteChapterId: null },
  memories: [
    {
      id: "memory-owned",
      title: "The final bell",
      body: "A private recollection.",
      createdAt: "2026-08-01T13:00:00.000Z",
    },
  ],
  chapters: [{ id: "chapter-1", sequence: 1, title: "The first light", completedAt: "2026-08-01T12:30:00.000Z" }],
  crew: [
    {
      historicalDisplayName: "Captain Rowan",
      role: "CAPTAIN",
      humanRole: "Captain",
      crewRole: "Captain",
      isHistoricalCaptain: true,
    },
  ],
} as unknown as VoyageDetail;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WakebookVoyageBook", () => {
  it("uses the owner-scoped Passport route without exposing a source identifier", () => {
    render(<WakebookVoyageBookEntry recordId="record-owned" />);
    expect(screen.getByRole("link", { name: "Open private Voyage Book" })).toHaveAttribute(
      "href",
      "/passport/history/record-owned/book",
    );
  });

  it("keeps the printable story presentation private and distinct from canonical account-data export", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(voyage)));
    render(<WakebookVoyageBook recordId="record-owned" />);
    expect(await screen.findByRole("heading", { name: "The Lantern Below" })).toBeInTheDocument();
    expect(screen.getByText("The quiet room after the final bell.")).toBeInTheDocument();
    expect(screen.getByText(/does not alter the Voyage/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print this private Voyage Book" })).toBeInTheDocument();
  });
});
