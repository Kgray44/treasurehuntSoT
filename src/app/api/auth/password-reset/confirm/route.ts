import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, resetPassword } from "@/wayfarer/accounts";
import { setWayfarerCookie } from "@/wayfarer/http";
import { safeReturnTo } from "@/homeport/return-to";

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().max(256),
  returnTo: z.string().max(2048).optional(),
});
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Reset details are invalid." }, { status: 400 });
  try {
    const session = await resetPassword(parsed.data.token, parsed.data.password);
    await setWayfarerCookie(session.token);
    return NextResponse.json({
      ok: true,
      csrfToken: session.csrfToken,
      next: safeReturnTo(parsed.data.returnTo, "/passport"),
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof AccountError ? cause.message : "Password reset is unavailable." },
      { status: 400 },
    );
  }
}
