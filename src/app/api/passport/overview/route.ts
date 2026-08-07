import { NextResponse } from "next/server";
import { passportOverview } from "@/homeport/personal-harbor";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json(await passportOverview(session.accountId, session.account.profile.id), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
