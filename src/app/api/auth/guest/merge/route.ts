import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountError, authenticateAccount, createAccountSession, mergeGuestIntoAccount } from "@/wayfarer/accounts";
import { requireWayfarerAccount, setWayfarerCookie } from "@/wayfarer/http";
const schema = z.object({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
  confirm: z.literal(true),
});
export async function POST(request: Request) {
  const guest = await requireWayfarerAccount(request);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!guest || !parsed.success)
    return NextResponse.json({ error: "Confirm the existing account before merging." }, { status: 400 });
  const target = await authenticateAccount(
    parsed.data.login,
    parsed.data.password,
    request.headers.get("user-agent") ?? undefined,
  );
  if (!target) return NextResponse.json({ error: "Those credentials were not accepted." }, { status: 401 });
  try {
    const merged = await mergeGuestIntoAccount(guest.accountId, target.account.id);
    const session = await createAccountSession(target.account.id, request.headers.get("user-agent") ?? undefined);
    await setWayfarerCookie(session.token);
    return NextResponse.json({
      ok: true,
      idempotent: merged.idempotent,
      csrfToken: session.csrfToken,
      player: target.account.profile
        ? { id: target.account.profile.id, displayName: target.account.profile.displayName }
        : null,
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof AccountError ? cause.message : "Guest merge is unavailable." },
      { status: 400 },
    );
  }
}
