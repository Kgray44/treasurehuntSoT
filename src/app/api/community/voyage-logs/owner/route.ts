import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCanonicalAccountIdentity } from "@/platform/auth";

/** Owner-only, no-store draft inventory. It deliberately excludes source/session and storage identity. */
export async function GET() {
  const identity = await requireCanonicalAccountIdentity();
  if (!identity) return NextResponse.json({ code: "COMMUNITY_ACCESS_DENIED", error: "Sign in to view Voyage Logs." }, { status: 401 });
  const logs = await db.communityVoyageLog.findMany({
    where: { ownerAccountId: identity.accountId }, orderBy: { updatedAt: "desc" }, take: 100,
    select: { id: true, slug: true, title: true, visibility: true, lifecycleState: true, consentRevision: true, publishedAt: true, updatedAt: true },
  });
  return NextResponse.json({ logs }, { headers: { "Cache-Control": "private, no-store" } });
}
