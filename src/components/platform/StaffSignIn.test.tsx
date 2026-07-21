import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { StaffSignIn } from "./StaffSignIn";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

function response(status: number, body = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderCaptain(onRouteHandoff?: (destination: string, signal: AbortSignal) => void | Promise<void>) {
  return render(
    <TestAuthority>
      <StaffSignIn intent="captain" authorized={false} signedIn={false} onRouteHandoff={onRouteHandoff} />
    </TestAuthority>,
  );
}

function submitCaptainSignIn() {
  renderCaptain();
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kato" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "development-captain-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Enter Captain's Console" }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("StaffSignIn", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("continues through the authoritative status check when a successful login response has no body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200, JSON.stringify({ captain: { authenticated: true } })));
    vi.stubGlobal("fetch", fetch);

    submitCaptainSignIn();

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/captain/library"));
    expect(navigation.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a recoverable error instead of throwing when a failed login response has no body", async () => {
    const fetch = vi.fn().mockResolvedValue(response(500));
    vi.stubGlobal("fetch", fetch);

    submitCaptainSignIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't sign you in. Check your details, then try again.",
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("restores the form after a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    submitCaptainSignIn();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Captain's Console could not be reached. Check that the app is running and try again.",
    );
    expect(screen.getByRole("button", { name: "Enter Captain's Console" })).toBeEnabled();
  });

  it("holds accepted state during delayed route handoff and ignores a repeated submit", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200, JSON.stringify({ captain: { authenticated: true } })));
    vi.stubGlobal("fetch", fetch);
    const route = deferred<void>();
    const handoff = vi.fn(() => route.promise);
    renderCaptain(handoff);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kato" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "development-captain-only" } });
    const form = screen.getByRole("button", { name: "Enter Captain's Console" }).closest("form")!;

    fireEvent.submit(form);

    expect(await screen.findByRole("status")).toHaveTextContent("Sign-in accepted");
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-state", "accepted");
    expect(screen.getByRole("button", { name: "Checking the ledger…" })).toBeDisabled();
    fireEvent.submit(form);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(handoff).toHaveBeenCalledOnce();

    route.resolve();
    await route.promise;
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-state", "accepted");
    await waitFor(() => expect(screen.getByRole("button", { name: "Enter Captain's Console" })).toBeEnabled());
  });

  it("restores focus and never retains success when route handoff fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200))
        .mockResolvedValueOnce(response(200, JSON.stringify({ captain: { authenticated: true } }))),
    );
    renderCaptain(() => Promise.reject(new Error("route failed")));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kato" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "development-captain-only" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter Captain's Console" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in succeeded, but Captain's Console could not be opened",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-auth-state", "rejected");
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveFocus());
  });

  it("aborts a pending staff login on unmount", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal as AbortSignal;
        return new Promise<Response>(() => undefined);
      }),
    );
    const view = renderCaptain();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kato" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "development-captain-only" } });
    fireEvent.click(screen.getByRole("button", { name: "Enter Captain's Console" }));
    await waitFor(() => expect(signal).toBeDefined());

    view.unmount();

    expect(signal?.aborted).toBe(true);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("keeps the staff form outside its registered decorative ceremony host", () => {
    renderCaptain();

    const host = document.querySelector<HTMLElement>('[data-scene-host-boundary="platform-ceremony"]');
    expect(host).toHaveAttribute("aria-hidden", "true");
    expect(host).toHaveStyle({ pointerEvents: "none" });
    expect(host?.querySelectorAll("[data-scene-target-id]")).toHaveLength(2);
    expect(host?.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(2);
    expect(host?.querySelector("[data-gsap-owned]")).toBeNull();
    expect(host?.querySelector("input, button, form, [role]")).toBeNull();
    expect(screen.getByLabelText("Username").closest("[data-scene-host-boundary]")).toBeNull();
  });
});
