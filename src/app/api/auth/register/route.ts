import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, maskEmailAddress, registerAccount } from "@/wayfarer/accounts";
import { safeReturnTo } from "@/homeport/return-to";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { hashToken } from "@/lib/security";
import { setWayfarerCookie } from "@/wayfarer/http";

const schema = z.object({
  email: z.string().max(254),
  password: z.string().max(256),
  confirmPassword: z.string().max(256),
  displayName: z.string().max(80),
  returnTo: z.string().max(2048).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Enter an email, password, and display name." }, { status: 400 });
  const rate = consumeRateLimit(
    `wayfarer-register:${hashToken(`${request.headers.get("x-forwarded-for") ?? "local"}:${parsed.data.email.toLowerCase()}`)}`,
    { limit: 5, windowMs: 60 * 60_000 },
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Wait before trying to create this account again." },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  try {
    const { returnTo, ...accountInput } = parsed.data;
    const result = await registerAccount({
      ...accountInput,
      deviceLabel: request.headers.get("user-agent") ?? undefined,
    });
    await setWayfarerCookie(result.session.token);
    const destination = new URLSearchParams();
    const safeDestination = safeReturnTo(returnTo, "");
    if (safeDestination) destination.set("returnTo", safeDestination);
    if (result.deliveryState === "FAILED") destination.set("delivery", "failed");
    return NextResponse.json(
      {
        ok: true,
        verificationRequired: true,
        registrationState: result.deliveryState === "FAILED" ? "ACCOUNT_CREATED_DELIVERY_FAILED" : "READY_TO_VERIFY",
        ...(result.deliveryState === "FAILED"
          ? { message: "Your account was created, but we could not send the verification email." }
          : {}),
        csrfToken: result.session.csrfToken,
        player: { id: result.account.profile.id, displayName: result.account.profile.displayName },
        maskedEmail: maskEmailAddress(accountInput.email),
        next: `/verify-email${destination.size ? `?${destination.toString()}` : ""}`,
      },
      { status: 201 },
    );
  } catch (cause) {
    const error =
      cause instanceof AccountError ? cause : new AccountError("Account registration is unavailable.", "UNAVAILABLE");
    return NextResponse.json(
      {
        error: error.message,
        ...(error.kind ? { conflict: error.kind } : {}),
        ...(error.field ? { field: error.field } : {}),
        ...(error.kind === "EMAIL_CONFLICT"
          ? {
              handoff: {
                destination: "/sign-in",
                email: parsed.data.email.trim(),
                forgotPassword: "/forgot-password",
              },
            }
          : {}),
        ...(error.code === "UNAVAILABLE" ? { registrationState: "PROVIDER_UNAVAILABLE" } : {}),
      },
      { status: error.code === "CONFLICT" ? 409 : error.code === "UNAVAILABLE" ? 503 : 400 },
    );
  }
}
