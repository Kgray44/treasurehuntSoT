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

export async function requireWayfarerVerification(request?: Request) {
  const token = (await cookies()).get(WAYFARER_COOKIE)?.value;
  if (!token) return null;
  const session = await currentAccount(token, ["VERIFICATION", "ORDINARY"]);
  if (
    !session ||
    session.account.status !== "PENDING_VERIFICATION" ||
    (request && !safeEqual(session.csrfToken, request.headers.get("x-csrf-token") ?? ""))
  )
    return null;
  return session;
}

export async function setWayfarerCookie(token: string) {
  const jar = await cookies();
  jar.set(WAYFARER_COOKIE, token, wayfarerCookieOptions);
  jar.delete("forever_gm");
  jar.delete("chronicle_player");
}

export async function setWayfarerRoleCookie(token: string, roles: string[]) {
  await setWayfarerCookie(token);
  // Homeport Phase 1: role assignment is server-owned AccountSession context.
  // Keep the argument for response-shape compatibility, but stop minting a
  // second staff cookie for ordinary account sign-in.
  void roles;
  (await cookies()).delete("forever_gm");
}

export async function clearWayfarerCookie() {
  (await cookies()).delete(WAYFARER_COOKIE);
}

export async function clearProductIdentityCookies() {
  const jar = await cookies();
  jar.delete(WAYFARER_COOKIE);
  jar.delete("forever_gm");
  jar.delete("chronicle_player");
}
