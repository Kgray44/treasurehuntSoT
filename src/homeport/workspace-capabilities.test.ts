import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  profile: vi.fn(),
  membershipCount: vi.fn(),
  role: vi.fn(),
  roleCreate: vi.fn(),
  membershipFind: vi.fn(),
  membershipUpdate: vi.fn(),
  securityCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    userAccount: { findUnique: mocks.account },
    playerProfile: { findUnique: mocks.profile },
    playthroughMembership: {
      count: mocks.membershipCount,
      findMany: mocks.membershipFind,
      updateMany: mocks.membershipUpdate,
    },
    accountRoleAssignment: { findFirst: mocks.role, create: mocks.roleCreate },
    securityEvent: { create: mocks.securityCreate },
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(db)),
  };
  return { db };
});

import {
  WorkspaceCapabilityError,
  activateWorkspaceCapability,
  hasActivePlayerWorkspaceLock,
  leaveActivePlayerChronicles,
  workspaceCapabilityOverview,
} from "./workspace-capabilities";

describe("Project Homeport workspace transition authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue({
      status: "ACTIVE",
      claimedAt: new Date("2026-08-04T00:00:00.000Z"),
      profile: { status: "ACTIVE" },
      roles: [
        { role: "CAPTAIN", grantedAt: new Date() },
        { role: "CREATOR", grantedAt: new Date() },
      ],
    });
    mocks.profile.mockResolvedValue({ memberships: [] });
    mocks.membershipCount.mockResolvedValue(0);
    mocks.role.mockResolvedValue(null);
    mocks.roleCreate.mockResolvedValue({ id: "role-1" });
    mocks.membershipFind.mockResolvedValue([]);
    mocks.membershipUpdate.mockResolvedValue({ count: 0 });
    mocks.securityCreate.mockResolvedValue({ id: "event-1" });
  });

  it("homeport.owner-correction.round1.same-chronicle-denial detects an authoritative active Player lock", async () => {
    mocks.membershipCount.mockResolvedValue(1);
    expect(await hasActivePlayerWorkspaceLock("account-1")).toBe(true);
    expect(mocks.membershipCount).toHaveBeenCalledWith({
      where: {
        player: { accountId: "account-1" },
        status: { in: ["ACCEPTED", "READY", "ACTIVE_MEMBER"] },
        playthrough: { status: "ACTIVE", previewMode: false },
      },
    });
  });

  it("homeport.owner-correction.round1.active-lock blocks both staff workspaces while preserving the Player return", async () => {
    mocks.profile.mockResolvedValue({
      memberships: [
        {
          id: "membership-1",
          status: "ACTIVE_MEMBER",
          participationAlias: "Night Cartographer",
          playthrough: {
            id: "voyage-1",
            voyageName: "Moonlit Run",
            tale: { title: "The Moonlit Map", slug: "moonlit-map" },
          },
        },
      ],
    });
    const overview = await workspaceCapabilityOverview("account-1");
    expect(overview.transitionLock.state).toBe("BLOCKED_ACTIVE_PLAYER_CHRONICLE");
    expect(overview.activeChronicles[0]).toMatchObject({
      alias: "Night Cartographer",
      returnHref: "/play/moonlit-map/session/voyage-1",
    });
    expect(overview.workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "CAPTAIN", state: "BLOCKED", href: null }),
        expect.objectContaining({ id: "CREATOR", state: "BLOCKED", href: null }),
      ]),
    );
  });

  it("homeport.owner-correction.round1.capability-escalation refuses self-initialization during active participation", async () => {
    mocks.account.mockResolvedValue({
      status: "ACTIVE",
      claimedAt: new Date(),
      profile: { status: "ACTIVE" },
      roles: [],
    });
    mocks.profile.mockResolvedValue({
      memberships: [
        {
          id: "membership-1",
          status: "READY",
          participationAlias: null,
          playthrough: {
            id: "voyage-1",
            voyageName: null,
            tale: { title: "The Moonlit Map", slug: "moonlit-map" },
          },
        },
      ],
    });
    await expect(activateWorkspaceCapability("account-1", "CAPTAIN")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(mocks.roleCreate).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round1.workspace-self-initialize grants one idempotent account role when clear", async () => {
    await expect(activateWorkspaceCapability("account-1", "CREATOR")).resolves.toEqual({
      state: "ACTIVATED",
      role: "CREATOR",
    });
    expect(mocks.roleCreate).toHaveBeenCalledWith({
      data: { accountId: "account-1", role: "CREATOR", scopeType: "GLOBAL" },
    });
    expect(mocks.securityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId: "account-1", eventType: "WORKSPACE_CAPABILITY_ACTIVATED" }),
    });
  });

  it("homeport.owner-correction.round1.safe-exit requires exact confirmation and writes the membership exit atomically", async () => {
    await expect(leaveActivePlayerChronicles("account-1", "leave")).rejects.toBeInstanceOf(WorkspaceCapabilityError);
    mocks.profile.mockResolvedValue({ id: "profile-1" });
    mocks.membershipFind.mockResolvedValue([{ id: "membership-1", playthroughId: "voyage-1" }]);
    await expect(leaveActivePlayerChronicles("account-1", "LEAVE ACTIVE CHRONICLES")).resolves.toEqual({
      state: "LEFT",
      count: 1,
    });
    expect(mocks.membershipUpdate).toHaveBeenCalledWith({
      where: { id: { in: ["membership-1"] } },
      data: { status: "LEFT", removedAt: expect.any(Date) },
    });
  });
});
