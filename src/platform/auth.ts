import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashToken, makeToken } from "@/lib/security";
import { safeEqual } from "@/lib/security";
import { readTaleSessionCookie } from "@/tall-tale/session-cookie";
import { authenticateAccount, createAccountSession, currentAccount, revokeAccountSession } from "@/wayfarer/accounts";

const PLAYER_IDENTITY_COOKIE = "tall_tale_player";
const ACCOUNT_IDENTITY_COOKIE = "wayfarer_account";
const PENDING_INVITATION_COOKIE = "tall_tale_pending_invitation";
const playerSessionAgeMs = 1000 * 60 * 60 * 24 * 30;

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export async function createPlayerIdentitySession(playerProfileId: string) {
  const profile = await db.playerProfile.findUnique({ where: { id: playerProfileId }, select: { accountId: true } });
  if (profile?.accountId) {
    const session = await createAccountSession(profile.accountId);
    (await cookies()).set(ACCOUNT_IDENTITY_COOKIE, session.token, cookieOptions(playerSessionAgeMs / 1000));
    return session.csrfToken;
  }
  const jar = await cookies();
  const previous = jar.get(PLAYER_IDENTITY_COOKIE)?.value;
  if (previous)
    await db.playerIdentitySession.updateMany({
      where: { tokenHash: hashToken(previous), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  const token = makeToken();
  const csrfToken = makeToken(24);
  await db.playerIdentitySession.create({
    data: {
      playerProfileId,
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt: new Date(Date.now() + playerSessionAgeMs),
    },
  });
  jar.set(PLAYER_IDENTITY_COOKIE, token, cookieOptions(playerSessionAgeMs / 1000));
  await db.playerProfile.update({ where: { id: playerProfileId }, data: { lastSeenAt: new Date() } });
  return csrfToken;
}

export async function requirePlayerIdentity() {
  const canonicalToken = (await cookies()).get(ACCOUNT_IDENTITY_COOKIE)?.value;
  if (canonicalToken) {
    const session = await currentAccount(canonicalToken);
    if (session?.account.profile)
      return {
        id: session.id,
        accountId: session.accountId,
        playerProfileId: session.account.profile.id,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
        player: session.account.profile,
      };
  }
  const token = (await cookies()).get(PLAYER_IDENTITY_COOKIE)?.value;
  if (!token) return null;
  return db.playerIdentitySession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      player: { status: "ACTIVE" },
    },
    include: { player: true },
  });
}

export async function signInPlayer(username: string, password: string) {
  const account = await authenticateAccount(username, password);
  if (account?.account.profile) {
    (await cookies()).set(ACCOUNT_IDENTITY_COOKIE, account.session.token, cookieOptions(playerSessionAgeMs / 1000));
    return { player: account.account.profile, csrfToken: account.session.csrfToken };
  }
  const player = await db.playerProfile.findFirst({
    where: { username: username.trim().toLocaleLowerCase(), status: "ACTIVE" },
  });
  if (!player?.passwordHash || !(await compare(password, player.passwordHash))) return null;
  return { player, csrfToken: await createPlayerIdentitySession(player.id) };
}

export async function verifyPlayerCsrf(provided: string | null) {
  const session = await requirePlayerIdentity();
  return Boolean(session && provided && safeEqual(session.csrfToken, provided));
}

export async function clearPlayerIdentitySession() {
  const jar = await cookies();
  const canonicalToken = jar.get(ACCOUNT_IDENTITY_COOKIE)?.value;
  if (canonicalToken) {
    const session = await currentAccount(canonicalToken);
    if (session) await revokeAccountSession(session.accountId, session.id);
    jar.delete(ACCOUNT_IDENTITY_COOKIE);
  }
  const token = jar.get(PLAYER_IDENTITY_COOKIE)?.value;
  if (token)
    await db.playerIdentitySession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  jar.delete(PLAYER_IDENTITY_COOKIE);
}

export async function setPendingInvitationToken(token: string) {
  const csrfToken = makeToken(24);
  (await cookies()).set(PENDING_INVITATION_COOKIE, `${token}.${csrfToken}`, cookieOptions(30 * 60));
  return csrfToken;
}

export async function readPendingInvitationToken() {
  const value = (await cookies()).get(PENDING_INVITATION_COOKIE)?.value;
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  return separator > 0 ? value.slice(0, separator) : null;
}

export async function readPendingInvitationCsrf() {
  const value = (await cookies()).get(PENDING_INVITATION_COOKIE)?.value;
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  return separator > 0 ? value.slice(separator + 1) : null;
}

export async function verifyPendingInvitationCsrf(provided: string | null) {
  const expected = await readPendingInvitationCsrf();
  return Boolean(expected && provided && safeEqual(expected, provided));
}

export async function clearPendingInvitationToken() {
  (await cookies()).delete(PENDING_INVITATION_COOKIE);
}

export async function playerCanAccessPlaythrough(playthroughId: string, playerId?: string) {
  const identity = playerId ? null : await requirePlayerIdentity();
  const resolvedPlayerId = playerId ?? identity?.playerProfileId;
  if (!resolvedPlayerId) return false;
  return Boolean(
    await db.playthroughMembership.findFirst({
      where: {
        playthroughId,
        playerProfileId: resolvedPlayerId,
        status: { in: ["INVITED", "ACCEPTED", "READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] },
      },
      select: { id: true },
    }),
  );
}

export async function authorizeTaleSessionPlayer(playthroughId: string) {
  const identity = await requirePlayerIdentity();
  if (identity && (await playerCanAccessPlaythrough(playthroughId, identity.playerProfileId)))
    return {
      kind: "identity" as const,
      playerId: identity.playerProfileId,
      identitySessionId: identity.id,
      csrfToken: identity.csrfToken,
    };
  const legacy = await readTaleSessionCookie(playthroughId);
  if (!legacy) return null;
  const session = await db.taleSession.findFirst({
    where: { id: playthroughId, accessTokenHash: hashToken(legacy.token) },
    select: { id: true },
  });
  return session ? { kind: "legacy" as const, token: legacy.token } : null;
}

export async function pendingInvitationMatches(invitationId: string) {
  const credential = await readPendingInvitationToken();
  if (!credential) return false;
  const where = credential.startsWith("code:")
    ? { shortCodeHash: hashToken(credential.slice(5)) }
    : { tokenHash: hashToken(credential) };
  return Boolean(await db.invitation.findFirst({ where: { id: invitationId, ...where }, select: { id: true } }));
}
