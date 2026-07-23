import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { db } from "@/lib/db";
import { ProfileError, type Visibility, visibilityValues } from "@/wayfarer/profile";

export const providerNames = [
  "DISCORD",
  "STEAM",
  "MICROSOFT_ACCOUNT",
  "XBOX_NETWORK",
  "EPIC_GAMES",
  "TWITCH",
  "GOOGLE",
  "APPLE",
  "EA_ACCOUNT",
  "PLAYSTATION_NETWORK",
  "NINTENDO_ACCOUNT",
  "BATTLE_NET",
  "UBISOFT_CONNECT",
  "CUSTOM_OIDC",
  "DISCORD_SIMULATOR",
  "STEAM_SIMULATOR",
  "MICROSOFT_SIMULATOR",
] as const;
type ProviderName = (typeof providerNames)[number];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const randomUrlToken = () => randomBytes(32).toString("base64url");

function redirectPath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/passport/providers";
}

function encryptionKey() {
  const raw = process.env.WAYFARER_PROVIDER_TOKEN_KEY;
  if (!raw) throw new ProfileError("Provider token storage is not configured.", "FORBIDDEN");
  return createHash("sha256").update(raw).digest();
}

export function encryptProviderToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptProviderToken(value: string) {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) throw new ProfileError("Stored provider token is malformed.", "FORBIDDEN");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function listProviderAdapters() {
  const configured = (...keys: string[]) => keys.every((key) => Boolean(process.env[key]));
  const simulated = process.env.NODE_ENV !== "production" || process.env.WAYFARER_PROVIDER_SIMULATORS === "1";
  return [
    {
      provider: "DISCORD",
      name: "Discord",
      identityClass: "social",
      protocol: "OAuth 2.0",
      status: "IMPLEMENTED_CONFIGURATION_REQUIRED",
      available: configured("DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_REDIRECT_URI"),
      login: true,
      link: true,
      publicProfile: true,
      avatar: true,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: true,
      unlink: true,
      productionAvailability: "configuration-required",
      externalApproval: "Discord developer application",
    },
    {
      provider: "STEAM",
      name: "Steam",
      identityClass: "gaming",
      protocol: "OpenID 2.0",
      status: "IMPLEMENTED_CONFIGURATION_REQUIRED",
      available: configured("STEAM_OPENID_RETURN_URI", "STEAM_OPENID_REALM"),
      login: true,
      link: true,
      publicProfile: true,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: true,
      productionAvailability: "configuration-required",
      externalApproval: "Steam OpenID return URL and realm",
    },
    {
      provider: "MICROSOFT_ACCOUNT",
      name: "Microsoft account",
      identityClass: "account",
      protocol: "OAuth 2.0 / OpenID Connect",
      status: "IMPLEMENTED_CONFIGURATION_REQUIRED",
      available: configured("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI"),
      login: true,
      link: true,
      publicProfile: true,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: true,
      productionAvailability: "configuration-required",
      externalApproval: "Microsoft Entra application registration",
    },
    {
      provider: "XBOX_NETWORK",
      name: "Xbox Network",
      identityClass: "gaming capability",
      protocol: "partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "Xbox publisher provisioning",
    },
    {
      provider: "EPIC_GAMES",
      name: "Epic Games",
      identityClass: "gaming",
      protocol: "OAuth / partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "Epic approved account-services flow",
    },
    {
      provider: "TWITCH",
      name: "Twitch",
      identityClass: "creator",
      protocol: "OAuth 2.0",
      status: "PLANNED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "planned",
      externalApproval: "Twitch application registration",
    },
    {
      provider: "GOOGLE",
      name: "Google",
      identityClass: "account",
      protocol: "OpenID Connect",
      status: "PLANNED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "planned",
      externalApproval: "Google OAuth client",
    },
    {
      provider: "APPLE",
      name: "Apple",
      identityClass: "account",
      protocol: "OpenID Connect",
      status: "PLANNED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "planned",
      externalApproval: "Apple developer service ID",
    },
    {
      provider: "EA_ACCOUNT",
      name: "EA Account",
      identityClass: "gaming",
      protocol: "partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "EA approved third-party API",
    },
    {
      provider: "PLAYSTATION_NETWORK",
      name: "PlayStation Network",
      identityClass: "gaming",
      protocol: "partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "PlayStation partner access",
    },
    {
      provider: "NINTENDO_ACCOUNT",
      name: "Nintendo Account",
      identityClass: "gaming",
      protocol: "partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "Nintendo developer approval",
    },
    {
      provider: "BATTLE_NET",
      name: "Battle.net",
      identityClass: "gaming",
      protocol: "OAuth 2.0",
      status: "PLANNED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "planned",
      externalApproval: "Battle.net client registration",
    },
    {
      provider: "UBISOFT_CONNECT",
      name: "Ubisoft Connect",
      identityClass: "gaming",
      protocol: "partner API",
      status: "PARTNER_GATED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "partner-gated",
      externalApproval: "Ubisoft partner approval",
    },
    {
      provider: "CUSTOM_OIDC",
      name: "Other OpenID Connect identity",
      identityClass: "account",
      protocol: "OpenID Connect",
      status: "DISABLED",
      available: false,
      login: false,
      link: false,
      publicProfile: false,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: false,
      productionAvailability: "disabled",
      externalApproval: "per-issuer security review",
    },
    {
      provider: "DISCORD_SIMULATOR",
      name: "Discord simulator",
      identityClass: "test",
      protocol: "deterministic simulator",
      status: "SIMULATED_TEST_ONLY",
      available: simulated,
      login: true,
      link: true,
      publicProfile: true,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: true,
      unlink: true,
      productionAvailability: "test-only",
      externalApproval: "none",
    },
    {
      provider: "STEAM_SIMULATOR",
      name: "Steam OpenID simulator",
      identityClass: "test",
      protocol: "deterministic OpenID simulator",
      status: "SIMULATED_TEST_ONLY",
      available: simulated,
      login: true,
      link: true,
      publicProfile: true,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: false,
      unlink: true,
      productionAvailability: "test-only",
      externalApproval: "none",
    },
    {
      provider: "MICROSOFT_SIMULATOR",
      name: "Microsoft OIDC simulator",
      identityClass: "test",
      protocol: "deterministic OIDC simulator",
      status: "SIMULATED_TEST_ONLY",
      available: simulated,
      login: true,
      link: true,
      publicProfile: true,
      avatar: false,
      invitationDelivery: false,
      presence: false,
      friendDiscovery: false,
      tokenRefresh: true,
      unlink: true,
      productionAvailability: "test-only",
      externalApproval: "none",
    },
  ] as const;
}

export async function beginProviderLink(accountId: string, provider: string, requestedRedirect?: string) {
  if (!providerNames.includes(provider as ProviderName)) throw new ProfileError("That provider is not supported.");
  const adapter = listProviderAdapters().find((item) => item.provider === provider);
  if (!adapter?.available || !adapter.link)
    throw new ProfileError("That provider is not configured for linking.", "FORBIDDEN");
  const state = randomUrlToken();
  const verifier = randomUrlToken();
  const nonce = randomUrlToken();
  const attempt = await db.providerLinkAttempt.create({
    data: {
      accountId,
      provider,
      stateHash: hash(state),
      pkceVerifier: verifier,
      nonceHash: hash(nonce),
      redirectPath: redirectPath(requestedRedirect),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  if (provider.endsWith("_SIMULATOR"))
    return {
      provider,
      state,
      nonce,
      codeChallenge: challenge,
      callback: `/api/passport/providers/callback?provider=${provider}&state=${encodeURIComponent(state)}&nonce=${encodeURIComponent(nonce)}`,
    };
  if (provider === "STEAM") {
    const returnUri = process.env.STEAM_OPENID_RETURN_URI!;
    const realm = process.env.STEAM_OPENID_REALM!;
    const returnTo = new URL(returnUri);
    returnTo.searchParams.set("state", state);
    const params = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo.toString(),
      "openid.realm": realm,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });
    return { provider, authorizationUrl: `https://steamcommunity.com/openid/login?${params}` };
  }
  if (provider === "MICROSOFT_ACCOUNT") {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: "code",
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      response_mode: "query",
      scope: "openid profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return {
      provider,
      authorizationUrl: `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}`,
    };
  }
  const clientId = process.env.DISCORD_CLIENT_ID;
  const callback = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !callback) {
    await db.providerLinkAttempt.delete({ where: { id: attempt.id } });
    throw new ProfileError("Discord linking is not configured for this deployment.", "FORBIDDEN");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return { provider, authorizationUrl: `https://discord.com/oauth2/authorize?${params}` };
}

type ProviderIdentity = {
  accountId: string;
  displayName: string;
  avatarReference?: string;
  accessToken?: string;
  scopes: string[];
};
type ProviderAttempt = {
  id: string;
  accountId: string;
  provider: string;
  stateHash: string;
  pkceVerifier: string;
  nonceHash: string;
};

function decodeJwtPart(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new ProfileError("Microsoft returned an invalid identity token.");
  }
}

async function exchangeMicrosoft(code: string, attempt: ProviderAttempt): Promise<ProviderIdentity> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri)
    throw new ProfileError("Microsoft account linking is not configured for this deployment.", "FORBIDDEN");
  const tokenResponse = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: attempt.pkceVerifier,
    }),
  });
  if (!tokenResponse.ok) throw new ProfileError("Microsoft could not verify this link.");
  const token = (await tokenResponse.json()) as { access_token?: string; id_token?: string; scope?: string };
  if (!token.access_token || !token.id_token) throw new ProfileError("Microsoft did not return a verified identity.");
  const parts = token.id_token.split(".");
  if (parts.length !== 3) throw new ProfileError("Microsoft returned an invalid identity token.");
  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string")
    throw new ProfileError("Microsoft returned an unsupported identity token.");
  const jwksResponse = await fetch("https://login.microsoftonline.com/consumers/discovery/v2.0/keys");
  if (!jwksResponse.ok) throw new ProfileError("Microsoft signing keys are unavailable.");
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
    throw new ProfileError("Microsoft could not verify this identity token.");
  const now = Math.floor(Date.now() / 1000);
  const issuer = typeof claims.iss === "string" ? claims.iss : "";
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    !issuer.startsWith("https://login.microsoftonline.com/") ||
    !issuer.endsWith("/v2.0") ||
    !audience.includes(clientId) ||
    typeof claims.sub !== "string" ||
    typeof claims.nonce !== "string" ||
    hash(claims.nonce) !== attempt.nonceHash ||
    typeof claims.exp !== "number" ||
    claims.exp <= now
  )
    throw new ProfileError("Microsoft identity claims did not match this linking request.", "FORBIDDEN");
  return {
    accountId: claims.sub,
    displayName:
      (typeof claims.name === "string" && claims.name) ||
      (typeof claims.preferred_username === "string" && claims.preferred_username) ||
      "Microsoft account",
    accessToken: token.access_token,
    scopes: token.scope?.split(" ").filter(Boolean) ?? ["openid", "profile"],
  };
}

async function exchange(provider: string, code: string, attempt: ProviderAttempt): Promise<ProviderIdentity> {
  if (provider.endsWith("_SIMULATOR")) {
    const match = /^sim:([a-zA-Z0-9_-]{3,80}):(.{1,80})$/.exec(code);
    if (!match) throw new ProfileError("Simulator code is invalid.");
    return {
      accountId: match[1],
      displayName: match[2].trim(),
      accessToken: `simulated:${match[1]}:${attempt.pkceVerifier.slice(0, 12)}`,
      scopes:
        provider === "STEAM_SIMULATOR"
          ? ["openid"]
          : provider === "MICROSOFT_SIMULATOR"
            ? ["openid", "profile"]
            : ["identify"],
    };
  }
  if (provider === "MICROSOFT_ACCOUNT") return exchangeMicrosoft(code, attempt);
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri)
    throw new ProfileError("Discord linking is not configured for this deployment.", "FORBIDDEN");
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: attempt.pkceVerifier,
    }),
  });
  if (!tokenResponse.ok) throw new ProfileError("Discord could not verify this link.");
  const token = (await tokenResponse.json()) as { access_token?: string; scope?: string };
  if (!token.access_token) throw new ProfileError("Discord did not return an access token.");
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) throw new ProfileError("Discord could not read the selected identity.");
  const user = (await userResponse.json()) as { id?: string; global_name?: string; username?: string; avatar?: string };
  if (!user.id) throw new ProfileError("Discord did not return an immutable account identifier.");
  return {
    accountId: user.id,
    displayName: user.global_name || user.username || "Discord member",
    avatarReference: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : undefined,
    accessToken: token.access_token,
    scopes: token.scope?.split(" ").filter(Boolean) ?? ["identify"],
  };
}

function providerAttemptWhere(input: { accountId: string; provider: string; state: string }) {
  return {
    accountId: input.accountId,
    provider: input.provider,
    stateHash: hash(input.state),
    consumedAt: null,
    expiresAt: { gt: new Date() },
  };
}

async function persistLinkedIdentity(input: { attempt: ProviderAttempt; identity: ProviderIdentity }) {
  const { attempt, identity } = input;
  try {
    const linked = await db.$transaction(async (tx) => {
      const existing = await tx.externalIdentity.findUnique({
        where: { provider_providerAccountId: { provider: attempt.provider, providerAccountId: identity.accountId } },
      });
      if (existing && existing.accountId !== attempt.accountId)
        throw new ProfileError("That provider identity is already linked to another account.", "CONFLICT");
      const data = {
        providerDisplayName: identity.displayName,
        avatarReference: identity.avatarReference,
        allowedScopes: JSON.stringify(identity.scopes),
        encryptedToken: identity.accessToken ? encryptProviderToken(identity.accessToken) : null,
        status: "LINKED",
        revokedAt: null,
        lastVerifiedAt: new Date(),
        refreshedAt: new Date(),
      };
      const record = existing
        ? await tx.externalIdentity.update({ where: { id: existing.id }, data })
        : await tx.externalIdentity.create({
            data: {
              accountId: attempt.accountId,
              provider: attempt.provider,
              providerAccountId: identity.accountId,
              ...data,
            },
          });
      await tx.providerLinkAttempt.update({
        where: { id: attempt.id },
        data: { consumedAt: new Date(), pkceVerifier: "consumed" },
      });
      return record;
    });
    return {
      id: linked.id,
      provider: linked.provider,
      displayName: linked.providerDisplayName,
      visibility: linked.visibility,
      useForLogin: linked.useForLogin,
    };
  } catch (cause) {
    if ((cause as { code?: string })?.code === "P2002")
      throw new ProfileError("That provider identity is already linked to another account.", "CONFLICT");
    throw cause;
  }
}

export async function completeProviderLink(input: {
  accountId: string;
  provider: string;
  state: string;
  nonce?: string;
  code: string;
}) {
  const attempt = await db.providerLinkAttempt.findFirst({
    where: providerAttemptWhere({ accountId: input.accountId, provider: input.provider, state: input.state }),
  });
  if (!attempt) throw new ProfileError("Provider link state is invalid or expired.", "FORBIDDEN");
  if (input.provider.endsWith("_SIMULATOR") && (!input.nonce || hash(input.nonce) !== attempt.nonceHash))
    throw new ProfileError("Provider link state is invalid or expired.", "FORBIDDEN");
  if (input.provider === "STEAM") throw new ProfileError("Steam linking must return its signed OpenID assertion.");
  return persistLinkedIdentity({ attempt, identity: await exchange(input.provider, input.code, attempt) });
}

export async function completeSteamOpenIdLink(input: { accountId: string; state: string; assertion: URLSearchParams }) {
  const attempt = await db.providerLinkAttempt.findFirst({
    where: providerAttemptWhere({ ...input, provider: "STEAM" }),
  });
  if (!attempt) throw new ProfileError("Provider link state is invalid or expired.", "FORBIDDEN");
  const expectedReturn = process.env.STEAM_OPENID_RETURN_URI;
  const expectedRealm = process.env.STEAM_OPENID_REALM;
  const mode = input.assertion.get("openid.mode");
  const claimedId = input.assertion.get("openid.claimed_id");
  const returnTo = input.assertion.get("openid.return_to");
  if (!expectedReturn || !expectedRealm || mode !== "id_res" || !claimedId || !returnTo)
    throw new ProfileError("Steam returned an invalid OpenID assertion.", "FORBIDDEN");
  const returned = new URL(returnTo);
  const expected = new URL(expectedReturn);
  const steamId = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimedId)?.[1];
  if (
    returned.origin !== expected.origin ||
    returned.pathname !== expected.pathname ||
    returned.searchParams.get("state") !== input.state ||
    !steamId
  )
    throw new ProfileError("Steam identity claims did not match this linking request.", "FORBIDDEN");
  const verification = new URLSearchParams(input.assertion);
  verification.set("openid.mode", "check_authentication");
  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verification,
  });
  if (!response.ok || !(await response.text()).split(/\r?\n/).includes("is_valid:true"))
    throw new ProfileError("Steam could not verify this OpenID assertion.");
  return persistLinkedIdentity({
    attempt,
    identity: { accountId: steamId, displayName: `Steam ${steamId}`, scopes: ["openid"] },
  });
}

export async function updateExternalIdentity(
  accountId: string,
  identityId: string,
  input: { visibility?: Visibility; useForLogin?: boolean },
) {
  if (input.visibility && !visibilityValues.includes(input.visibility))
    throw new ProfileError("Choose a supported provider visibility.");
  const identity = await db.externalIdentity.findFirst({
    where: { id: identityId, accountId, status: "LINKED", revokedAt: null },
  });
  if (!identity) throw new ProfileError("Linked identity not found.", "NOT_FOUND");
  return db.externalIdentity.update({
    where: { id: identity.id },
    data: { visibility: input.visibility, useForLogin: input.useForLogin },
  });
}

export async function unlinkExternalIdentity(accountId: string, identityId: string) {
  const identities = await db.externalIdentity.findMany({ where: { accountId, status: "LINKED", revokedAt: null } });
  const target = identities.find((item) => item.id === identityId);
  if (!target) throw new ProfileError("Linked identity not found.", "NOT_FOUND");
  const account = await db.userAccount.findUnique({
    where: { id: accountId },
    select: {
      credential: { select: { id: true } },
      emails: { where: { verificationState: "VERIFIED" }, select: { id: true } },
    },
  });
  const otherLogin = identities.some((item) => item.id !== identityId && item.useForLogin);
  if (target.useForLogin && !otherLogin && !account?.credential && !account?.emails.length)
    throw new ProfileError("Add another login or recovery method before unlinking this identity.", "FORBIDDEN");
  await db.externalIdentity.update({
    where: { id: identityId },
    data: { status: "REVOKED", revokedAt: new Date(), encryptedToken: null, useForLogin: false, visibility: "ONLY_ME" },
  });
}

export async function safeLinkedIdentities(accountId: string) {
  return db.externalIdentity.findMany({
    where: { accountId },
    select: {
      id: true,
      provider: true,
      providerDisplayName: true,
      avatarReference: true,
      allowedScopes: true,
      useForLogin: true,
      visibility: true,
      status: true,
      linkedAt: true,
      lastVerifiedAt: true,
      revokedAt: true,
    },
    orderBy: { linkedAt: "desc" },
  });
}
