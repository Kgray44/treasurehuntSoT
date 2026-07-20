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

const invitation = {
  id: "invite-1",
  playthroughId: "voyage-1",
  taleTitle: "The Moonlit Key",
  voyageName: "Lanternwake",
  versionLabel: "1",
  recipientName: "Kato",
  status: "VIEWED",
  tokenPrefix: "abcd",
  shortCodePrefix: "EFGH",
  expiresAt: "2099-07-19T12:00:00.000Z",
  viewedAt: "2026-07-19T12:00:00.000Z",
  acceptedAt: null,
  replacementId: null,
};

const tale = {
  id: "tale-1",
  title: "The Moonlit Key",
  subtitle: "A Lanternwake Chronicle",
  visibility: "PRIVATE",
  versions: [{ id: "version-1", label: "1", publishedAt: "2026-07-18T12:00:00.000Z", activeRunCount: 0 }],
};

function library(overrides: Record<string, unknown> = {}) {
  return {
    csrfToken: "csrf",
    groups: { needsAttention: [], activeVoyages: [], readyToLaunch: [readyVoyage], completedPlaythroughs: [] },
    invitations: [invitation],
    publishedTales: [tale],
    playerProfiles: [{ id: "player-1", displayName: "Kato", username: "kato" }],
    serverTime: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("CaptainLibrary motion and authority", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses one shared active tab plate and swaps semantic tab content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, library())));
    render(<CaptainLibrary />);
    await screen.findByRole("heading", { name: "Captain's Console" });

    expect(document.querySelectorAll(".platform-tab-plate")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Invitations/ }));

    expect(await screen.findByRole("heading", { name: "Crew invitations" })).toBeInTheDocument();
    expect(document.querySelectorAll(".platform-tab-plate")).toHaveLength(1);
  });

  it("shows an authoritative readiness gauge and holds launch pending until the server responds", async () => {
    const launch = deferred<Response>();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, library()))
        .mockReturnValueOnce(launch.promise)
        .mockResolvedValueOnce(
          response(
            200,
            library({
              groups: {
                needsAttention: [],
                activeVoyages: [readyVoyage],
                readyToLaunch: [],
                completedPlaythroughs: [],
              },
            }),
          ),
        ),
    );
    render(<CaptainLibrary />);
    expect(await screen.findByLabelText("100% of Crew ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Begin Voyage" }));

    expect(screen.getByRole("button", { name: "Beginning..." })).toBeDisabled();
    expect(screen.getByText("Recording this Voyage launch with the Captain’s Console.")).toBeInTheDocument();
    expect(screen.queryByText(/now live/)).not.toBeInTheDocument();
    launch.resolve(response(200, { ok: true }));

    expect(await screen.findByText(/now available to ready Crew/)).toBeInTheDocument();
  });

  it("settles a replaced row before revealing server-created replacement credentials", async () => {
    const replacement = deferred<Response>();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, library()))
        .mockReturnValueOnce(replacement.promise)
        .mockResolvedValueOnce(response(200, library())),
    );
    render(<CaptainLibrary />);
    await screen.findByRole("heading", { name: "Captain's Console" });
    fireEvent.click(screen.getByRole("button", { name: /Invitations/ }));
    const row = await screen.findByRole("row");

    fireEvent.click(within(row).getByRole("button", { name: "Replace invitation" }));
    expect(row).toHaveAttribute("data-invitation-transition", "replace-pending");
    expect(screen.queryByAltText(/QR code/)).not.toBeInTheDocument();
    replacement.resolve(
      response(200, {
        replacement: {
          id: "invite-2",
          recipientName: "Kato",
          link: "https://example.test/new",
          shortCode: "ABCD-EFGH",
          qrCodeDataUrl: "data:image/png;base64,AAAA",
          message: "New invitation",
          expiresAt: "2099-07-20T12:00:00.000Z",
        },
      }),
    );

    await waitFor(() => expect(row).toHaveAttribute("data-invitation-transition", "replaced"));
    expect(await screen.findByAltText(/QR code for Kato/)).toBeInTheDocument();
  });

  it("moves wizard focus by step while preserving entered values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, library())));
    render(<CaptainLibrary />);
    await screen.findByRole("heading", { name: "Captain's Console" });
    fireEvent.click(screen.getByRole("button", { name: "Create a Voyage" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /The Moonlit Key/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Configure Voyage" }));
    const title = await within(dialog).findByRole("heading", { name: "Configure Voyage" });
    await waitFor(() => expect(title).toHaveFocus());
    fireEvent.change(within(dialog).getByLabelText("Voyage name"), { target: { value: "Remember This Voyage" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Continue to Add Crew" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Back to Configure Voyage" }));

    expect(await within(dialog).findByDisplayValue("Remember This Voyage")).toBeInTheDocument();
  });
});
