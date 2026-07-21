import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const listeners = new Map<
    string,
    Set<(event: { id: string; eventType: string; sequence: number; createdAt: string }) => void>
  >();
  return {
    access: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    bus: {
      on: vi.fn(
        (
          channel: string,
          listener: (event: { id: string; eventType: string; sequence: number; createdAt: string }) => void,
        ) => {
          const values = listeners.get(channel) ?? new Set();
          values.add(listener);
          listeners.set(channel, values);
        },
      ),
      off: vi.fn(
        (
          channel: string,
          listener: (event: { id: string; eventType: string; sequence: number; createdAt: string }) => void,
        ) => {
          listeners.get(channel)?.delete(listener);
        },
      ),
      count: (channel: string) => listeners.get(channel)?.size ?? 0,
      reset: () => listeners.clear(),
    },
  };
});

vi.mock("@/compatibility/legacy-companion", () => ({ requireLegacyCompatibilityAccess: mocks.access }));
vi.mock("@/lib/events", () => ({ eventBus: mocks.bus }));
vi.mock("@/lib/db", () => ({ db: { taleSessionEvent: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));

import { GET } from "./route";
import { PLAYER_EVENT_HISTORY_PAGE_SIZE } from "@/platform/player-event-stream";

const context = { params: Promise.resolve({ campaignSlug: "legacy-voyage" }) };
const canonicalEvent = (sequence: number) => ({
  id: `event-${sequence}`,
  eventType: "CHAPTER_RELEASED",
  sequence,
  payload: JSON.stringify({ chapterId: "chapter-1" }),
  createdAt: new Date(Date.UTC(2026, 6, 21, 12, 0, sequence)),
});

async function readOne(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const result = await reader.read();
  return new TextDecoder().decode(result.value);
}

describe("legacy Player event adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.bus.reset();
    mocks.access.mockResolvedValue({ sessionId: "session-1", playerId: "player-1" });
    mocks.findMany.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it("fails closed before querying canonical history when the canonical membership is absent", async () => {
    mocks.access.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/player/legacy-voyage/events"), context);
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("replays the mapped Chronicle Session event stream using the legacy SSE envelope", async () => {
    mocks.findMany.mockResolvedValue([canonicalEvent(2), canonicalEvent(3)]);
    const response = await GET(new Request("http://localhost/api/player/legacy-voyage/events?after=1"), context);
    const reader = response.body!.getReader();
    const first = await readOne(reader);
    const second = await readOne(reader);
    expect(`${first}${second}`).toContain('"sequence":2');
    expect(`${first}${second}`).toContain('"sequence":3');
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { sessionId: "session-1", sequence: { gt: 1 } },
      orderBy: { sequence: "asc" },
      take: PLAYER_EVENT_HISTORY_PAGE_SIZE,
    });
    await reader.cancel();
  });

  it("uses the mapped Chronicle Session channel and releases it on cancellation", async () => {
    const response = await GET(new Request("http://localhost/api/player/legacy-voyage/events"), context);
    const reader = response.body!.getReader();
    expect(mocks.bus.count("tale-session:session-1")).toBe(1);
    await reader.cancel();
    expect(mocks.bus.count("tale-session:session-1")).toBe(0);
  });
});
