import { NextResponse } from "next/server";
import { revokeAllAccountSessions } from "@/wayfarer/accounts";
import { clearProductIdentityCookies, requireWayfarerAccount } from "@/wayfarer/http";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  await revokeAllAccountSessions(session.accountId);
  await clearProductIdentityCookies();
  return NextResponse.json({ ok: true });
}
