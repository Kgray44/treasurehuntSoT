import { NextResponse } from "next/server";
import { z } from "zod";
import { safeReturnTo } from "@/homeport/return-to";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { AccountError, createAccountSession, revokeAccountSession, verifyAccountEmail } from "@/wayfarer/accounts";
import { requireWayfarerVerification, setWayfarerCookie } from "@/wayfarer/http";

const schema = z.object({ code: z.string().regex(/^\d{6}$/u), returnTo: z.string().max(2048).optional() });
export async function POST(request: Request) {
  const session = await requireWayfarerVerification(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!session || !parsed.success)
    return NextResponse.json(
      { error: "Verification details are invalid.", codeState: "CODE_INVALID" },
      { status: 400 },
    );
  const rate = consumeRateLimit(`wayfarer-verify:${session.accountId}`, { limit: 8, windowMs: 10 * 60_000 });
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Verification is temporarily rate limited.", codeState: "CODE_RATE_LIMITED" },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  try {
    await verifyAccountEmail(session.accountId, parsed.data.code);
    const replacement = await createAccountSession(
      session.accountId,
      request.headers.get("user-agent") ?? undefined,
      "ORDINARY",
    );
    await revokeAccountSession(session.accountId, session.id);
    await setWayfarerCookie(replacement.token);
    return NextResponse.json({
      ok: true,
      codeState: "EMAIL_VERIFIED",
      csrfToken: replacement.csrfToken,
      next: safeReturnTo(parsed.data.returnTo, "/passport"),
    });
  } catch (cause) {
    const message = cause instanceof AccountError ? cause.message : "Verification is unavailable.";
    return NextResponse.json(
      {
        error: message,
        codeState: message.includes("expired")
          ? "CODE_EXPIRED"
          : message.includes("Too many")
            ? "CODE_RATE_LIMITED"
            : "CODE_INVALID",
      },
      { status: 400 },
    );
  }
}
