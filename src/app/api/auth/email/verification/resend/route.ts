import { NextResponse } from "next/server";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { resendVerification } from "@/wayfarer/accounts";
import { requireWayfarerAccount } from "@/wayfarer/http";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const rate = consumeRateLimit(`wayfarer-resend:${session.accountId}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait before requesting another verification email." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  await resendVerification(session.accountId);
  return NextResponse.json({ ok: true });
}
