import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CaptainCommandConsole } from "./CaptainCommandConsole";

const requestAction = vi.hoisted(() => vi.fn());

vi.mock("@/components/ui/ActionDialog", () => ({
  useActionDialog: () => ({ dialog: null, requestAction }),
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
    requestAction.mockReset();
  });

  it("preserves Captain orientation while the authoritative projection is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);

    expect(screen.getByRole("heading", { name: "Preparing Captain console" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Captain console loading" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Reading live Voyage state.");
    expect(screen.queryByRole("button", { name: /Pause Voyage/ })).not.toBeInTheDocument();
  });

  it("keeps navigation separate from ordinary and authority actions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(projection)));
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);

    expect(await screen.findByRole("heading", { name: "What you can do now" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Captain destinations" })).toHaveTextContent(
      "Captain library",
    );
    expect(screen.getByRole("button", { name: /Pause Voyage/ })).toHaveAttribute(
      "data-action-tier",
      "ordinary",
    );
    expect(screen.getByRole("button", { name: /Restore prior Passage/ })).toHaveAttribute(
      "data-action-tier",
      "authority",
    );
    expect(screen.getByText("Review consequence before confirming")).toBeVisible();
    expect(screen.getByText("Show progression map details")).toBeVisible();
  });
  it("reviews the authoritative prepared command and cancels without committing", async () => {
    const command = projection.commandConsole.commands[1];
    const prepared = {
      command,
      target: null,
      currentState: {
        voyageName: projection.voyage.voyageName,
        lifecycle: "ACTIVE",
        expectedSequence: 31,
        chapter: "Canonical chapter",
        passage: "Canonical passage",
      },
    };
    requestAction.mockResolvedValue(null);
    const commits: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/commands/preview")) return Response.json(prepared);
        if (url.endsWith("/commands")) {
          commits.push(JSON.parse(String(init?.body)));
          return Response.json({});
        }
        return Response.json(projection);
      }),
    );
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);
    fireEvent.click(await screen.findByRole("button", { name: /Restore prior Passage/ }));
    await waitFor(() => expect(requestAction).toHaveBeenCalledTimes(1));
    expect(requestAction.mock.calls[0][0]).toMatchObject({
      title: "Restore prior Passage?",
      detail: expect.stringContaining("at revision 31"),
    });
    expect(requestAction.mock.calls[0][0].detail).toContain(command.consequence);
    expect(await screen.findByText("Prepared preview: Restore prior Passage at revision 31.")).toBeVisible();
    expect(commits).toEqual([]);
  });

  it("preserves the authoritative sequence and stable retry identity after a lost command response", async () => {
    const command = projection.commandConsole.commands[1];
    const prepared = {
      command,
      target: null,
      currentState: {
        voyageName: projection.voyage.voyageName,
        lifecycle: "ACTIVE",
        expectedSequence: 31,
        chapter: "Canonical chapter",
        passage: "Canonical passage",
      },
    };
    requestAction.mockResolvedValue({ reason: "Synthetic canonical recovery" });
    const commits: Array<{
      commandId: string;
      expectedSequence: number;
      idempotencyKey: string;
      confirmed: boolean;
      reason: string;
    }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/commands/preview")) return Response.json(prepared);
        if (url.endsWith("/commands")) {
          expect(init?.headers).toMatchObject({ "x-csrf-token": "csrf-token" });
          commits.push(JSON.parse(String(init?.body)));
          if (commits.length === 1) throw new Error("Synthetic lost response");
          return Response.json({ message: "Canonical command recorded." });
        }
        return Response.json(projection);
      }),
    );
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);
    fireEvent.click(await screen.findByRole("button", { name: /Restore prior Passage/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The command response was lost. Retry the same action to reconcile its authoritative result.",
    );
    const retry = screen.getByRole("button", { name: /Restore prior Passage/ });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    expect(await screen.findByRole("status")).toHaveTextContent("Canonical command recorded.");
    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      commandId: command.id,
      expectedSequence: 31,
      confirmed: true,
      reason: "Synthetic canonical recovery",
    });
    expect(commits[0].idempotencyKey).toMatch(/^[a-f0-9-]{36}$/i);
    expect(commits[1]).toEqual(commits[0]);
    expect(requestAction).toHaveBeenCalledTimes(2);
  });

  it("prepares a governed recovery step from the current command catalog", async () => {
    const command = projection.commandConsole.commands[0];
    const recoveryProjection = {
      ...projection,
      resilience: {
        ...projection.resilience,
        recovery: {
          ...projection.resilience.recovery,
          steps: [
            {
              id: "pause",
              label: "Pause safely",
              detail: "Review this current Voyage action.",
              commandId: command.id,
            },
          ],
        },
      },
    };
    const commits: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/commands/preview")) {
          expect(JSON.parse(String(init?.body))).toEqual({ commandId: command.id });
          return Response.json({ command, target: null, currentState: { expectedSequence: 37 } });
        }
        if (url.endsWith("/commands")) {
          commits.push(JSON.parse(String(init?.body)));
          return Response.json({ message: "Canonical recovery recorded." });
        }
        return Response.json(recoveryProjection);
      }),
    );
    render(<CaptainCommandConsole voyageId="voyage-1" authenticated />);
    fireEvent.click(await screen.findByRole("button", { name: "Prepare governed action" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Canonical recovery recorded.");
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ commandId: command.id, expectedSequence: 37, confirmed: false });
    expect(requestAction).not.toHaveBeenCalled();
  });
});
