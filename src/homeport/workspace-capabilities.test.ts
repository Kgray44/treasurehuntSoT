import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  accountUpdate: vi.fn(),
  profile: vi.fn(),
  membershipCount: vi.fn(),
  role: vi.fn(),
  roleCreate: vi.fn(),
  membershipFind: vi.fn(),
  membershipUpdate: vi.fn(),
  securityCreate: vi.fn(),
  captainVoyageCount: vi.fn(),
  creatorChronicleCount: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const db = {
    userAccount: { findUnique: mocks.account, update: mocks.accountUpdate },
    playerProfile: { findUnique: mocks.profile },
    playthroughMembership: {
      count: mocks.membershipCount,
      findMany: mocks.membershipFind,
      updateMany: mocks.membershipUpdate,
    },
    accountRoleAssignment: { findFirst: mocks.role, create: mocks.roleCreate },
    securityEvent: { create: mocks.securityCreate },
    taleSession: { count: mocks.captainVoyageCount },
    chronicle: { count: mocks.creatorChronicleCount },
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
      id: "account-1",
      legacyGameMasterId: null,
      status: "ACTIVE",
      claimedAt: new Date("2026-08-04T00:00:00.000Z"),
      ordinaryWorkspaceEntryAt: new Date("2026-08-04T00:00:00.000Z"),
      emails: [{ verificationState: "VERIFIED" }],
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
    mocks.accountUpdate.mockResolvedValue({ id: "account-1" });
    mocks.captainVoyageCount.mockResolvedValue(0);
    mocks.creatorChronicleCount.mockResolvedValue(0);
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
    mocks.membershipFind.mockResolvedValue([
      { playthrough: { captainId: "another-captain", captainAccountId: "another-account" } },
    ]);
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
    expect(overview.transitionLock.blockedWorkspaces).toEqual(["CAPTAIN", "CREATOR"]);
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
    mocks.membershipFind.mockResolvedValue([
      { playthrough: { captainId: "another-captain", captainAccountId: "another-account" } },
    ]);
    mocks.account.mockResolvedValue({
      status: "ACTIVE",
      claimedAt: new Date(),
      ordinaryWorkspaceEntryAt: null,
      emails: [{ verificationState: "VERIFIED" }],
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

  it("helm.phase1 allows Captain entry only when active Player participation belongs to that Captain", async () => {
    mocks.membershipCount.mockResolvedValue(1);
    mocks.membershipFind.mockResolvedValue([
      { playthrough: { captainId: "account-1", captainAccountId: "account-1" } },
    ]);
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

    await expect(hasActivePlayerWorkspaceLock("account-1", { target: "CAPTAIN" })).resolves.toBe(false);
    const overview = await workspaceCapabilityOverview("account-1");
    expect(overview.transitionLock).toMatchObject({
      state: "BLOCKED_ACTIVE_PLAYER_CHRONICLE",
      blockedWorkspaces: ["CREATOR"],
    });
    expect(overview.workspaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "CAPTAIN", state: "ACTIVE", href: "/captain/library" }),
        expect.objectContaining({ id: "CREATOR", state: "BLOCKED", href: null }),
      ]),
    );
  });

  it("homeport.owner-correction.round1.workspace-self-initialize grants one idempotent account role when clear", async () => {
    mocks.account.mockResolvedValue({
      status: "ACTIVE",
      claimedAt: new Date(),
      ordinaryWorkspaceEntryAt: null,
      emails: [{ verificationState: "VERIFIED" }],
      profile: { status: "ACTIVE" },
      roles: [],
    });
    await expect(activateWorkspaceCapability("account-1", "CREATOR")).resolves.toEqual({
      state: "ACTIVATED",
      role: "CREATOR",
    });
    expect(mocks.accountUpdate).toHaveBeenCalledWith({
      where: { id: "account-1" },
      data: { ordinaryWorkspaceEntryAt: expect.any(Date) },
    });
    expect(mocks.roleCreate).not.toHaveBeenCalled();
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
