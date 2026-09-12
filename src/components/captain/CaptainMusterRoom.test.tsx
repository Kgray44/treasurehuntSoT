import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainMusterRoom } from "./CaptainMusterRoom";
import { member, mockNetwork, room } from "../muster/test-support";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("CaptainMusterRoom shared projection", () => {
  it("launches Captain-only through the canonical confirmed command without adding Player readiness", async () => {
    const base = room();
    const state = room({
      viewer: {
        ...base.viewer,
        isCaptain: true,
        participates: false,
        membershipId: null,
        canLaunch: true,
        canRelinquish: true,
        canLeave: false,
      },
      readiness: { ready: 0, total: 0, allReady: true },
      crew: [
        member({
          id: "captain",
          displayName: "Kato",
          isCaptain: true,
          isCurrentPlayer: false,
          participates: false,
          status: "CAPTAIN_ONLY",
          ready: false,
        }),
      ],
    });
    const fetchMock = mockNetwork(() => state);
    render(<CaptainMusterRoom voyageId="voyage-1" />);
    await screen.findByRole("heading", { level: 1, name: "The Moonlit Key" });
    expect(screen.getByRole("main")).toHaveAttribute("data-viewer-role", "captain-only");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0 of 0 Players ready");
    expect(screen.queryByRole("button", { name: "Leave Voyage" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Begin the Voyage" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Begin the Voyage" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/captain/playthroughs/voyage-1/launch",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ expectedVersion: 5 }) }),
      ),
    );
  });
  it("shows canonical invitation management and transfer only for eligible crew", async () => {
    const base = room();
    mockNetwork(() =>
      room({
        viewer: { ...base.viewer, isCaptain: true, canLaunch: true },
        crew: [
          member({ isCaptain: true, displayName: "Kato" }),
          member({
            id: "mira",
            displayName: "Mira",
            isCurrentPlayer: false,
            ready: false,
            status: "INVITED",
            participates: false,
            invitation: { id: "invite-1", canManage: true },
          }),
          member({ id: "joined", displayName: "Joined sailor", isCurrentPlayer: false, canReceiveCaptaincy: true }),
        ],
      }),
    );
    render(<CaptainMusterRoom voyageId="voyage-1" />);
    await screen.findByRole("heading", { level: 1, name: "The Moonlit Key" });
    fireEvent.click(screen.getByRole("button", { name: "Manage Mira" }));
    expect(screen.getByRole("button", { name: "Resend invitation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Transfer Captaincy" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Manage Joined sailor" }));
    expect(screen.getByRole("button", { name: "Transfer Captaincy" })).toBeInTheDocument();
  });
  it("requires destructive confirmation before cancelling everyone", async () => {
    const base = room();
    const fetchMock = mockNetwork(() => room({ viewer: { ...base.viewer, isCaptain: true, canRelinquish: true } }));
    render(<CaptainMusterRoom voyageId="voyage-1" />);
    await screen.findByRole("heading", { level: 1, name: "The Moonlit Key" });
    fireEvent.click(screen.getByText("Captain & Voyage options"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Voyage for Everyone" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("This cannot be undone.");
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/cancel"))).toBe(false);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/cancel"))).toBe(false);
  });
});
