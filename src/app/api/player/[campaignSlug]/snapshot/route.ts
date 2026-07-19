import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/security";
import { buildPublicSnapshot } from "@/lib/snapshot";

export async function GET(request: Request, context: { params: Promise<{ campaignSlug: string }> }) {
  const { campaignSlug } = await context.params;
  const access = await requirePlayer(campaignSlug);
  if (!access) return NextResponse.json({ error: "Invitation required." }, { status: 401 });
  const requestedBoundary = new URL(request.url).searchParams.get("offlineAfterSequence");
  const offlineAfterSequence = requestedBoundary === null ? undefined : Number(requestedBoundary);
  const synchronization =
    Number.isSafeInteger(offlineAfterSequence) && offlineAfterSequence! >= 0
      ? { offlineAfterSequence, synchronizedAt: new Date() }
      : undefined;
  return NextResponse.json(await buildPublicSnapshot(access.campaignId, access.id, synchronization), {
    headers: { "Cache-Control": "no-store, private" },
  });
}
