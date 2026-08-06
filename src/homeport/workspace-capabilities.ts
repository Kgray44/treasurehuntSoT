import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export type SelfServiceWorkspace = "CAPTAIN" | "CREATOR";
export type OrdinaryWorkspaceRole = "PLAYER" | "CAPTAIN" | "CREATOR";
export type CapabilityReconciliationMode = "DRY_RUN" | "COMMIT" | "VERIFY";

export class WorkspaceCapabilityError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "FORBIDDEN" | "CONFLICT" = "INVALID",
  ) {
    super(message);
  }
}

const activeMembershipStates = ["ACCEPTED", "READY", "ACTIVE_MEMBER"];

export type CapabilityReconciliationAccount = Readonly<{
  accountId: string;
  status: "READY" | "SKIPPED_RESTRICTED" | "SKIPPED_NOT_CLAIMED" | "SKIPPED_NOT_VERIFIED";
  ordinaryEntry: "PRESENT" | "CREATE_REQUIRED";
  playerProfile: "PRESENT" | "CREATE_REQUIRED";
  changed: boolean;
}>;

export async function reconcileClaimedAccountCapabilities(options: {
  accountId?: string;
  commit?: boolean;
  mode?: CapabilityReconciliationMode;
}): Promise<
  Readonly<{
    mode: CapabilityReconciliationMode;
    verified: boolean;
    accounts: readonly CapabilityReconciliationAccount[];
  }>
> {
  const mode = options.mode ?? (options.commit ? "COMMIT" : "DRY_RUN");
  const accounts = await db.userAccount.findMany({
    where: options.accountId ? { id: options.accountId } : undefined,
    select: {
      id: true,
      status: true,
      claimedAt: true,
      lockedAt: true,
      suspendedAt: true,
      ordinaryWorkspaceEntryAt: true,
      emails: { where: { isPrimary: true }, select: { verificationState: true }, take: 1 },
      profile: { select: { id: true } },
    },
    orderBy: { id: "asc" },
  });
  if (options.accountId && accounts.length !== 1)
    throw new WorkspaceCapabilityError("The requested account does not exist.", "FORBIDDEN");
  const plan: CapabilityReconciliationAccount[] = accounts.map((account) => {
    const active = account.status === "ACTIVE" && !account.lockedAt && !account.suspendedAt;
    const claimed = Boolean(account.claimedAt);
    const verified = account.emails[0]?.verificationState === "VERIFIED";
    return {
      accountId: account.id,
      status: !active
        ? "SKIPPED_RESTRICTED"
        : !claimed
          ? "SKIPPED_NOT_CLAIMED"
          : !verified
            ? "SKIPPED_NOT_VERIFIED"
            : "READY",
      ordinaryEntry: account.ordinaryWorkspaceEntryAt ? "PRESENT" : "CREATE_REQUIRED",
      playerProfile: account.profile ? "PRESENT" : "CREATE_REQUIRED",
      changed: active && claimed && verified && (!account.ordinaryWorkspaceEntryAt || !account.profile),
    };
  });
  const verified = plan.every((account) => account.status !== "READY" || !account.changed);
  if (mode !== "COMMIT") return { mode, verified, accounts: plan };
  for (const account of plan) {
    if (account.status !== "READY" || !account.changed) continue;
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
      if (account.ordinaryEntry === "CREATE_REQUIRED")
        await tx.userAccount.update({
          where: { id: account.accountId },
          data: { ordinaryWorkspaceEntryAt: new Date() },
        });
      await tx.securityEvent.create({
        data: {
          accountId: account.accountId,
          eventType: "WORKSPACE_CAPABILITIES_RECONCILED",
          correlationId: randomUUID(),
          metadata: JSON.stringify({
            mode: "COMMIT",
            createdPlayerProfile: account.playerProfile === "CREATE_REQUIRED",
            createdOrdinaryWorkspaceEntry: account.ordinaryEntry === "CREATE_REQUIRED",
            privilegedOrResourceRolesGranted: [],
          }),
        },
      });
    });
  }
  return { mode, verified: true, accounts: plan };
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
        id: true,
        legacyGameMasterId: true,
        status: true,
        claimedAt: true,
        ordinaryWorkspaceEntryAt: true,
        profile: { select: { status: true } },
        emails: { where: { isPrimary: true }, select: { verificationState: true }, take: 1 },
        roles: { where: { revokedAt: null }, select: { role: true, grantedAt: true } },
      },
    }),
    activePlayerChronicles(accountId),
  ]);
  if (!account) throw new WorkspaceCapabilityError("Account context is unavailable.", "FORBIDDEN");
  const [captainVoyageCount, creatorChronicleCount] = await Promise.all([
    db.taleSession.count({
      where: {
        previewMode: false,
        OR: [
          { captainAccountId: account.id },
          ...(account.legacyGameMasterId ? [{ captainId: account.legacyGameMasterId }] : []),
        ],
      },
    }),
    db.chronicle.count({
      where: {
        archivedAt: null,
        OR: [
          { creatorAccountId: account.id },
          ...(account.legacyGameMasterId ? [{ creatorId: account.legacyGameMasterId }] : []),
        ],
      },
    }),
  ]);
  const roles = new Set(account.roles.map((role) => role.role));
  const administrator = roles.has("ADMINISTRATOR");
  const verified = account.emails[0]?.verificationState === "VERIFIED";
  const eligible = account.status === "ACTIVE" && Boolean(account.claimedAt) && verified;
  const canEnterOrdinaryWorkspaces = eligible && Boolean(account.ordinaryWorkspaceEntryAt);
  const locked = activeChronicles.length > 0;
  return {
    accountState: canEnterOrdinaryWorkspaces ? "Active verified account" : "Account setup or verification required",
    canSelfInitialize: eligible,
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
        state:
          canEnterOrdinaryWorkspaces && account.profile?.status === "ACTIVE"
            ? ("ACTIVE" as const)
            : ("UNAVAILABLE" as const),
        href: canEnterOrdinaryWorkspaces && account.profile?.status === "ACTIVE" ? "/player/library" : null,
        detail: "Join and play Chronicles.",
      },
      {
        id: "CAPTAIN" as const,
        label: "Captain",
        state: canEnterOrdinaryWorkspaces || administrator ? (locked ? "BLOCKED" : "ACTIVE") : "UNAVAILABLE",
        href: (canEnterOrdinaryWorkspaces || administrator) && !locked ? "/captain/library" : null,
        detail: "Prepare or guide Voyages assigned to you.",
        emptyHint: captainVoyageCount === 0 ? "No Captain Voyages yet." : null,
      },
      {
        id: "CREATOR" as const,
        label: "Creator",
        state: canEnterOrdinaryWorkspaces || administrator ? (locked ? "BLOCKED" : "ACTIVE") : "UNAVAILABLE",
        href: (canEnterOrdinaryWorkspaces || administrator) && !locked ? "/studio/library" : null,
        detail: "Create and publish your own Chronicles.",
        emptyHint: creatorChronicleCount === 0 ? "Create your first Chronicle." : null,
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
  const existing = overview.workspaces.find((workspace) => workspace.id === target && workspace.state === "ACTIVE");
  if (existing) return { state: "ALREADY_ACTIVE" as const, role: target };
  await db.$transaction(async (tx) => {
    await tx.userAccount.update({ where: { id: accountId }, data: { ordinaryWorkspaceEntryAt: new Date() } });
    await tx.securityEvent.create({
      data: {
        accountId,
        eventType: "WORKSPACE_CAPABILITY_ACTIVATED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ workspace: target, resourceAuthorityGranted: false }),
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
