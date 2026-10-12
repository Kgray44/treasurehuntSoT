// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CrossdeckHandoff } from "./CrossdeckHandoff";
import { storageKey } from "@/crossdeck/client";
import type { SyncSnapshot } from "@/crossdeck/sync-contracts";
const mocks = vi.hoisted(() => ({
  next: null as null | ((snapshot: SyncSnapshot) => void),
  failed: null as null | ((error: Error) => void),
  unsubscribe: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/crossdeck/transport", () => ({
  SyncTransportError: class extends Error {
    constructor(
      message: string,
      public status = 503,
    ) {
      super(message);
    }
  },
  createHttpSyncTransport: () => ({
    subscribe: (next: typeof mocks.next, failed: typeof mocks.failed) => {
      mocks.next = next;
      mocks.failed = failed;
      return mocks.unsubscribe;
    },
    send: mocks.send,
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.next = null;
  mocks.failed = null;
  sessionStorage.setItem(storageKey("voyage"), "surface");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ surfaces: [] }))));
});
it("aborts an in-flight command and ignores old session callbacks after replacement", async () => {
  const initial: SyncSnapshot = {
    revision: 2,
    nextSequence: 1,
    surfaceId: "surface",
    voyageId: "voyage",
    observedAt: new Date().toISOString(),
    focus: {},
    presentations: [],
    handoffs: [
      {
        id: "handoff",
        sourceId: "other",
        targetId: "surface",
        object: { family: "NOTE", objectId: "note", version: "version" },
        context: {},
        mode: "SEND_VIEW",
        title: "Private note",
        visibility: "PRIVATE",
        state: "OFFERED",
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    ],
  };
  let resolve!: (snapshot: SyncSnapshot) => void;
  mocks.send.mockImplementation(
    () =>
      new Promise<SyncSnapshot>((done) => {
        resolve = done;
      }),
  );
  const view = render(
    <CrossdeckHandoff voyageId="voyage" csrfToken="first" object={null} context={{}} resume={vi.fn()} />,
  );
  await act(async () => mocks.next!(initial));
  const obsolete = mocks.next!;
  fireEvent.click(screen.getByRole("button", { name: "Receive Private note" }));
  const commandSignal = mocks.send.mock.calls[0][1] as AbortSignal;
  view.rerender(<CrossdeckHandoff voyageId="voyage" csrfToken="second" object={null} context={{}} resume={vi.fn()} />);
  expect(commandSignal.aborted).toBe(true);
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  await act(async () => {
    obsolete(initial);
    resolve(initial);
  });
  expect(screen.queryByRole("button", { name: "Receive Private note" })).not.toBeInTheDocument();
  await act(async () => mocks.next!({ ...initial, revision: 3 }));
  expect(screen.getByRole("button", { name: "Receive Private note" })).toBeEnabled();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it("clears offers during a failed refresh and restores an unchanged authoritative reconnect snapshot", async () => {
  const snapshot: SyncSnapshot = {
    revision: 2,
    nextSequence: 1,
    surfaceId: "surface",
    voyageId: "voyage",
    observedAt: new Date().toISOString(),
    focus: {},
    presentations: [],
    handoffs: [
      {
        id: "handoff",
        sourceId: "other",
        targetId: "surface",
        object: { family: "NOTE", objectId: "note", version: "version" },
        context: {},
        mode: "SEND_VIEW",
        title: "Private note",
        visibility: "PRIVATE",
        state: "OFFERED",
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    ],
  };
  render(<CrossdeckHandoff voyageId="voyage" csrfToken="csrf" object={null} context={{}} resume={vi.fn()} />);
  await act(async () => mocks.next!(snapshot));
  expect(screen.getByRole("button", { name: "Receive Private note" })).toBeEnabled();
  await act(async () => mocks.failed!(new Error("Network interrupted")));
  expect(screen.queryByRole("button", { name: "Receive Private note" })).not.toBeInTheDocument();
  await act(async () => mocks.next!({ ...snapshot, observedAt: new Date().toISOString() }));
  expect(screen.getByRole("button", { name: "Receive Private note" })).toBeEnabled();
  expect(screen.getByRole("status")).toHaveTextContent("Connection restored");
  cleanup();
  expect(mocks.unsubscribe).toHaveBeenCalledOnce();
});

it("starts the canonical transport when contextual pairing registers this mounted screen", async () => {
  sessionStorage.removeItem(storageKey("voyage"));
  render(<CrossdeckHandoff voyageId="voyage" csrfToken="csrf" object={null} context={{}} resume={vi.fn()} />);
  expect(mocks.next).toBeNull();
  await act(async () => {
    sessionStorage.setItem(storageKey("voyage"), "surface");
    window.dispatchEvent(new Event("crossdeck-surface-changed"));
  });
  expect(mocks.next).toBeTypeOf("function");
});

it("does not acknowledge until the version-bound receiver presentation and rendered frame settle", async () => {
  let presented!: () => void;
  const resume = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        presented = resolve;
      }),
  );
  const object = { family: "NOTE" as const, objectId: "note", version: "published" };
  const snapshot: SyncSnapshot = {
    revision: 5,
    nextSequence: 2,
    surfaceId: "surface",
    voyageId: "voyage",
    observedAt: new Date().toISOString(),
    focus: {},
    presentations: [
      {
        object,
        title: "Released letter",
        visibility: "PRIVATE",
        custody: "other",
        focus: "surface",
        context: { blockId: "note" },
        views: { other: "MOVE_CUSTODY", surface: "SEND_VIEW" },
        revision: 5,
      },
    ],
    handoffs: [
      {
        id: "accepted",
        sourceId: "other",
        targetId: "surface",
        object,
        context: { blockId: "note" },
        mode: "SEND_VIEW",
        title: "Released letter",
        visibility: "PRIVATE",
        state: "COMMITTED",
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120000).toISOString(),
      },
    ],
  };
  mocks.send.mockResolvedValue({
    ...snapshot,
    revision: 6,
    handoffs: [{ ...snapshot.handoffs[0], state: "ACKNOWLEDGED" }],
  });
  render(<CrossdeckHandoff voyageId="voyage" csrfToken="csrf" object={null} context={{}} resume={resume} />);
  await act(async () => mocks.next!(snapshot));
  expect(resume).toHaveBeenCalledWith(object, { blockId: "note" }, { mode: "SEND_VIEW", readOnly: true });
  expect(mocks.send).not.toHaveBeenCalled();
  await act(async () => presented());
  await waitFor(() => expect(mocks.send).toHaveBeenCalledOnce());
  expect(mocks.send.mock.calls[0][0].payload).toEqual({ action: "acknowledge", handoffId: "accepted" });
});

it("keeps an explicit Journal purpose when an older artifact view remains recoverable", async () => {
  const resume = vi.fn();
  const object = { family: "ARTIFACT" as const, objectId: "compass", version: "published" };
  const snapshot: SyncSnapshot = {
    revision: 5,
    nextSequence: 2,
    surfaceId: "surface",
    voyageId: "voyage",
    observedAt: new Date().toISOString(),
    focus: {},
    presentations: [
      {
        object,
        title: "Compass",
        visibility: "PRIVATE",
        custody: "other",
        focus: "surface",
        context: {},
        views: { other: "MOVE_CUSTODY", surface: "SEND_VIEW" },
        revision: 5,
      },
    ],
    handoffs: [],
  };
  const view = render(
    <CrossdeckHandoff
      voyageId="voyage"
      csrfToken="csrf"
      object={null}
      context={{}}
      followingFamily="NOTE"
      resume={resume}
    />,
  );
  await act(async () => mocks.next!(snapshot));
  expect(resume).not.toHaveBeenCalled();
  expect(screen.getByText("Compass · Read-only companion view")).toBeInTheDocument();
  view.rerender(
    <CrossdeckHandoff
      voyageId="voyage"
      csrfToken="csrf"
      object={null}
      context={{}}
      followingFamily="ARTIFACT"
      resume={resume}
    />,
  );
  await act(async () => mocks.next!({ ...snapshot, revision: 6 }));
  await waitFor(() => expect(resume).toHaveBeenCalledWith(object, {}, { mode: "SEND_VIEW", readOnly: true }));
  expect(mocks.send).not.toHaveBeenCalled();
});
