import { NextResponse } from "next/server";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AccountError, resendVerification } from "@/wayfarer/accounts";
import { requireWayfarerVerification } from "@/wayfarer/http";
export async function POST(request: Request) {
  const session = await requireWayfarerVerification(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const rate = consumeRateLimit(`wayfarer-resend:${session.accountId}`, { limit: 3, windowMs: 60 * 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait before requesting another verification email." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  try {
    await resendVerification(session.accountId);
    return NextResponse.json({ ok: true, codeState: "CODE_REPLACED", cooldownSeconds: 60 });
  } catch (cause) {
    const message = cause instanceof AccountError ? cause.message : "Verification delivery is unavailable.";
    return NextResponse.json(
      { error: message, codeState: message.includes("unavailable") ? "PROVIDER_UNAVAILABLE" : "CODE_RATE_LIMITED" },
      { status: message.includes("unavailable") ? 503 : 429 },
    );
  }
}
