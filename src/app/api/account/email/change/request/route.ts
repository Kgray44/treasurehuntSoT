import { NextResponse } from "next/server";
import { z } from "zod";
import { accountApiError } from "@/wayfarer/account-api-error";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { normalizeEmail, requestEmailChange } from "@/wayfarer/accounts";
import { requireWayfarerAccount } from "@/wayfarer/http";

const schema = z.object({ password: z.string().min(1).max(256), email: z.string().trim().min(3).max(254) }).strict();

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  try {
    const input = schema.parse(await request.json());
    const rate = consumeRateLimit(
      `wayfarer-email-change:${session.accountId}:${hashToken(normalizeEmail(input.email))}`,
      { limit: 3, windowMs: 60 * 60_000 },
    );
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Wait before requesting another email change." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    await requestEmailChange(session.accountId, input.password, input.email);
    return NextResponse.json({ ok: true, message: "Check the new address to verify this email change." });
  } catch (cause) {
    return accountApiError(cause);
  }
}
