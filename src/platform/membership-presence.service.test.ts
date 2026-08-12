import { beforeEach, describe, expect, it, vi } from "vitest";

const { membership, devices } = vi.hoisted(() => ({
  membership: { findFirst: vi.fn() },
  devices: { upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: { playthroughMembership: membership, membershipPresenceDevice: devices } }));

import { recordMembershipPresence } from "./membership-presence";

const input = {
  taleSessionId: "voyage-1",
  playerProfileId: "player-1",
  membershipId: "membership-1",
  deviceInstanceId: "550e8400-e29b-41d4-a716-446655440000",
  acknowledgedSequence: 3,
  safeActivity: "JOURNAL" as const,
};

describe("membership presence authorization and acknowledgement guards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a forged membership or cross-voyage target before persisting device evidence", async () => {
    membership.findFirst.mockResolvedValue(null);
    await expect(recordMembershipPresence(input)).rejects.toMatchObject({
      code: "MEMBERSHIP_UNAVAILABLE",
    });
    expect(membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "membership-1", playthroughId: "voyage-1", playerProfileId: "player-1" }),
      }),
    );
    expect(devices.upsert).not.toHaveBeenCalled();
  });

  it("rejects acknowledgements beyond the server sequence", async () => {
    membership.findFirst.mockResolvedValue({ id: "membership-1", playthrough: { currentSequence: 2 } });
    await expect(recordMembershipPresence(input)).rejects.toMatchObject({
      code: "FUTURE_SEQUENCE",
    });
    expect(devices.upsert).not.toHaveBeenCalled();
  });

  it("keeps acknowledgements monotonic while safely pruning only bounded member evidence", async () => {
    membership.findFirst.mockResolvedValue({ id: "membership-1", playthrough: { currentSequence: 3 } });
    devices.upsert.mockResolvedValue({ id: "device-row-1" });
    devices.findMany.mockResolvedValue([]);
    await expect(recordMembershipPresence(input)).resolves.toMatchObject({ currentSequence: 3 });
    expect(devices.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "device-row-1", acknowledgedSequence: { lte: 3 } } }),
    );
    expect(devices.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ playthroughMembershipId: "membership-1" }) }),
    );
  });
});
