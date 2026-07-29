import { NextResponse } from "next/server";
import { removeArtifactCase, saveArtifactCase } from "@/wayfarer/artifacts";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function PATCH(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  try { const result = await saveArtifactCase(session.account.profile.id, await request.json(), (await context.params).caseId); return result ? NextResponse.json(result) : NextResponse.json({ error: "Display case not found." }, { status: 404 }); } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Invalid display case." }, { status: 400 }); }
}
export async function DELETE(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  return (await removeArtifactCase(session.account.profile.id, (await context.params).caseId)) ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "Display case not found." }, { status: 404 });
}
