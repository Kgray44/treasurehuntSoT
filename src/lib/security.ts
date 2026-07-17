import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

const PLAYER_COOKIE = "forever_player";
const GM_COOKIE = "forever_gm";
const sessionAge = 1000 * 60 * 60 * 10;

export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
export const makeToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function setPlayerSession(playerAccessId: string) {
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, playerAccessId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function requirePlayer(campaignSlug: string) {
  const jar = await cookies();
  const id = jar.get(PLAYER_COOKIE)?.value;
  if (!id) return null;
  return db.playerAccess.findFirst({
    where: { id, campaign: { slug: campaignSlug }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { campaign: true },
  });
}

export async function createGmSession(userId: string) {
  const id = makeToken();
  const csrfToken = makeToken(24);
  await db.gameMasterSession.create({
    data: { id: hashToken(id), userId, csrfToken, expiresAt: new Date(Date.now() + sessionAge) },
  });
  const jar = await cookies();
  jar.set(GM_COOKIE, id, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionAge / 1000,
  });
  return csrfToken;
}

export async function requireGm() {
  const raw = (await cookies()).get(GM_COOKIE)?.value;
  if (!raw) return null;
  return db.gameMasterSession.findFirst({
    where: { id: hashToken(raw), expiresAt: { gt: new Date() } },
    include: { user: true },
  });
}

export type GmCapability = "CAPTAIN" | "CREATE_TALES" | "PUBLISH_TALES" | "MANAGE_ASSETS";

const roleCapabilities: Record<string, GmCapability[]> = {
  CAPTAIN: ["CAPTAIN"],
  CREATOR: ["CREATE_TALES", "MANAGE_ASSETS"],
  PUBLISHER: ["CREATE_TALES", "PUBLISH_TALES", "MANAGE_ASSETS"],
  CAPTAIN_CREATOR: ["CAPTAIN", "CREATE_TALES", "PUBLISH_TALES", "MANAGE_ASSETS"],
};

export function gmCan(user: { role: string; capabilities: string }, capability: GmCapability) {
  let explicit: string[] = [];
  try {
    const parsed = JSON.parse(user.capabilities);
    if (Array.isArray(parsed)) explicit = parsed.filter((item): item is string => typeof item === "string");
  } catch {}
  return roleCapabilities[user.role]?.includes(capability) || explicit.includes(capability);
}

export async function requireGmCapability(capability: GmCapability) {
  const session = await requireGm();
  return session && gmCan(session.user, capability) ? session : null;
}

export async function verifyCsrf(session: { csrfToken: string }) {
  const provided = (await headers()).get("x-csrf-token") ?? "";
  return safeEqual(provided, session.csrfToken);
}

export async function clearGmSession() {
  const jar = await cookies();
  const raw = jar.get(GM_COOKIE)?.value;
  if (raw) await db.gameMasterSession.deleteMany({ where: { id: hashToken(raw) } });
  jar.delete(GM_COOKIE);
}
