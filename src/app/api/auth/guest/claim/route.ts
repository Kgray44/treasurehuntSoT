import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, claimGuestAccount } from "@/wayfarer/accounts";
import { requireWayfarerAccount } from "@/wayfarer/http";
const schema = z.object({ email: z.string().max(254), password: z.string().max(256) });
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!session || !parsed.success)
    return NextResponse.json({ error: "Guest claim details are invalid." }, { status: 400 });
  try {
    await claimGuestAccount({ accountId: session.accountId, ...parsed.data });
    return NextResponse.json({ ok: true, verificationRequired: true });
  } catch (cause) {
    const error =
      cause instanceof AccountError ? cause : new AccountError("Guest claim is unavailable.", "UNAVAILABLE");
    return NextResponse.json({ error: error.message }, { status: error.code === "CONFLICT" ? 409 : 400 });
  }
}
