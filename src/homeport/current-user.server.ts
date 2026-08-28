import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createAccountSession, recordSecurityEvent } from "@/wayfarer/accounts";
import { WAYFARER_COOKIE, wayfarerCookieOptions } from "@/wayfarer/http";
import {
  CURRENT_USER_CONTEXT_VERSION,
  decideCapability,
  type AuthenticatedCurrentUser,
  type CapabilityDecision,
  type CurrentUserContext,
  type HomeportCapability,
  type HomeportWorkspace,
} from "./current-user";
import { hasActivePlayerWorkspaceLock } from "./workspace-capabilities";

const activeAccountStatuses = new Set(["ACTIVE", "PENDING_VERIFICATION", "GUEST_UNCLAIMED"]);
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

type SessionWithAccount = NonNullable<Awaited<ReturnType<typeof findAccountSession>>>;

function initials(displayName: string) {
  const value = displayName
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("en-US") ?? "")
    .join("");
  return value || "A";
}

function findAccountSession(token: string) {
  return db.accountSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      account: {
        include: {
          profile: {
            include: {
              avatarMedia: { select: { id: true, processingState: true, scanState: true, removedAt: true } },
            },
          },
          emails: { where: { isPrimary: true }, select: { verificationState: true, verifiedAt: true }, take: 1 },
          roles: true,
        },
      },
    },
  });
}

async function classifySession(session: SessionWithAccount): Promise<CurrentUserContext> {
  const base = { contextVersion: CURRENT_USER_CONTEXT_VERSION, authenticated: false as const };
  if (session.revokedAt) return { ...base, status: "revoked" };
  if (session.expiresAt.getTime() <= Date.now()) return { ...base, status: "expired" };
  if (session.account.lockedAt) return { ...base, status: "restricted", reason: "locked" };
  if (session.account.suspendedAt) return { ...base, status: "restricted", reason: "suspended" };
  if (!activeAccountStatuses.has(session.account.status))
    return { ...base, status: "restricted", reason: "account-status" };
  if (session.sessionType === "VERIFICATION") return { ...base, status: "anonymous" };

  const activeRoles = session.account.roles.filter((assignment) => !assignment.revokedAt);
  const roles = new Set(activeRoles.map((assignment) => assignment.role));
  const isAdministrator = roles.has("ADMINISTRATOR");
  const primaryEmail = session.account.emails[0];
  const emailVerified = primaryEmail?.verificationState === "VERIFIED";
  const ordinaryEntry =
    ["ACTIVE", "PENDING_VERIFICATION"].includes(session.account.status) &&
    Boolean(session.account.claimedAt) &&
    Boolean(session.account.ordinaryWorkspaceEntryAt || session.account.status === "PENDING_VERIFICATION");
  // Invitation acceptance creates an account-rooted, unclaimed guest profile. It
  // must retain its own Player Library and historical journal, but it does not
  // gain ordinary Captain or Creator workspace authority until it is claimed.
  const guestPlayerEntry = session.account.status === "GUEST_UNCLAIMED";
  const canUsePlayer = (ordinaryEntry || guestPlayerEntry) && session.account.profile?.status === "ACTIVE";
  const [activePlayerWorkspaceLock, captainPlayerWorkspaceLock] = canUsePlayer
    ? await Promise.all([
        hasActivePlayerWorkspaceLock(session.accountId),
        hasActivePlayerWorkspaceLock(session.accountId, { target: "CAPTAIN" }),
      ])
    : [false, false];
  const canUseCaptain = !captainPlayerWorkspaceLock && (ordinaryEntry || isAdministrator);
  const canUseCreator = !activePlayerWorkspaceLock && (ordinaryEntry || isAdministrator);
  const canModerate = roles.has("MODERATOR") || isAdministrator;
  const canUseAdmiralty = [
    "ADMINISTRATOR",
    "SUPPORT_OPERATOR",
    "SECURITY_OPERATOR",
    "MODERATION_OPERATOR",
    "OPERATIONS_OPERATOR",
    "RELEASE_OPERATOR",
    "AUDIT_OPERATOR",
    "EMERGENCY_OPERATOR",
  ].some((role) => roles.has(role));
  const workspaces: HomeportWorkspace[] = ["public", "account", "community"];
  if (canUsePlayer) workspaces.push("player");
  if (canUseCaptain) workspaces.push("captain");
  if (canUseCreator) workspaces.push("creator");
  const profile = session.account.profile;
  const displayName = (profile?.displayName ?? "Voyagewright account").slice(0, 80);
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        account: [
          session.account.status,
          session.account.updatedAt,
          session.account.lockedAt,
          session.account.suspendedAt,
          session.account.ordinaryWorkspaceEntryAt,
          session.account.emails[0]?.verificationState,
          session.account.emails[0]?.verifiedAt,
        ],
        profile: profile
          ? [
              profile.id,
              profile.status,
              profile.updatedAt,
              profile.displayName,
              profile.handle,
              profile.avatarMedia?.id,
              profile.avatarMedia?.processingState,
              profile.avatarMedia?.scanState,
              profile.avatarMedia?.removedAt,
            ]
          : null,
        roles: session.account.roles
          .map((assignment) => [
            assignment.role,
            assignment.scopeType,
            assignment.scopeId,
            assignment.grantedAt,
            assignment.revokedAt,
          ])
          .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
        session: [session.id, session.expiresAt, session.revokedAt],
        activePlayerWorkspaceLock,
        captainPlayerWorkspaceLock,
      }),
    )
    .digest("hex")
    .slice(0, 20);
  const context: AuthenticatedCurrentUser = {
    contextVersion: CURRENT_USER_CONTEXT_VERSION,
    status: "authenticated",
    authenticated: true,
    user: {
      accountId: session.accountId,
      ...(profile ? { profileId: profile.id } : {}),
      displayName,
      initials: initials(displayName),
      ...(profile?.handle ? { handle: profile.handle.slice(0, 32) } : {}),
      ...(profile?.avatarMedia?.processingState === "READY" &&
      profile.avatarMedia.scanState === "LOCAL_VALIDATED" &&
      !profile.avatarMedia.removedAt
        ? { avatarUrl: `/api/profile-media/${profile.avatarMedia.id}` }
        : {}),
    },
    capabilities: { canUsePlayer, canUseCaptain, canUseCreator, canModerate, isAdministrator, canUseAdmiralty },
    emailVerification: {
      status: emailVerified ? "verified" : "unverified",
      ...(primaryEmail?.verifiedAt ? { verifiedAt: primaryEmail.verifiedAt.toISOString() } : {}),
    },
    workspaces,
    session: { id: session.id, expiresAt: session.expiresAt.toISOString() },
    csrfToken: session.csrfToken,
    revision,
  };
  return context;
}

async function rotateLegacyPlayer(raw: string) {
  const legacy = await db.playerIdentitySession.findFirst({
    where: { tokenHash: hashToken(raw), revokedAt: null, expiresAt: { gt: new Date() }, player: { status: "ACTIVE" } },
    include: { player: true },
  });
  if (!legacy?.player.accountId) return null;
  const issued = await createAccountSession(legacy.player.accountId, "Homeport legacy Player rotation");
  await recordSecurityEvent(legacy.player.accountId, "ACCOUNT_COMPATIBILITY_BRIDGED", { family: "legacy-player" });
  return { issued, session: await findAccountSession(issued.token) };
}

async function rotateLegacyStaff(raw: string) {
  const canonical = await findAccountSession(raw);
  if (canonical) {
    await recordSecurityEvent(canonical.accountId, "ACCOUNT_COMPATIBILITY_BRIDGED", { family: "legacy-staff" });
    return { issued: { token: raw }, session: canonical };
  }
  const legacy = await db.gameMasterSession.findFirst({
    where: { id: hashToken(raw), expiresAt: { gt: new Date() } },
    include: { user: { include: { canonicalAccount: true } } },
  });
  if (!legacy?.user.canonicalAccount) return null;
  const issued = await createAccountSession(legacy.user.canonicalAccount.id, "Homeport legacy staff rotation");
  await recordSecurityEvent(legacy.user.canonicalAccount.id, "ACCOUNT_COMPATIBILITY_BRIDGED", {
    family: "legacy-staff",
  });
  return { issued, session: await findAccountSession(issued.token) };
}

export async function resolveCurrentUser(options: { rotateCompatibility?: boolean } = {}): Promise<CurrentUserContext> {
  const jar = await cookies();
  const canonical = jar.get(WAYFARER_COOKIE)?.value;
  try {
    if (canonical) {
      const session = await findAccountSession(canonical);
      return session
        ? await classifySession(session)
        : { contextVersion: CURRENT_USER_CONTEXT_VERSION, status: "invalid", authenticated: false };
    }

    const legacyStaff = jar.get("forever_gm")?.value;
    const legacyPlayer = jar.get("chronicle_player")?.value;
    if ((legacyStaff || legacyPlayer) && !options.rotateCompatibility)
      return { contextVersion: CURRENT_USER_CONTEXT_VERSION, status: "invalid", authenticated: false };
    const rotated = legacyStaff
      ? await rotateLegacyStaff(legacyStaff)
      : legacyPlayer
        ? await rotateLegacyPlayer(legacyPlayer)
        : null;
    if (!rotated?.session)
      return legacyStaff || legacyPlayer
        ? { contextVersion: CURRENT_USER_CONTEXT_VERSION, status: "invalid", authenticated: false }
        : { contextVersion: CURRENT_USER_CONTEXT_VERSION, status: "anonymous", authenticated: false };

    if (options.rotateCompatibility) {
      jar.set(WAYFARER_COOKIE, rotated.issued.token, wayfarerCookieOptions);
      if (legacyStaff) jar.delete("forever_gm");
      if (legacyPlayer) jar.delete("chronicle_player");
    }
    return await classifySession(rotated.session);
  } catch {
    return {
      contextVersion: CURRENT_USER_CONTEXT_VERSION,
      status: "unavailable",
      authenticated: false,
      correlationId: randomUUID(),
      retryable: true,
    };
  }
}

export async function resolveCapability(capability: HomeportCapability): Promise<CapabilityDecision> {
  return decideCapability(await resolveCurrentUser(), capability);
}
