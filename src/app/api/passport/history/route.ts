import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { listChronicleHistory, materializeChronicleHistory } from "@/wayfarer/chronicle-history";

export async function GET(request: Request) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  const url = new URL(request.url);
  return NextResponse.json(
    await listChronicleHistory(session.account.profile.id, {
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 20),
      status: url.searchParams.get("status") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    }),
  );
}

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 403 });
  return NextResponse.json(await materializeChronicleHistory(session.account.profile.id));
}
