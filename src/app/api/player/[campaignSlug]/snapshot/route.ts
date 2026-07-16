import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/security";
import { buildPublicSnapshot } from "@/lib/snapshot";

export async function GET(_: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params; const access = await requirePlayer(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  return NextResponse.json(await buildPublicSnapshot(access.campaignId), { headers: { "Cache-Control": "no-store, private" } });
}
