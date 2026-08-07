import { NextResponse } from "next/server";
import { revokeAccountSession } from "@/wayfarer/accounts";
import { clearProductIdentityCookies, requireWayfarerAccount } from "@/wayfarer/http";
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (session) await revokeAccountSession(session.accountId, session.id);
  await clearProductIdentityCookies();
  return NextResponse.json({ ok: true });
}
