import { NextResponse } from "next/server";
import { replaceArtifactCaseItems } from "@/wayfarer/artifacts";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function PUT(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  try { const body = await request.json(); const result = await replaceArtifactCaseItems(session.account.profile.id, (await context.params).caseId, body.artifactRecordIds); return result ? NextResponse.json(result) : NextResponse.json({ error: "Display case not found." }, { status: 404 }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid display items." }, { status: 400 }); }
}
