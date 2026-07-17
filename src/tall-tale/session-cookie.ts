import { cookies } from "next/headers";

const COOKIE = "tall_tale_session";

export async function setTaleSessionCookie(sessionId: string, token: string) {
  (await cookies()).set(COOKIE, `${sessionId}.${token}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function readTaleSessionCookie(expectedSessionId?: string) {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const separator = raw.indexOf(".");
  if (separator < 1) return null;
  const sessionId = raw.slice(0, separator);
  const token = raw.slice(separator + 1);
  return !expectedSessionId || expectedSessionId === sessionId ? { sessionId, token } : null;
}
