import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const tx = {
    playthroughMembership: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    membershipPresenceDevice: { updateMany: vi.fn() },
    taleSession: { findFirst: vi.fn(), update: vi.fn() },
    invitation: { updateMany: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (callback) => callback(tx)) } };
});

vi.mock("@/lib/db", () => ({ db: harness.db }));
vi.mock("@/chronicle/captain-authorization", () => ({
  captainAuthorityClauses: () => [{ captainAccountId: "captain-account" }],
}));

import { cancelVoyage, leaveVoyage, removeCrewMember } from "./lifecycle";

const actor = { accountId: "captain-account", legacyGameMasterId: "captain-legacy" } as never;

function resetHarness() {
  vi.clearAllMocks();
  harness.db.$transaction.mockImplementation(async (callback) => callback(harness.tx));
  for (const model of Object.values(harness.tx))
    for (const method of Object.values(model)) (method as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
}

describe("Helm A1 governed crew lifecycle", () => {
  beforeEach(resetHarness);

  it("treats a previously left Player membership as retry-safe before checking an obsolete version", async () => {
    harness.tx.playthroughMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      status: "LEFT",
      player: { accountId: "player-account" },
      playthrough: { status: "ACTIVE", concurrencyVersion: 7, captainAccountId: "captain-account" },
    });

    await expect(
      leaveVoyage({ voyageId: "voyage-1", playerProfileId: "player-1", expectedVersion: 2 }),
    ).resolves.toMatchObject({
      status: "LEFT",
      idempotent: true,
    });
    expect(harness.tx.playthroughMembership.update).not.toHaveBeenCalled();
  });

  it("removes a Crew member, invalidates active presence, and records an auditable outcome", async () => {
    harness.tx.taleSession.findFirst.mockResolvedValue({ id: "voyage-1", status: "ACTIVE", concurrencyVersion: 3 });
    harness.tx.playthroughMembership.findFirst.mockResolvedValue({
      id: "membership-2",
      status: "READY",
      player: { accountId: "player-account" },
    });

    await expect(
      removeCrewMember({ voyageId: "voyage-1", membershipId: "membership-2", actor, expectedVersion: 3 }),
    ).resolves.toMatchObject({
      status: "REMOVED",
      idempotent: false,
    });
    expect(harness.tx.membershipPresenceDevice.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ playthroughMembershipId: "membership-2" }) }),
    );
    expect(harness.tx.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "VOYAGE_CREW_MEMBER_REMOVED" }) }),
    );
  });

  it("cancels every active membership and makes a duplicate cancellation safe", async () => {
    harness.tx.taleSession.findFirst.mockResolvedValueOnce({
      id: "voyage-1",
      status: "ACTIVE",
      concurrencyVersion: 4,
      memberships: [
        { id: "membership-1", status: "READY" },
        { id: "membership-2", status: "LEFT" },
      ],
    });

    await expect(cancelVoyage({ voyageId: "voyage-1", actor, expectedVersion: 4 })).resolves.toMatchObject({
      status: "CANCELLED",
      idempotent: false,
    });
    expect(harness.tx.playthroughMembership.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["membership-1"] } },
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
    expect(harness.tx.invitation.updateMany).toHaveBeenCalled();

    harness.tx.taleSession.findFirst.mockResolvedValueOnce({
      id: "voyage-1",
      status: "CANCELLED",
      concurrencyVersion: 5,
      memberships: [],
    });
    await expect(cancelVoyage({ voyageId: "voyage-1", actor, expectedVersion: 4 })).resolves.toMatchObject({
      status: "CANCELLED",
      idempotent: true,
    });
  });
});
