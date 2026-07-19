import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlayer: vi.fn(),
  findEvent: vi.fn(),
  findCeremony: vi.fn(),
  upsertCeremony: vi.fn(),
  upsertContent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/security", () => ({ requirePlayer: mocks.requirePlayer }));
vi.mock("@/lib/db", () => ({
  db: {
    progressEvent: { findFirst: mocks.findEvent },
    viewedCeremony: { findUnique: mocks.findCeremony, upsert: mocks.upsertCeremony },
    viewedContent: { upsert: mocks.upsertContent },
    $transaction: mocks.transaction,
  },
}));

import { GET, POST } from "./route";

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

describe("/api/player/[campaignSlug]/viewed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePlayer.mockResolvedValue({ id: "player-access-1", campaignId: "campaign-1" });
    mocks.findEvent.mockResolvedValue({ id: "event-123" });
    mocks.findCeremony.mockResolvedValue(null);
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
    await expect(response.json()).resolves.toEqual({ error: "Ceremony is not eligible for acknowledgement." });
    expect(mocks.findEvent).toHaveBeenCalledWith({
      where: {
        id: "event-123",
        campaignId: "campaign-1",
        type: "CHAPTER_RELEASED",
        releaseAt: { lte: expect.any(Date) },
      },
      select: { id: true },
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
    await expect(response.json()).resolves.toEqual({ error: "Ceremony is not eligible for acknowledgement." });
    expect(mocks.findCeremony).not.toHaveBeenCalled();
  });
});
