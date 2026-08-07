import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  state: {
    status: "authenticated",
    authenticated: true,
    revision: "revision-1",
    csrfToken: "csrf-token",
    user: { accountId: "account-1", displayName: "Synthetic Owner", initials: "SO" },
  },
}));

vi.mock("@/components/auth/CurrentUserProvider", () => ({
  useCurrentUser: () => ({ state: mocks.state, invalidate: mocks.invalidate }),
}));

import { WorkspaceCapabilityDashboard } from "./WorkspaceCapabilityDashboard";

const clearOverview = {
  accountState: "Active account",
  canSelfInitialize: true,
  activeChronicles: [],
  transitionLock: { state: "CLEAR", detail: "No active Player participation blocks a workspace transition." },
  workspaces: [
    { id: "PLAYER", label: "Player", state: "ACTIVE", href: "/player/library", detail: "Play Chronicles." },
    { id: "CAPTAIN", label: "Captain", state: "AVAILABLE", href: null, detail: "Guide Voyages." },
    { id: "CREATOR", label: "Creator", state: "AVAILABLE", href: null, detail: "Create Chronicles." },
  ],
};

describe("Project Homeport All Workspaces dashboard", () => {
  afterEach(() => {
    cleanup();
    mocks.invalidate.mockReset().mockResolvedValue({ status: "authenticated" });
    vi.unstubAllGlobals();
  });

  it("activates an available capability through the canonical CSRF mutation and refreshes account authority", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(clearOverview), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ state: "ACTIVATED", role: "CAPTAIN" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...clearOverview,
            workspaces: clearOverview.workspaces.map((workspace) =>
              workspace.id === "CAPTAIN" ? { ...workspace, state: "ACTIVE", href: "/captain/library" } : workspace,
            ),
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetch);
    render(<WorkspaceCapabilityDashboard />);

    fireEvent.click(await screen.findByRole("button", { name: "Activate Captain" }));
    expect(await screen.findByText("Captain workspace activated for this account.")).toBeInTheDocument();
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/account/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "csrf-token" },
      body: JSON.stringify({ action: "ACTIVATE", target: "CAPTAIN" }),
    });
    expect(mocks.invalidate).toHaveBeenCalledOnce();
    expect(await screen.findByRole("link", { name: "Enter Captain" })).toHaveAttribute("href", "/captain/library");
  });

  it("renders the active-Chronicle lock, keeps blocked transitions inert, and requires the exact safe-exit phrase", async () => {
    const locked = {
      ...clearOverview,
      activeChronicles: [
        {
          membershipId: "membership-1",
          playthroughId: "voyage-1",
          title: "The Moonlit Map",
          voyageName: "Moonlit Run",
          alias: "Night Cartographer",
          status: "ACTIVE_MEMBER",
          returnHref: "/play/moonlit-map/session/voyage-1",
        },
      ],
      transitionLock: {
        state: "BLOCKED_ACTIVE_PLAYER_CHRONICLE",
        detail: "Finish or safely leave active Player participation before switching.",
      },
      workspaces: clearOverview.workspaces.map((workspace) =>
        workspace.id === "PLAYER" ? workspace : { ...workspace, state: "BLOCKED", href: null },
      ),
    };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(locked), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(<WorkspaceCapabilityDashboard />);

    expect(await screen.findByRole("heading", { name: "Captain and Creator transitions are paused" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Return to Chronicle" })).toHaveAttribute(
      "href",
      "/play/moonlit-map/session/voyage-1",
    );
    expect(screen.queryByRole("link", { name: "Enter Captain" })).not.toBeInTheDocument();
    const leave = screen.getByRole("button", { name: "Safely leave active Chronicles" });
    expect(leave).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "leave active chronicles" } });
    expect(leave).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "LEAVE ACTIVE CHRONICLES" } });
    expect(leave).toBeEnabled();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
