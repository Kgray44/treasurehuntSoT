import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { PlayerSignIn } from "./PlayerSignIn";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/animation/motion/useMotionMode", () => ({ useMotionMode: () => ({ mode: "reduced" }) }));

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPlayer(onRouteHandoff?: (destination: string, signal: AbortSignal) => void | Promise<void>) {
  return render(
    <TestAuthority>
      <PlayerSignIn authenticated={false} onRouteHandoff={onRouteHandoff} />
    </TestAuthority>,
  );
}

function submitCredentials() {
  fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "sailor" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "safe-development-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Open my library" }));
}

describe("PlayerSignIn route handoff", () => {
  afterEach(() => {
    cleanup();
    history.replaceState(null, "", "/player/sign-in");
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("holds the accepted pose through a delayed route and does not snap back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {})));
    const route = deferred<void>();
    const handoff = vi.fn(() => route.promise);
    renderPlayer(handoff);

    submitCredentials();

    expect(await screen.findByRole("status")).toHaveTextContent("Player sign-in accepted");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("data-auth-state", "accepted");
    expect(screen.getByRole("button", { name: "Opening library…" })).toBeDisabled();
    expect(handoff).toHaveBeenCalledWith("/player/library", expect.any(AbortSignal));

    route.resolve();
    await route.promise;
    expect(main).toHaveAttribute("data-auth-state", "accepted");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open my library" })).toBeEnabled());
  });

  it("restores a stable focused form when route handoff fails after authentication", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, {})));
    renderPlayer(() => Promise.reject(new Error("route failed")));

    submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("could not complete");
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-state", "rejected");
    expect(screen.getByRole("button", { name: "Open my library" })).toBeEnabled();
    await waitFor(() => expect(screen.getByLabelText("Player name")).toHaveFocus());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("never flashes success for an authentication failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { error: "That Player account was refused." })));
    const handoff = vi.fn();
    renderPlayer(handoff);

    submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent("That Player account was refused.");
    expect(handoff).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-state", "rejected");
  });

  it("keeps repeated submissions single-flight while an accepted route is held", async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, {}));
    vi.stubGlobal("fetch", fetch);
    const route = deferred<void>();
    renderPlayer(() => route.promise);

    submitCredentials();
    expect(await screen.findByRole("status")).toBeVisible();
    fireEvent.submit(screen.getByRole("button", { name: "Opening library…" }).closest("form")!);

    expect(fetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-operation", "1");
    route.resolve();
  });

  it("aborts the authoritative request on unmount without navigation", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal as AbortSignal;
        return new Promise<Response>(() => undefined);
      }),
    );
    const view = renderPlayer();

    submitCredentials();
    await waitFor(() => expect(signal).toBeDefined());
    view.unmount();

    expect(signal?.aborted).toBe(true);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("keeps semantic forms outside the pointer-inert registered cinematic host", () => {
    renderPlayer();

    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="platform-ceremony"]');
    expect(host).toHaveAttribute("aria-hidden", "true");
    expect(host).toHaveStyle({ pointerEvents: "none" });
    expect(host?.querySelectorAll("[data-scene-target-id]")).toHaveLength(2);
    expect(host?.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(2);
    expect(host?.querySelector("[data-gsap-owned]")).toBeNull();
    expect(host?.querySelector("input, button, form, [role]")).toBeNull();
    expect(screen.getByLabelText("Player name").closest("[data-scene-host-boundary]")).toBeNull();
  });

  it("switches entry modes without discarding entered account data and moves focus", async () => {
    renderPlayer();
    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "remember-me" } });
    fireEvent.click(screen.getByRole("tab", { name: "Invitation code" }));
    await waitFor(() => expect(screen.getByLabelText("Short code")).toHaveFocus());
    fireEvent.change(screen.getByLabelText("Short code"), { target: { value: "ABCD-EFGH" } });
    fireEvent.click(screen.getByRole("tab", { name: "Player account" }));
    await waitFor(() => expect(screen.getByLabelText("Player name")).toHaveFocus());
    expect(screen.getByLabelText("Player name")).toHaveValue("remember-me");
  });

  it("clears stale account feedback when switching to invitation entry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { error: "That Player account was refused." })));
    renderPlayer();

    fireEvent.change(screen.getByLabelText("Player name"), { target: { value: "Anne" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Open my library" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That Player account was refused.");

    fireEvent.click(screen.getByRole("tab", { name: "Invitation code" }));
    expect(screen.queryByText("That Player account was refused.")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-async-state", "idle");
  });
});
