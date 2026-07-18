import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { signInPlayer } from "@/platform/auth";
import { writePlatformAudit } from "@/platform/audit";

const schema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(4).max(256) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your Player name and password." }, { status: 400 });
  const fingerprint = hashToken(
    `${request.headers.get("x-forwarded-for") ?? "local"}:${parsed.data.username.toLowerCase()}`,
  );
  const rate = consumeRateLimit(`platform-player-login:${fingerprint}`, { limit: 6, windowMs: 15 * 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many sign-in attempts. Wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const result = await signInPlayer(parsed.data.username, parsed.data.password);
  await writePlatformAudit({
    actorType: result ? "PLAYER" : "ANONYMOUS",
    actorId: result?.player.id,
    action: result ? "PLAYER_SIGN_IN" : "PLAYER_SIGN_IN_FAILED",
    resourceType: "PLAYER_PROFILE",
    resourceId: result?.player.id ?? fingerprint.slice(0, 12),
    outcome: result ? "SUCCEEDED" : "DENIED",
  });
  if (!result) return NextResponse.json({ error: "Those Player credentials were not accepted." }, { status: 401 });
  return NextResponse.json({
    ok: true,
    csrfToken: result.csrfToken,
    player: { id: result.player.id, displayName: result.player.displayName },
  });
}
