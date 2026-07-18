import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireGm, verifyCsrf } from "@/lib/security";
import { requirePlayerIdentity, verifyPlayerCsrf } from "@/platform/auth";
import {
  normalizeApplicationTheme,
  parseApplicationPreferences,
  themePreferenceInputSchema,
  type ThemePreferenceScope,
} from "@/theme/theme";

export async function GET(request: Request) {
  const scope = requestedScope(request);
  if (scope === "staff") {
    const session = await requireGm();
    if (!session) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
    return NextResponse.json({
      theme: normalizeApplicationTheme(parseApplicationPreferences(session.user.preferences).theme),
      scope,
      csrfToken: session.csrfToken,
    });
  }
  if (scope === "player") {
    const session = await requirePlayerIdentity();
    if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
    return NextResponse.json({
      theme: normalizeApplicationTheme(parseApplicationPreferences(session.player.preferences).theme),
      scope,
      csrfToken: session.csrfToken,
    });
  }
  return NextResponse.json({ theme: "verdant-depths", scope: "anonymous" });
}

export async function POST(request: Request) {
  const parsed = themePreferenceInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid theme preference." }, { status: 400 });
  const { scope, theme } = parsed.data;
  if (scope === "staff") {
    const session = await requireGm();
    if (!session) return NextResponse.json({ error: "Staff sign-in required." }, { status: 401 });
    if (!(await verifyCsrf(session)))
      return NextResponse.json({ error: "The staff session expired." }, { status: 403 });
    const preferences = parseApplicationPreferences(session.user.preferences);
    await db.gameMasterUser.update({
      where: { id: session.userId },
      data: { preferences: JSON.stringify({ ...preferences, theme }) },
    });
    return NextResponse.json({ theme, scope, persisted: true });
  }
  const session = await requirePlayerIdentity();
  if (!session) return NextResponse.json({ error: "Player sign-in required." }, { status: 401 });
  if (!(await verifyPlayerCsrf(request.headers.get("x-csrf-token"))))
    return NextResponse.json({ error: "The Player session expired." }, { status: 403 });
  const preferences = parseApplicationPreferences(session.player.preferences);
  await db.playerProfile.update({
    where: { id: session.playerProfileId },
    data: { preferences: JSON.stringify({ ...preferences, theme }) },
  });
  return NextResponse.json({ theme, scope, persisted: true });
}

function requestedScope(request: Request): ThemePreferenceScope {
  const value = new URL(request.url).searchParams.get("scope");
  return value === "player" || value === "staff" ? value : "anonymous";
}
