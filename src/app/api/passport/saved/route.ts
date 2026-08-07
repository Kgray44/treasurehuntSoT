import { NextResponse } from "next/server";
import { listSavedContent } from "@/homeport/personal-harbor";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET() {
  const session = await requireWayfarerAccount();
  if (!session) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  return NextResponse.json(await listSavedContent(session.accountId), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
