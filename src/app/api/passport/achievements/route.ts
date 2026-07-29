import { NextResponse } from "next/server";
import { evaluateAchievements, listPersonalArtifacts } from "@/wayfarer/artifacts";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(_request: Request) {
  const session = await requireWayfarerAccount();
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  return NextResponse.json((await listPersonalArtifacts(session.account.profile.id)).achievements, {
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(request: Request) {
  const session = await requireWayfarerAccount(request);
  if (!session?.account.profile)
    return NextResponse.json({ error: "A valid signed-in session is required." }, { status: 401 });
  return NextResponse.json(await evaluateAchievements(session.account.profile.id));
}
