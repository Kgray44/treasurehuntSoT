import { cookies } from "next/headers";
import { safeEqual } from "@/lib/security";
import { currentAccount } from "@/wayfarer/accounts";

export const WAYFARER_COOKIE = "wayfarer_account";

export const wayfarerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function requireWayfarerAccount(request?: Request) {
  const token = (await cookies()).get(WAYFARER_COOKIE)?.value;
  if (!token) return null;
  const session = await currentAccount(token);
  if (!session || (request && !safeEqual(session.csrfToken, request.headers.get("x-csrf-token") ?? ""))) return null;
  return session;
}

export async function setWayfarerCookie(token: string) {
  (await cookies()).set(WAYFARER_COOKIE, token, wayfarerCookieOptions);
}

export async function setWayfarerRoleCookie(token: string, roles: string[]) {
  await setWayfarerCookie(token);
  if (roles.some((role) => ["CAPTAIN", "CREATOR", "MODERATOR", "ADMINISTRATOR"].includes(role)))
    (await cookies()).set("forever_gm", token, { ...wayfarerCookieOptions, sameSite: "strict", maxAge: 60 * 60 * 10 });
}

export async function clearWayfarerCookie() {
  (await cookies()).delete(WAYFARER_COOKIE);
}
