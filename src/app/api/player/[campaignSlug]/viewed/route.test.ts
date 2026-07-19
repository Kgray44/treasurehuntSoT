import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlayer: vi.fn(),
  findEvent: vi.fn(),
  findEvents: vi.fn(),
  findCeremony: vi.fn(),
  findCeremonies: vi.fn(),
  upsertCeremony: vi.fn(),
  upsertContent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/security", () => ({ requirePlayer: mocks.requirePlayer }));
vi.mock("@/lib/db", () => ({
  db: {
    progressEvent: { findFirst: mocks.findEvent, findMany: mocks.findEvents },
    viewedCeremony: {
      findUnique: mocks.findCeremony,
      findMany: mocks.findCeremonies,
      upsert: mocks.upsertCeremony,
    },
    viewedContent: { upsert: mocks.upsertContent },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "./route";
import { playerPresentationEventTypes } from "@/domain/visibility";

const context = { params: Promise.resolve({ campaignSlug: "lantern-test" }) };
const deviceId = "123e4567-e89b-42d3-a456-426614174000";

function request(body: unknown) {
  return new Request("http://localhost/api/player/lantern-test/viewed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function statusRequest(eventId = "event-123", clientDeviceId = deviceId) {
  const query = new URLSearchParams({ eventId, deviceId: clientDeviceId });
  return new Request(`http://localhost/api/player/lantern-test/viewed?${query}`);
}

function batchStatusRequest(eventIds: string[], clientDeviceId = deviceId) {
  const query = new URLSearchParams({ deviceId: clientDeviceId });
  for (const eventId of eventIds) query.append("eventIds", eventId);
  return new Request(`http://localhost/api/player/lantern-test/viewed?${query}`);
}

describe("/api/player/[campaignSlug]/viewed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlayer.mockResolvedValue({ id: "player-access-1", campaignId: "campaign-1" });
    mocks.findEvent.mockResolvedValue({ id: "event-123", type: "CHAPTER_RELEASED" });
    mocks.findEvents.mockResolvedValue([]);
    mocks.findCeremony.mockResolvedValue(null);
    mocks.findCeremonies.mockResolvedValue([]);
    mocks.upsertCeremony.mockResolvedValue({ id: "viewed-1" });
    mocks.upsertContent.mockResolvedValue({ id: "content-1" });
    mocks.transaction.mockResolvedValue([]);
  });

  it("rejects an invalid ceremony acknowledgement before reading event state", async () => {
    const response = await POST(request({ eventId: "short", deviceId: "also-short" }), context);

    expect(response.status).toBe(400);
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
  });

  it("fails closed before writing when the event is missing, cross-campaign, wrong-type, or unreleased", async () => {
    mocks.findEvent.mockResolvedValue(null);

    const response = await POST(request({ eventId: "event-123", deviceId }), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Presentation is not eligible for acknowledgement." });
    expect(mocks.findEvent).toHaveBeenCalledWith({
      where: {
        id: "event-123",
        campaignId: "campaign-1",
        type: { in: [...playerPresentationEventTypes] },
        releaseAt: { lte: expect.any(Date) },
      },
      select: { id: true, type: true },
    });
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
  });

  it("upserts an eligible released chapter ceremony with the existing idempotency key", async () => {
    const response = await POST(request({ eventId: "event-123", deviceId }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.upsertCeremony).toHaveBeenCalledWith({
      where: {
        campaignId_deviceId_eventId: {
          campaignId: "campaign-1",
          eventId: "event-123",
          deviceId,
        },
      },
      update: {},
      create: { campaignId: "campaign-1", eventId: "event-123", deviceId },
    });
  });

  it.each(playerPresentationEventTypes)("accepts the server-approved %s event family", async (type) => {
    mocks.findEvent.mockResolvedValue({ id: "event-123", type });

    const response = await POST(request({ eventId: "event-123", deviceId }), context);

    expect(response.status).toBe(200);
    expect(mocks.upsertCeremony).toHaveBeenCalledOnce();
  });

  it("keeps repeated eligible acknowledgements on the same composite upsert path", async () => {
    const body = { eventId: "event-123", deviceId };

    await POST(request(body), context);
    await POST(request(body), context);

    expect(mocks.upsertCeremony).toHaveBeenCalledTimes(2);
    expect(mocks.upsertCeremony.mock.calls[0][0].where).toEqual(mocks.upsertCeremony.mock.calls[1][0].where);
  });

  it("preserves the existing content-viewed transaction without event validation", async () => {
    const response = await POST(request({ contentType: "chapter", contentKeys: ["1", "2"] }), context);

    expect(response.status).toBe(200);
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.upsertContent).toHaveBeenCalledTimes(2);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it("does not expose event eligibility to an unauthenticated caller", async () => {
    mocks.requirePlayer.mockResolvedValue(null);

    const response = await POST(request({ eventId: "event-123", deviceId }), context);

    expect(response.status).toBe(401);
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
  });

  it("bounds ceremony identifiers and requires a client UUID before any database lookup", async () => {
    for (const body of [
      { eventId: "x".repeat(129), deviceId },
      { eventId: "event-123", deviceId: "device-123" },
    ]) {
      const response = await POST(request(body), context);
      expect(response.status).toBe(400);
    }

    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
  });

  it("reads persisted ceremony truth for the authorized campaign without mutating it", async () => {
    mocks.findCeremony.mockResolvedValue({ id: "viewed-1" });

    const response = await GET(statusRequest(), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ acknowledged: true });
    expect(mocks.findCeremony).toHaveBeenCalledWith({
      where: {
        campaignId_deviceId_eventId: { campaignId: "campaign-1", eventId: "event-123", deviceId },
      },
      select: { id: true },
    });
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("reports an eligible ceremony as pending without creating a viewed record", async () => {
    const response = await GET(statusRequest(), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ acknowledged: false });
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
  });

  it("fails closed on an ineligible status query without exposing cross-campaign state", async () => {
    mocks.findEvent.mockResolvedValue(null);

    const response = await GET(statusRequest(), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Presentation is not eligible for acknowledgement." });
    expect(mocks.findCeremony).not.toHaveBeenCalled();
  });

  it("reads a bounded authorized batch with one eligibility query and one viewed query", async () => {
    mocks.findEvents.mockResolvedValue([{ id: "event-123" }, { id: "event-456" }]);
    mocks.findCeremonies.mockResolvedValue([{ eventId: "event-456" }, { eventId: "event-123" }]);

    const response = await GET(batchStatusRequest(["event-456", "event-123"]), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ acknowledgedEventIds: ["event-123", "event-456"] });
    expect(mocks.findEvents).toHaveBeenCalledOnce();
    expect(mocks.findEvents).toHaveBeenCalledWith({
      where: {
        id: { in: ["event-456", "event-123"] },
        campaignId: "campaign-1",
        type: { in: [...playerPresentationEventTypes] },
        releaseAt: { lte: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(mocks.findCeremonies).toHaveBeenCalledOnce();
    expect(mocks.findCeremonies).toHaveBeenCalledWith({
      where: {
        campaignId: "campaign-1",
        deviceId,
        eventId: { in: ["event-123", "event-456"] },
      },
      select: { eventId: true },
    });
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.findCeremony).not.toHaveBeenCalled();
    expect(mocks.upsertCeremony).not.toHaveBeenCalled();
    expect(mocks.upsertContent).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("deduplicates and sorts batch receipts while excluding ineligible or cross-campaign identities", async () => {
    mocks.findEvents.mockResolvedValue([{ id: "event-456" }]);
    mocks.findCeremonies.mockResolvedValue([
      { eventId: "event-456" },
      { eventId: "event-456" },
      { eventId: "event-999" },
    ]);

    const response = await GET(batchStatusRequest(["event-999", "event-456", "event-456"]), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ acknowledgedEventIds: ["event-456"] });
    expect(mocks.findEvents.mock.calls[0]?.[0].where.id).toEqual({ in: ["event-999", "event-456"] });
    expect(mocks.findCeremonies.mock.calls[0]?.[0].where.eventId).toEqual({ in: ["event-456"] });
  });

  it("rejects malformed, ambiguous, empty, or oversized batches before any database read", async () => {
    const oversized = Array.from({ length: 101 }, (_, index) => `event-${String(index).padStart(3, "0")}`);
    const ambiguous = new URLSearchParams({ deviceId, eventId: "event-123", eventIds: "event-456" });
    const empty = new URLSearchParams({ deviceId, eventIds: "" });
    const requests = [
      new Request(`http://localhost/api/player/lantern-test/viewed?${empty}`),
      batchStatusRequest(["short"], deviceId),
      batchStatusRequest(["event-123"], "not-a-uuid"),
      batchStatusRequest(oversized, deviceId),
      new Request(`http://localhost/api/player/lantern-test/viewed?${ambiguous}`),
    ];

    for (const request of requests) {
      const response = await GET(request, context);
      expect(response.status).toBe(400);
    }

    expect(mocks.findEvents).not.toHaveBeenCalled();
    expect(mocks.findCeremonies).not.toHaveBeenCalled();
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.findCeremony).not.toHaveBeenCalled();
  });

  it("does not expose batch eligibility or acknowledgement state without Player access", async () => {
    mocks.requirePlayer.mockResolvedValue(null);

    const response = await GET(batchStatusRequest(["event-123", "event-456"]), context);

    expect(response.status).toBe(401);
    expect(mocks.findEvents).not.toHaveBeenCalled();
    expect(mocks.findCeremonies).not.toHaveBeenCalled();
  });
});
