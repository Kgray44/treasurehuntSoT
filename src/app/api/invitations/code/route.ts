import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { setPendingInvitationToken } from "@/platform/auth";
import { invitationCredentialForCode, resolveInvitation } from "@/platform/invitations";

const schema = z.object({ code: z.string().min(6).max(20) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter the invitation code." }, { status: 400 });
  const fingerprint = hashToken(`${request.headers.get("x-forwarded-for") ?? "local"}:invitation-code`);
  const rate = consumeRateLimit(`invitation-code:${fingerprint}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many invitation attempts. Wait before trying again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  const credential = invitationCredentialForCode(parsed.data.code);
  try {
    await resolveInvitation(credential, false);
    const csrfToken = await setPendingInvitationToken(credential);
    return NextResponse.json({ ok: true, csrfToken, next: "/player/invitation" });
  } catch {
    return NextResponse.json({ error: "This invitation is not available." }, { status: 404 });
  }
}
