import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publicArtifactProjection } from "@/wayfarer/artifacts";
import { normalizeHandle } from "@/wayfarer/profile";
import { requireWayfarerAccount } from "@/wayfarer/http";

export async function GET(request: Request, context: { params: Promise<{ handle: string }> }) {
  const session = await requireWayfarerAccount(); const handle = normalizeHandle((await context.params).handle);
  const profile = await db.playerProfile.findFirst({ where: { normalizedHandle: handle }, select: { id: true, accountId: true } });
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  const viewerProfileId = session?.account.profile?.id;
  const sharedCrew = viewerProfileId ? Boolean(await db.playthroughMembership.findFirst({ where: { playerProfileId: profile.id, status: { in: ["READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] }, playthrough: { memberships: { some: { playerProfileId: viewerProfileId, status: { in: ["READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"] } } } } }, select: { id: true } })) : false;
  return NextResponse.json(await publicArtifactProjection(profile.id, { owner: session?.accountId === profile.accountId, registered: Boolean(session), sharedCrew, unlistedCaseToken: new URL(request.url).searchParams.get("case") ?? undefined }), { headers: { "Cache-Control": "private, no-store" } });
}
