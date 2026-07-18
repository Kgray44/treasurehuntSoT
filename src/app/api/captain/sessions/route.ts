import { NextResponse } from "next/server";
import { requireGmCapability } from "@/lib/security";
import { listCaptainSessions } from "@/tall-tale/progression";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireGmCapability("CAPTAIN");
  if (!session) return NextResponse.json({ error: "Captain authentication required." }, { status: 401 });
  const tales = await db.tallTale.findMany({
    where: { archivedAt: null, latestPublishedVersionId: { not: null } },
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true, status: true, visibility: true },
  });
  return NextResponse.json({ csrfToken: session.csrfToken, sessions: await listCaptainSessions(), tales });
}
