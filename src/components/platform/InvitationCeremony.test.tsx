import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useMemo } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationAuthorityContext } from "@/animation/hosts/SceneHostContext";
import { SceneHostRegistry } from "@/animation/hosts/scene-host-registry";
import { InvitationCeremony } from "./InvitationCeremony";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const director = vi.hoisted(() => ({ play: vi.fn(), cancel: vi.fn(), skip: vi.fn() }));

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

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function renderInvitation(onRouteHandoff?: (destination: string, signal: AbortSignal) => void | Promise<void>) {
  return render(
    <TestAuthority>
      <InvitationCeremony onRouteHandoff={onRouteHandoff} />
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
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("resolves into the physical PIN-required invitation with a registered ceremony host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { invitation, csrfToken: "csrf" })));
    renderInvitation();

    const heading = await screen.findByRole("heading", { name: "The Moonlit Key" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByLabelText("Invitation PIN")).toBeInTheDocument();
    expect(screen.getByText("Invitation found. Enter its PIN to continue.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("data-invitation-state", "pin-required");
    expect(document.querySelector('[data-scene-host-boundary="access"]')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-runtime-boundary="gsap"]')).toHaveLength(5);
    expect(document.querySelector('[data-rive-interface="invitation-seal"]')).toHaveAttribute(
      "data-rive-fallback",
      "css-svg",
    );
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
