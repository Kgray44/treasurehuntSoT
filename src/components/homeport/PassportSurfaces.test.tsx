import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryExplorer } from "./PassportSurfaces";

function jsonResponse(body: unknown) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Passport Tideglass entry", () => {
  it("offers a visible owner-record comparison entry without adding edition data to the history DTO", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          items: [
            {
              id: "record-1",
              chronicle: { title: "Lantern Test", cover: null, versionChecksum: "private-checksum" },
              lifecycleStatus: "COMPLETED",
              outcome: "Completed",
              timestamps: { completedAt: "2026-08-03T00:00:00.000Z" },
              memories: [],
              artifactSummary: [],
            },
          ],
          invitations: [],
          nextCursor: null,
        }),
      ),
    );

    render(<HistoryExplorer />);

    expect(await screen.findByRole("link", { name: "See what changed" })).toHaveAttribute(
      "href",
      "/passport/history/record-1/compare",
    );
  });
});
