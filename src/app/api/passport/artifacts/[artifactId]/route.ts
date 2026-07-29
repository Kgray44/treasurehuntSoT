import { NextResponse } from "next/server";
import { requireWayfarerAccount } from "@/wayfarer/http";
import { personalArtifactDetail, personalizeArtifact } from "@/wayfarer/artifacts";

export async function GET(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  const result = await personalArtifactDetail(session.account.profile.id, (await context.params).artifactId);
  return result ? NextResponse.json(result, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Artifact not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ artifactId: string }> }) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile) return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  const result = await personalizeArtifact(session.account.profile.id, (await context.params).artifactId, await request.json());
  return result ? NextResponse.json(result, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Artifact not found." }, { status: 404 });
}
