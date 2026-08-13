import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ identity: vi.fn(), csrf: vi.fn(), rate: vi.fn(), record: vi.fn() }));
vi.mock("@/platform/auth", () => ({ requirePlayerIdentity: mocks.identity, verifyPlayerCsrf: mocks.csrf }));
vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.rate,
  rateLimitHeaders: () => ({ "x-rate-limit": "present" }),
}));
vi.mock("@/platform/membership-presence", async () => {
  const actual = await vi.importActual<typeof import("@/platform/membership-presence")>(
    "@/platform/membership-presence",
  );
  return { ...actual, recordMembershipPresence: mocks.record };
});

import { POST } from "./route";

const context = { params: Promise.resolve({ playthroughId: "voyage-1" }) };
const body = {
  membershipId: "membership-1",
  deviceInstanceId: "550e8400-e29b-41d4-a716-446655440000",
  acknowledgedSequence: 3,
  safeActivity: "JOURNAL",
};

describe("Player membership presence route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identity.mockResolvedValue({ playerProfileId: "player-1" });
    mocks.csrf.mockResolvedValue(true);
    mocks.rate.mockReturnValue({ allowed: true });
    mocks.record.mockResolvedValue({ recordedAt: "2026-08-10T20:00:00.000Z", currentSequence: 3 });
  });

  it("rejects unsigned and csrf-forged heartbeat requests before data access", async () => {
    mocks.identity.mockResolvedValue(null);
    expect(
      (await POST(new Request("https://example.test", { method: "POST", body: JSON.stringify(body) }), context)).status,
    ).toBe(401);
    mocks.identity.mockResolvedValue({ playerProfileId: "player-1" });
    mocks.csrf.mockResolvedValue(false);
    expect(
      (await POST(new Request("https://example.test", { method: "POST", body: JSON.stringify(body) }), context)).status,
    ).toBe(403);
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("binds a valid heartbeat to the current Player and requested Voyage", async () => {
    const response = await POST(
      new Request("https://example.test", {
        method: "POST",
        headers: { "x-csrf-token": "csrf" },
        body: JSON.stringify(body),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.record).toHaveBeenCalledWith({ taleSessionId: "voyage-1", playerProfileId: "player-1", ...body });
  });

  it("rejects malformed device, forged acknowledgement, and rate-limit abuse", async () => {
    expect(
      (
        await POST(
          new Request("https://example.test", {
            method: "POST",
            body: JSON.stringify({ ...body, deviceInstanceId: "raw-device" }),
          }),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          new Request("https://example.test", {
            method: "POST",
            body: JSON.stringify({ ...body, safeActivity: "TRACKING" }),
          }),
          context,
        )
      ).status,
    ).toBe(400);
    mocks.rate.mockReturnValue({ allowed: false });
    expect(
      (await POST(new Request("https://example.test", { method: "POST", body: JSON.stringify(body) }), context)).status,
    ).toBe(429);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
