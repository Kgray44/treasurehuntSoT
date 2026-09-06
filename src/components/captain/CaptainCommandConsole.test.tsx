import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainCommandConsole } from "./CaptainCommandConsole";

vi.mock("@/components/ui/ActionDialog", () => ({
  useActionDialog: () => ({ dialog: null, requestAction: vi.fn() }),
}));

function response(body: unknown) {
  return { ok: true, json: vi.fn().mockResolvedValue(body) } as unknown as Response;
}

const projection = {
  csrfToken: "csrf-token",
  voyage: {
    voyageName: "Lanternwake",
    chronicle: "The Moonlit Key",
    edition: "Edition one",
    lifecycle: "ACTIVE",
    operationalStatus: "ATTENTION_REQUIRED",
    concurrencyVersion: 4,
    computedAt: "2026-09-06T12:00:30.000Z",
    sourceUpdatedAt: "2026-09-06T12:00:00.000Z",
  },
  progress: {
    currentChapter: "The Lantern Room",
    currentCheckpoint: "Read the map",
    currentSequence: 12,
    pendingCaptain: false,
    pendingPlayer: true,
    providerWaiting: false,
  },
  commandConsole: {
    commands: [
      {
        id: "PAUSE_VOYAGE",
        label: "Pause Voyage",
        description: "Pause at the current safe boundary.",
        risk: "LOW",
        reversible: true,
        playersSeeResult: true,
        consequence: "The Crew sees the paused state.",
        warning: null,
        requiresConfirmation: false,
        requiresReason: false,
        target: "NONE",
      },
      {
        id: "RESTORE_PRIOR_PASSAGE",
        label: "Restore prior Passage",
        description: "Restore a prior published Passage.",
        risk: "HIGH",
        reversible: false,
        playersSeeResult: true,
        consequence: "The shared Voyage moves to the selected Passage.",
        warning: "This changes the shared Voyage.",
        requiresConfirmation: true,
        requiresReason: true,
        target: "NONE",
      },
    ],
    hintSummary: { available: 2, released: 1 },
    progressMap: [
      {
        id: "passage-1",
        chapterId: "chapter-1",
        chapterTitle: "The Lantern Room",
        title: "Read the map",
        blockType: "NARRATIVE",
        state: "CURRENT",
        outgoingCount: 1,
      },
    ],
  },
  attention: [],
  crew: [],
  resilience: {
    preflight: { state: "READY", checks: [] },
    recovery: {
      state: "HEALTHY",
      diagnosis: "No recovery is needed.",
      evidence: { sourceRevision: 4, observedAt: "now" },
      steps: [],
    },
  },
  events: [],
};

describe("CaptainCommandConsole", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps navigation separate from ordinary and authority actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(projection)));
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);

    expect(await screen.findByRole("heading", { name: "What you can do now" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Captain destinations" })).toHaveTextContent("Captain library");
    expect(screen.getByRole("button", { name: /Pause Voyage/ })).toHaveAttribute("data-action-tier", "ordinary");
    expect(screen.getByRole("button", { name: /Restore prior Passage/ })).toHaveAttribute(
      "data-action-tier",
      "authority",
    );
    expect(screen.getByText("Review consequence before confirming")).toBeVisible();
    expect(screen.getByText("Show progression map details")).toBeVisible();
  });
});
