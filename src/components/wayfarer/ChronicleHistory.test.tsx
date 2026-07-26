import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChronicleHistory } from "./ChronicleHistory";

function response(body: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(body) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ChronicleHistory", () => {
  it("shows a safe empty state and no player-facing reconciliation control", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [] }))
      .mockResolvedValueOnce(response({ csrfToken: "csrf" }));
    vi.stubGlobal("fetch", fetch);

    render(<ChronicleHistory />);

    expect(screen.getByText(/Loading private Chronicle history/)).toBeInTheDocument();
    expect(await screen.findByText("No historical Voyages have been recorded yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reconcile|refresh history/i })).not.toBeInTheDocument();
  });

  it("renders unavailable timing and a private Keepsake action for an owner record", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: "record-1",
              chronicle: { title: "Harborlight", versionChecksum: "checksum-1" },
              lifecycleStatus: "COMPLETED",
              outcome: "COMPLETED:block-1",
              timestamps: { completedAt: "2026-07-25T10:00:00.000Z" },
              timing: { wallClock: { seconds: null, accuracy: "UNAVAILABLE" } },
              memories: [{ id: "memory-1", title: "Lantern" }],
              keepsake: null,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ csrfToken: "csrf" }));
    vi.stubGlobal("fetch", fetch);

    render(<ChronicleHistory />);

    expect(await screen.findByRole("heading", { name: "Harborlight" })).toBeInTheDocument();
    expect(screen.getByText(/Wall-clock: unavailable \(UNAVAILABLE\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate private Keepsake" })).toBeInTheDocument();
  });

  it("surfaces a safe service failure instead of rendering stale history", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response({ error: "Unable to load Chronicle history." }, false))
      .mockResolvedValueOnce(response({ csrfToken: "csrf" }));
    vi.stubGlobal("fetch", fetch);

    render(<ChronicleHistory />);

    await waitFor(() => expect(screen.getByText("Unable to load Chronicle history.")).toBeInTheDocument());
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
