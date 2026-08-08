import { createHash, createPublicKey, randomBytes, randomUUID, verify } from "node:crypto";
import { db } from "@/lib/db";
import { safeReturnTo } from "@/homeport/return-to";
import { createAccountSession, normalizeDisplayName, normalizeEmail, recordSecurityEvent } from "@/wayfarer/accounts";

export const oauthProviderNames = ["GOOGLE", "GITHUB"] as const;
export type OAuthProviderName = (typeof oauthProviderNames)[number];
export type OAuthIntent = "SIGN_IN" | "LINK";

const attemptAgeMs = 10 * 60_000;
const providerTimeoutMs = 10_000;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const randomUrlToken = () => randomBytes(32).toString("base64url");

type OAuthErrorCode =
  | "ACCOUNT_RESTRICTED"
  | "CANCELLED"
  | "EMAIL_COLLISION"
  | "EMAIL_REQUIRED"
  | "IDENTITY_CONFLICT"
  | "INVALID_CALLBACK"
  | "PROVIDER_UNAVAILABLE"
  | "STATE_INVALID";

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly code: OAuthErrorCode,
  ) {
    super(message);
  }
}

export function isOAuthProvider(value: string): value is OAuthProviderName {
  return oauthProviderNames.includes(value.toUpperCase() as OAuthProviderName);
}

export function oauthTestMode() {
  return process.env.NODE_ENV !== "production" && process.env.VOYAGEWRIGHT_OAUTH_TEST_MODE === "1";
}

const providerEnvironment = {
  GOOGLE: {
    clientId: "VOYAGEWRIGHT_GOOGLE_CLIENT_ID",
    clientSecret: "VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET",
    redirectUri: "VOYAGEWRIGHT_GOOGLE_REDIRECT_URI",
  },
  GITHUB: {
    clientId: "VOYAGEWRIGHT_GITHUB_CLIENT_ID",
    clientSecret: "VOYAGEWRIGHT_GITHUB_CLIENT_SECRET",
    redirectUri: "VOYAGEWRIGHT_GITHUB_REDIRECT_URI",
  },
} as const;

export function oauthProviderConfiguration(provider: OAuthProviderName) {
  const keys = providerEnvironment[provider];
  const clientId = process.env[keys.clientId] ?? "";
  const clientSecret = process.env[keys.clientSecret] ?? "";
  const redirectUri = process.env[keys.redirectUri] ?? "";
  const configured = Boolean(clientId && clientSecret && redirectUri);
  return {
    provider,
    name: provider === "GOOGLE" ? "Google" : "GitHub",
    clientId,
    clientSecret,
    redirectUri,
    configured,
    available: configured || oauthTestMode(),
    testMode: oauthTestMode(),
  };
}

export function publicOAuthProviderConfiguration() {
  return oauthProviderNames.map((provider) => {
    const config = oauthProviderConfiguration(provider);
    return {
      provider,
      name: config.name,
      available: config.available,
      status: config.testMode
        ? "SIMULATED_TEST_ONLY"
        : config.configured
          ? "IMPLEMENTED_CONFIGURED"
          : "IMPLEMENTED_CONFIGURATION_REQUIRED",
    };
  });
}

function boundedRedirect(value: string | undefined, fallback: string) {
  return safeReturnTo(value, fallback);
}

export async function beginOAuthAuthorization(input: {
  provider: OAuthProviderName;
  intent: OAuthIntent;
  accountId?: string;
  redirectPath?: string;
  simulation?: { subject?: string; displayName?: string; email?: string; emailVerified?: boolean };
}) {
  const config = oauthProviderConfiguration(input.provider);
  if (!config.available)
    throw new OAuthError(`${config.name} sign-in is not configured for this deployment.`, "PROVIDER_UNAVAILABLE");
  if (input.intent === "LINK" && !input.accountId)
    throw new OAuthError("Sign in before connecting an identity.", "ACCOUNT_RESTRICTED");
  if (input.intent === "SIGN_IN" && input.accountId)
    throw new OAuthError("Anonymous sign-in state cannot be bound to an account.", "INVALID_CALLBACK");

  const state = randomUrlToken();
  const verifier = randomUrlToken();
  const nonce = randomUrlToken();
  await db.providerLinkAttempt.create({
    data: {
      accountId: input.accountId,
      provider: input.provider,
      intent: input.intent,
      stateHash: hash(state),
      pkceVerifier: verifier,
      nonceHash: hash(nonce),
      redirectPath: boundedRedirect(
        input.redirectPath,
        input.intent === "LINK" ? "/account/linked-identities" : "/passport",
      ),
      expiresAt: new Date(Date.now() + attemptAgeMs),
    },
  });

  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  if (config.testMode) {
    const params = new URLSearchParams({ state, nonce });
    if (input.simulation?.subject) params.set("subject", input.simulation.subject);
    if (input.simulation?.displayName) params.set("displayName", input.simulation.displayName);
    if (input.simulation?.email) params.set("email", input.simulation.email);
    if (input.simulation?.emailVerified === false) params.set("emailVerified", "0");
    return {
      provider: input.provider,
      authorizationUrl: `/api/auth/providers/${input.provider.toLowerCase()}/simulate?${params.toString()}`,
    };
  }

  if (input.provider === "GOOGLE") {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return { provider: input.provider, authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "user:email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return { provider: input.provider, authorizationUrl: `https://github.com/login/oauth/authorize?${params}` };
}

export type ProviderAttempt = {
  id: string;
  accountId: string | null;
  provider: string;
  intent: string;
  pkceVerifier: string;
  nonceHash: string;
  redirectPath: string;
  expiresAt: Date;
};

type VerifiedOAuthIdentity = {
  providerAccountId: string;
  displayName: string;
  avatarReference?: string;
  email: string;
  emailVerified: boolean;
  scopes: string[];
};

function decodeJwtPart(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new OAuthError("Google returned an invalid identity token.", "INVALID_CALLBACK");
  }
}

function safeAvatar(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function providerFetch(url: string, init?: RequestInit) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(providerTimeoutMs) });
  } catch {
    throw new OAuthError("The identity provider did not respond in time.", "PROVIDER_UNAVAILABLE");
  }
}

type SyntheticIdentity = {
  subject: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  avatarReference?: string;
  nonce: string;
};

export function createSyntheticOAuthCode(identity: SyntheticIdentity) {
  if (!oauthTestMode()) throw new OAuthError("Synthetic OAuth is disabled.", "PROVIDER_UNAVAILABLE");
  return `voyagewright-sim.${Buffer.from(JSON.stringify(identity)).toString("base64url")}`;
}

function syntheticIdentity(code: string, attempt: ProviderAttempt): VerifiedOAuthIdentity | null {
  if (!code.startsWith("voyagewright-sim.")) return null;
  if (!oauthTestMode()) throw new OAuthError("Synthetic OAuth is disabled.", "INVALID_CALLBACK");
  try {
    const value = JSON.parse(Buffer.from(code.slice("voyagewright-sim.".length), "base64url").toString("utf8")) as
      | SyntheticIdentity
      | undefined;
    if (
      !value ||
      !/^[A-Za-z0-9_.:-]{3,191}$/u.test(value.subject) ||
      typeof value.displayName !== "string" ||
      typeof value.email !== "string" ||
      typeof value.emailVerified !== "boolean" ||
      typeof value.nonce !== "string" ||
      hash(value.nonce) !== attempt.nonceHash
    )
      throw new Error("invalid synthetic identity");
    return {
      providerAccountId: value.subject,
      displayName: value.displayName,
      avatarReference: safeAvatar(value.avatarReference),
      email: value.email,
      emailVerified: value.emailVerified,
      scopes: attempt.provider === "GOOGLE" ? ["openid", "email", "profile"] : ["user:email"],
    };
  } catch (cause) {
    if (cause instanceof OAuthError) throw cause;
    throw new OAuthError("Synthetic OAuth returned an invalid identity.", "INVALID_CALLBACK");
  }
}

export async function exchangeGoogle(code: string, attempt: ProviderAttempt): Promise<VerifiedOAuthIdentity> {
  const synthetic = syntheticIdentity(code, attempt);
  if (synthetic) return synthetic;
  const config = oauthProviderConfiguration("GOOGLE");
  if (!config.configured) throw new OAuthError("Google sign-in is unavailable.", "PROVIDER_UNAVAILABLE");
  const response = await providerFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: attempt.pkceVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });
  if (!response.ok) throw new OAuthError("Google could not verify this authorization.", "INVALID_CALLBACK");
  const token = (await response.json()) as { id_token?: string; scope?: string };
  if (!token.id_token) throw new OAuthError("Google did not return an identity token.", "INVALID_CALLBACK");
  const parts = token.id_token.split(".");
  if (parts.length !== 3) throw new OAuthError("Google returned an invalid identity token.", "INVALID_CALLBACK");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string")
    throw new OAuthError("Google returned an unsupported identity token.", "INVALID_CALLBACK");
  const jwksResponse = await providerFetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!jwksResponse.ok) throw new OAuthError("Google signing keys are unavailable.", "PROVIDER_UNAVAILABLE");
  const jwks = (await jwksResponse.json()) as { keys?: Array<Record<string, string>> };
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (
    !key ||
    !verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key: key as never, format: "jwk" }),
      Buffer.from(parts[2], "base64url"),
    )
  )
    throw new OAuthError("Google could not verify this identity token.", "INVALID_CALLBACK");

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const issuer = claims.iss;
  const subject = claims.sub;
  const email = claims.email;
  const nonce = claims.nonce;
  if (
    !["https://accounts.google.com", "accounts.google.com"].includes(String(issuer)) ||
    !audiences.includes(config.clientId) ||
    typeof subject !== "string" ||
    subject.length < 1 ||
    subject.length > 191 ||
    (audiences.length > 1 && claims.azp !== config.clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 300 ||
    typeof nonce !== "string" ||
    hash(nonce) !== attempt.nonceHash ||
    typeof email !== "string" ||
    claims.email_verified !== true
  )
    throw new OAuthError("Google identity claims did not match this authorization.", "INVALID_CALLBACK");
  return {
    providerAccountId: subject,
    displayName: typeof claims.name === "string" ? claims.name : "Google member",
    avatarReference: safeAvatar(claims.picture),
    email,
    emailVerified: true,
    scopes: token.scope?.split(" ").filter(Boolean) ?? ["openid", "email", "profile"],
  };
}

export async function exchangeGitHub(code: string, attempt: ProviderAttempt): Promise<VerifiedOAuthIdentity> {
  const synthetic = syntheticIdentity(code, attempt);
  if (synthetic) return synthetic;
  const config = oauthProviderConfiguration("GITHUB");
  if (!config.configured) throw new OAuthError("GitHub sign-in is unavailable.", "PROVIDER_UNAVAILABLE");
  const tokenResponse = await providerFetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: attempt.pkceVerifier,
    }),
  });
  if (!tokenResponse.ok) throw new OAuthError("GitHub could not verify this authorization.", "INVALID_CALLBACK");
  const token = (await tokenResponse.json()) as { access_token?: string; scope?: string; error?: string };
  if (!token.access_token || token.error)
    throw new OAuthError("GitHub did not return a usable authorization.", "INVALID_CALLBACK");
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token.access_token}`,
    "x-github-api-version": "2026-03-10",
    "user-agent": "Voyagewright-OAuth",
  };
  const [userResponse, emailsResponse] = await Promise.all([
    providerFetch("https://api.github.com/user", { headers }),
    providerFetch("https://api.github.com/user/emails?per_page=100", { headers }),
  ]);
  if (!userResponse.ok || !emailsResponse.ok)
    throw new OAuthError("GitHub could not verify the selected account and email.", "INVALID_CALLBACK");
  const user = (await userResponse.json()) as {
    id?: number | string;
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
  };
  const emails = (await emailsResponse.json()) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
  const providerAccountId = String(user.id ?? "");
  if (!/^\d{1,30}$/u.test(providerAccountId))
    throw new OAuthError("GitHub did not return an immutable account identifier.", "INVALID_CALLBACK");
  const verified =
    emails.find((entry) => entry.primary && entry.verified && entry.email) ??
    emails.find((entry) => entry.verified && entry.email);
  if (!verified?.email) throw new OAuthError("GitHub did not provide a verified email address.", "EMAIL_REQUIRED");
  return {
    providerAccountId,
    displayName: user.name?.trim() || user.login?.trim() || "GitHub member",
    avatarReference: safeAvatar(user.avatar_url),
    email: verified.email,
    emailVerified: true,
    scopes: token.scope?.split(/[ ,]+/u).filter(Boolean) ?? ["user:email"],
  };
}

function cleanDisplayName(value: string) {
  const cleaned = value.normalize("NFKC").replaceAll("@", "").trim().replace(/\s+/gu, " ").slice(0, 80);
  return cleaned || "Voyagewright member";
}

function providerDisplayName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").slice(0, 191) || "Voyagewright member";
}

async function uniqueDisplayName(provider: OAuthProviderName, identity: VerifiedOAuthIdentity) {
  const base = cleanDisplayName(identity.displayName);
  const normalized = normalizeDisplayName(base);
  const existing = await db.playerProfile.findUnique({
    where: { normalizedDisplayName: normalized },
    select: { id: true },
  });
  if (!existing) return { displayName: base, normalizedDisplayName: normalized };
  const suffix = `${provider === "GOOGLE" ? "Google" : "GitHub"} ${hash(identity.providerAccountId).slice(0, 6)}`;
  const displayName = `${base.slice(0, Math.max(1, 77 - suffix.length))} - ${suffix}`;
  return { displayName, normalizedDisplayName: normalizeDisplayName(displayName) };
}

function assertAccountEligible(account: {
  status: string;
  lockedAt: Date | null;
  suspendedAt: Date | null;
  profile: unknown;
}) {
  if (
    !["ACTIVE", "PENDING_VERIFICATION"].includes(account.status) ||
    account.lockedAt ||
    account.suspendedAt ||
    !account.profile
  )
    throw new OAuthError("This account cannot use provider sign-in in its current state.", "ACCOUNT_RESTRICTED");
}

async function signInExistingIdentity(
  provider: OAuthProviderName,
  identity: VerifiedOAuthIdentity,
  deviceLabel?: string,
) {
  const linked = await db.externalIdentity.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.providerAccountId } },
    include: { account: { include: { profile: true } } },
  });
  if (!linked) return null;
  if (linked.status !== "LINKED" || linked.revokedAt || !linked.useForLogin)
    throw new OAuthError("This linked identity is not enabled for sign-in.", "ACCOUNT_RESTRICTED");
  assertAccountEligible(linked.account);
  await db.externalIdentity.update({
    where: { id: linked.id },
    data: {
      providerDisplayName: providerDisplayName(identity.displayName),
      avatarReference: identity.avatarReference,
      allowedScopes: JSON.stringify(identity.scopes),
      encryptedToken: null,
      lastVerifiedAt: new Date(),
      refreshedAt: new Date(),
    },
  });
  const session = await createAccountSession(linked.accountId, deviceLabel, "ORDINARY");
  await recordSecurityEvent(linked.accountId, "ACCOUNT_SIGNED_IN_WITH_EXTERNAL_IDENTITY", { provider }).catch(
    () => undefined,
  );
  return { accountId: linked.accountId, session };
}

async function linkIdentity(accountId: string, provider: OAuthProviderName, identity: VerifiedOAuthIdentity) {
  try {
    return await db.$transaction(async (tx) => {
      const account = await tx.userAccount.findUnique({ where: { id: accountId }, include: { profile: true } });
      if (!account) throw new OAuthError("The signed-in account no longer exists.", "ACCOUNT_RESTRICTED");
      assertAccountEligible(account);
      const existing = await tx.externalIdentity.findUnique({
        where: { provider_providerAccountId: { provider, providerAccountId: identity.providerAccountId } },
      });
      if (existing && existing.accountId !== accountId)
        throw new OAuthError("That provider identity is already connected to another account.", "IDENTITY_CONFLICT");
      const data = {
        providerDisplayName: providerDisplayName(identity.displayName),
        avatarReference: identity.avatarReference,
        allowedScopes: JSON.stringify(identity.scopes),
        encryptedToken: null,
        useForLogin: true,
        status: "LINKED",
        revokedAt: null,
        lastVerifiedAt: new Date(),
        refreshedAt: new Date(),
      };
      const linked = existing
        ? await tx.externalIdentity.update({ where: { id: existing.id }, data })
        : await tx.externalIdentity.create({
            data: { accountId, provider, providerAccountId: identity.providerAccountId, ...data },
          });
      await tx.securityEvent.create({
        data: {
          accountId,
          eventType: existing ? "EXTERNAL_IDENTITY_REVERIFIED" : "EXTERNAL_IDENTITY_LINKED",
          correlationId: randomUUID(),
          metadata: JSON.stringify({ provider, identityId: linked.id }),
        },
      });
      return { identityId: linked.id };
    });
  } catch (cause) {
    if ((cause as { code?: string })?.code === "P2002")
      throw new OAuthError("That provider identity is already connected to another account.", "IDENTITY_CONFLICT");
    throw cause;
  }
}

async function createAccountFromIdentity(
  provider: OAuthProviderName,
  identity: VerifiedOAuthIdentity,
  deviceLabel?: string,
) {
  if (!identity.emailVerified)
    throw new OAuthError("A verified provider email is required to create an account.", "EMAIL_REQUIRED");
  const normalizedEmail = normalizeEmail(identity.email);
  if (!/^\S+@\S+\.\S+$/u.test(normalizedEmail) || normalizedEmail.length > 254)
    throw new OAuthError("The provider returned an unusable email address.", "EMAIL_REQUIRED");
  const collision = await db.accountEmail.findUnique({ where: { normalizedEmail }, select: { id: true } });
  if (collision)
    throw new OAuthError(
      "An account already uses that email address. Sign in to that account, then connect this provider in Settings.",
      "EMAIL_COLLISION",
    );
  const names = await uniqueDisplayName(provider, identity);
  try {
    const accountId = await db.$transaction(async (tx) => {
      const emailOwner = await tx.accountEmail.findUnique({ where: { normalizedEmail }, select: { id: true } });
      if (emailOwner)
        throw new OAuthError(
          "An account already uses that email address. Sign in to that account, then connect this provider in Settings.",
          "EMAIL_COLLISION",
        );
      const now = new Date();
      const account = await tx.userAccount.create({
        data: { status: "ACTIVE", claimedAt: now, ordinaryWorkspaceEntryAt: now, lastSeenAt: now },
      });
      await tx.playerProfile.create({
        data: { accountId: account.id, ...names, status: "ACTIVE", claimedAt: now },
      });
      await tx.accountEmail.create({
        data: {
          accountId: account.id,
          normalizedEmail,
          displayEmail: identity.email.trim(),
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      });
      await tx.accountRoleAssignment.create({ data: { accountId: account.id, role: "PLAYER" } });
      const linked = await tx.externalIdentity.create({
        data: {
          accountId: account.id,
          provider,
          providerAccountId: identity.providerAccountId,
          providerDisplayName: providerDisplayName(identity.displayName),
          avatarReference: identity.avatarReference,
          allowedScopes: JSON.stringify(identity.scopes),
          encryptedToken: null,
          useForLogin: true,
          status: "LINKED",
          lastVerifiedAt: now,
          refreshedAt: now,
        },
      });
      await tx.securityEvent.createMany({
        data: [
          {
            accountId: account.id,
            eventType: "ACCOUNT_CREATED_WITH_EXTERNAL_IDENTITY",
            correlationId: randomUUID(),
            metadata: JSON.stringify({ provider }),
          },
          {
            accountId: account.id,
            eventType: "EXTERNAL_IDENTITY_LINKED",
            correlationId: randomUUID(),
            metadata: JSON.stringify({ provider, identityId: linked.id }),
          },
        ],
      });
      return account.id;
    });
    return { accountId, session: await createAccountSession(accountId, deviceLabel, "ORDINARY") };
  } catch (cause) {
    if (cause instanceof OAuthError) throw cause;
    if ((cause as { code?: string })?.code === "P2002") {
      const existing = await signInExistingIdentity(provider, identity, deviceLabel);
      if (existing) return existing;
      throw new OAuthError(
        "That email or provider identity is already attached to an account. Sign in first, then connect it in Settings.",
        "EMAIL_COLLISION",
      );
    }
    throw cause;
  }
}

export async function cancelOAuthAuthorization(provider: OAuthProviderName, state: string) {
  const result = await db.providerLinkAttempt.updateMany({
    where: {
      provider,
      stateHash: hash(state),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { consumedAt: new Date(), pkceVerifier: "consumed" },
  });
  if (!result.count) throw new OAuthError("OAuth state is invalid or expired.", "STATE_INVALID");
}

export async function completeOAuthAuthorization(input: {
  provider: OAuthProviderName;
  state: string;
  code: string;
  currentAccountId?: string;
  deviceLabel?: string;
}) {
  const attempt = (await db.providerLinkAttempt.findFirst({
    where: {
      provider: input.provider,
      stateHash: hash(input.state),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  })) as ProviderAttempt | null;
  if (!attempt || !["SIGN_IN", "LINK"].includes(attempt.intent))
    throw new OAuthError("OAuth state is invalid or expired.", "STATE_INVALID");
  if (attempt.intent === "LINK" && (!attempt.accountId || attempt.accountId !== input.currentAccountId))
    throw new OAuthError("This provider callback is not bound to the signed-in account.", "STATE_INVALID");
  if (attempt.intent === "SIGN_IN" && attempt.accountId)
    throw new OAuthError("This sign-in callback is bound to an unexpected account.", "STATE_INVALID");
  const consumed = await db.providerLinkAttempt.updateMany({
    where: { id: attempt.id, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date(), pkceVerifier: "consumed" },
  });
  if (!consumed.count) throw new OAuthError("OAuth state was already used.", "STATE_INVALID");

  const identity =
    input.provider === "GOOGLE" ? await exchangeGoogle(input.code, attempt) : await exchangeGitHub(input.code, attempt);
  if (attempt.intent === "LINK") {
    await linkIdentity(attempt.accountId!, input.provider, identity);
    return { kind: "LINKED" as const, redirectPath: attempt.redirectPath };
  }
  const existing = await signInExistingIdentity(input.provider, identity, input.deviceLabel);
  const authenticated = existing ?? (await createAccountFromIdentity(input.provider, identity, input.deviceLabel));
  return {
    kind: "SIGNED_IN" as const,
    redirectPath: attempt.redirectPath,
    accountId: authenticated.accountId,
    session: authenticated.session,
  };
}
