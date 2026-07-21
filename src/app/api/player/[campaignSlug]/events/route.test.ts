import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientProgressEvent } from "@/domain/story";

type Listener = (event: ClientProgressEvent) => void;

const mocks = vi.hoisted(() => {
  const channels = new Map<string, Set<Listener>>();
  const bus = {
    on: vi.fn((channel: string, listener: Listener) => {
      const listeners = channels.get(channel) ?? new Set<Listener>();
      listeners.add(listener);
      channels.set(channel, listeners);
      return bus;
    }),
    off: vi.fn((channel: string, listener: Listener) => {
      channels.get(channel)?.delete(listener);
      return bus;
    }),
    emit(channel: string, event: ClientProgressEvent) {
      for (const listener of channels.get(channel) ?? []) listener(event);
    },
    listenerCount(channel: string) {
      return channels.get(channel)?.size ?? 0;
    },
    reset() {
      channels.clear();
      bus.on.mockClear();
      bus.off.mockClear();
    },
  };
  return {
    bus,
    requirePlayer: vi.fn(),
    findEvents: vi.fn(),
    findAccess: vi.fn(),
  };
});

vi.mock("@/lib/events", () => ({ eventBus: mocks.bus }));
vi.mock("@/lib/security", () => ({ requirePlayer: mocks.requirePlayer }));
vi.mock("@/lib/db", () => ({
  db: {
    progressEvent: { findMany: mocks.findEvents },
    playerAccess: { findFirst: mocks.findAccess },
  },
}));

import { GET } from "./route";
import {
  PLAYER_EVENT_DEDUPE_WINDOW_SIZE,
  PLAYER_EVENT_HEARTBEAT_MS,
  PLAYER_EVENT_HISTORY_PAGE_SIZE,
  PLAYER_EVENT_STREAM_HIGH_WATER_MARK,
} from "@/platform/player-event-stream";

const context = { params: Promise.resolve({ campaignSlug: "lantern-test" }) };
const channel = "campaign:campaign-1";

function storedEvent(sequence: number, overrides: Record<string, unknown> = {}) {
  const releaseAt = new Date(Date.UTC(2026, 6, 18, 12, 0, 0) + sequence * 1_000);
  return {
    id: `event-${sequence}`,
    type: "SIDE_QUEST_UPDATED",
    sequence,
    payload: JSON.stringify({ key: `quest-${sequence}`, objectiveOrdinal: sequence, internalNote: "secret" }),
    releaseAt,
    reversesEventId: null,
    supersededById: null,
    ...overrides,
  };
}

function clientEvent(sequence: number, overrides: Partial<ClientProgressEvent> = {}): ClientProgressEvent {
  const releaseAt = new Date(Date.UTC(2026, 6, 18, 12, 0, 0) + sequence * 1_000);
  return {
    id: `event-${sequence}`,
    type: "SIDE_QUEST_UPDATED",
    sequence,
    payload: { key: `quest-${sequence}`, objectiveOrdinal: sequence },
    releaseAt: releaseAt.toISOString(),
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, predicate: (text: string) => boolean) {
  const decoder = new TextDecoder();
  let text = "";
  for (let index = 0; index < 1_000; index += 1) {
    const result = await reader.read();
    if (result.done) return text;
    text += decoder.decode(result.value, { stream: true });
    if (predicate(text)) return text;
  }
  throw new Error(`Expected SSE output was not observed: ${text}`);
}

async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const result = await reader.read();
    if (result.done) return text;
    text += decoder.decode(result.value, { stream: true });
  }
}

function progressionEvents(text: string) {
  return [...text.matchAll(/data: (\{.*\})/g)].map((match) => JSON.parse(match[1]) as ClientProgressEvent);
}

describe("/api/player/[campaignSlug]/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bus.reset();
    mocks.requirePlayer.mockResolvedValue({ id: "access-1", campaignId: "campaign-1" });
    mocks.findEvents.mockResolvedValue([]);
    mocks.findAccess.mockResolvedValue({ id: "access-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthenticated callers before opening a campaign listener or querying history", async () => {
    mocks.requirePlayer.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/player/lantern-test/events"), context);

    expect(response.status).toBe(401);
    expect(mocks.findEvents).not.toHaveBeenCalled();
    expect(mocks.findAccess).not.toHaveBeenCalled();
    expect(mocks.bus.listenerCount(channel)).toBe(0);
  });

  it("subscribes before the history query, then deduplicates and orders durable/live overlap", async () => {
    const history = deferred<ReturnType<typeof storedEvent>[]>();
    mocks.findEvents.mockReturnValue(history.promise);
    const response = await GET(new Request("http://localhost/api/player/lantern-test/events?after=0"), context);
    const reader = response.body!.getReader();

    expect(mocks.bus.listenerCount(channel)).toBe(1);
    mocks.bus.emit(channel, clientEvent(2, { payload: { key: "quest-2", objectiveOrdinal: 2 } }));
    mocks.bus.emit(channel, clientEvent(3));
    history.resolve([storedEvent(2), storedEvent(1)]);

    const text = await readUntil(reader, (value) => (value.match(/event: progression/g) ?? []).length === 3);
    const ids = progressionEvents(text).map((event) => event.id);

    expect(ids).toEqual(["event-1", "event-2", "event-3"]);
    expect(ids.filter((id) => id === "event-2")).toHaveLength(1);
    expect(text).not.toContain("internalNote");
    expect(mocks.findEvents).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        sequence: { gt: 0 },
        releaseAt: { lte: expect.any(Date) },
      },
      orderBy: [{ sequence: "asc" }, { id: "asc" }],
      take: PLAYER_EVENT_HISTORY_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        sequence: true,
        payload: true,
        releaseAt: true,
        reversesEventId: true,
        supersededById: true,
      },
    });

    await reader.cancel();
    expect(mocks.bus.listenerCount(channel)).toBe(0);
  });

  it("continues bounded durable pages in strict sequence order without materializing the whole gap", async () => {
    const durable = Array.from({ length: PLAYER_EVENT_HISTORY_PAGE_SIZE * 2 + 5 }, (_, index) =>
      storedEvent(index + 1),
    );
    mocks.findEvents.mockImplementation(
      async ({ where, take }: { where: { sequence: { gt: number } }; take: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return durable.filter((event) => event.sequence > where.sequence.gt).slice(0, take);
      },
    );

    const response = await GET(new Request("http://localhost/api/player/lantern-test/events?after=0"), context);
    const reader = response.body!.getReader();
    const text = await readUntil(
      reader,
      (value) => (value.match(/event: progression/g) ?? []).length === durable.length,
    );
    const sequences = progressionEvents(text).map((event) => event.sequence);

    expect(sequences).toEqual(durable.map((event) => event.sequence));
    expect(mocks.findEvents).toHaveBeenCalledTimes(3);
    expect(mocks.findEvents.mock.calls.map(([query]) => query.where.sequence.gt)).toEqual([
      0,
      PLAYER_EVENT_HISTORY_PAGE_SIZE,
      PLAYER_EVENT_HISTORY_PAGE_SIZE * 2,
    ]);
    expect(mocks.findEvents.mock.calls.every(([query]) => query.take === PLAYER_EVENT_HISTORY_PAGE_SIZE)).toBe(true);
    await reader.cancel();
  });

  it("uses only the explicit delivery cursor and never treats earlier sequences as presentation acknowledgements", async () => {
    mocks.findEvents.mockResolvedValue([storedEvent(41), storedEvent(42)]);
    const request = new Request("http://localhost/api/player/lantern-test/events?after=41", {
      headers: { "last-event-id": "41" },
    });

    const response = await GET(request, context);
    const reader = response.body!.getReader();
    const text = await readUntil(reader, (value) => value.includes('"id":"event-42"'));

    expect(text).not.toContain('"id":"event-41"');
    expect(text).toContain('"id":"event-42"');
    expect(mocks.findEvents.mock.calls[0]?.[0].where.sequence).toEqual({ gt: 41 });
    await reader.cancel();
  });

  it("keeps old duplicate suppression safe after recent-ID eviction by retaining the delivered sequence cursor", async () => {
    const durable = Array.from({ length: PLAYER_EVENT_DEDUPE_WINDOW_SIZE + 5 }, (_, index) => storedEvent(index + 1));
    mocks.findEvents.mockImplementation(
      async ({ where, take }: { where: { sequence: { gt: number } }; take: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return durable.filter((event) => event.sequence > where.sequence.gt).slice(0, take);
      },
    );
    const response = await GET(new Request("http://localhost/api/player/lantern-test/events?after=0"), context);
    const reader = response.body!.getReader();
    await readUntil(reader, (value) => (value.match(/event: progression/g) ?? []).length === durable.length);

    mocks.bus.emit(channel, clientEvent(1));
    mocks.bus.emit(channel, clientEvent(durable.length + 1));
    const liveText = await readUntil(reader, (value) => value.includes(`"sequence":${durable.length + 1}`));
    const liveSequences = progressionEvents(liveText).map((event) => event.sequence);

    expect(liveSequences).toEqual([durable.length + 1]);
    await reader.cancel();
  });

  it("closes and cleans up on stream backpressure without marking the overflow event delivered", async () => {
    mocks.findEvents.mockResolvedValueOnce([storedEvent(1)]).mockResolvedValueOnce([storedEvent(66)]);
    const response = await GET(new Request("http://localhost/api/player/lantern-test/events?after=0"), context);
    const reader = response.body!.getReader();
    await readUntil(reader, (value) => value.includes('"sequence":1'));

    for (let sequence = 2; sequence <= PLAYER_EVENT_STREAM_HIGH_WATER_MARK + 2; sequence += 1) {
      mocks.bus.emit(channel, clientEvent(sequence));
    }
    expect(mocks.bus.listenerCount(channel)).toBe(0);
    const queued = progressionEvents(await readAll(reader));
    expect(queued.at(-1)?.sequence).toBe(PLAYER_EVENT_STREAM_HIGH_WATER_MARK + 1);
    expect(queued.some((event) => event.sequence === PLAYER_EVENT_STREAM_HIGH_WATER_MARK + 2)).toBe(false);

    const reconnectCursor = queued.at(-1)!.sequence;
    const reconnected = await GET(
      new Request("http://localhost/api/player/lantern-test/events", {
        headers: { "last-event-id": String(reconnectCursor) },
      }),
      context,
    );
    const reconnectReader = reconnected.body!.getReader();
    const reconnectText = await readUntil(reconnectReader, (value) =>
      value.includes(`"sequence":${PLAYER_EVENT_STREAM_HIGH_WATER_MARK + 2}`),
    );
    expect(progressionEvents(reconnectText).map((event) => event.sequence)).toEqual([
      PLAYER_EVENT_STREAM_HIGH_WATER_MARK + 2,
    ]);
    expect(mocks.findEvents.mock.calls.at(-1)?.[0].where.sequence).toEqual({ gt: reconnectCursor });
    await reconnectReader.cancel();
  });

  it("revalidates access, emits revocation, closes, and releases the listener", async () => {
    vi.useFakeTimers();
    mocks.findAccess.mockResolvedValueOnce({ id: "access-1" }).mockResolvedValueOnce(null);
    const response = await GET(new Request("http://localhost/api/player/lantern-test/events"), context);
    const reader = response.body!.getReader();

    await readUntil(reader, (value) => value.includes("tide connected"));
    await vi.advanceTimersByTimeAsync(PLAYER_EVENT_HEARTBEAT_MS);
    const text = await readUntil(reader, (value) => value.includes("event: access-revoked"));

    expect(text).toContain("event: access-revoked\ndata: {}");
    expect(mocks.findAccess).toHaveBeenCalledTimes(2);
    expect(mocks.bus.listenerCount(channel)).toBe(0);
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("releases the campaign listener on request abort and explicit stream cancellation", async () => {
    const abortController = new AbortController();
    const aborted = await GET(
      new Request("http://localhost/api/player/lantern-test/events", { signal: abortController.signal }),
      context,
    );
    const abortedReader = aborted.body!.getReader();
    expect(mocks.bus.listenerCount(channel)).toBe(1);

    abortController.abort();
    expect(mocks.bus.listenerCount(channel)).toBe(0);
    await readUntil(abortedReader, (value) => value.includes("tide connected"));
    await expect(abortedReader.read()).resolves.toEqual({ done: true, value: undefined });

    const cancelled = await GET(new Request("http://localhost/api/player/lantern-test/events"), context);
    const cancelledReader = cancelled.body!.getReader();
    expect(mocks.bus.listenerCount(channel)).toBe(1);
    await cancelledReader.cancel();
    expect(mocks.bus.listenerCount(channel)).toBe(0);
  });

  it("fails closed and releases the listener when durable history cannot be read", async () => {
    mocks.findEvents.mockRejectedValue(new Error("database unavailable"));
    const response = await GET(new Request("http://localhost/api/player/lantern-test/events"), context);
    const reader = response.body!.getReader();

    await expect(readUntil(reader, () => false)).rejects.toThrow("database unavailable");
    expect(mocks.bus.listenerCount(channel)).toBe(0);
  });
});
