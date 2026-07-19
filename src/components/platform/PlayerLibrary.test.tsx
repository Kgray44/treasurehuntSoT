import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerLibrary, type PlayerLibraryCard } from "./PlayerLibrary";

vi.mock("@/animation/motion/useMotionMode", () => ({
  useMotionMode: () => ({ mode: "reduced", source: "system", userOverride: null, setUserOverride: vi.fn() }),
}));

function card(id: string, title: string, state: string, overrides: Partial<PlayerLibraryCard> = {}): PlayerLibraryCard {
  return {
    id,
    title,
    subtitle: null,
    shortDescription: "A charted Tall Tale.",
    coverUrl: null,
    captainName: "Captain Kato",
    voyageName: "Lanternwake",
    state,
    status: "READY",
    pinned: false,
    versionLabel: "1",
    completionDate: null,
    plannedStartAt: null,
    currentChapterTitle: null,
    revealedChapterCount: 0,
    memoriesCollected: 0,
    lastSynchronizedAt: "2026-07-19T12:00:00.000Z",
    primaryHref: `/player/playthroughs/${id}`,
    primaryLabel: "Open Tall Tale",
    ...overrides,
  };
}

function library(
  overrides: Partial<
    Record<
      "invitations" | "awaitingCaptain" | "inProgress" | "completed" | "replayOrNewEdition" | "expiredOrRevoked",
      PlayerLibraryCard[]
    >
  > = {},
) {
  const groups = {
    invitations: [],
    awaitingCaptain: [],
    inProgress: [],
    completed: [],
    replayOrNewEdition: [],
    expiredOrRevoked: [],
    ...overrides,
  };
  return {
    player: { displayName: "Kato" },
    groups,
    total: Object.values(groups).reduce((count, cards) => count + cards.length, 0),
    serverTime: "2026-07-19T12:00:00.000Z",
    csrfToken: "csrf",
  };
}

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

describe("PlayerLibrary motion and authority", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reveals a new invitation once and preserves focus while collapsing its semantic group", async () => {
    const invite = card("invite-1", "The Moonlit Key", "INVITATIONS");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, library({ invitations: [invite] }))));
    render(<PlayerLibrary />);

    await screen.findByRole("heading", { name: "My Tall Tale Library" });
    expect(screen.getByText("New invitation")).toBeInTheDocument();
    const collapse = screen.getByRole("button", { name: "Invitations" });
    fireEvent.click(collapse);

    await waitFor(() => expect(screen.queryByRole("heading", { name: "The Moonlit Key" })).not.toBeInTheDocument());
    expect(collapse).toHaveFocus();
    expect(collapse).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps card identity stable across gallery/list layout and announces immediate search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response(
            200,
            library({ inProgress: [card("one", "Moon Key", "IN_PROGRESS"), card("two", "Sun Key", "IN_PROGRESS")] }),
          ),
        ),
    );
    render(<PlayerLibrary />);
    const moonHeading = await screen.findByRole("heading", { name: "Moon Key" });
    const originalCard = moonHeading.closest("article");

    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByRole("heading", { name: "Moon Key" }).closest("article")).toBe(originalCard);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Sun" } });

    expect(screen.getByText("1 Tall Tale result")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Moon Key" })).not.toBeInTheDocument());
  });

  it("moves a card to the pinned position only after the preference response succeeds", async () => {
    const first = card("one", "First Voyage", "IN_PROGRESS", { lastSynchronizedAt: "2026-07-19T13:00:00.000Z" });
    const second = card("two", "Second Voyage", "IN_PROGRESS", { lastSynchronizedAt: "2026-07-19T12:00:00.000Z" });
    let resolvePin!: (value: Response) => void;
    const pinResponse = new Promise<Response>((resolve) => {
      resolvePin = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, library({ inProgress: [first, second] })))
        .mockReturnValueOnce(pinResponse),
    );
    render(<PlayerLibrary />);
    await screen.findByRole("heading", { name: "First Voyage" });
    const group = screen.getByRole("heading", { name: "In Progress" }).closest("section")!;
    const secondCard = screen.getByRole("heading", { name: "Second Voyage" }).closest("article")!;

    fireEvent.click(within(secondCard).getByRole("button", { name: "Pin to top" }));
    expect(
      within(group)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["First Voyage", "Second Voyage"]);
    resolvePin(response(200, { ok: true }));

    await waitFor(() =>
      expect(
        within(group)
          .getAllByRole("heading", { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(["Second Voyage", "First Voyage"]),
    );
  });

  it("removes hidden history only after authority and provides a separate undo mutation", async () => {
    const completed = card("done", "Finished Voyage", "COMPLETED", { completionDate: "2026-07-18T12:00:00.000Z" });
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response(200, library({ completed: [completed] })))
        .mockResolvedValueOnce(response(200, { ok: true }))
        .mockResolvedValueOnce(response(200, { ok: true })),
    );
    render(<PlayerLibrary />);
    await screen.findByRole("heading", { name: "Finished Voyage" });

    fireEvent.click(screen.getByRole("button", { name: "Hide from library" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Finished Voyage" })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Undo hide" }));

    expect(await screen.findByRole("heading", { name: "Finished Voyage" })).toBeInTheDocument();
  });
});
