import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ProfileError, type Visibility, visibilityValues } from "@/wayfarer/profile";

const providerNames = ["DISCORD", "DISCORD_SIMULATOR"] as const;
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
  return [
    {
      provider: "DISCORD",
      available: Boolean(
        process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI,
      ),
      mode: "external",
    },
    { provider: "DISCORD_SIMULATOR", available: process.env.NODE_ENV !== "production", mode: "simulated" },
  ] as const;
}

export async function beginProviderLink(accountId: string, provider: string, requestedRedirect?: string) {
  if (!providerNames.includes(provider as ProviderName)) throw new ProfileError("That provider is not supported.");
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
  if (provider === "DISCORD_SIMULATOR")
    return {
      provider,
      state,
      nonce,
      codeChallenge: challenge,
      callback: `/api/passport/providers/callback?provider=${provider}&state=${encodeURIComponent(state)}&nonce=${encodeURIComponent(nonce)}`,
    };
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
  accessToken: string;
  scopes: string[];
};
async function exchange(provider: string, code: string, verifier: string): Promise<ProviderIdentity> {
  if (provider === "DISCORD_SIMULATOR") {
    const match = /^sim:([a-zA-Z0-9_-]{3,80}):(.{1,80})$/.exec(code);
    if (!match) throw new ProfileError("Simulator code is invalid.");
    return {
      accountId: match[1],
      displayName: match[2].trim(),
      accessToken: `simulated:${match[1]}:${verifier.slice(0, 12)}`,
      scopes: ["identify"],
    };
  }
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
      code_verifier: verifier,
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

export async function completeProviderLink(input: {
  accountId: string;
  provider: string;
  state: string;
  nonce: string;
  code: string;
}) {
  const attempt = await db.providerLinkAttempt.findFirst({
    where: {
      accountId: input.accountId,
      provider: input.provider,
      stateHash: hash(input.state),
      nonceHash: hash(input.nonce),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!attempt) throw new ProfileError("Provider link state is invalid or expired.", "FORBIDDEN");
  const identity = await exchange(input.provider, input.code, attempt.pkceVerifier);
  try {
    const linked = await db.$transaction(async (tx) => {
      const existing = await tx.externalIdentity.findUnique({
        where: { provider_providerAccountId: { provider: input.provider, providerAccountId: identity.accountId } },
      });
      if (existing && existing.accountId !== input.accountId)
        throw new ProfileError("That provider identity is already linked to another account.", "CONFLICT");
      const record = existing
        ? await tx.externalIdentity.update({
            where: { id: existing.id },
            data: {
              providerDisplayName: identity.displayName,
              avatarReference: identity.avatarReference,
              allowedScopes: JSON.stringify(identity.scopes),
              encryptedToken: encryptProviderToken(identity.accessToken),
              status: "LINKED",
              revokedAt: null,
              lastVerifiedAt: new Date(),
              refreshedAt: new Date(),
            },
          })
        : await tx.externalIdentity.create({
            data: {
              accountId: input.accountId,
              provider: input.provider,
              providerAccountId: identity.accountId,
              providerDisplayName: identity.displayName,
              avatarReference: identity.avatarReference,
              allowedScopes: JSON.stringify(identity.scopes),
              encryptedToken: encryptProviderToken(identity.accessToken),
              lastVerifiedAt: new Date(),
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
