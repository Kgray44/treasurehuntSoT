import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  findEvent: vi.fn(),
  findEvents: vi.fn(),
  findViewed: vi.fn(),
  findViewedMany: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/compatibility/legacy-companion", () => ({ requireLegacyCompatibilityAccess: mocks.access }));
vi.mock("@/lib/db", () => ({
  db: {
    taleSessionEvent: { findFirst: mocks.findEvent, findMany: mocks.findEvents },
    revealState: { findFirst: mocks.findViewed, findMany: mocks.findViewedMany, upsert: mocks.upsert },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "./route";

const context = { params: Promise.resolve({ campaignSlug: "legacy-voyage" }) };
const deviceId = "a5ac1c34-41ca-4d3c-849f-84939c950b60";
const eventId = "canonical-event-001";

describe("legacy Player acknowledgement adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({ sessionId: "session-1", playerId: "player-1" });
    mocks.findEvent.mockResolvedValue({ id: eventId, eventType: "CHAPTER_RELEASED" });
    mocks.upsert.mockResolvedValue({ id: "reveal-1" });
    mocks.transaction.mockResolvedValue([]);
  });

  it("fails closed before canonical lookups without a mapped Player membership", async () => {
    mocks.access.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/player/legacy-voyage/viewed", { method: "POST", body: "{}" }),
      context,
    );
    expect(response.status).toBe(401);
    expect(mocks.findEvent).not.toHaveBeenCalled();
  });

  it("rejects malformed acknowledgement input before canonical event lookup", async () => {
    const response = await POST(
      new Request("http://localhost/api/player/legacy-voyage/viewed", { method: "POST", body: "{}" }),
      context,
    );
    expect(response.status).toBe(400);
    expect(mocks.findEvent).not.toHaveBeenCalled();
  });

  it("writes a canonical RevealState acknowledgement for an eligible canonical event", async () => {
    const response = await POST(
      new Request("http://localhost/api/player/legacy-voyage/viewed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, deviceId }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          playthroughId: "session-1",
          contentType: "acknowledgement:event",
          revealedBy: "player-1",
        }),
      }),
    );
  });

  it("does not acknowledge a cross-session or ineligible event", async () => {
    mocks.findEvent.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/player/legacy-voyage/viewed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, deviceId }),
      }),
      context,
    );
    expect(response.status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("reads acknowledgement state from canonical RevealState", async () => {
    mocks.findViewed.mockResolvedValue({ id: "reveal-1" });
    const response = await GET(
      new Request(`http://localhost/api/player/legacy-voyage/viewed?eventId=${eventId}&deviceId=${deviceId}`),
      context,
    );
    await expect(response.json()).resolves.toEqual({ acknowledged: true });
    expect(mocks.findViewed).toHaveBeenCalled();
  });
});
