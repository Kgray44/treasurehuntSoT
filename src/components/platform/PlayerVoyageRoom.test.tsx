import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { PlayerVoyageRoom } from "./PlayerVoyageRoom";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const motion = vi.hoisted(() => ({ mode: "reduced" as "full" | "gentle" | "reduced" }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: motion.mode, source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

class FakeEventSource {
  static current: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<() => void>>();
  close = vi.fn();
  constructor(public url: string) {
    FakeEventSource.current = this;
  }
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

const voyage = {
  id: "voyage-1",
  title: "The Moonlit Key",
  subtitle: null,
  voyageName: "Lanternwake",
  versionLabel: "1",
  status: "READY",
  state: "AWAITING_CAPTAIN",
  plannedStartAt: "2099-07-19T12:00:00.000Z",
  lastSynchronizedAt: "2026-07-19T12:00:00.000Z",
  primaryHref: "/player/playthroughs/voyage-1",
  primaryLabel: "Open waiting room",
  crew: [{ displayName: "Kato", crewRole: "Navigator", status: "READY" }],
  canEnter: false,
  runtimeHref: null as string | null,
};

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function body(nextVoyage = voyage) {
  return { playthrough: nextVoyage, serverTime: "2026-07-19T12:00:00.000Z" };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderRoom(onRouteHandoff?: (destination: string) => void | Promise<void>) {
  return render(
    <TestAuthority>
      <PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={onRouteHandoff} />
    </TestAuthority>,
  );
}

describe("PlayerVoyageRoom", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    sessionStorage.clear();
    FakeEventSource.current = null;
    motion.mode = "reduced";
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("renders truthful scheduled readiness with a dedicated launch host and fallback clasp", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body())));
    renderRoom();

    await screen.findByRole("heading", { name: "The Moonlit Key" });
    expect(screen.getByRole("timer")).toHaveTextContent(/d|h|m/);
    expect(document.querySelector('[data-scene-host-boundary="platform-ceremony"]')).toBeInTheDocument();
    expect(document.querySelector('[data-rive-interface="journal-clasp"]')).toHaveAttribute(
      "data-rive-fallback",
      "css-svg",
    );
    expect(document.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(2);
  });

  it("gives transiently overlapping waiting rooms independent launch hosts", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body())));
    render(
      <TestAuthority>
        <PlayerVoyageRoom playthroughId="voyage-1" />
        <PlayerVoyageRoom playthroughId="voyage-1" />
      </TestAuthority>,
    );

    await waitFor(() => expect(screen.getAllByRole("heading", { name: "The Moonlit Key" })).toHaveLength(2));
    expect(document.querySelectorAll('[data-scene-host-boundary="platform-ceremony"]')).toHaveLength(2);
  });

  it("distinguishes live, polling, and offline connection states without changing voyage truth", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body())));
    renderRoom();
    await screen.findByRole("heading", { name: "The Moonlit Key" });
    FakeEventSource.current?.onopen?.();
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "live"));
    expect(screen.getByRole("status").closest("dd")).not.toBeNull();

    FakeEventSource.current?.onerror?.();
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "polling"));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "offline"));
    expect(screen.getByRole("heading", { name: "The Moonlit Key" })).toBeInTheDocument();
  });

  it("reconciles a newly arrived crew member once while preserving unchanged token identity", async () => {
    const joined = { ...voyage, crew: [...voyage.crew, { displayName: "Mira", crewRole: "Lookout", status: "READY" }] };
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, body()))
        .mockResolvedValueOnce(response(200, body(joined)))
        .mockResolvedValueOnce(response(200, body(joined))),
    );
    renderRoom();
    await screen.findByText("Kato");

    FakeEventSource.current?.emit("progression");
    const mira = await screen.findByText("Mira");
    expect(screen.getByText("Mira joined the waiting crew.")).toBeInTheDocument();
    const token = mira.closest("li");
    FakeEventSource.current?.emit("progression");
    await waitFor(() => expect(screen.getByText("Mira").closest("li")).toBe(token));
  });

  it("starts the launch handoff only after an authoritative enterable response", async () => {
    const pending = deferred<Response>();
    const handoff = vi.fn();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(pending.promise));
    renderRoom(handoff);
    expect(handoff).not.toHaveBeenCalled();

    pending.resolve(
      response(
        200,
        body({ ...voyage, status: "ACTIVE", state: "IN_PROGRESS", canEnter: true, runtimeHref: "/play/voyage-1" }),
      ),
    );

    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/play/voyage-1"));
    expect(screen.getByRole("main")).toHaveAttribute("data-launch-state", "launch-ready");
  });

  it("preserves the authoritative launch handoff through live-channel reconciliation", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    motion.mode = "full";
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body(active))));
    renderRoom(handoff);

    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-launch-state", "launch-ready"));
    FakeEventSource.current?.onopen?.();
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "live"));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"), {
      timeout: 2_000,
    });
  });

  it("does not lose an authoritative progression event while an older load is pending", async () => {
    const stale = deferred<Response>();
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await waitFor(() => expect(FakeEventSource.current).not.toBeNull());

    FakeEventSource.current?.emit("progression");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("reconciles immediately when a backgrounded waiting room becomes visible after launch", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    let hidden = true;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("reconciles a backgrounded waiting room from its stream heartbeat after launch", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    motion.mode = "full";
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    FakeEventSource.current?.emit("heartbeat");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("keeps authoritative launch polling active while the waiting room is backgrounded", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    await act(async () => vi.advanceTimersByTimeAsync(5_000));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("does not defer an authoritative launch handoff behind a backgrounded ceremony", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    motion.mode = "full";
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body(active))));
    renderRoom(handoff);

    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("reconciles immediately when a waiting room regains focus after launch", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("reconciles a launched waiting room when focus precedes a delayed visibility update", async () => {
    const handoff = vi.fn();
    const active = {
      ...voyage,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      canEnter: true,
      runtimeHref: "/player/playthroughs/voyage-1/journal",
    };
    const hidden = true;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body()))
      .mockResolvedValueOnce(response(200, body(active)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom(handoff);
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1/journal"));
  });

  it("makes revocation terminal and removes reconnect controls", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body())));
    renderRoom();
    await screen.findByRole("heading", { name: "The Moonlit Key" });

    FakeEventSource.current?.emit("access-revoked");

    expect(await screen.findByRole("alert")).toHaveTextContent("revoked");
    expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "revoked");
    expect(screen.queryByRole("button", { name: "Reconnect and Refresh" })).not.toBeInTheDocument();
  });

  it("shows Succession Hold, commits only the selected route, and keeps ordinary leave distinct", async () => {
    const held = {
      ...voyage,
      status: "ACTIVE",
      state: "SUCCESSION_HOLD",
      canEnter: false,
      runtimeHref: null,
      concurrencyVersion: 7,
      captainAuthorityState: "VACANT",
      canTakeCaptaincy: true,
      canContinueSolo: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body(held)))
      .mockResolvedValueOnce(response(200, { voyageId: "solo-voyage-1", voyageName: "Lanternwake — solo" }));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom();

    expect(await screen.findByRole("heading", { name: "This Voyage needs a Captain" })).toBeInTheDocument();
    expect(screen.getAllByText("Succession Hold").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Take Captaincy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue Solo" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /Continue “Lanternwake” solo/ })).getByRole("button", {
        name: "Create Solo Voyage",
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/player/playthroughs/voyage-1/continue-solo",
        expect.objectContaining({ method: "POST", body: expect.stringContaining('"expectedVersion":7') }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Your solo Voyage is ready" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open solo Voyage" })).toHaveAttribute(
      "href",
      "/player/playthroughs/solo-voyage-1",
    );
    expect(navigation.push).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.flat().join(" ")).not.toContain("/leave");
  });

  it("uses the canonical leave mutation when a Player chooses Leave Voyage during Succession Hold", async () => {
    const held = {
      ...voyage,
      status: "ACTIVE",
      state: "SUCCESSION_HOLD",
      concurrencyVersion: 7,
      captainAuthorityState: "VACANT",
      canTakeCaptaincy: true,
      canContinueSolo: true,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body(held)))
      .mockResolvedValueOnce(response(200, { status: "LEFT" }));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom();

    await screen.findByRole("heading", { name: "This Voyage needs a Captain" });
    fireEvent.click(screen.getByRole("button", { name: "Leave Voyage" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /Leave “Lanternwake”/ })).getByRole("button", { name: "Leave Voyage" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/player/playthroughs/voyage-1/leave",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ expectedVersion: 7 }) }),
      ),
    );
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/player/library"));
  });

  it("gives a participating Captain a rich room and a direct launch without Captain-waiting language", async () => {
    const captaining = {
      ...voyage,
      concurrencyVersion: 4,
      viewer: { isCaptain: true, participationMode: "CAPTAIN_AND_PLAYER" as const, canLaunch: true },
      crew: [
        {
          id: "captain-membership",
          displayName: "Kato",
          crewRole: "Navigator",
          status: "READY",
          isCaptain: true,
          isCurrentPlayer: true,
          presence: {
            state: "CONNECTED",
            lastSeenAt: "2026-07-19T12:00:00.000Z",
            activeDeviceCount: 1,
            safeActivity: "WAITING_ROOM",
          },
          synchronization: { state: "SYNCHRONIZED", lag: 0 },
          readiness: { state: "READY" },
          invitation: null,
        },
        {
          id: "invited-membership",
          displayName: "Mira",
          crewRole: "Lookout",
          status: "INVITED",
          isCaptain: false,
          isCurrentPlayer: false,
          presence: { state: "UNKNOWN", lastSeenAt: null, activeDeviceCount: 0, safeActivity: null },
          synchronization: { state: "UNKNOWN", lag: null },
          readiness: { state: "NOT_READY" },
          invitation: { id: "invite-1", status: "SENT", expiresAt: "2099-07-20T12:00:00.000Z", canManage: true },
        },
      ],
    };
    const afterLaunch = {
      ...captaining,
      status: "ACTIVE",
      state: "IN_PROGRESS",
      viewer: { ...captaining.viewer, canLaunch: false },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, body(captaining)))
      .mockResolvedValueOnce(response(200, {}))
      .mockResolvedValueOnce(response(200, body(afterLaunch)));
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", fetchMock);
    renderRoom();

    await screen.findByRole("heading", { name: "The Moonlit Key" });
    expect(screen.getByText("Captain launch available")).toBeInTheDocument();
    expect(screen.queryByText("Awaiting Captain")).not.toBeInTheDocument();
    expect(screen.getByText("Invited — not joined")).toBeInTheDocument();
    expect(screen.getByText("Online and in sync")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leave Waiting Room" })).toHaveAttribute("href", "/player/library");
    expect(screen.getByRole("button", { name: "Leave Voyage" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: /Begin “Lanternwake”/ })).getByRole("button", {
        name: "Begin Voyage",
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/captain/playthroughs/voyage-1/launch",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ expectedVersion: 4 }) }),
      ),
    );
  });

  it("announces a Captain transfer once during live reconciliation", async () => {
    const before = {
      ...voyage,
      crew: [
        { id: "captain-membership", displayName: "Kato", crewRole: "Navigator", status: "READY", isCaptain: true },
        { id: "mira-membership", displayName: "Mira", crewRole: "Lookout", status: "READY", isCaptain: false },
      ],
    };
    const transferred = {
      ...before,
      crew: [
        { ...before.crew[0], isCaptain: false },
        { ...before.crew[1], isCaptain: true },
      ],
    };
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, body(before)))
        .mockResolvedValueOnce(response(200, body(transferred))),
    );
    renderRoom();
    await screen.findByText("Kato");

    FakeEventSource.current?.emit("progression");

    expect(await screen.findByText("Mira is now Captain.")).toBeInTheDocument();
    expect(screen.getAllByText("Captain").length).toBeGreaterThanOrEqual(1);
  });

  it("keeps revocation terminal when an in-flight load resolves after the access event", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(pending.promise));
    renderRoom();
    await waitFor(() => expect(FakeEventSource.current).not.toBeNull());

    FakeEventSource.current?.emit("access-revoked");
    pending.resolve(response(200, body()));

    expect(await screen.findByRole("alert")).toHaveTextContent("revoked");
    expect(screen.getByRole("link", { name: "Return to My Library" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconnect and Refresh" })).not.toBeInTheDocument();
  });
});
