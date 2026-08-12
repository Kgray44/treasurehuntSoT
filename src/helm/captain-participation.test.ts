import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    resource: {
      id: string;
      status: string;
      previewMode: boolean;
      launchedAt: Date | null;
      concurrencyVersion: number;
      captainId: string | null;
      captainAccountId: string | null;
    };
    profile: { id: string; status: string; displayName: string } | null;
    membership: {
      id: string;
      status: string;
      joinedAt: Date | null;
      removedAt: Date | null;
      playerProfileId: string;
    } | null;
  } = {
    resource: {
      id: "voyage-1",
      status: "READY",
      previewMode: false,
      launchedAt: null,
      concurrencyVersion: 2,
      captainId: "account-1",
      captainAccountId: "account-1",
    },
    profile: { id: "profile-1", status: "ACTIVE", displayName: "Mara Tide" },
    membership: null,
  };
  return {
    state,
    profileFind: vi.fn(),
    sessionFind: vi.fn(),
    sessionUpdate: vi.fn(),
    sessionUpdateMany: vi.fn(),
    membershipUpsert: vi.fn(),
    membershipUpdate: vi.fn(),
    presenceUpdateMany: vi.fn(),
    auditCreate: vi.fn(),
    transaction: vi.fn(),
  };
});

vi.mock("@/lib/db", () => {
  const tx = {
    taleSession: {
      updateMany: mocks.sessionUpdateMany,
      update: mocks.sessionUpdate,
    },
    playthroughMembership: {
      upsert: mocks.membershipUpsert,
      update: mocks.membershipUpdate,
    },
    membershipPresenceDevice: { updateMany: mocks.presenceUpdateMany },
    platformAuditEvent: { create: mocks.auditCreate },
  };
  return {
    db: {
      userAccount: { findUnique: vi.fn() },
      playerProfile: { findUnique: mocks.profileFind },
      taleSession: {
        findUnique: mocks.sessionFind,
        updateMany: mocks.sessionUpdateMany,
        update: mocks.sessionUpdate,
      },
      playthroughMembership: {
        upsert: mocks.membershipUpsert,
        update: mocks.membershipUpdate,
      },
      membershipPresenceDevice: { updateMany: mocks.presenceUpdateMany },
      platformAuditEvent: { create: mocks.auditCreate },
      $transaction: mocks.transaction,
      __tx: tx,
    },
  };
});

import {
  CaptainParticipationError,
  assignCaptainAuthority,
  captainParticipationProjection,
  changeCaptainParticipation,
  establishCreatedCaptainParticipation,
  revokeCaptainAuthority,
} from "./captain-participation";

const actor = { accountId: "account-1", legacyGameMasterId: null };

function projection(authority: boolean, membership: boolean) {
  return captainParticipationProjection({
    resource: {
      ...mocks.state.resource,
      captainId: authority ? "account-1" : null,
      captainAccountId: authority ? "account-1" : null,
    },
    actor,
    profileStatus: "ACTIVE",
    membership: membership
      ? {
          id: "membership-1",
          status: "ACTIVE_MEMBER",
          joinedAt: new Date("2026-08-09T10:00:00.000Z"),
          removedAt: null,
          playerProfileId: "profile-1",
        }
      : null,
  });
}

describe("Project Helm Phase 1 Captain participation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.state.resource, {
      id: "voyage-1",
      status: "READY",
      previewMode: false,
      launchedAt: null,
      concurrencyVersion: 2,
      captainId: "account-1",
      captainAccountId: "account-1",
    });
    mocks.state.profile = { id: "profile-1", status: "ACTIVE", displayName: "Mara Tide" };
    mocks.state.membership = null;
    mocks.profileFind.mockImplementation(async () => mocks.state.profile);
    mocks.sessionFind.mockImplementation(async () => ({
      ...mocks.state.resource,
      memberships: mocks.state.membership ? [mocks.state.membership] : [],
    }));
    mocks.sessionUpdateMany.mockImplementation(async () => {
      mocks.state.resource.concurrencyVersion += 1;
      return { count: 1 };
    });
    mocks.sessionUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      if ("captainAccountId" in data) mocks.state.resource.captainAccountId = data.captainAccountId as string | null;
      if ("captainId" in data) mocks.state.resource.captainId = data.captainId as string | null;
      mocks.state.resource.concurrencyVersion += 1;
      return { ...mocks.state.resource };
    });
    mocks.membershipUpsert.mockImplementation(
      async ({ update, create }: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
        mocks.state.membership = mocks.state.membership
          ? ({ ...mocks.state.membership, ...update } as typeof mocks.state.membership)
          : ({
              id: "membership-1",
              removedAt: null,
              ...create,
            } as NonNullable<typeof mocks.state.membership>);
        return mocks.state.membership;
      },
    );
    mocks.membershipUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      mocks.state.membership = { ...mocks.state.membership!, ...data };
      return mocks.state.membership;
    });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation === "function")
        return operation({
          taleSession: { updateMany: mocks.sessionUpdateMany, update: mocks.sessionUpdate },
          playthroughMembership: { upsert: mocks.membershipUpsert, update: mocks.membershipUpdate },
          membershipPresenceDevice: { updateMany: mocks.presenceUpdateMany },
          platformAuditEvent: { create: mocks.auditCreate },
        });
      return Promise.all(operation as Promise<unknown>[]);
    });
  });

  it("derives all four authority and membership states without another truth source", () => {
    expect(projection(false, false).accessState).toBe("NO_ACCESS");
    expect(projection(false, true).accessState).toBe("PLAYER_ONLY");
    expect(projection(true, false).accessState).toBe("CAPTAIN_ONLY");
    expect(projection(true, true)).toMatchObject({
      accessState: "CAPTAIN_AND_PLAYER",
      participationMode: "CAPTAIN_AND_PLAYER",
      playerPerspectiveAvailable: true,
      playerPerspectiveHref: "/player/playthroughs/voyage-1",
      presence: "UNKNOWN",
    });
    expect(Object.keys(projection(true, true)).sort()).toEqual(
      [
        "accessState",
        "canChangeParticipation",
        "changeBlockedReason",
        "concurrencyVersion",
        "hasCaptainAuthority",
        "hasPlayerMembership",
        "participationMode",
        "playerMembershipId",
        "playerPerspectiveAvailable",
        "playerPerspectiveHref",
        "presence",
        "voyageId",
        "voyageLifecycleState",
      ].sort(),
    );

    mocks.state.resource.status = "ACTIVE";
    expect(projection(true, true).playerPerspectiveHref).toBe("/player/playthroughs/voyage-1/journal");
  });

  it("creates no self membership for Captain-only and one ordinary membership for Captain + Player", async () => {
    const tx = {
      playthroughMembership: { upsert: mocks.membershipUpsert },
      platformAuditEvent: { create: mocks.auditCreate },
    };
    await expect(
      establishCreatedCaptainParticipation({
        tx: tx as never,
        voyageId: "voyage-1",
        captainAccountId: "account-1",
        captainLegacyId: null,
        playerProfileId: "profile-1",
        mode: "CAPTAIN_ONLY",
        joinedAt: new Date("2026-08-09T10:00:00.000Z"),
        correlationId: "create-captain-only",
      }),
    ).resolves.toBeNull();
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CAPTAIN_AUTHORITY_ASSIGNED" }),
    });

    vi.clearAllMocks();
    mocks.membershipUpsert.mockResolvedValue({ id: "membership-1" });
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    await expect(
      establishCreatedCaptainParticipation({
        tx: tx as never,
        voyageId: "voyage-1",
        captainAccountId: "account-1",
        captainLegacyId: null,
        playerProfileId: "profile-1",
        mode: "CAPTAIN_AND_PLAYER",
        joinedAt: new Date("2026-08-09T10:00:00.000Z"),
        correlationId: "create-captain-player",
      }),
    ).resolves.toMatchObject({ id: "membership-1" });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: {
        playthroughId_playerProfileId: { playthroughId: "voyage-1", playerProfileId: "profile-1" },
      },
      update: {},
      create: expect.objectContaining({ status: "READY", joinedAt: expect.any(Date) }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "PLAYER_MEMBERSHIP_ADDED" }),
    });
  });

  it("adds one ordinary membership and treats same-mode retries as idempotent", async () => {
    const first = await changeCaptainParticipation("voyage-1", actor, {
      mode: "CAPTAIN_AND_PLAYER",
      expectedVersion: 2,
      idempotencyKey: "helm-request-1",
    });
    expect(first).toMatchObject({
      idempotent: false,
      participation: { accessState: "CAPTAIN_AND_PLAYER", playerMembershipId: "membership-1" },
    });
    expect(mocks.membershipUpsert).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "PLAYER_MEMBERSHIP_ADDED", actorAccountId: "account-1" }),
    });

    const retry = await changeCaptainParticipation("voyage-1", actor, {
      mode: "CAPTAIN_AND_PLAYER",
      expectedVersion: 2,
      idempotencyKey: "helm-request-2",
    });
    expect(retry.idempotent).toBe(true);
    expect(mocks.membershipUpsert).toHaveBeenCalledOnce();
  });

  it("uses ordinary active-member timing for a late join and blocks a second live interval", async () => {
    mocks.state.resource.status = "ACTIVE";
    mocks.state.resource.launchedAt = new Date("2026-08-09T10:00:00.000Z");
    const lateJoin = await changeCaptainParticipation("voyage-1", actor, {
      mode: "CAPTAIN_AND_PLAYER",
      expectedVersion: 2,
      idempotencyKey: "helm-late-join-1",
    });
    expect(lateJoin.participation).toMatchObject({
      hasPlayerMembership: true,
      voyageLifecycleState: "ACTIVE",
    });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith({
      where: {
        playthroughId_playerProfileId: { playthroughId: "voyage-1", playerProfileId: "profile-1" },
      },
      update: expect.objectContaining({ status: "ACTIVE_MEMBER", removedAt: null }),
      create: expect.objectContaining({ status: "ACTIVE_MEMBER", joinedAt: expect.any(Date) }),
    });

    mocks.state.membership = {
      id: "membership-1",
      status: "REMOVED",
      joinedAt: new Date("2026-08-09T10:01:00.000Z"),
      removedAt: new Date("2026-08-09T10:10:00.000Z"),
      playerProfileId: "profile-1",
    };
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 3,
        idempotencyKey: "helm-live-rejoin-1",
      }),
    ).rejects.toMatchObject({ code: "LATE_JOIN_NOT_ALLOWED" });
  });

  it("reuses a pre-launch removed membership without splitting its historical interval", async () => {
    const originalJoin = new Date("2026-08-09T09:30:00.000Z");
    mocks.state.membership = {
      id: "membership-1",
      status: "REMOVED",
      joinedAt: originalJoin,
      removedAt: new Date("2026-08-09T09:45:00.000Z"),
      playerProfileId: "profile-1",
    };
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "helm-prelaunch-rejoin-1",
      }),
    ).resolves.toMatchObject({ participation: { hasPlayerMembership: true } });
    expect(mocks.membershipUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { status: "READY", joinedAt: originalJoin, removedAt: null },
      }),
    );
  });

  it("removes Player participation without changing Captain authority", async () => {
    mocks.state.resource.status = "ACTIVE";
    mocks.state.resource.launchedAt = new Date("2026-08-09T10:00:00.000Z");
    mocks.state.membership = {
      id: "membership-1",
      status: "ACTIVE_MEMBER",
      joinedAt: new Date("2026-08-09T10:00:00.000Z"),
      removedAt: null,
      playerProfileId: "profile-1",
    };
    const result = await changeCaptainParticipation("voyage-1", actor, {
      mode: "CAPTAIN_ONLY",
      expectedVersion: 2,
      idempotencyKey: "helm-remove-1",
    });
    expect(result.participation).toMatchObject({
      accessState: "CAPTAIN_ONLY",
      hasCaptainAuthority: true,
      hasPlayerMembership: false,
    });
    expect(mocks.state.resource.captainAccountId).toBe("account-1");
    expect(mocks.state.membership).toMatchObject({ status: "REMOVED", removedAt: expect.any(Date) });
  });

  it("records a safe rejection when terminal Voyage state blocks a mode change", async () => {
    mocks.state.resource.status = "COMPLETED";
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "helm-blocked-1",
      }),
    ).rejects.toBeInstanceOf(CaptainParticipationError);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CAPTAIN_PARTICIPATION_CHANGE_REJECTED", outcome: "DENIED" }),
    });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("does not let Captain participation revive suspended or closed membership history", async () => {
    mocks.state.membership = {
      id: "membership-1",
      status: "SUSPENDED",
      joinedAt: new Date("2026-08-09T10:00:00.000Z"),
      removedAt: null,
      playerProfileId: "profile-1",
    };
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "helm-suspended-1",
      }),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_CONFLICT" });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();

    mocks.state.membership.status = "LEFT";
    mocks.state.membership.removedAt = new Date("2026-08-09T10:10:00.000Z");
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "helm-left-1",
      }),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_CONFLICT" });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });

  it("allows an existing membership to be removed even when the Player Profile is no longer active", async () => {
    mocks.state.profile = { id: "profile-1", status: "DEACTIVATED", displayName: "Mara Tide" };
    mocks.state.membership = {
      id: "membership-1",
      status: "READY",
      joinedAt: new Date("2026-08-09T10:00:00.000Z"),
      removedAt: null,
      playerProfileId: "profile-1",
    };
    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_ONLY",
        expectedVersion: 2,
        idempotencyKey: "helm-inactive-remove-1",
      }),
    ).resolves.toMatchObject({ participation: { hasCaptainAuthority: true, hasPlayerMembership: false } });
    expect(mocks.membershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-1" },
      data: { status: "REMOVED", removedAt: expect.any(Date) },
    });
  });

  it("records a safe rejection when a concurrent update wins the mutation claim", async () => {
    mocks.sessionUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "helm-race-1",
      }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "CAPTAIN_PARTICIPATION_CHANGE_REJECTED",
        outcome: "DENIED",
        correlationId: "helm-race-1",
      }),
    });
  });

  it("assigns and revokes Captain authority without rewriting an existing Player membership", async () => {
    mocks.state.membership = {
      id: "membership-1",
      status: "ACTIVE_MEMBER",
      joinedAt: new Date("2026-08-09T10:00:00.000Z"),
      removedAt: null,
      playerProfileId: "profile-1",
    };
    mocks.state.resource.captainId = null;
    mocks.state.resource.captainAccountId = null;
    await expect(
      assignCaptainAuthority({
        voyageId: "voyage-1",
        captain: actor,
        authorizedByAccountId: "owner-1",
        correlationId: "authority-add-1",
      }),
    ).resolves.toEqual({ idempotent: false });
    expect(projection(true, true).accessState).toBe("CAPTAIN_AND_PLAYER");
    expect(mocks.membershipUpdate).not.toHaveBeenCalled();

    await expect(
      revokeCaptainAuthority({
        voyageId: "voyage-1",
        captain: actor,
        authorizedByAccountId: "owner-1",
        correlationId: "authority-remove-1",
      }),
    ).resolves.toEqual({ idempotent: false });
    expect(mocks.state.membership).toMatchObject({ id: "membership-1", status: "ACTIVE_MEMBER" });
    expect(mocks.state.resource).toMatchObject({ captainId: null, captainAccountId: null });
    expect(projection(false, true).accessState).toBe("PLAYER_ONLY");
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CAPTAIN_AUTHORITY_REVOKED" }),
    });
  });

  it("does not let retained Player membership call Captain mutation after authority revocation", async () => {
    mocks.state.resource.captainId = null;
    mocks.state.resource.captainAccountId = null;
    mocks.state.membership = {
      id: "membership-1",
      status: "ACTIVE_MEMBER",
      joinedAt: new Date("2026-08-09T10:00:00.000Z"),
      removedAt: null,
      playerProfileId: "profile-1",
    };

    await expect(
      changeCaptainParticipation("voyage-1", actor, {
        mode: "CAPTAIN_AND_PLAYER",
        expectedVersion: 2,
        idempotencyKey: "revoked-authority-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_AUTHORIZED", message: "This Voyage is unavailable." });
    expect(mocks.membershipUpsert).not.toHaveBeenCalled();
  });
});
