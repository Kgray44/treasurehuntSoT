import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JourneyArchiveResponse, JourneyArchiveItem } from "@/wakebook/contracts";
import { WakebookArchive } from "@/components/wakebook/WakebookArchive";

const item: JourneyArchiveItem = {
  id: "record-one",
  chronology: { archiveDate: "2026-04-03T12:00:00.000Z", year: 2026, dateQuality: "EXACT" },
  chronicle: {
    historicalTitle: "The Lantern Below",
    historicalCover: null,
    publishedVersionId: "version-private",
    publishedVersionLabel: "First Tide",
    publishedVersionChecksum: "checksum-private",
  },
  lifecycle: { status: "COMPLETED", humanLabel: "Completed" },
  participation: { role: "PLAYER", humanRole: "Player", crewRole: "Navigator" },
  crewPreview: [
    {
      historicalDisplayName: "Synthetic Crew",
      avatarAlt: null,
      role: "PLAYER",
      humanRole: "Player",
      crewRole: "Lookout",
    },
  ],
  timing: { primary: { seconds: 3720, quality: "EXACT", humanLabel: "1 hr 2 min" } },
  outcome: { label: "Completed", quality: "SAFE_GENERIC" },
  progress: { completedChapterCount: 4, chapterEvidenceAvailable: true },
  context: {
    memoryCount: 2,
    sharedArtifactCount: 1,
    personalArtifactCount: 0,
    hasKeepsake: false,
    hasReflection: true,
  },
  dataQuality: "COMPLETE",
  warnings: [],
};

function response(overrides: Partial<JourneyArchiveResponse> = {}): JourneyArchiveResponse {
  return {
    groups: [
      {
        key: "2026",
        year: 2026,
        label: "2026",
        totalCount: 1,
        completedCount: 1,
        displayedCount: 1,
        exactRecordedSeconds: 3720,
        items: [item],
      },
    ],
    invitations: [],
    nextCursor: null,
    resultCount: 1,
    pageCount: 1,
    filtersApplied: false,
    projection: { examined: 1, created: 0, updated: 0, failures: 0 },
    warnings: [],
    ...overrides,
  };
}

describe("WakebookArchive", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the visual archive with human labels while keeping provenance internals off cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(response())));

    render(<WakebookArchive />);

    expect(await screen.findByRole("heading", { name: "Your Voyages" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The Lantern Below" })).toBeInTheDocument();
    expect(screen.getByText("Completed · 1 hr 2 min")).toBeInTheDocument();
    expect(screen.getByLabelText("Historical crew: Synthetic Crew")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open The Lantern Below Voyage" })).toHaveAttribute(
      "href",
      "/passport/history/record-one",
    );
    expect(document.body).not.toHaveTextContent("version-private");
    expect(document.body).not.toHaveTextContent("checksum-private");
  });

  it("keeps invitation-only history separate from played Voyage totals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          response({
            groups: [],
            resultCount: 0,
            pageCount: 0,
            invitations: [
              {
                id: "invitation-one",
                chronicleTitle: "A Future Wake",
                lifecycle: { status: "DECLINED", humanLabel: "Invitation declined" },
                chronology: { archiveDate: "2026-03-01T00:00:00.000Z", year: 2026, dateQuality: "EXACT" },
                editionLabel: "Invitation edition",
                replaced: false,
              },
            ],
          }),
        ),
      ),
    );

    render(<WakebookArchive />);

    expect(await screen.findByLabelText("0 played Voyages in this archive")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your first played Voyage is still ahead" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invitations along the way" })).toBeInTheDocument();
    expect(screen.getByText("A Future Wake")).toBeInTheDocument();
  });

  it("submits bounded filters and offers one-action recovery from an empty result", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(response()))
      .mockResolvedValueOnce(
        Response.json(
          response({
            groups: [],
            resultCount: 0,
            pageCount: 0,
            filtersApplied: true,
            projection: response().projection,
          }),
        ),
      )
      .mockResolvedValueOnce(Response.json(response()));
    vi.stubGlobal("fetch", fetch);
    render(<WakebookArchive />);
    await screen.findByRole("heading", { name: "The Lantern Below" });

    fireEvent.change(screen.getByLabelText("Search your archive"), { target: { value: "Harbor" } });
    fireEvent.click(screen.getByRole("button", { name: "Read the wake" }));

    expect(await screen.findByRole("heading", { name: "No Voyages match these archive filters" })).toBeInTheDocument();
    expect(String(fetch.mock.calls[1]?.[0])).toBe("/api/passport/voyages?search=Harbor");
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  });
});
