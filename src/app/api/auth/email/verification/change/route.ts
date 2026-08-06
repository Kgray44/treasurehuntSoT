import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AccountError, changePendingVerificationEmail } from "@/wayfarer/accounts";
import { requireWayfarerVerification } from "@/wayfarer/http";

const schema = z.object({ email: z.string().trim().min(3).max(254) });

export async function POST(request: Request) {
  const session = await requireWayfarerVerification(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const rate = consumeRateLimit(`wayfarer-verification-email-change:${session.accountId}`, {
    limit: 4,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait before changing the registration email again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  try {
    const result = await changePendingVerificationEmail(session.accountId, parsed.data.email);
    return NextResponse.json({ ok: true, codeState: "CODE_REPLACED", cooldownSeconds: 60, ...result });
  } catch (cause) {
    const error =
      cause instanceof AccountError ? cause : new AccountError("Verification delivery is unavailable.", "UNAVAILABLE");
    return NextResponse.json(
      { error: error.message, codeState: error.code === "UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : "CODE_INVALID" },
      { status: error.code === "CONFLICT" ? 409 : error.code === "UNAVAILABLE" ? 503 : 400 },
    );
  }
}
