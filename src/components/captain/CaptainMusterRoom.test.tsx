import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainMusterRoom } from "./CaptainMusterRoom";

class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener = vi.fn();
  close = vi.fn();
  constructor(public url: string) {}
}

const room = {
  csrfToken: "csrf-token",
  voyage: {
    id: "voyage-1",
    chronicle: "The Moonlit Key",
    voyageName: "Lanternwake",
    edition: "1",
    lifecycle: "READY",
    captainAuthorityState: "ASSIGNED",
    concurrencyVersion: 5,
    sourceUpdatedAt: "2026-07-19T12:00:00.000Z",
  },
  crew: [],
};

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("CaptainMusterRoom", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("makes a Captain-only Voyage readable and launchable without inventing Player membership", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, room))
      .mockResolvedValueOnce(response(200, {}))
      .mockResolvedValueOnce(response(200, { ...room, voyage: { ...room.voyage, lifecycle: "ACTIVE" } }));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    render(<CaptainMusterRoom voyageId="voyage-1" />);

    await screen.findByRole("heading", { name: "The Moonlit Key" });
    expect(screen.getByRole("heading", { name: "Captain-only Voyage" })).toBeInTheDocument();
    expect(screen.getByText(/No Player membership exists yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leave Waiting Room" })).toHaveAttribute("href", "/captain/library");
    expect(screen.queryByRole("button", { name: "Leave Voyage" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /Begin “Lanternwake”/ })).getByRole("button", {
        name: "Begin Voyage",
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/captain/playthroughs/voyage-1/launch",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ expectedVersion: 5 }) }),
      ),
    );
  });

  it("renders invitation, presence, readiness, and Captain-transfer affordances together", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(200, {
          ...room,
          crew: [
            {
              id: "captain-membership",
              displayName: "Kato",
              avatar: null,
              crewRole: "Navigator",
              membership: { status: "READY", joinedAt: null, completedAt: null, removedAt: null },
              presence: {
                state: "CONNECTED",
                lastSeenAt: "2026-07-19T12:00:00.000Z",
                activeDeviceCount: 1,
                safeActivity: "WAITING_ROOM",
              },
              synchronization: { state: "SYNCHRONIZED", lag: 0 },
              readiness: { state: "READY" },
              invitation: null,
              isCaptainsOwnPlayerMembership: true,
              canReceiveCaptaincy: false,
            },
            {
              id: "mira-membership",
              displayName: "Mira",
              avatar: null,
              crewRole: "Lookout",
              membership: { status: "INVITED", joinedAt: null, completedAt: null, removedAt: null },
              presence: {
                state: "STALE",
                lastSeenAt: "2026-07-19T11:00:00.000Z",
                activeDeviceCount: 0,
                safeActivity: null,
              },
              synchronization: { state: "UNKNOWN", lag: null },
              readiness: { state: "NOT_READY" },
              invitation: {
                id: "invitation-1",
                status: "SENT",
                expiresAt: "2099-07-19T12:00:00.000Z",
                canManage: true,
              },
              isCaptainsOwnPlayerMembership: false,
              canReceiveCaptaincy: true,
            },
          ],
        }),
      ),
    );
    render(<CaptainMusterRoom voyageId="voyage-1" />);

    expect(await screen.findByText("Invited — not joined")).toBeInTheDocument();
    expect(screen.getByText("Online and in sync")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend invitation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer Captaincy" })).toBeInTheDocument();
  });
});
