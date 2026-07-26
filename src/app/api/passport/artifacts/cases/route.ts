import { NextResponse } from "next/server";
import { listArtifactCases, saveArtifactCase } from "@/wayfarer/artifacts";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(_request: Request) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  return NextResponse.json(await listArtifactCases(session.account.profile.id), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  try { return NextResponse.json(await saveArtifactCase(session.account.profile.id, await request.json())); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid display case." }, { status: 400 }); }
}
