// @sounding-line-registration owner=project-crossdeck suite=unit.crossdeck contracts=crossdeck.phase2.continuity
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
