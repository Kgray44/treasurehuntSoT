import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export type SelfServiceWorkspace = "CAPTAIN" | "CREATOR";
export type OrdinaryWorkspaceRole = "PLAYER" | "CAPTAIN" | "CREATOR";

export class WorkspaceCapabilityError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "FORBIDDEN" | "CONFLICT" = "INVALID",
  ) {
    super(message);
  }
}

const activeMembershipStates = ["ACCEPTED", "READY", "ACTIVE_MEMBER"];
const ordinaryWorkspaceRoles = ["PLAYER", "CAPTAIN", "CREATOR"] as const;

export type CapabilityReconciliationAccount = Readonly<{
  accountId: string;
  status: "READY" | "SKIPPED_RESTRICTED" | "SKIPPED_NOT_CLAIMED";
  missingRoles: readonly OrdinaryWorkspaceRole[];
  playerProfile: "PRESENT" | "CREATE_REQUIRED";
  changed: boolean;
}>;

export async function reconcileClaimedAccountCapabilities(options: {
  accountId?: string;
  commit?: boolean;
}): Promise<Readonly<{ mode: "DRY_RUN" | "COMMIT"; accounts: readonly CapabilityReconciliationAccount[] }>> {
  const accounts = await db.userAccount.findMany({
    where: options.accountId ? { id: options.accountId } : undefined,
    select: {
      id: true,
      status: true,
      claimedAt: true,
      lockedAt: true,
      suspendedAt: true,
      profile: { select: { id: true } },
      roles: { where: { revokedAt: null }, select: { role: true } },
    },
    orderBy: { id: "asc" },
  });
  if (options.accountId && accounts.length !== 1)
    throw new WorkspaceCapabilityError("The requested account does not exist.", "FORBIDDEN");
  const plan: CapabilityReconciliationAccount[] = accounts.map((account) => {
    const active = account.status === "ACTIVE" && !account.lockedAt && !account.suspendedAt;
    const claimed = Boolean(account.claimedAt);
    const roles = new Set(account.roles.map((assignment) => assignment.role));
    const missingRoles = ordinaryWorkspaceRoles.filter((role) => !roles.has(role));
    return {
      accountId: account.id,
      status: !active ? "SKIPPED_RESTRICTED" : !claimed ? "SKIPPED_NOT_CLAIMED" : "READY",
      missingRoles,
      playerProfile: account.profile ? "PRESENT" : "CREATE_REQUIRED",
      changed: active && claimed && (missingRoles.length > 0 || !account.profile),
    };
  });
  if (!options.commit) return { mode: "DRY_RUN", accounts: plan };
  for (const account of plan) {
    if (account.status !== "READY") continue;
    await db.$transaction(async (tx) => {
      if (account.playerProfile === "CREATE_REQUIRED") {
        await tx.playerProfile.create({
          data: {
            id: `homeport-player-${account.accountId}`,
            accountId: account.accountId,
            displayName: "Voyagewright member",
            status: "ACTIVE",
            claimedAt: new Date(),
          },
        });
      }
      for (const role of account.missingRoles) {
        const existing = await tx.accountRoleAssignment.findFirst({
          where: { accountId: account.accountId, role, scopeType: "GLOBAL", scopeId: null, revokedAt: null },
          select: { id: true },
        });
        if (!existing)
          await tx.accountRoleAssignment.create({
            data: {
              id: `homeport-ordinary-${account.accountId}-${role.toLocaleLowerCase()}`,
              accountId: account.accountId,
              role,
              scopeType: "GLOBAL",
            },
          });
      }
      await tx.securityEvent.create({
        data: {
          accountId: account.accountId,
          eventType: "WORKSPACE_CAPABILITIES_RECONCILED",
          correlationId: randomUUID(),
          metadata: JSON.stringify({
            mode: "COMMIT",
            createdPlayerProfile: account.playerProfile === "CREATE_REQUIRED",
            addedRoles: account.missingRoles,
          }),
        },
      });
    });
  }
  return { mode: "COMMIT", accounts: plan };
}

export async function hasActivePlayerWorkspaceLock(accountId: string) {
  return (
    (await db.playthroughMembership.count({
      where: {
        player: { accountId },
        status: { in: activeMembershipStates },
        playthrough: { status: "ACTIVE", previewMode: false },
      },
    })) > 0
  );
}

async function activePlayerChronicles(accountId: string) {
  const profile = await db.playerProfile.findUnique({
    where: { accountId },
    select: {
      memberships: {
        where: {
          status: { in: activeMembershipStates },
          playthrough: { status: "ACTIVE", previewMode: false },
        },
        select: {
          id: true,
          status: true,
          participationAlias: true,
          playthrough: { select: { id: true, voyageName: true, tale: { select: { title: true, slug: true } } } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  return (profile?.memberships ?? []).map((membership) => ({
    membershipId: membership.id,
    playthroughId: membership.playthrough.id,
    title: membership.playthrough.tale.title,
    voyageName: membership.playthrough.voyageName,
    alias: membership.participationAlias,
    status: membership.status,
    returnHref: `/play/${encodeURIComponent(membership.playthrough.tale.slug)}/session/${encodeURIComponent(membership.playthrough.id)}`,
  }));
}

export async function workspaceCapabilityOverview(accountId: string) {
  const [account, activeChronicles] = await Promise.all([
    db.userAccount.findUnique({
      where: { id: accountId },
      select: {
        status: true,
        claimedAt: true,
        profile: { select: { status: true } },
        roles: { where: { revokedAt: null }, select: { role: true, grantedAt: true } },
      },
    }),
    activePlayerChronicles(accountId),
  ]);
  if (!account) throw new WorkspaceCapabilityError("Account context is unavailable.", "FORBIDDEN");
  const roles = new Set(account.roles.map((role) => role.role));
  const administrator = roles.has("ADMINISTRATOR");
  const canSelfInitialize = account.status === "ACTIVE" && Boolean(account.claimedAt);
  const locked = activeChronicles.length > 0;
  return {
    accountState: account.status === "ACTIVE" ? "Active account" : "Account setup or verification required",
    canSelfInitialize,
    activeChronicles,
    transitionLock: locked
      ? {
          state: "BLOCKED_ACTIVE_PLAYER_CHRONICLE" as const,
          detail:
            "Finish or safely leave active Player participation before entering Captain or Creator context. This prevents spoilers and conflicting Chronicle writes.",
        }
      : { state: "CLEAR" as const, detail: "No active Player participation blocks a workspace transition." },
    workspaces: [
      {
        id: "PLAYER" as const,
        label: "Player",
        state: account.profile?.status === "ACTIVE" ? ("ACTIVE" as const) : ("UNAVAILABLE" as const),
        href: account.profile?.status === "ACTIVE" ? "/player/library" : null,
        detail: "Join and play Chronicles with your canonical Profile.",
      },
      {
        id: "CAPTAIN" as const,
        label: "Captain",
        state:
          roles.has("CAPTAIN") || administrator
            ? locked
              ? "BLOCKED"
              : "ACTIVE"
            : canSelfInitialize
              ? "AVAILABLE"
              : "UNAVAILABLE",
        href: (roles.has("CAPTAIN") || administrator) && !locked ? "/captain/library" : null,
        detail: "Prepare and guide authorized Voyages without becoming a separate account.",
      },
      {
        id: "CREATOR" as const,
        label: "Creator",
        state:
          roles.has("CREATOR") || roles.has("PUBLISHER") || administrator
            ? locked
              ? "BLOCKED"
              : "ACTIVE"
            : canSelfInitialize
              ? "AVAILABLE"
              : "UNAVAILABLE",
        href: (roles.has("CREATOR") || roles.has("PUBLISHER") || administrator) && !locked ? "/studio/library" : null,
        detail: "Create and publish Chronicles through the same AccountSession.",
      },
    ],
  };
}

export async function activateWorkspaceCapability(accountId: string, target: SelfServiceWorkspace) {
  const overview = await workspaceCapabilityOverview(accountId);
  if (!overview.canSelfInitialize)
    throw new WorkspaceCapabilityError(
      "Complete account setup and email verification before activating a workspace.",
      "FORBIDDEN",
    );
  if (overview.activeChronicles.length)
    throw new WorkspaceCapabilityError(
      "Active Player participation blocks Captain and Creator transitions until you safely leave those Chronicles.",
      "CONFLICT",
    );
  const existing = await db.accountRoleAssignment.findFirst({
    where: { accountId, role: target, scopeType: "GLOBAL", scopeId: null, revokedAt: null },
  });
  if (existing) return { state: "ALREADY_ACTIVE" as const, role: target };
  await db.$transaction(async (tx) => {
    await tx.accountRoleAssignment.create({ data: { accountId, role: target, scopeType: "GLOBAL" } });
    await tx.securityEvent.create({
      data: {
        accountId,
        eventType: "WORKSPACE_CAPABILITY_ACTIVATED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ role: target }),
      },
    });
  });
  return { state: "ACTIVATED" as const, role: target };
}

export async function leaveActivePlayerChronicles(accountId: string, confirmation: string) {
  if (confirmation !== "LEAVE ACTIVE CHRONICLES")
    throw new WorkspaceCapabilityError("Type LEAVE ACTIVE CHRONICLES exactly to confirm the safe exit.");
  const profile = await db.playerProfile.findUnique({ where: { accountId }, select: { id: true } });
  if (!profile) throw new WorkspaceCapabilityError("A Player Profile is required.", "FORBIDDEN");
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const memberships = await tx.playthroughMembership.findMany({
      where: {
        playerProfileId: profile.id,
        status: { in: activeMembershipStates },
        playthrough: { status: "ACTIVE", previewMode: false },
      },
      select: { id: true, playthroughId: true },
    });
    if (memberships.length)
      await tx.playthroughMembership.updateMany({
        where: { id: { in: memberships.map((membership) => membership.id) } },
        data: { status: "LEFT", removedAt: now },
      });
    await tx.securityEvent.create({
      data: {
        accountId,
        eventType: "ACTIVE_PLAYER_CHRONICLES_LEFT",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ playthroughIds: memberships.map((membership) => membership.playthroughId) }),
      },
    });
    return memberships.length;
  });
  return { state: "LEFT" as const, count: result };
}
