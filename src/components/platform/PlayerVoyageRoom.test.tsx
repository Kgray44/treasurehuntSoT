import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerVoyageRoom } from "./PlayerVoyageRoom";
import { FakeEventSource, member, mockNetwork, response, room } from "../muster/test-support";
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
const heading = () => screen.findByRole("heading", { name: "The Moonlit Key", level: 1 });
describe("PlayerVoyageRoom shared Muster", () => {
  it("shows Player copy and readiness without Captain commands", async () => {
    mockNetwork(() => room());
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    expect(screen.getByText("All set. Waiting for the Captain to begin.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-motion", "reduced");
    expect(screen.queryByRole("button", { name: "Relinquish Captaincy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel Voyage for Everyone" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crew Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Invite Crew" })).not.toBeInTheDocument();
    expect(document.querySelector(".muster-open-card")).toBeNull();
  });
  it("keeps offline and reconnect states separate from the last confirmed crew", async () => {
    mockNetwork(() => room());
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    act(() => FakeEventSource.current.onopen?.());
    expect(screen.getByText("Live", { exact: true })).toBeInTheDocument();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(screen.getByText("Offline", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Sera", { exact: true })).toBeInTheDocument();
  });
  it("reconciles a new crew member while keeping unchanged cards mounted", async () => {
    let state = room();
    mockNetwork(() => state);
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    const priorCard = screen.getByText("Sera", { exact: true }).closest("li");
    state = room({ crew: [member(), member({ id: "mira", displayName: "Mira", isCurrentPlayer: false })] });
    act(() => FakeEventSource.current.emit("changed"));
    await screen.findByText("Mira", { exact: true });
    expect(screen.getByText("Sera", { exact: true }).closest("li")).toBe(priorCard);
  });
  it("opens the journal only after an authoritative active projection", async () => {
    let state = room();
    mockNetwork(() => state);
    const handoff = vi.fn();
    render(<PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={handoff} />);
    await heading();
    expect(handoff).not.toHaveBeenCalled();
    state = room({
      viewer: { ...state.viewer, runtimeHref: "/player/playthroughs/voyage-1/journal" },
      voyage: { ...state.voyage, status: "ACTIVE" },
    });
    act(() => FakeEventSource.current.emit("changed"));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
    act(() => FakeEventSource.current.emit("heartbeat"));
    await waitFor(() => expect(handoff).toHaveBeenCalledTimes(1));
  });
  it.each(["heartbeat", "focus", "visibility"])("recovers a launched Voyage through %s", async (signal) => {
    let state = room();
    mockNetwork(() => state);
    const handoff = vi.fn();
    render(<PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={handoff} />);
    await heading();
    state = room({ viewer: { ...state.viewer, runtimeHref: "/journal" } });
    act(() => {
      if (signal === "heartbeat") FakeEventSource.current.emit("heartbeat");
      else if (signal === "focus") window.dispatchEvent(new Event("focus"));
      else {
        vi.spyOn(document, "hidden", "get").mockReturnValue(false);
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/journal"));
  });
  it("queues a newer event arriving while an older refresh is pending", async () => {
    let state = room();
    const fetchMock = mockNetwork(() => state);
    const handoff = vi.fn();
    render(<PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={handoff} />);
    await heading();
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/chat"))).toBe(true));
    await act(async () => {});
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    act(() => FakeEventSource.current.emit("changed"));
    state = room({ viewer: { ...state.viewer, runtimeHref: "/journal" } });
    act(() => FakeEventSource.current.emit("changed"));
    await act(async () => resolve(response(200, room())));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/journal"));
  });
  it("keeps revocation terminal when a pending response later claims launch is ready", async () => {
    const fetchMock = mockNetwork(() => room());
    const handoff = vi.fn();
    render(<PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={handoff} />);
    await heading();
    await act(async () => {});
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    act(() => FakeEventSource.current.emit("changed"));
    act(() => FakeEventSource.current.emit("access-revoked"));
    await act(async () => resolve(response(200, room({ viewer: { ...room().viewer, runtimeHref: "/journal" } }))));
    expect(screen.getByRole("heading", { name: "This room is unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh room" })).not.toBeInTheDocument();
    expect(handoff).not.toHaveBeenCalled();
  });
  it("keeps ordinary leave separate from Succession Hold takeover", async () => {
    const base = room();
    const fetchMock = mockNetwork(() =>
      room({
        voyage: { ...base.voyage, authorityState: "VACANT" },
        viewer: { ...base.viewer, canTakeCaptaincy: true },
      }),
    );
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    fireEvent.click(screen.getByText("Your Voyage options"));
    expect(screen.getByRole("button", { name: "Take Captaincy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave Voyage" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave Voyage" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/player/playthroughs/voyage-1/leave",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(fetchMock.mock.calls.some(([url]) => url.includes("/takeover"))).toBe(false);
  });
  it("projects a participating Captain identically on the Player entry route", async () => {
    const base = room();
    mockNetwork(() => room({ viewer: { ...base.viewer, isCaptain: true, canLaunch: true, canRelinquish: true } }));
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    expect(screen.getByRole("main")).toHaveAttribute("data-viewer-role", "captain-player");
    expect(screen.getByText("All set. Begin the Voyage when you're ready.")).toBeInTheDocument();
    expect(screen.queryByText("All set. Waiting for the Captain to begin.")).not.toBeInTheDocument();
  });
  it("announces a Captain transfer once and removes obsolete authority controls", async () => {
    const base = room();
    let state = room({ viewer: { ...base.viewer, isCaptain: true, canLaunch: true } });
    mockNetwork(() => state);
    render(<PlayerVoyageRoom playthroughId="voyage-1" />);
    await heading();
    state = room({ crew: [member({ isCaptain: true })] });
    act(() => FakeEventSource.current.emit("changed"));
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-viewer-role", "player"));
    expect(document.querySelector(".muster-announcements")).toHaveTextContent("Sera: Captain, ready.");
    expect(screen.queryByRole("button", { name: "Begin the Voyage" })).not.toBeInTheDocument();
  });
});
