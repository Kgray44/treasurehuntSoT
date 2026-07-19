import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { PlayerVoyageRoom } from "./PlayerVoyageRoom";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

class FakeEventSource {
  static current: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<() => void>>();
  close = vi.fn();
  constructor(public url: string) { FakeEventSource.current = this; }
  addEventListener(name: string, listener: () => void) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
  }
  emit(name: string) { for (const listener of this.listeners.get(name) ?? []) listener(); }
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
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

function renderRoom(onRouteHandoff?: (destination: string) => void | Promise<void>) {
  return render(<TestAuthority><PlayerVoyageRoom playthroughId="voyage-1" onRouteHandoff={onRouteHandoff} /></TestAuthority>);
}

describe("PlayerVoyageRoom", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    FakeEventSource.current = null;
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
    expect(document.querySelector('[data-rive-interface="journal-clasp"]')).toHaveAttribute("data-rive-fallback", "css-svg");
    expect(document.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(2);
  });

  it("distinguishes live, polling, and offline connection states without changing voyage truth", async () => {
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, body())));
    renderRoom();
    await screen.findByRole("heading", { name: "The Moonlit Key" });
    FakeEventSource.current?.onopen?.();
    await waitFor(() => expect(screen.getByRole("main")).toHaveAttribute("data-connection-state", "live"));

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(200, body())).mockResolvedValueOnce(response(200, body(joined))).mockResolvedValueOnce(response(200, body(joined))));
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

    pending.resolve(response(200, body({ ...voyage, status: "ACTIVE", state: "IN_PROGRESS", canEnter: true, runtimeHref: "/play/voyage-1" })));

    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/play/voyage-1"));
    expect(screen.getByRole("main")).toHaveAttribute("data-launch-state", "launch-ready");
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
});
