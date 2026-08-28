import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  findSession: vi.fn(),
  findLegacyPlayer: vi.fn(),
  findLegacyStaff: vi.fn(),
  createSession: vi.fn(),
  recordSecurityEvent: vi.fn(),
  activePlayerWorkspaceLock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name);
      return value ? { value } : undefined;
    },
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    accountSession: { findUnique: mocks.findSession },
    playerIdentitySession: { findFirst: mocks.findLegacyPlayer },
    gameMasterSession: { findFirst: mocks.findLegacyStaff },
  },
}));
vi.mock("@/wayfarer/accounts", () => ({
  createAccountSession: mocks.createSession,
  recordSecurityEvent: mocks.recordSecurityEvent,
}));
vi.mock("@/wayfarer/http", () => ({
  WAYFARER_COOKIE: "wayfarer_account",
  wayfarerCookieOptions: { httpOnly: true, sameSite: "lax", path: "/" },
}));
vi.mock("@/homeport/workspace-capabilities", () => ({
  hasActivePlayerWorkspaceLock: mocks.activePlayerWorkspaceLock,
}));

import { decideCapability } from "./current-user";
import { resolveCurrentUser } from "./current-user.server";

function session(overrides: Record<string, unknown> = {}) {
  const baseAccount = {
    id: "account-1",
    status: "ACTIVE",
    claimedAt: new Date("2026-08-04T00:00:00.000Z"),
    ordinaryWorkspaceEntryAt: new Date("2026-08-04T00:00:00.000Z"),
    updatedAt: new Date("2026-08-04T00:00:00.000Z"),
    lockedAt: null,
    suspendedAt: null,
    emails: [{ verificationState: "VERIFIED", verifiedAt: new Date("2026-08-04T00:00:00.000Z") }],
    profile: {
      id: "profile-1",
      displayName: "Mara Tide",
      handle: "mara",
      status: "ACTIVE",
      updatedAt: new Date("2026-08-04T00:00:00.000Z"),
      avatarMedia: null,
    },
    roles: [],
  };
  const accountOverride = (overrides.account ?? {}) as Record<string, unknown>;
  return {
    id: "session-1",
    accountId: "account-1",
    csrfToken: "csrf-safe-client-value",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    sessionType: "ORDINARY",
    ...overrides,
    account: { ...baseAccount, ...accountOverride },
  };
}

describe("Project Homeport current-user authority", () => {
  beforeEach(() => {
    mocks.cookieValues.clear();
    mocks.cookieValues.set("wayfarer_account", "canonical-token");
    mocks.cookieSet.mockReset();
    mocks.cookieDelete.mockReset();
    mocks.findSession.mockReset().mockResolvedValue(session());
    mocks.findLegacyPlayer.mockReset();
    mocks.findLegacyStaff.mockReset();
    mocks.createSession.mockReset();
    mocks.recordSecurityEvent.mockReset().mockResolvedValue({});
    mocks.activePlayerWorkspaceLock.mockReset().mockResolvedValue(false);
  });

  it("homeport.auth.single-product resolves the one canonical AccountSession cookie", async () => {
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({ status: "authenticated", authenticated: true });
    expect(mocks.findSession).toHaveBeenCalledOnce();
    expect(mocks.findLegacyPlayer).not.toHaveBeenCalled();
    expect(mocks.findLegacyStaff).not.toHaveBeenCalled();
  });

  it("homeport.owner-correction.round3.patch-a.pending ordinary sign-in is authenticated with an unverified notice", async () => {
    mocks.findSession.mockResolvedValue(
      session({
        account: {
          ...session().account,
          status: "PENDING_VERIFICATION",
          ordinaryWorkspaceEntryAt: null,
          emails: [{ verificationState: "PENDING", verifiedAt: null }],
        },
      }),
    );
    expect(await resolveCurrentUser()).toMatchObject({
      status: "authenticated",
      authenticated: true,
      emailVerification: { status: "unverified" },
      capabilities: { canUsePlayer: true, canUseCaptain: true, canUseCreator: true },
    });
  });

  it("homeport.owner-correction.round3.patch-a.registration verification session stays bounded before sign-in", async () => {
    mocks.findSession.mockResolvedValue(
      session({
        sessionType: "VERIFICATION",
        account: {
          ...session().account,
          status: "PENDING_VERIFICATION",
          emails: [{ verificationState: "PENDING", verifiedAt: null }],
        },
      }),
    );
    expect(await resolveCurrentUser()).toMatchObject({ status: "anonymous", authenticated: false });
  });

  it("homeport.session.convergence projects Player and staff workspaces from one context", async () => {
    mocks.findSession.mockResolvedValue(
      session({
        account: {
          id: "account-1",
          status: "ACTIVE",
          lockedAt: null,
          suspendedAt: null,
          profile: { id: "profile-1", displayName: "Mara Tide", status: "ACTIVE", handle: null },
          roles: [{ role: "CAPTAIN" }, { role: "CREATOR" }],
        },
      }),
    );
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({
      status: "authenticated",
      capabilities: { canUsePlayer: true, canUseCaptain: true, canUseCreator: true },
      workspaces: expect.arrayContaining(["player", "captain", "creator"]),
    });
  });

  it("homeport.session.expiry distinguishes expiry from anonymous state", async () => {
    mocks.findSession.mockResolvedValue(session({ expiresAt: new Date(Date.now() - 1) }));
    expect(await resolveCurrentUser()).toMatchObject({ status: "expired", authenticated: false });
  });

  it("homeport.session.revocation distinguishes revocation and invalid credentials", async () => {
    mocks.findSession.mockResolvedValue(session({ revokedAt: new Date() }));
    expect(await resolveCurrentUser()).toMatchObject({ status: "revoked" });
    mocks.findSession.mockResolvedValue(null);
    expect(await resolveCurrentUser()).toMatchObject({ status: "invalid" });
  });

  it("homeport.session.restricted-account distinguishes locked and suspended accounts", async () => {
    mocks.findSession.mockResolvedValue(
      session({ account: { ...session().account, lockedAt: new Date(), profile: null } }),
    );
    expect(await resolveCurrentUser()).toMatchObject({ status: "restricted", reason: "locked" });
    mocks.findSession.mockResolvedValue(
      session({ account: { ...session().account, suspendedAt: new Date(), profile: null } }),
    );
    expect(await resolveCurrentUser()).toMatchObject({ status: "restricted", reason: "suspended" });
  });

  it("homeport.context.failure-state returns unavailable with an opaque correlation id", async () => {
    mocks.findSession.mockRejectedValue(new Error("database detail must not escape"));
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({ status: "unavailable", retryable: true });
    expect(JSON.stringify(context)).not.toContain("database detail");
  });

  it("homeport.capability.player-agreement derives Player from an active profile", async () => {
    const active = await resolveCurrentUser();
    expect(active.status === "authenticated" && decideCapability(active, "player").status).toBe("allowed");
    mocks.findSession.mockResolvedValue(
      session({ account: { ...session().account, profile: null, roles: [{ role: "PLAYER" }] } }),
    );
    const roleOnly = await resolveCurrentUser();
    expect(roleOnly.status === "authenticated" && decideCapability(roleOnly, "player").status).toBe(
      "permission-denied",
    );
  });

  it("chronicle.guest-player-library preserves Player access without ordinary workspace authority", async () => {
    mocks.findSession.mockResolvedValue(
      session({
        account: {
          ...session().account,
          status: "GUEST_UNCLAIMED",
          claimedAt: null,
          ordinaryWorkspaceEntryAt: null,
          roles: [{ role: "PLAYER" }],
        },
      }),
    );
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({
      status: "authenticated",
      capabilities: { canUsePlayer: true, canUseCaptain: false, canUseCreator: false },
      workspaces: expect.arrayContaining(["player"]),
    });
    expect(context.status === "authenticated" && decideCapability(context, "player").status).toBe("allowed");
    expect(context.status === "authenticated" && decideCapability(context, "captain").status).toBe("permission-denied");
    expect(context.status === "authenticated" && decideCapability(context, "creator").status).toBe("permission-denied");
  });

  it("homeport.owner-correction.round3.workspace-entry derives both ordinary workspaces without redundant roles", async () => {
    mocks.findSession.mockResolvedValue(session({ account: { ...session().account, roles: [{ role: "CAPTAIN" }] } }));
    const context = await resolveCurrentUser();
    expect(context.status === "authenticated" && decideCapability(context, "captain").status).toBe("allowed");
    expect(context.status === "authenticated" && decideCapability(context, "creator").status).toBe("allowed");
  });

  it("homeport.workspace.same-chronicle-lock denies Captain and Creator context while Player participation is active", async () => {
    mocks.activePlayerWorkspaceLock.mockResolvedValue(true);
    mocks.findSession.mockResolvedValue(
      session({
        account: {
          ...session().account,
          roles: [{ role: "CAPTAIN" }, { role: "CREATOR" }],
        },
      }),
    );
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({
      status: "authenticated",
      capabilities: { canUsePlayer: true, canUseCaptain: false, canUseCreator: false },
    });
    expect(context.status === "authenticated" && decideCapability(context, "captain").status).toBe("permission-denied");
  });

  it("helm.phase1 keeps Captain and Player workspaces available together for a resource-authorized Voyage", async () => {
    mocks.activePlayerWorkspaceLock.mockImplementation((_accountId: string, options?: { target?: string }) =>
      Promise.resolve(options?.target !== "CAPTAIN"),
    );
    const context = await resolveCurrentUser();
    expect(context).toMatchObject({
      status: "authenticated",
      capabilities: { canUsePlayer: true, canUseCaptain: true, canUseCreator: false },
      workspaces: expect.arrayContaining(["player", "captain"]),
    });
    expect(context.status === "authenticated" && decideCapability(context, "captain").status).toBe("allowed");
    expect(context.status === "authenticated" && decideCapability(context, "creator").status).toBe("permission-denied");
  });

  it("homeport.permission.explicit preserves authenticated permission denial", async () => {
    const context = await resolveCurrentUser();
    expect(context.status === "authenticated" && decideCapability(context, "moderator")).toMatchObject({
      status: "permission-denied",
      capability: "moderator",
    });
  });

  it("homeport.legacy-staff.bridge accepts a canonical AccountSession found through the staff compatibility cookie", async () => {
    mocks.cookieValues.clear();
    mocks.cookieValues.set("forever_gm", "compat-token");
    const context = await resolveCurrentUser({ rotateCompatibility: true });
    expect(context.status).toBe("authenticated");
    expect(mocks.cookieSet).toHaveBeenCalledWith("wayfarer_account", "compat-token", expect.any(Object));
    expect(mocks.cookieDelete).toHaveBeenCalledWith("forever_gm");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith("account-1", "ACCOUNT_COMPATIBILITY_BRIDGED", {
      family: "legacy-staff",
    });
  });

  it("homeport.legacy-player.rotation issues a fresh AccountSession for a linked legacy Player", async () => {
    mocks.cookieValues.clear();
    mocks.cookieValues.set("chronicle_player", "legacy-player-token");
    mocks.findLegacyPlayer.mockResolvedValue({ player: { accountId: "account-1" } });
    mocks.createSession.mockResolvedValue({ token: "fresh-account-token" });
    mocks.findSession.mockResolvedValue(session());
    const context = await resolveCurrentUser({ rotateCompatibility: true });
    expect(context.status).toBe("authenticated");
    expect(mocks.createSession).toHaveBeenCalledWith("account-1", "Homeport legacy Player rotation");
    expect(mocks.cookieSet).toHaveBeenCalledWith("wayfarer_account", "fresh-account-token", expect.any(Object));
    expect(mocks.cookieDelete).toHaveBeenCalledWith("chronicle_player");
    expect(mocks.recordSecurityEvent).toHaveBeenCalledWith("account-1", "ACCOUNT_COMPATIBILITY_BRIDGED", {
      family: "legacy-player",
    });
  });
});
