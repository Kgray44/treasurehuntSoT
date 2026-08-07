import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { accountDataOverview } from "@/wayfarer/account-lifecycle";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json(await accountDataOverview(session.accountId), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
