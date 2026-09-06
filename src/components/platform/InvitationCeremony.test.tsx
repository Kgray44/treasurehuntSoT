import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { invitationResolveTimeoutMs, InvitationCeremony } from "./InvitationCeremony";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const director = vi.hoisted(() => ({ play: vi.fn(), cancel: vi.fn(), skip: vi.fn() }));
const invalidateCurrentUser = vi.hoisted(() => vi.fn().mockResolvedValue({ status: "authenticated" }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));
vi.mock("@/animation/director/useAnimationDirector", () => ({
  useAnimationDirector: () => ({ director, snapshot: { isPlaying: false } }),
}));
vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ invalidate: invalidateCurrentUser }),
}));
vi.mock("@/components/animation/RiveStatefulObject", async () => {
  const React = await import("react");
  return {
    RiveStatefulObject: ({ onStatus }: { onStatus?: (status: "ready") => void }) => {
      React.useEffect(() => onStatus?.("ready"), [onStatus]);
      return <div data-animation-owner="rive" data-rive-runtime="ready" />;
    },
  };
});

function TestAuthority({ children }: { children: React.ReactNode }) {
  const hosts = useMemo(() => new SceneHostRegistry(), []);
  useEffect(() => () => hosts.destroy(), [hosts]);
  const authority = useMemo(() => ({ providerId: hosts.providerId, hosts, ownership: hosts.ownership }), [hosts]);
  return <AnimationAuthorityContext.Provider value={authority}>{children}</AnimationAuthorityContext.Provider>;
}

const invitation = {
  id: "invite-1",
  status: "VIEWED",
  recipientName: "Kato",
  expiresAt: "2099-07-19T12:00:00.000Z",
  requiresPin: true,
  playthrough: {
    id: "voyage-1",
    voyageName: "Lanternwake",
    status: "INVITING",
    plannedStartAt: null,
    scheduleTimezone: null,
    versionLabel: "Edition 1",
    tale: { title: "The Moonlit Key", subtitle: null, shortDescription: "Follow the lanterns.", coverUrl: null },
  },
};

const invitationWithoutPin = { ...invitation, requiresPin: false };

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderInvitation(
  onRouteHandoff?: (destination: string, signal: AbortSignal) => void | Promise<void>,
  onRouteRecovery?: (destination: string) => void,
) {
  return render(
    <TestAuthority>
      <InvitationCeremony onRouteHandoff={onRouteHandoff} onRouteRecovery={onRouteRecovery} />
    </TestAuthority>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("InvitationCeremony", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("resolves into the physical PIN-required invitation with a registered ceremony host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { invitation, csrfToken: "csrf" })));
    renderInvitation();

    const heading = await screen.findByRole("heading", { name: "The Moonlit Key" }, { timeout: 5_000 });
    await waitFor(() => expect(heading).toHaveFocus(), { timeout: 5_000 });
    expect(screen.getByLabelText("Invitation PIN")).toBeInTheDocument();
    expect(screen.getByText("Invitation found. Enter its PIN to continue.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "pin-required");
    expect(document.querySelector('[data-scene-host-boundary="access"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(5);
    expect(document.querySelector('[data-animation-owner="rive"]')).toHaveAttribute("data-rive-runtime", "ready");
  });

  it("retries one stalled invitation lookup instead of remaining in the resolving state", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockImplementationOnce(
        (_url: string, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Invitation lookup timed out", "AbortError")),
              { once: true },
            );
          }),
      )
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }));
    vi.stubGlobal("fetch", fetch);

    renderInvitation();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(invitationResolveTimeoutMs);
    });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "pin-required");
    expect(screen.getByLabelText("Invitation PIN")).toBeInTheDocument();
  });

  it("renders a distinct terminal state from an authoritative revoked result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(410, { error: "This invitation is no longer available.", code: "REVOKED" })),
    );
    renderInvitation();

    const heading = await screen.findByRole("heading", { name: "This invitation was locked by its Captain" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "revoked");
    expect(screen.getByText("What happened")).toBeInTheDocument();
    expect(screen.getByText("What you can do next")).toBeInTheDocument();
    expect(screen.getByText(/no longer grants access/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Player Entry" })).toBeInTheDocument();
  });

  it("does not enter accepted state or route until the server accepts the invitation", async () => {
    const accept = deferred<Response>();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
      .mockReturnValueOnce(accept.promise);
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(async (_scene, options) => {
      const result = await options.operation();
      options.finalStateRuntime?.holdSafePose("access-result-readable");
      return { outcome: "presented", finalSemanticState: "access-result-readable", operationResult: result };
    });
    const handoff = vi.fn();
    renderInvitation(handoff);
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "1234" } });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "pin-validating");
    expect(handoff).not.toHaveBeenCalled();
    accept.resolve(response(200, { ok: true, playthroughId: "voyage-1" }));
    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1", expect.any(AbortSignal)));
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "accepted");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Invitation accepted" })).toHaveAttribute("aria-busy", "false"),
    );
    expect(screen.getByRole("button", { name: "Invitation accepted" })).toBeDisabled();
  });

  it("pushes the accepted Player route without refreshing the spent invitation route", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
      .mockResolvedValueOnce(response(200, { ok: true, playthroughId: "voyage-1" }));
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(async (_scene, options) => {
      const result = await options.operation();
      options.finalStateRuntime?.holdSafePose("access-result-readable");
      return { outcome: "presented", finalSemanticState: "access-result-readable", operationResult: result };
    });
    renderInvitation();
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "1234" } });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/player/playthroughs/voyage-1"));
    expect(navigation.refresh).not.toHaveBeenCalled();
  });

  it("recovers with a document navigation when a soft handoff remains on invitation", async () => {
    window.history.replaceState({}, "", "/player/invitation");
    const recoverRoute = vi.fn();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
      .mockResolvedValueOnce(response(200, { ok: true, playthroughId: "voyage-1" }));
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(async (_scene, options) => {
      const result = await options.operation();
      options.finalStateRuntime?.holdSafePose("access-result-readable");
      return { outcome: "presented", finalSemanticState: "access-result-readable", operationResult: result };
    });
    renderInvitation(undefined, recoverRoute);
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "1234" } });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/player/playthroughs/voyage-1"));
    await waitFor(() => expect(recoverRoute).toHaveBeenCalledWith("/player/playthroughs/voyage-1"), {
      timeout: 3_000,
    });
  });

  it("routes after acceptance while shared context invalidation is still pending", async () => {
    const invalidation = deferred<{ status: "authenticated" }>();
    invalidateCurrentUser.mockReturnValueOnce(invalidation.promise);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
      .mockResolvedValueOnce(response(200, { ok: true, playthroughId: "voyage-1" }));
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(async (_scene, options) => {
      const result = await options.operation();
      options.finalStateRuntime?.holdSafePose("access-result-readable");
      return { outcome: "presented", finalSemanticState: "access-result-readable", operationResult: result };
    });
    const handoff = vi.fn();
    renderInvitation(handoff);
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "1234" } });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    await waitFor(() => expect(handoff).toHaveBeenCalledWith("/player/playthroughs/voyage-1", expect.any(AbortSignal)));
    expect(invalidateCurrentUser).toHaveBeenCalledTimes(1);
    invalidation.resolve({ status: "authenticated" });
  });

  it("starts the authoritative accept request even when presentation never invokes its operation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
      .mockResolvedValueOnce(response(200, { ok: true, playthroughId: "voyage-1" }));
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(() => new Promise(() => undefined));
    renderInvitation();
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "1234" } });
    expect(screen.getByRole("button", { name: "Accept and Join Voyage" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Decline Invitation" })).toHaveAttribute("type", "button");

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/invitations/accept");
  });

  it("starts the visible no-PIN accept request without waiting for presentation", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { invitation: invitationWithoutPin, csrfToken: "csrf" }))
      .mockResolvedValueOnce(response(200, { ok: true, playthroughId: "voyage-1" }));
    vi.stubGlobal("fetch", fetch);
    director.play.mockImplementation(() => new Promise(() => undefined));
    renderInvitation();
    await screen.findByRole("button", { name: "Accept and Join Voyage" });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/invitations/accept");
  });

  it("clears rejected PIN progress and restores the PIN-required state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, { invitation, csrfToken: "csrf" }))
        .mockResolvedValueOnce(response(400, { error: "The invitation PIN was not accepted.", code: "INVALID" })),
    );
    director.play.mockImplementation(async (_scene, options) => {
      await options.operation();
      return { outcome: "runtime-failed" };
    });
    renderInvitation();
    await screen.findByLabelText("Invitation PIN");
    fireEvent.change(screen.getByLabelText("Invitation PIN"), { target: { value: "9999" } });

    fireEvent.click(screen.getByRole("button", { name: "Accept and Join Voyage" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PIN was not accepted");
    expect(screen.getByLabelText("Invitation PIN")).toHaveValue("");
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "pin-required");
  });
});
