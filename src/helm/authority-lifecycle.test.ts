import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const tx = {
    taleSession: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    playthroughMembership: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    voyageCaptainAuthorityReceipt: { findUnique: vi.fn(), create: vi.fn() },
    voyageForkLineage: { findUnique: vi.fn(), create: vi.fn() },
    taleSessionEvent: { createMany: vi.fn() },
    platformAuditEvent: { create: vi.fn() },
  };
  return { tx, db: { $transaction: vi.fn(async (callback) => callback(tx)) } };
});

vi.mock("@/lib/db", () => ({ db: harness.db }));
vi.mock("@/lib/security", () => ({ hashToken: () => "safe-token-hash", makeToken: () => "safe-token" }));
vi.mock("@/platform/audit", () => ({ safeAuditMetadata: (value: unknown) => value }));
vi.mock("@/chronicle/captain-authorization", () => ({
  captainAuthorityClauses: (actor: { accountId: string }) => [{ captainAccountId: actor.accountId }],
  hasCaptainAuthority: (session: { captainAccountId: string | null }, actor: { accountId: string }) =>
    session.captainAccountId === actor.accountId,
}));

import {
  HelmAuthorityError,
  continueSolo,
  relinquishCaptaincy,
  takeCaptaincy,
  transferCaptainAuthority,
} from "./authority-lifecycle";

const actor = { accountId: "captain-account", legacyGameMasterId: "captain-legacy" } as never;
const now = new Date("2026-08-26T12:00:00.000Z");

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    voyageId: "voyage-1",
    action: "CAPTAIN_TRANSFERRED",
    previousCaptainAccountId: "captain-account",
    nextCaptainAccountId: "player-account",
    authorityState: "ASSIGNED",
    sourceConcurrencyVersion: 7,
    sourceSequence: 21,
    idempotencyKey: "transfer-key-1",
    correlationId: "receipt-correlation",
    safeReason: null,
    committedAt: now,
    ...overrides,
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "voyage-1",
    status: "ACTIVE",
    concurrencyVersion: 7,
    captainAuthorityState: "ASSIGNED",
    captainAccountId: "captain-account",
    captainId: "captain-legacy",
    currentSequence: 21,
    memberships: [
      {
        id: "membership-captain",
        status: "ACTIVE_MEMBER",
        player: { accountId: "captain-account", displayName: "Current Captain" },
      },
      {
        id: "membership-player",
        status: "READY",
        player: { accountId: "player-account", displayName: "Safe Player" },
      },
    ],
    taleId: "tale-1",
    publishedVersionId: "edition-9",
    ownerLabel: "Original captain label",
    voyageName: "Shared Voyage",
    configuration: "{}",
    scheduleTimezone: "UTC",
    currentChapterId: "chapter-1",
    currentBlockId: "block-4",
    variables: '{"shared":"state"}',
    inventory: '["shared-artifact"]',
    events: [],
    ...overrides,
  };
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    id: "membership-player",
    status: "READY",
    crewRole: "Navigator",
    participationAlias: "Safe Player",
    participationAliasEditedAt: null,
    player: { accountId: "player-account", displayName: "Safe Player" },
    playthrough: session(),
    ...overrides,
  };
}

function resetHarness() {
  vi.clearAllMocks();
  harness.db.$transaction.mockImplementation(async (callback) => callback(harness.tx));
  for (const model of Object.values(harness.tx))
    for (const method of Object.values(model)) (method as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
  harness.tx.voyageCaptainAuthorityReceipt.findUnique.mockResolvedValue(null);
  harness.tx.voyageForkLineage.findUnique.mockResolvedValue(null);
  harness.tx.taleSession.updateMany.mockResolvedValue({ count: 1 });
  harness.tx.voyageCaptainAuthorityReceipt.create.mockImplementation(async (input) => receipt(input.data));
  harness.tx.voyageForkLineage.create.mockImplementation(async (input) => ({
    id: "lineage-1",
    createdAt: now,
    ...input.data,
  }));
  harness.tx.taleSession.create.mockResolvedValue({ id: "solo-voyage-1", voyageName: "Shared Voyage — solo" });
}

describe("Helm A2 Captain authority and solo lineage", () => {
  beforeEach(resetHarness);

  it("transfers authority atomically without touching either Player membership", async () => {
    harness.tx.taleSession.findUnique.mockResolvedValue(session());

    await expect(
      transferCaptainAuthority("voyage-1", actor, {
        recipientMembershipId: "membership-player",
        expectedVersion: 7,
        idempotencyKey: "transfer-key-1",
      }),
    ).resolves.toMatchObject({
      action: "CAPTAIN_TRANSFERRED",
      nextCaptainAccountId: "player-account",
      idempotent: false,
    });

    expect(harness.tx.taleSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "voyage-1",
          concurrencyVersion: 7,
          captainAuthorityState: "ASSIGNED",
          OR: [{ captainAccountId: "captain-account" }],
        }),
        data: expect.objectContaining({ captainAccountId: "player-account", concurrencyVersion: { increment: 1 } }),
      }),
    );
    expect(harness.tx.playthroughMembership.create).not.toHaveBeenCalled();
    expect(harness.tx.playthroughMembership.update).not.toHaveBeenCalled();
    expect(harness.tx.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "VOYAGE_CAPTAIN_TRANSFERRED" }) }),
    );
  });

  it("makes direct transfer retry-safe only after the caller is still authorized", async () => {
    harness.tx.taleSession.findUnique.mockResolvedValue(session());
    harness.tx.voyageCaptainAuthorityReceipt.findUnique.mockResolvedValue(receipt());

    await expect(
      transferCaptainAuthority("voyage-1", actor, {
        recipientMembershipId: "membership-player",
        expectedVersion: 1,
        idempotencyKey: "transfer-key-1",
      }),
    ).resolves.toMatchObject({ idempotent: true });
    expect(harness.tx.taleSession.updateMany).not.toHaveBeenCalled();

    harness.tx.taleSession.findUnique.mockResolvedValue(null);
    await expect(
      transferCaptainAuthority("voyage-1", actor, {
        recipientMembershipId: "membership-player",
        expectedVersion: 7,
        idempotencyKey: "transfer-key-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
  });

  it("relinquishes Captaincy into Succession Hold rather than cancelling the Voyage", async () => {
    harness.tx.taleSession.findUnique.mockResolvedValue(session());
    harness.tx.voyageCaptainAuthorityReceipt.create.mockImplementation(async (input) =>
      receipt({ ...input.data, action: "CAPTAIN_RELINQUISHED", authorityState: "VACANT" }),
    );

    await expect(
      relinquishCaptaincy("voyage-1", actor, { expectedVersion: 7, idempotencyKey: "relinquish-key-1" }),
    ).resolves.toMatchObject({ action: "CAPTAIN_RELINQUISHED", authorityState: "VACANT" });
    expect(harness.tx.taleSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ captainAccountId: null, captainAuthorityState: "VACANT" }),
      }),
    );
    expect(harness.tx.platformAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "VOYAGE_CAPTAIN_RELINQUISHED" }) }),
    );
  });

  it("accepts only the first committed takeover when Players act concurrently", async () => {
    harness.tx.playthroughMembership.findFirst.mockResolvedValue(
      membership({ playthrough: session({ captainAuthorityState: "VACANT", captainAccountId: null }) }),
    );
    harness.tx.taleSession.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      takeCaptaincy("voyage-1", { playerProfileId: "player-1", expectedVersion: 7, idempotencyKey: "take-key-1" }),
    ).rejects.toSatisfy((cause: unknown) => cause instanceof HelmAuthorityError && cause.code === "STALE_STATE");
    expect(harness.tx.taleSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          captainAuthorityState: "VACANT",
          captainAccountId: null,
          concurrencyVersion: 7,
        }),
      }),
    );
    expect(harness.tx.voyageCaptainAuthorityReceipt.create).not.toHaveBeenCalled();
  });

  it("creates an independent, same-edition solo fork with explicit lineage and no private Player copies", async () => {
    const safeEvent = {
      id: "shared-event",
      eventType: "blockCompleted",
      blockId: "block-3",
      payload: '{"shared":true}',
      sequence: 20,
      createdAt: now,
    };
    const privateEvent = {
      id: "private-event",
      eventType: "privateReflection",
      blockId: "block-private",
      payload: "PRIVATE_PLAYER_CANARY",
      sequence: 21,
      createdAt: now,
    };
    harness.tx.playthroughMembership.findFirst.mockResolvedValue(
      membership({ playthrough: session({ events: [safeEvent, privateEvent] }) }),
    );

    await expect(
      continueSolo("voyage-1", { playerProfileId: "player-1", expectedVersion: 7, idempotencyKey: "solo-key-1" }),
    ).resolves.toMatchObject({ voyageId: "solo-voyage-1", parentVoyageId: "voyage-1", sourceSequence: 21 });

    expect(harness.tx.taleSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publishedVersionId: "edition-9",
          currentBlockId: "block-4",
          currentSequence: 21,
          variables: '{"shared":"state"}',
          inventory: '["shared-artifact"]',
        }),
      }),
    );
    expect(harness.tx.taleSessionEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ eventType: "blockCompleted", payload: '{"shared":true}' })],
      }),
    );
    expect(JSON.stringify(harness.tx.taleSessionEvent.createMany.mock.calls)).not.toContain("PRIVATE_PLAYER_CANARY");
    expect(harness.tx.voyageForkLineage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentVoyageId: "voyage-1", childVoyageId: "solo-voyage-1" }),
      }),
    );
    expect(harness.tx.taleSession.updateMany).not.toHaveBeenCalled();
  });

  it("allows two Players to create independent forks from the same committed shared version", async () => {
    const first = membership({ player: { accountId: "player-one-account", displayName: "Player One" } });
    const second = membership({ player: { accountId: "player-two-account", displayName: "Player Two" } });
    harness.tx.playthroughMembership.findFirst.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    harness.tx.taleSession.create.mockResolvedValueOnce({ id: "solo-one", voyageName: "Shared Voyage — solo" });
    harness.tx.taleSession.create.mockResolvedValueOnce({ id: "solo-two", voyageName: "Shared Voyage — solo" });
    harness.tx.voyageForkLineage.create.mockImplementationOnce(async (input) => ({
      ...input.data,
      childVoyageId: "solo-one",
    }));
    harness.tx.voyageForkLineage.create.mockImplementationOnce(async (input) => ({
      ...input.data,
      childVoyageId: "solo-two",
    }));

    const [one, two] = await Promise.all([
      continueSolo("voyage-1", { playerProfileId: "player-one", expectedVersion: 7, idempotencyKey: "solo-one-key" }),
      continueSolo("voyage-1", { playerProfileId: "player-two", expectedVersion: 7, idempotencyKey: "solo-two-key" }),
    ]);

    expect([one.voyageId, two.voyageId].sort()).toEqual(["solo-one", "solo-two"]);
    expect(harness.tx.taleSession.updateMany).not.toHaveBeenCalled();
    expect(harness.tx.voyageForkLineage.create).toHaveBeenCalledTimes(2);
    expect(
      harness.tx.voyageForkLineage.create.mock.calls.map(([input]) => input.data.sourceConcurrencyVersion),
    ).toEqual([7, 7]);
  });

  it("does not let a non-member use a prior solo-fork receipt to discover a child Voyage", async () => {
    harness.tx.playthroughMembership.findFirst.mockResolvedValue(null);
    harness.tx.voyageForkLineage.findUnique.mockResolvedValue({
      parentVoyageId: "voyage-1",
      childVoyageId: "solo-voyage-1",
      sourceConcurrencyVersion: 7,
      sourceSequence: 21,
      requesterPlayerProfileId: "player-1",
      requesterAccountId: "player-account",
      idempotencyKey: "solo-key-1",
      correlationId: "lineage-correlation",
    });

    await expect(
      continueSolo("voyage-1", { playerProfileId: "intruder", expectedVersion: 7, idempotencyKey: "solo-key-1" }),
    ).rejects.toMatchObject({ code: "NOT_AUTHORIZED" });
  });
});
