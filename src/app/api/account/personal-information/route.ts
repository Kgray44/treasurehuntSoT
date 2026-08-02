import { NextResponse } from "next/server";
import { personalInformation } from "@/homeport/personal-harbor";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const result = await personalInformation(session.accountId);
  return result
    ? NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
    : NextResponse.json({ error: "Account not found." }, { status: 404 });
}
