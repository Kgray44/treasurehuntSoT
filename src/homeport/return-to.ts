import { capabilityAllowed, type AuthenticatedCurrentUser, type HomeportCapability } from "./current-user";

const maximumReturnLength = 2048;
const dangerousEncoding = /%(?:00|0[1-9a-f]|1[0-9a-f]|25|2f|3a|5c)/iu;
const controlCharacter = /[\u0000-\u001f\u007f]/u;

export function safeReturnTo(value: string | null | undefined, fallback = "/") {
  if (!value || value.length > maximumReturnLength || controlCharacter.test(value) || value.includes("\\"))
    return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || dangerousEncoding.test(value)) return fallback;
  try {
    const resolved = new URL(value, "https://voyagewright.invalid");
    if (resolved.origin !== "https://voyagewright.invalid" || !resolved.pathname.startsWith("/")) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

export function signInHref(returnTo: string, reason?: "auth-required" | "expired" | "revoked" | "invalid") {
  const query = new URLSearchParams({ returnTo: safeReturnTo(returnTo) });
  if (reason && reason !== "auth-required") query.set("reason", reason);
  return `/sign-in?${query.toString()}`;
}

export function capabilityForReturnTo(path: string): HomeportCapability | "authenticated" | null {
  if (path.startsWith("/community/moderation")) return "moderator";
  if (path.startsWith("/captain")) return "captain";
  if (path.startsWith("/studio")) return "creator";
  if (path.startsWith("/player") || path.startsWith("/passport") || path.startsWith("/profile")) return "player";
  if (path.startsWith("/account")) return "authenticated";
  return null;
}

export function authorizedReturnTo(
  value: string | null | undefined,
  context: AuthenticatedCurrentUser,
  fallback = "/",
) {
  const path = safeReturnTo(value, fallback);
  const required = capabilityForReturnTo(path);
  if (!required || required === "authenticated" || capabilityAllowed(context, required)) return path;
  return fallback;
}
