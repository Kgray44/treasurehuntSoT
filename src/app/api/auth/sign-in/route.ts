import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { authenticateAccount } from "@/wayfarer/accounts";
import { setWayfarerRoleCookie } from "@/wayfarer/http";

const schema = z.object({ login: z.string().trim().min(1).max(254), password: z.string().min(1).max(256) });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Enter your email or legacy Player name and password." }, { status: 400 });
  const rate = consumeRateLimit(
    `wayfarer-login:${hashToken(`${request.headers.get("x-forwarded-for") ?? "local"}:${parsed.data.login.toLowerCase()}`)}`,
    { limit: 6, windowMs: 15 * 60_000 },
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const result = await authenticateAccount(
    parsed.data.login,
    parsed.data.password,
    request.headers.get("user-agent") ?? undefined,
  );
  if (!result || !result.account.profile)
    return NextResponse.json({ error: "Those credentials were not accepted." }, { status: 401 });
  const roles = result.account.roles.map((role) => role.role);
  await setWayfarerRoleCookie(result.session.token, roles);
  return NextResponse.json({
    ok: true,
    csrfToken: result.session.csrfToken,
    player: { id: result.account.profile.id, displayName: result.account.profile.displayName },
    roles,
  });
}
