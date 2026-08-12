import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const eventBus = {
    on: (channel: string, listener: (event: unknown) => void) => {
      listeners.set(channel, new Set([...(listeners.get(channel) ?? []), listener]));
    },
    off: (channel: string, listener: (event: unknown) => void) => listeners.get(channel)?.delete(listener),
    emit: (channel: string, event: unknown) => {
      for (const listener of listeners.get(channel) ?? []) listener(event);
    },
    listenerCount: (channel: string) => listeners.get(channel)?.size ?? 0,
    clear: () => listeners.clear(),
  };
  return {
    findMany: vi.fn(),
    authorize: vi.fn(),
    canAccess: vi.fn(),
    eventBus,
  };
});

vi.mock("@/lib/db", () => ({ db: { taleSessionEvent: { findMany: mocks.findMany } } }));
vi.mock("@/lib/events", () => ({ eventBus: mocks.eventBus }));
vi.mock("@/platform/auth", () => ({
  authorizeTaleSessionPlayer: mocks.authorize,
  playerCanAccessPlaythrough: mocks.canAccess,
}));

import { GET } from "./route";

const context = { params: Promise.resolve({ sessionId: "voyage-1" }) };
const channel = "tale-session:voyage-1";

describe("play-session event stream", () => {
  afterEach(() => {
    mocks.eventBus.clear();
    vi.clearAllMocks();
  });

  it("removes a canceled stream listener before later progression publication", async () => {
    mocks.authorize.mockResolvedValue({ kind: "identity", playerId: "player-1" });
    mocks.findMany.mockResolvedValue([]);
    const response = await GET(new Request("https://example.test/api/play/sessions/voyage-1/events"), context);
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    await reader!.read();
    await expect.poll(() => mocks.eventBus.listenerCount(channel)).toBe(1);

    await reader!.cancel();

    expect(mocks.eventBus.listenerCount(channel)).toBe(0);
    expect(() =>
      mocks.eventBus.emit(channel, {
        id: "event-1",
        eventType: "sessionLaunched",
        sequence: 2,
        createdAt: "2026-08-12T00:00:00.000Z",
      }),
    ).not.toThrow();
  });

  it("removes its listener when the request is aborted", async () => {
    mocks.authorize.mockResolvedValue({ kind: "identity", playerId: "player-1" });
    mocks.findMany.mockResolvedValue([]);
    const abort = new AbortController();
    const response = await GET(
      new Request("https://example.test/api/play/sessions/voyage-1/events", { signal: abort.signal }),
      context,
    );
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    await reader!.read();
    await expect.poll(() => mocks.eventBus.listenerCount(channel)).toBe(1);

    abort.abort();

    await expect.poll(() => mocks.eventBus.listenerCount(channel)).toBe(0);
  });
});
