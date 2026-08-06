import { compare, hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken, makeToken } from "@/lib/security";
import {
  assertTransactionalEmailAvailable,
  sendTransactionalEmail,
  takeDevelopmentDelivery,
  type TransactionalEmailPurpose,
} from "@/wayfarer/transactional-email";
import {
  createEmailVerificationCode,
  emailVerificationCodeHash,
  emailVerificationPolicy,
  verificationCodeMatches,
} from "@/wayfarer/verification-policy";
import { assessPassword } from "@/wayfarer/password-policy";

const bcryptRounds = 12;
const sessionAgeMs = 1000 * 60 * 60 * 24 * 30;
const actionTokenAgeMs = 1000 * 60 * 60 * 24;
const resetAgeMs = 1000 * 60 * 30;

export { takeDevelopmentDelivery };

export class AccountError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID" | "CONFLICT" | "UNAVAILABLE" = "INVALID",
    readonly kind?: "DISPLAY_NAME_CONFLICT" | "EMAIL_CONFLICT" | "DELIVERY_FAILED" | "PASSWORD_INVALID",
    readonly field?: "displayName" | "email" | "password" | "confirmPassword",
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

export function assertPasswordPolicy(password: string, identity: { email?: string; displayName?: string } = {}) {
  const assessment = assessPassword(password, identity);
  if (!assessment.acceptable) throw new AccountError(assessment.message, "INVALID", "PASSWORD_INVALID", "password");
  return assessment;
}

function safeDisplayName(displayName: string) {
  const value = displayName.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (value.length < 1 || value.length > 80 || value.includes("@"))
    throw new AccountError("Choose a visible display name without an email address.");
  return value;
}

export function normalizeDisplayName(displayName: string) {
  return safeDisplayName(displayName).toLocaleLowerCase("en-US");
}

function emailConflict() {
  return new AccountError(
    "An account already uses this email address. Sign in instead.",
    "CONFLICT",
    "EMAIL_CONFLICT",
    "email",
  );
}

function displayNameConflict() {
  return new AccountError("That display name is already in use.", "CONFLICT", "DISPLAY_NAME_CONFLICT", "displayName");
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

async function issueToken(
  accountId: string,
  purpose: Extract<TransactionalEmailPurpose, "VERIFY_EMAIL" | "PASSWORD_RESET" | "EMAIL_CHANGE">,
  email: string,
  expiresInMs: number,
  pendingEmail?: { normalized: string; display: string },
) {
  assertTransactionalEmailAvailable();
  const token = purpose === "VERIFY_EMAIL" ? createEmailVerificationCode() : makeToken(32);
  const tokenHash = purpose === "VERIFY_EMAIL" ? emailVerificationCodeHash(accountId, email, token) : hashToken(token);
  const [, created] = await db.$transaction([
    db.accountToken.updateMany({ where: { accountId, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.accountToken.create({
      data: {
        accountId,
        purpose,
        tokenHash,
        expiresAt: new Date(Date.now() + expiresInMs),
        maxAttempts: purpose === "VERIFY_EMAIL" ? emailVerificationPolicy.maxAttempts : 5,
        pendingNormalizedEmail: pendingEmail?.normalized,
        pendingDisplayEmail: pendingEmail?.display,
      },
    }),
  ]);
  await sendTransactionalEmail({ purpose, email, token, accountId, accountTokenId: created.id });
  return token;
}

export async function createAccountSession(
  accountId: string,
  deviceLabel?: string,
  sessionType: "ORDINARY" | "VERIFICATION" = "ORDINARY",
) {
  const token = makeToken(32);
  const csrfToken = makeToken(24);
  const expiresAt = new Date(Date.now() + sessionAgeMs);
  const session = await db.accountSession.create({
    data: {
      accountId,
      tokenHash: hashToken(token),
      csrfToken,
      expiresAt,
      deviceLabel: deviceLabel?.slice(0, 80),
      sessionType,
    },
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
  confirmPassword?: string;
  displayName: string;
  deviceLabel?: string;
}) {
  assertTransactionalEmailAvailable();
  const email = normalizeEmail(input.email);
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AccountError("Enter a valid email address.");
  const displayName = safeDisplayName(input.displayName);
  const normalizedDisplayName = normalizeDisplayName(displayName);
  if (input.confirmPassword !== undefined && input.password !== input.confirmPassword)
    throw new AccountError("Passwords do not match.", "INVALID", undefined, "confirmPassword");
  assertPasswordPolicy(input.password, { email, displayName });

  const [existingEmail, existingNormalizedDisplay, legacyProfiles] = await Promise.all([
    db.accountEmail.findUnique({ where: { normalizedEmail: email }, select: { id: true } }),
    db.playerProfile.findUnique({ where: { normalizedDisplayName }, select: { id: true } }),
    db.playerProfile.findMany({
      where: { normalizedDisplayName: null },
      select: { displayName: true },
    }),
  ]);
  if (existingEmail) throw emailConflict();
  if (
    existingNormalizedDisplay ||
    legacyProfiles.some((profile) => normalizeDisplayName(profile.displayName) === normalizedDisplayName)
  )
    throw displayNameConflict();

  const passwordHash = await hash(input.password, bcryptRounds);
  const verificationCode = createEmailVerificationCode();
  const sessionToken = makeToken(32);
  const csrfToken = makeToken(24);
  const expiresAt = new Date(Date.now() + sessionAgeMs);
  try {
    const registered = await db.$transaction(async (tx) => {
      const emailOwner = await tx.accountEmail.findUnique({ where: { normalizedEmail: email }, select: { id: true } });
      if (emailOwner) throw emailConflict();
      const displayOwner = await tx.playerProfile.findUnique({
        where: { normalizedDisplayName },
        select: { id: true },
      });
      if (displayOwner) throw displayNameConflict();
      const unresolvedProfiles = await tx.playerProfile.findMany({
        where: { normalizedDisplayName: null },
        select: { displayName: true },
      });
      if (unresolvedProfiles.some((profile) => normalizeDisplayName(profile.displayName) === normalizedDisplayName))
        throw displayNameConflict();

      const now = new Date();
      const created = await tx.userAccount.create({
        data: { status: "PENDING_VERIFICATION", claimedAt: now, lastSeenAt: now },
      });
      const profile = await tx.playerProfile.create({
        data: { accountId: created.id, displayName, normalizedDisplayName, status: "ACTIVE", claimedAt: now },
      });
      await tx.accountEmail.create({
        data: { accountId: created.id, normalizedEmail: email, displayEmail: input.email.trim() },
      });
      await tx.accountCredential.create({ data: { accountId: created.id, passwordHash } });
      await tx.accountRoleAssignment.create({ data: { accountId: created.id, role: "PLAYER" } });
      await tx.securityEvent.create({
        data: { accountId: created.id, eventType: "ACCOUNT_REGISTERED", correlationId: randomUUID(), metadata: "{}" },
      });
      const accountToken = await tx.accountToken.create({
        data: {
          accountId: created.id,
          purpose: "VERIFY_EMAIL",
          tokenHash: emailVerificationCodeHash(created.id, email, verificationCode),
          expiresAt: new Date(Date.now() + emailVerificationPolicy.expiresMs),
          maxAttempts: emailVerificationPolicy.maxAttempts,
        },
      });
      const session = await tx.accountSession.create({
        data: {
          accountId: created.id,
          tokenHash: hashToken(sessionToken),
          csrfToken,
          expiresAt,
          deviceLabel: input.deviceLabel?.slice(0, 80),
          sessionType: "VERIFICATION",
        },
      });
      return { account: { ...created, profile }, accountToken, session };
    });
    let deliveryState: "SUBMITTED" | "FAILED" = "SUBMITTED";
    try {
      await sendTransactionalEmail({
        purpose: "VERIFY_EMAIL",
        email,
        token: verificationCode,
        accountId: registered.account.id,
        accountTokenId: registered.accountToken.id,
        displayName,
      });
    } catch {
      deliveryState = "FAILED";
      await recordSecurityEvent(registered.account.id, "ACCOUNT_VERIFICATION_DELIVERY_FAILED").catch(() => undefined);
    }
    return {
      account: registered.account,
      session: {
        id: registered.session.id,
        token: sessionToken,
        csrfToken,
        expiresAt,
      },
      deliveryState,
    };
  } catch (cause) {
    if (cause instanceof AccountError) throw cause;
    if (typeof cause === "object" && cause && "code" in cause && (cause as { code?: string }).code === "P2002") {
      const target = JSON.stringify((cause as { meta?: unknown }).meta ?? "");
      if (target.includes("normalizedDisplayName")) throw displayNameConflict();
      if (target.includes("normalizedEmail")) throw emailConflict();
    }
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
  const session = await createAccountSession(account.id, deviceLabel, "ORDINARY");
  await recordSecurityEvent(account.id, "ACCOUNT_SIGNED_IN");
  return { account, session };
}

export async function currentAccount(token: string, sessionTypes: readonly string[] = ["ORDINARY"]) {
  return db.accountSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      sessionType: { in: [...sessionTypes] },
      revokedAt: null,
      expiresAt: { gt: new Date() },
      account: {
        status: { in: ["ACTIVE", "PENDING_VERIFICATION", "GUEST_UNCLAIMED"] },
        lockedAt: null,
        suspendedAt: null,
      },
    },
    include: {
      account: {
        include: {
          profile: true,
          emails: { where: { isPrimary: true }, take: 1 },
          roles: { where: { revokedAt: null } },
        },
      },
    },
  });
}

export async function verifyAccountEmail(accountId: string, rawCode: string) {
  const token = await db.accountToken.findFirst({
    where: { accountId, purpose: "VERIFY_EMAIL", consumedAt: null },
    include: { account: { include: { emails: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!token) throw new AccountError("That verification code is invalid or has been replaced.");
  if (token.expiresAt.getTime() <= Date.now()) throw new AccountError("That verification code has expired.");
  if (token.attemptCount >= token.maxAttempts)
    throw new AccountError("Too many incorrect attempts. Request a new verification code.");
  const primaryEmail = token.account.emails.find((email) => email.isPrimary)?.normalizedEmail;
  if (!primaryEmail || !verificationCodeMatches(accountId, primaryEmail, rawCode, token.tokenHash)) {
    await db.accountToken.update({
      where: { id: token.id },
      data: { attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    });
    throw new AccountError(
      token.attemptCount + 1 >= token.maxAttempts
        ? "Too many incorrect attempts. Request a new verification code."
        : "That verification code is incorrect.",
    );
  }
  const now = new Date();
  await db.$transaction([
    db.accountToken.update({ where: { id: token.id }, data: { consumedAt: now, lastAttemptAt: now } }),
    db.accountEmail.updateMany({
      where: { accountId: token.accountId, isPrimary: true },
      data: { verificationState: "VERIFIED", verifiedAt: now },
    }),
    db.userAccount.update({
      where: { id: token.accountId },
      data: { status: "ACTIVE", claimedAt: now, ordinaryWorkspaceEntryAt: now },
    }),
  ]);
  await recordSecurityEvent(token.accountId, "EMAIL_VERIFIED");
}

export async function resendVerification(accountId: string) {
  const email = await db.accountEmail.findFirst({ where: { accountId, isPrimary: true } });
  if (!email || email.verificationState === "VERIFIED") return;
  const latest = await db.accountToken.findFirst({
    where: { accountId, purpose: "VERIFY_EMAIL" },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const retryableDeliveryFailure = latest
    ? await db.transactionalEmailDelivery.findFirst({
        where: { accountId, accountTokenId: latest.id, purpose: "VERIFY_EMAIL", status: "FAILED" },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (
    latest &&
    !retryableDeliveryFailure &&
    Date.now() - latest.createdAt.getTime() < emailVerificationPolicy.resendCooldownMs
  )
    throw new AccountError("Wait 60 seconds before requesting another verification code.");
  const recentCount = await db.accountToken.count({
    where: { accountId, purpose: "VERIFY_EMAIL", createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
  });
  if (recentCount >= emailVerificationPolicy.maxResendsPerHour)
    throw new AccountError("Verification resend is temporarily rate limited.");
  await issueToken(accountId, "VERIFY_EMAIL", email.normalizedEmail, emailVerificationPolicy.expiresMs);
  await recordSecurityEvent(accountId, "EMAIL_VERIFICATION_RESENT");
}

export async function repairPendingVerificationChallenge(accountId: string) {
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    include: { emails: { where: { isPrimary: true }, take: 1 } },
  });
  const email = account?.emails[0];
  if (!account || account.status !== "PENDING_VERIFICATION" || !email || email.verificationState === "VERIFIED")
    throw new AccountError("Only a complete unverified account can receive a repaired challenge.", "INVALID");
  await issueToken(account.id, "VERIFY_EMAIL", email.normalizedEmail, emailVerificationPolicy.expiresMs);
  await recordSecurityEvent(account.id, "ACCOUNT_VERIFICATION_CHALLENGE_REPAIRED");
}

export function maskEmailAddress(email: string) {
  return email.replace(
    /^(.)(.*)(@.*)$/u,
    (_match, first: string, middle: string, domain: string) =>
      `${first}${"•".repeat(Math.min(6, Math.max(2, middle.length)))}${domain}`,
  );
}

export async function changePendingVerificationEmail(accountId: string, requestedEmail: string) {
  assertTransactionalEmailAvailable();
  const normalized = normalizeEmail(requestedEmail);
  if (!/^\S+@\S+\.\S+$/u.test(normalized) || normalized.length > 254)
    throw new AccountError("Enter a valid email address.");
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    include: { emails: { where: { isPrimary: true }, take: 1 } },
  });
  const current = account?.emails[0];
  if (!account || account.status !== "PENDING_VERIFICATION" || !current)
    throw new AccountError("The registration email can only be changed before verification.");
  if (current.normalizedEmail === normalized)
    throw new AccountError("Enter a different email address, or resend the current code.");
  const collision = await db.accountEmail.findUnique({ where: { normalizedEmail: normalized }, select: { id: true } });
  if (collision) throw new AccountError("That email address cannot be used.", "CONFLICT");
  try {
    await db.accountEmail.update({
      where: { id: current.id },
      data: {
        normalizedEmail: normalized,
        displayEmail: requestedEmail.trim(),
        verificationState: "UNVERIFIED",
        verifiedAt: null,
      },
    });
  } catch (cause) {
    if (typeof cause === "object" && cause && "code" in cause && (cause as { code?: string }).code === "P2002")
      throw new AccountError("That email address cannot be used.", "CONFLICT");
    throw cause;
  }
  await issueToken(accountId, "VERIFY_EMAIL", normalized, emailVerificationPolicy.expiresMs);
  await recordSecurityEvent(accountId, "PENDING_VERIFICATION_EMAIL_CHANGED", { emailId: current.id });
  return { maskedEmail: maskEmailAddress(requestedEmail.trim()) };
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
  await issueToken(accountId, "EMAIL_CHANGE", normalized, actionTokenAgeMs, {
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
  await sendTransactionalEmail({
    purpose: "EMAIL_CHANGE_NOTICE",
    email: current.normalizedEmail,
    accountId: token.accountId,
    detail: "The primary email address was changed. Use account recovery if this was not you.",
  });
  return { displayEmail: nextDisplay };
}

export async function claimGuestAccount(input: { accountId: string; email: string; password: string }) {
  assertTransactionalEmailAvailable();
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
  await issueToken(account.id, "VERIFY_EMAIL", email, emailVerificationPolicy.expiresMs);
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
  const primary = await db.accountEmail.findFirst({
    where: { accountId: token.accountId, isPrimary: true, verificationState: "VERIFIED" },
  });
  if (primary)
    await sendTransactionalEmail({
      purpose: "PASSWORD_CHANGED_NOTICE",
      email: primary.normalizedEmail,
      accountId: token.accountId,
      detail: "The account password was changed. Use account recovery if this was not you.",
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
