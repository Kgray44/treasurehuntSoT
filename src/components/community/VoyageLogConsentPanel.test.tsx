import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoyageLogConsentPanel } from "./VoyageLogConsentPanel";

describe("Voyage Log publication consent panel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(cleanup);
  it("renders owner states and sends a CSRF-protected participant approval", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-1" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            voyageLogId: "log-1",
            lifecycleState: "CONSENT_PENDING",
            participants: [
              {
                id: "participant-1",
                displayName: "Deckhand",
                protected: false,
                consents: [{ scope: "DISPLAY_NAME", state: "PENDING" }],
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ voyageLogId: "log-1", scope: "DISPLAY_NAME", state: "PENDING" }])),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-1" })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ voyageLogId: "log-1", lifecycleState: "CONSENT_PENDING", participants: [] })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([])));
    render(<VoyageLogConsentPanel voyageLogId="log-1" />);
    expect(await screen.findByText("Lifecycle: CONSENT_PENDING")).toBeInTheDocument();
    expect(screen.getAllByText("DISPLAY_NAME: PENDING")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/community/voyage-logs/consent/respond",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-csrf-token": "csrf-1" }),
          body: JSON.stringify({ voyageLogId: "log-1", scope: "DISPLAY_NAME", decision: "APPROVED" }),
        }),
      ),
    );
  });
  it("does not disclose protected participant names", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: "csrf-1" })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            voyageLogId: "log-1",
            lifecycleState: "DRAFT",
            participants: [
              { id: "participant-1", displayName: "Protected participant", protected: true, consents: [] },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([])));
    render(<VoyageLogConsentPanel voyageLogId="log-1" />);
    expect(
      await screen.findByText("Protected participants cannot be requested through this public-consent panel."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request publication consent" })).not.toBeInTheDocument();
  });
});
