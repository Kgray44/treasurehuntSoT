import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { db } from "@/lib/db";
import { hashToken, makeToken } from "@/lib/security";

const bcryptRounds = 12;
const sessionAgeMs = 1000 * 60 * 60 * 24 * 30;
const verificationAgeMs = 1000 * 60 * 60 * 24;
const resetAgeMs = 1000 * 60 * 30;

type Delivery = {
  purpose: "VERIFY_EMAIL" | "PASSWORD_RESET" | "EMAIL_CHANGE" | "EMAIL_CHANGE_NOTICE";
  email: string;
  token?: string;
  accountId: string;
  detail?: string;
};
const developmentOutbox: Delivery[] = [];

export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "CONFLICT" | "UNAVAILABLE" = "INVALID",
  ) {
    super(message);
  }
}

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}

export async function canonicalAccountForLegacyActor(actorId?: string | null) {
  if (!actorId) return null;
  const account = await db.userAccount.findFirst({
    where: { OR: [{ id: actorId }, { legacyGameMasterId: actorId }] },
    select: { id: true },
  });
  return account?.id ?? null;
}

export function assertPasswordPolicy(password: string) {
  if (password.length < 12 || password.length > 256 || !/\S/.test(password))
    throw new AccountError("Choose a password with at least 12 characters.");
}

function safeDisplayName(displayName: string) {
  const value = displayName.trim();
  if (value.length < 1 || value.length > 80 || value.includes("@"))
    throw new AccountError("Choose a visible display name without an email address.");
  return value;
}

export async function recordSecurityEvent(
  accountId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  await db.securityEvent.create({
    data: { accountId, eventType, correlationId: randomUUID(), metadata: JSON.stringify(metadata) },
  });
}

function queueDelivery(delivery: Delivery) {
  // Production delivery receives raw one-time material only through its configured
  // adapter. Local governed runs may opt into a task-owned synthetic outbox so a
  // separate browser process can inspect delivery without putting raw tokens in DB.
  const taskOwnedAdapter = process.env.HOMEPORT_SYNTHETIC_EMAIL_ADAPTER === "TASK_OWNED_TEST";
  if (process.env.NODE_ENV === "production" && !taskOwnedAdapter) return;
  if (process.env.NODE_ENV !== "production") developmentOutbox.push(delivery);
  const requestedPath = process.env.HOMEPORT_SYNTHETIC_OUTBOX_PATH;
  if (!taskOwnedAdapter || !requestedPath) return;
  const requestedRoot = process.env.HOMEPORT_PHASE7_TASK_ROOT;
  if (!requestedRoot) throw new AccountError("Synthetic email delivery is not configured safely.", "UNAVAILABLE");
  const taskRoot = resolve(requestedRoot);
  const outboxPath = resolve(requestedPath);
  if (!outboxPath.startsWith(`${taskRoot}${sep}`))
    throw new AccountError("Synthetic email delivery is not configured safely.", "UNAVAILABLE");
  mkdirSync(dirname(outboxPath), { recursive: true });
  appendFileSync(outboxPath, `${JSON.stringify({ ...delivery, queuedAt: new Date().toISOString() })}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function takeDevelopmentDelivery(purpose: Delivery["purpose"], email: string) {
  const normalized = normalizeEmail(email);
  const index = developmentOutbox.findIndex((item) => item.purpose === purpose && item.email === normalized);
  return index < 0 ? null : developmentOutbox.splice(index, 1)[0];
}

async function issueToken(
  accountId: string,
  purpose: Exclude<Delivery["purpose"], "EMAIL_CHANGE_NOTICE">,
  email: string,
  expiresInMs: number,
  pendingEmail?: { normalized: string; display: string },
) {
  const token = makeToken(32);
  await db.$transaction([
    db.accountToken.updateMany({ where: { accountId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.accountToken.create({
      data: {
        accountId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + expiresInMs),
        pendingNormalizedEmail: pendingEmail?.normalized,
        pendingDisplayEmail: pendingEmail?.display,
      },
    }),
  ]);
  queueDelivery({ purpose, email, token, accountId });
  return token;
}

export async function createAccountSession(accountId: string, deviceLabel?: string) {
  const token = makeToken(32);
  const csrfToken = makeToken(24);
  const expiresAt = new Date(Date.now() + sessionAgeMs);
  const session = await db.accountSession.create({
    data: { accountId, tokenHash: hashToken(token), csrfToken, expiresAt, deviceLabel: deviceLabel?.slice(0, 80) },
  });
  await db.userAccount.update({ where: { id: accountId }, data: { lastSeenAt: new Date() } });
  return { id: session.id, token, csrfToken, expiresAt };
}

export async function ensureGuestAccountForProfile(profileId: string) {
  const profile = await db.playerProfile.findUnique({
    where: { id: profileId },
    select: { accountId: true, displayName: true },
  });
  if (!profile) throw new AccountError("Guest profile no longer exists.", "UNAVAILABLE");
  if (profile.accountId) return profile.accountId;
  const account = await db.$transaction(async (tx) => {
    const fresh = await tx.playerProfile.findUnique({ where: { id: profileId }, select: { accountId: true } });
    if (fresh?.accountId) return { id: fresh.accountId };
    const created = await tx.userAccount.create({ data: { status: "GUEST_UNCLAIMED" } });
    await tx.playerProfile.update({ where: { id: profileId }, data: { accountId: created.id } });
    await tx.accountRoleAssignment.create({ data: { accountId: created.id, role: "PLAYER" } });
    await tx.securityEvent.create({
      data: { accountId: created.id, eventType: "GUEST_IDENTITY_CREATED", correlationId: randomUUID(), metadata: "{}" },
    });
    return created;
  });
  return account.id;
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
  deviceLabel?: string;
}) {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AccountError("Enter a valid email address.");
  assertPasswordPolicy(input.password);
  const displayName = safeDisplayName(input.displayName);
  const passwordHash = await hash(input.password, bcryptRounds);
  try {
    const account = await db.$transaction(async (tx) => {
      const created = await tx.userAccount.create({ data: { status: "PENDING_VERIFICATION", claimedAt: new Date() } });
      const profile = await tx.playerProfile.create({
        data: { accountId: created.id, displayName, status: "ACTIVE", claimedAt: new Date() },
      });
      await tx.accountEmail.create({
        data: { accountId: created.id, normalizedEmail: email, displayEmail: input.email.trim() },
      });
      await tx.accountCredential.create({ data: { accountId: created.id, passwordHash } });
      await tx.accountRoleAssignment.create({ data: { accountId: created.id, role: "PLAYER" } });
      await tx.securityEvent.create({
        data: { accountId: created.id, eventType: "ACCOUNT_REGISTERED", correlationId: randomUUID(), metadata: "{}" },
      });
      return { ...created, profile };
    });
    await issueToken(account.id, "VERIFY_EMAIL", email, verificationAgeMs);
    return { account, session: await createAccountSession(account.id, input.deviceLabel) };
  } catch (cause) {
    if (typeof cause === "object" && cause && "code" in cause && (cause as { code?: string }).code === "P2002")
      throw new AccountError("An account already uses that email address.", "CONFLICT");
    throw cause;
  }
}

export async function findActiveAccountByLogin(login: string) {
  const normalized = normalizeEmail(login);
  const emailAccount = await db.accountEmail.findUnique({
    where: { normalizedEmail: normalized },
    include: { account: { include: { credential: true, profile: true, roles: { where: { revokedAt: null } } } } },
  });
  if (emailAccount) return emailAccount.account;
  const legacyProfile = await db.playerProfile.findFirst({
    where: { username: login.trim().toLocaleLowerCase("en-US") },
    include: { account: { include: { credential: true, profile: true, roles: { where: { revokedAt: null } } } } },
  });
  return legacyProfile?.account ?? null;
}

export async function authenticateAccount(login: string, password: string, deviceLabel?: string) {
  const account = await findActiveAccountByLogin(login);
  if (!account?.credential || !account.profile || !["ACTIVE", "PENDING_VERIFICATION"].includes(account.status))
    return null;
  if (!(await compare(password, account.credential.passwordHash))) return null;
  const session = await createAccountSession(account.id, deviceLabel);
  await recordSecurityEvent(account.id, "ACCOUNT_SIGNED_IN");
  return { account, session };
}

export async function currentAccount(token: string) {
  return db.accountSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      account: {
        status: { in: ["ACTIVE", "PENDING_VERIFICATION", "GUEST_UNCLAIMED"] },
        lockedAt: null,
        suspendedAt: null,
      },
    },
    include: { account: { include: { profile: true, roles: { where: { revokedAt: null } } } } },
  });
}

export async function verifyAccountEmail(rawToken: string) {
  const token = await db.accountToken.findFirst({
    where: { purpose: "VERIFY_EMAIL", tokenHash: hashToken(rawToken), consumedAt: null, expiresAt: { gt: new Date() } },
    include: { account: { include: { emails: true } } },
  });
  if (!token) throw new AccountError("That verification link is invalid or expired.");
  await db.$transaction([
    db.accountToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } }),
    db.accountEmail.updateMany({
      where: { accountId: token.accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt: new Date() },
    }),
    db.userAccount.update({ where: { id: token.accountId }, data: { status: "ACTIVE", claimedAt: new Date() } }),
  ]);
  await recordSecurityEvent(token.accountId, "EMAIL_VERIFIED");
}

export async function resendVerification(accountId: string) {
  const email = await db.accountEmail.findFirst({ where: { accountId, isPrimary: true } });
  if (!email || email.verificationState === "VERIFIED") return;
  await issueToken(accountId, "VERIFY_EMAIL", email.normalizedEmail, verificationAgeMs);
  await recordSecurityEvent(accountId, "EMAIL_VERIFICATION_RESENT");
}

export async function requestPasswordReset(email: string) {
  const normalized = normalizeEmail(email);
  const recipient = await db.accountEmail.findUnique({
    where: { normalizedEmail: normalized },
    include: { account: true },
  });
  if (recipient && recipient.verificationState === "VERIFIED" && recipient.account.status === "ACTIVE") {
    await issueToken(recipient.accountId, "PASSWORD_RESET", normalized, resetAgeMs);
    await recordSecurityEvent(recipient.accountId, "PASSWORD_RESET_REQUESTED");
  }
}

export async function requestEmailChange(accountId: string, password: string, requestedEmail: string) {
  const normalized = normalizeEmail(requestedEmail);
  if (!/^\S+@\S+\.\S+$/.test(normalized) || normalized.length > 254)
    throw new AccountError("Enter a valid new email address.");
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    include: { credential: true, emails: { where: { isPrimary: true }, take: 1 } },
  });
  const current = account?.emails[0];
  if (!account?.credential || account.status !== "ACTIVE" || !current || current.verificationState !== "VERIFIED")
    throw new AccountError("Email change is unavailable until this account and its primary email are active.");
  if (!(await compare(password, account.credential.passwordHash)))
    throw new AccountError("Reauthentication failed. Check your password and try again.");
  if (current.normalizedEmail === normalized)
    throw new AccountError("Choose an email address different from the current one.");
  const collision = await db.accountEmail.findUnique({ where: { normalizedEmail: normalized }, select: { id: true } });
  if (collision) throw new AccountError("That email address cannot be used.", "CONFLICT");
  await issueToken(accountId, "EMAIL_CHANGE", normalized, verificationAgeMs, {
    normalized,
    display: requestedEmail.trim(),
  });
  await recordSecurityEvent(accountId, "EMAIL_CHANGE_REQUESTED", { currentEmailId: current.id });
}

export async function confirmEmailChange(rawToken: string) {
  const token = await db.accountToken.findFirst({
    where: {
      purpose: "EMAIL_CHANGE",
      tokenHash: hashToken(rawToken),
      consumedAt: null,
      expiresAt: { gt: new Date() },
      pendingNormalizedEmail: { not: null },
      pendingDisplayEmail: { not: null },
    },
    include: { account: { include: { emails: { where: { isPrimary: true }, take: 1 } } } },
  });
  const nextNormalized = token?.pendingNormalizedEmail;
  const nextDisplay = token?.pendingDisplayEmail;
  const current = token?.account.emails[0];
  if (!token || !nextNormalized || !nextDisplay || !current)
    throw new AccountError("That email-change link is invalid or expired.");
  const collision = await db.accountEmail.findUnique({ where: { normalizedEmail: nextNormalized } });
  if (collision && collision.id !== current.id)
    throw new AccountError("That email address cannot be used.", "CONFLICT");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.accountToken.update({ where: { id: token.id }, data: { consumedAt: now } });
    await tx.accountToken.updateMany({
      where: { accountId: token.accountId, purpose: "EMAIL_CHANGE", consumedAt: null },
      data: { consumedAt: now },
    });
    await tx.accountEmail.update({
      where: { id: current.id },
      data: {
        normalizedEmail: nextNormalized,
        displayEmail: nextDisplay,
        verificationState: "VERIFIED",
        verifiedAt: now,
      },
    });
    await tx.accountSession.updateMany({
      where: { accountId: token.accountId, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.securityEvent.create({
      data: {
        accountId: token.accountId,
        eventType: "EMAIL_CHANGED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ emailId: current.id }),
      },
    });
  });
  queueDelivery({
    purpose: "EMAIL_CHANGE_NOTICE",
    email: current.normalizedEmail,
    accountId: token.accountId,
    detail: "The primary email address was changed. Use account recovery if this was not you.",
  });
  return { displayEmail: nextDisplay };
}

export async function claimGuestAccount(input: { accountId: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AccountError("Enter a valid email address.");
  assertPasswordPolicy(input.password);
  const passwordHash = await hash(input.password, bcryptRounds);
  const account = await db.userAccount.findUnique({ where: { id: input.accountId }, include: { profile: true } });
  if (!account?.profile || account.status !== "GUEST_UNCLAIMED")
    throw new AccountError("This guest identity cannot be claimed.");
  try {
    await db.$transaction(async (tx) => {
      await tx.accountEmail.create({
        data: { accountId: account.id, normalizedEmail: email, displayEmail: input.email.trim() },
      });
      await tx.accountCredential.create({ data: { accountId: account.id, passwordHash } });
      await tx.userAccount.update({
        where: { id: account.id },
        data: { status: "PENDING_VERIFICATION", claimedAt: new Date() },
      });
      await tx.playerProfile.update({ where: { id: account.profile!.id }, data: { claimedAt: new Date() } });
      await tx.securityEvent.create({
        data: { accountId: account.id, eventType: "GUEST_CLAIMED", correlationId: randomUUID(), metadata: "{}" },
      });
    });
  } catch (cause) {
    if (typeof cause === "object" && cause && "code" in cause && (cause as { code?: string }).code === "P2002")
      throw new AccountError("An account already uses that email address.", "CONFLICT");
    throw cause;
  }
  await issueToken(account.id, "VERIFY_EMAIL", email, verificationAgeMs);
}

export async function mergeGuestIntoAccount(guestAccountId: string, targetAccountId: string) {
  if (guestAccountId === targetAccountId) return { idempotent: true };
  const result = await db.$transaction(async (tx) => {
    const [guest, target] = await Promise.all([
      tx.userAccount.findUnique({
        where: { id: guestAccountId },
        include: { profile: { include: { memberships: true } } },
      }),
      tx.userAccount.findUnique({ where: { id: targetAccountId }, include: { profile: true } }),
    ]);
    if (!guest || guest.status === "MERGED") return { idempotent: true };
    if (!guest.profile || !target?.profile || guest.status !== "GUEST_UNCLAIMED")
      throw new AccountError("Guest merge is unavailable.");
    for (const membership of guest.profile.memberships) {
      const existing = await tx.playthroughMembership.findUnique({
        where: {
          playthroughId_playerProfileId: {
            playthroughId: membership.playthroughId,
            playerProfileId: target.profile.id,
          },
        },
      });
      if (existing) {
        await tx.playthroughMembership.update({
          where: { id: existing.id },
          data: {
            joinedAt: existing.joinedAt ?? membership.joinedAt,
            completedAt: existing.completedAt ?? membership.completedAt,
            pinnedAt: existing.pinnedAt ?? membership.pinnedAt,
            hiddenAt: existing.hiddenAt ?? membership.hiddenAt,
          },
        });
        await tx.playthroughMembership.delete({ where: { id: membership.id } });
      } else {
        await tx.playthroughMembership.update({
          where: { id: membership.id },
          data: { playerProfileId: target.profile.id },
        });
      }
    }
    await tx.invitation.updateMany({
      where: { intendedPlayerId: guest.profile.id },
      data: { intendedPlayerId: target.profile.id },
    });
    await tx.accountSession.updateMany({
      where: { accountId: guest.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.userAccount.update({
      where: { id: guest.id },
      data: { status: "MERGED", mergedIntoAccountId: target.id },
    });
    await tx.securityEvent.create({
      data: {
        accountId: target.id,
        eventType: "GUEST_MERGED",
        correlationId: randomUUID(),
        metadata: JSON.stringify({ guestAccountId: guest.id }),
      },
    });
    return { idempotent: false };
  });
  return result;
}

export async function resetPassword(rawToken: string, password: string) {
  assertPasswordPolicy(password);
  const token = await db.accountToken.findFirst({
    where: {
      purpose: "PASSWORD_RESET",
      tokenHash: hashToken(rawToken),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!token) throw new AccountError("That password-reset link is invalid or expired.");
  const passwordHash = await hash(password, bcryptRounds);
  await db.$transaction(async (tx) => {
    await tx.accountToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
    await tx.accountToken.updateMany({
      where: { accountId: token.accountId, purpose: "PASSWORD_RESET", consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.accountCredential.upsert({
      where: { accountId: token.accountId },
      update: { passwordHash, changedAt: new Date() },
      create: { accountId: token.accountId, passwordHash },
    });
    await tx.accountSession.updateMany({
      where: { accountId: token.accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.securityEvent.create({
      data: {
        accountId: token.accountId,
        eventType: "PASSWORD_RESET_COMPLETED",
        correlationId: randomUUID(),
        metadata: "{}",
      },
    });
  });
  return createAccountSession(token.accountId, "Password reset");
}

export async function revokeAccountSession(accountId: string, sessionId: string) {
  const result = await db.accountSession.updateMany({
    where: { id: sessionId, accountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw new AccountError("Session not found.");
  await recordSecurityEvent(accountId, "SESSION_REVOKED", { sessionId });
}

export async function revokeAllAccountSessions(accountId: string, exceptSessionId?: string) {
  await db.accountSession.updateMany({
    where: { accountId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
  await recordSecurityEvent(accountId, "ALL_SESSIONS_REVOKED");
}
