import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { listPersonalArtifacts, materializePersonalArtifacts } from "@/wayfarer/artifacts";

export async function GET(request: Request) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 24);
  const result = await listPersonalArtifacts(session.account.profile.id, { search: url.searchParams.get("search") ?? undefined, state: url.searchParams.get("state") ?? undefined, status: url.searchParams.get("status") ?? undefined, cursor: url.searchParams.get("cursor") ?? undefined, favorite: url.searchParams.get("favorite") === "true", sort: url.searchParams.get("sort") ?? undefined, limit: Number.isFinite(limit) ? limit : 24 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  return NextResponse.json(await materializePersonalArtifacts(session.account.profile.id), { headers: { "Cache-Control": "no-store" } });
}
