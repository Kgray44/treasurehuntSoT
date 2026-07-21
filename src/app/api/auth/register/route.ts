import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, registerAccount } from "@/wayfarer/accounts";
import { setWayfarerCookie } from "@/wayfarer/http";

const schema = z.object({ email: z.string().max(254), password: z.string().max(256), displayName: z.string().max(80) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Enter an email, password, and display name." }, { status: 400 });
  try {
    const result = await registerAccount({
      ...parsed.data,
      deviceLabel: request.headers.get("user-agent") ?? undefined,
    });
    await setWayfarerCookie(result.session.token);
    return NextResponse.json(
      {
        ok: true,
        csrfToken: result.session.csrfToken,
        player: { id: result.account.profile.id, displayName: result.account.profile.displayName },
      },
      { status: 201 },
    );
  } catch (cause) {
    const error =
      cause instanceof AccountError ? cause : new AccountError("Account registration is unavailable.", "UNAVAILABLE");
    return NextResponse.json({ error: error.message }, { status: error.code === "CONFLICT" ? 409 : 400 });
  }
}
