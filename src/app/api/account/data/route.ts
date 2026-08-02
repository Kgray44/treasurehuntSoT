import { NextResponse } from "next/server";
import { accountDataAvailability } from "@/homeport/personal-harbor";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json(accountDataAvailability(), { headers: { "Cache-Control": "private, no-store" } });
}
