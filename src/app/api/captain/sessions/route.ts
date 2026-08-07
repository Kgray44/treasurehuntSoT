import { NextResponse } from "next/server";
import { requireCaptainWorkspace } from "@/chronicle/captain-authorization";
import { listCaptainSessions } from "@/chronicle/progression";
import { db } from "@/lib/db";

export async function GET() {
  const session = await requireCaptainWorkspace();
  if (!session)
    return NextResponse.json({ error: "Sign in to Captain's Console to view active Voyages." }, { status: 401 });
  const tales = await db.chronicle.findMany({
    where: {
      archivedAt: null,
      latestPublishedVersionId: { not: null },
      OR: [{ creatorAccountId: session.accountId }, { visibility: "PUBLIC" }],
    },
    orderBy: { title: "asc" },
    select: { id: true, slug: true, title: true, status: true, visibility: true },
  });
  const actor = { accountId: session.accountId, legacyGameMasterId: session.account.legacyGameMasterId };
  return NextResponse.json({
    csrfToken: session.csrfToken,
    sessions: await listCaptainSessions(actor),
    tales,
  });
}
