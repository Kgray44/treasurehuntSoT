import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CurrentUserProvider, useCurrentUser } from "./CurrentUserProvider";

const authenticated = {
  contextVersion: "homeport.current-user.v1",
  status: "authenticated",
  authenticated: true,
  user: { accountId: "account-1", profileId: "profile-1", displayName: "Mara Tide", initials: "MT" },
  capabilities: {
    canUsePlayer: true,
    canUseCaptain: false,
    canUseCreator: false,
    canModerate: false,
    isAdministrator: false,
  },
  emailVerification: { status: "verified" },
  workspaces: ["public", "account", "community", "player"],
  session: { id: "session-1", expiresAt: "2030-01-01T00:00:00.000Z" },
  csrfToken: "csrf-client-value",
  revision: "revision-1",
};

const channels: TestChannel[] = [];
class TestChannel {
  postMessage = vi.fn();
  close = vi.fn();
  listener?: (event: MessageEvent) => void;
  constructor(readonly name: string) {
    channels.push(this);
  }
  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listener = listener;
  }
}

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function Probe() {
  const { state, refresh, invalidate } = useCurrentUser();
  return (
    <div>
      <output>{state.status === "authenticated" ? state.user.displayName : state.status}</output>
      <button onClick={() => void refresh()}>Refresh</button>
      <button onClick={() => void invalidate()}>Invalidate</button>
    </div>
  );
}

describe("CurrentUserProvider", () => {
  beforeEach(() => {
    channels.length = 0;
    vi.stubGlobal("BroadcastChannel", TestChannel);
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("homeport.context.failure-state replaces authenticated UI when refresh fails", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(authenticated)).mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetch);
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    expect(await screen.findByText("Mara Tide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invalidate" }));
    expect(await screen.findByText("unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Mara Tide")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("wayfarer-csrf")).toBeNull();
  });

  it("publishes non-production hydration and bootstrap state without identity data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({ contextVersion: "homeport.current-user.v1", status: "anonymous", authenticated: false }),
        ),
    );
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    expect(document.documentElement).toHaveAttribute("data-homeport-hydration", "complete");
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-homeport-current-user-state", "anonymous");
    expect(document.documentElement.outerHTML).not.toMatch(/account-1|csrf-client-value|session-1/u);
  });

  it("homeport.signout.multitab broadcasts only a versioned invalidation event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(authenticated)));
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    expect(await screen.findByText("Mara Tide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Invalidate" }));
    await waitFor(() => expect(channels[0]?.postMessage).toHaveBeenCalled());
    expect(channels[0]?.postMessage).toHaveBeenCalledWith({ type: "current-user-invalidated", version: 1 });
    expect(JSON.stringify(channels[0]?.postMessage.mock.calls)).not.toMatch(/account|session|csrf|token/i);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("homeport.current-user.no-stale-overwrite ignores an older request that finishes last", async () => {
    let resolveOlder!: (value: Response) => void;
    let resolveNewer!: (value: Response) => void;
    const older = new Promise<Response>((resolve) => {
      resolveOlder = resolve;
    });
    const newer = new Promise<Response>((resolve) => {
      resolveNewer = resolve;
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(response(authenticated))
      .mockReturnValueOnce(older)
      .mockReturnValueOnce(newer);
    vi.stubGlobal("fetch", fetch);
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    expect(await screen.findByText("Mara Tide")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    resolveNewer(response({ contextVersion: "homeport.current-user.v1", status: "anonymous", authenticated: false }));
    expect(await screen.findByText("anonymous")).toBeInTheDocument();
    resolveOlder(response({ ...authenticated, user: { ...authenticated.user, displayName: "Stale Name" } }));
    await waitFor(() => expect(screen.queryByText("Stale Name")).not.toBeInTheDocument());
    expect(screen.getByText("anonymous")).toBeInTheDocument();
  });

  it("homeport.context.failure-state rejects malformed server projections", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ authenticated: true, canUseCaptain: true })));
    render(
      <CurrentUserProvider>
        <Probe />
      </CurrentUserProvider>,
    );
    expect(await screen.findByText("unavailable")).toBeInTheDocument();
  });
});
