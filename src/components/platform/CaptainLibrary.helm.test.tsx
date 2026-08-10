import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainLibrary } from "./CaptainLibrary";

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

const readyVoyage = {
  id: "voyage-1",
  taleTitle: "The Moonlit Key",
  voyageName: "Lanternwake",
  versionLabel: "1",
  status: "READY",
  plannedStartAt: null,
  lastActivityAt: "2026-07-19T12:00:00.000Z",
  currentSequence: 2,
  connected: true,
  pendingAction: null,
  players: [{ id: "player-1", displayName: "Kato", status: "READY" }],
};

const tale = {
  id: "tale-1",
  title: "The Moonlit Key",
  subtitle: "A Lanternwake Chronicle",
  visibility: "PRIVATE",
  versions: [{ id: "version-1", label: "1", publishedAt: "2026-07-18T12:00:00.000Z", activeRunCount: 0 }],
};

const captainOnlyParticipation = {
  voyageId: "voyage-1",
  accessState: "CAPTAIN_ONLY",
  hasCaptainAuthority: true,
  hasPlayerMembership: false,
  participationMode: "CAPTAIN_ONLY",
  playerMembershipId: null,
  canChangeParticipation: true,
  changeBlockedReason: null,
  voyageLifecycleState: "READY",
  playerPerspectiveAvailable: false,
  playerPerspectiveHref: null,
  presence: "UNKNOWN",
  concurrencyVersion: 2,
};

const captainPlayerParticipation = {
  ...captainOnlyParticipation,
  accessState: "CAPTAIN_AND_PLAYER",
  hasPlayerMembership: true,
  participationMode: "CAPTAIN_AND_PLAYER",
  playerMembershipId: "membership-1",
  playerPerspectiveAvailable: true,
  playerPerspectiveHref: "/player/playthroughs/voyage-1",
};

function library(overrides: Record<string, unknown> = {}) {
  return {
    csrfToken: "csrf",
    groups: { needsAttention: [], activeVoyages: [], readyToLaunch: [readyVoyage], completedPlaythroughs: [] },
    invitations: [],
    publishedTales: [tale],
    playerProfiles: [{ id: "player-1", displayName: "Kato", username: "kato" }],
    captainProfile: { id: "captain-profile-1", displayName: "Mara Tide", status: "ACTIVE" },
    serverTime: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("Project Helm Phase 1 Captain participation UI", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("defaults each new Voyage wizard to Captain only and presents an explicit opt-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, library())));
    render(<CaptainLibrary />);
    await screen.findByRole("heading", { name: "Captain's Console" });

    fireEvent.click(screen.getByRole("button", { name: "Create a Voyage" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /The Moonlit Key/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Configure Voyage" }));

    const captainOnly = await within(dialog).findByRole("radio", { name: /Captain only/ });
    const captainPlayer = await within(dialog).findByRole("radio", { name: /Captain \+ Player/ });
    expect(captainOnly).toBeChecked();
    expect(captainPlayer).not.toBeChecked();
    fireEvent.click(captainPlayer);
    expect(captainPlayer).toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "Close Voyage wizard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Create a Voyage" }));
    dialog = screen.getByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: /The Moonlit Key/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Configure Voyage" }));
    expect(await within(dialog).findByRole("radio", { name: /Captain only/ })).toBeChecked();
  });

  it("shows an ordinary Player View link only when the Captain has Player membership", async () => {
    const captainOnlyVoyage = { ...readyVoyage, participation: captainOnlyParticipation };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(
          200,
          library({
            groups: {
              needsAttention: [],
              activeVoyages: [],
              readyToLaunch: [captainOnlyVoyage],
              completedPlaythroughs: [],
            },
          }),
        ),
      ),
    );
    const view = render(<CaptainLibrary />);
    await screen.findByText("Captain only");
    expect(screen.queryByRole("link", { name: "Open Player View" })).not.toBeInTheDocument();

    view.unmount();
    vi.clearAllMocks();
    const captainPlayerVoyage = { ...readyVoyage, participation: captainPlayerParticipation };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response(
          200,
          library({
            groups: {
              needsAttention: [],
              activeVoyages: [],
              readyToLaunch: [captainPlayerVoyage],
              completedPlaythroughs: [],
            },
          }),
        ),
      ),
    );
    render(<CaptainLibrary />);
    const playerView = await screen.findByRole("link", { name: "Open Player View" });
    expect(playerView).toHaveAttribute("href", "/player/playthroughs/voyage-1");
  });

  it("reconciles a confirmed Player join without widening the Captain projection", async () => {
    const beforeVoyage = { ...readyVoyage, participation: captainOnlyParticipation };
    const afterVoyage = { ...readyVoyage, participation: captainPlayerParticipation };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response(
          200,
          library({
            groups: {
              needsAttention: [],
              activeVoyages: [],
              readyToLaunch: [beforeVoyage],
              completedPlaythroughs: [],
            },
          }),
        ),
      )
      .mockResolvedValueOnce(response(200, { participation: captainPlayerParticipation }))
      .mockResolvedValueOnce(
        response(
          200,
          library({
            groups: {
              needsAttention: [],
              activeVoyages: [],
              readyToLaunch: [afterVoyage],
              completedPlaythroughs: [],
            },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<CaptainLibrary />);

    fireEvent.click(await screen.findByRole("button", { name: "Join as Player" }));
    const confirmation = await screen.findByRole("dialog", { name: /Join.*Lanternwake.*as a Player/ });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Join as Player" }));

    expect(await screen.findByText("Captain + Player")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Player View" })).toHaveAttribute(
      "href",
      "/player/playthroughs/voyage-1",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/captain/playthroughs/voyage-1/participation",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": "csrf" },
      }),
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      mode: "CAPTAIN_AND_PLAYER",
      expectedVersion: 2,
    });
  });
});
